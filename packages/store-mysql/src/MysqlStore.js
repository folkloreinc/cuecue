import mysql from 'mysql2';
import StateMachine from 'javascript-state-machine';
import EventEmitter from 'wolfy87-eventemitter';
import createDebug from 'debug';
import isObject from 'lodash/isObject';
import { parseStoreInputId, parseStoreOutputId } from '@cuecue/core';
import {
    now,
    getParams,
    getInsertFields,
    getUpdateFields,
    getResult,
    getResults,
    splitExtra,
} from './utils';

const debug = createDebug('cuecue:store:mysql');

class MysqlStore extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.options = {
            host: process.env.MYSQL_HOST || 'localhost',
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DB,
            port: process.env.MYSQL_PORT,
            autoConnect: false,
            // One connection keeps the queries in order, as before. The pool replaces it when it is
            // lost.
            connectionLimit: 1,
            ...opts,
        };

        debug(this.options);

        this.onInit = this.onInit.bind(this);
        this.onInitialized = this.onInitialized.bind(this);
        this.onDestroy = this.onDestroy.bind(this);
        this.onDestroyed = this.onDestroyed.bind(this);
        this.onConnect = this.onConnect.bind(this);
        this.onDisconnect = this.onDisconnect.bind(this);
        this.onConnected = this.onConnected.bind(this);
        this.onDisconnected = this.onDisconnected.bind(this);
        this.onInvalidTransition = this.onInvalidTransition.bind(this);

        this.client = null;
        this.columns = {};

        this.state = new StateMachine({
            transitions: [
                { name: 'init', from: 'none', to: 'initialized' },
                { name: 'destroy', from: '*', to: 'none' },
                { name: 'connect', from: ['initialized', 'disconnected'], to: 'connected' },
                { name: 'disconnect', from: 'connected', to: 'disconnected' },
            ],
            methods: {
                onBeforeInit: this.onInit,
                onAfterInit: this.onInitialized,
                onBeforeDestroy: this.onDestroy,
                onAfterDestroy: this.onDestroyed,
                onBeforeConnect: this.onConnect,
                onAfterConnect: this.onConnected,
                onBeforeDisconnect: this.onDisconnect,
                onAfterDisconnect: this.onDisconnected,
                onInvalidTransition: this.onInvalidTransition,
            },
        });
    }

    async init() {
        await this.state.init();
        const { autoConnect } = this.options;
        if (autoConnect) {
            await this.connect();
        }
    }

    destroy() {
        return this.state.destroy();
    }

    connect() {
        return this.state.connect();
    }

    disconnect() {
        return this.state.disconnect();
    }

    initialized() {
        return this.state.is('initialized');
    }

    connected() {
        return this.state.is('connected');
    }

    disconnected() {
        return this.state.is('disconnected');
    }

    query(sql, values = []) {
        return new Promise((resolve, reject) => {
            this.client.query(sql, values, (error, results) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(results);
            });
        });
    }

    /**
     * The names of a table's columns, read once.
     */
    getColumns(type) {
        if (typeof this.columns[type] === 'undefined') {
            const columns = this.query(`SHOW COLUMNS FROM \`${type}\``).then(
                (results) => new Set(results.map(({ Field }) => Field)),
            );
            this.columns[type] = columns;
            columns.catch(() => {
                delete this.columns[type];
            });
        }
        return this.columns[type];
    }

    /**
     * Splits an item between the table's columns and its `extra` JSON column, for the fields
     * without a column of their own.
     */
    async splitItem(type, data) {
        const columns = await this.getColumns(type);
        const { own, extra } = splitExtra(data, columns);
        if (extra !== null && !columns.has('extra')) {
            throw new Error(
                `@cuecue/store-mysql: the ${type} table has no column for ${Object.keys(extra).join(
                    ', ',
                )}. Run the migrations to add its extra column.`,
            );
        }
        return { own, extra };
    }

    async findItem(type, externalId = null, internalId = null, withDeleted = false) {
        const idParams = isObject(externalId)
            ? externalId
            : {
                  ...(externalId !== null ? { externalId } : null),
                  ...(internalId !== null ? { internalId } : null),
              };
        const { where, values } = getParams(idParams, await this.getColumns(type));
        const results = await this.query(
            `SELECT * FROM ${type} WHERE ${where} ${
                withDeleted ? '' : 'AND ISNULL(deleted_at)'
            } LIMIT 1`,
            values,
        );
        const result = results !== null && results.length === 1 ? getResult(results[0]) : null;
        return parseStoreOutputId(result);
    }

    async addItem(type, data) {
        const parsedData = parseStoreInputId(data);
        const withCreated =
            parsedData !== null && !parsedData.created_at
                ? { ...parsedData, created_at: now() }
                : parsedData;
        const { own, extra } = await this.splitItem(type, withCreated);
        const { columns, fields, values } = getInsertFields(
            extra !== null ? { ...own, extra: JSON.stringify(extra) } : own,
        );
        const { insertId } = await this.query(
            `INSERT INTO ${type} (${columns}) VALUES(${fields})`,
            values,
        );
        return this.findItem(type, null, insertId);
    }

    addItems(type, items) {
        return Promise.all(items.map((it) => this.addItem(type, it)));
    }

    async updateItem(type, externalId, data) {
        const parsedData = parseStoreInputId(data);
        const { own, extra } = await this.splitItem(type, { ...parsedData, updated_at: now() });
        const { fields, values } = getUpdateFields(own);
        // The new fields of `extra` replace its old ones, and the others stay.
        const extraField =
            extra !== null
                ? ', `extra` = JSON_MERGE_PATCH(COALESCE(`extra`, JSON_OBJECT()), CAST(? AS JSON))'
                : '';
        await this.query(`UPDATE ${type} SET ${fields}${extraField} WHERE externalId = ?`, [
            ...values,
            ...(extra !== null ? [JSON.stringify(extra)] : []),
            externalId,
        ]);
        return this.findItem(type, externalId);
    }

    deleteItem(type, externalId) {
        return this.deleteItems(type, {
            externalId,
        });
    }

    async deleteItems(type, params = {}) {
        const { where, values } = getParams(params, await this.getColumns(type));
        return this.query(`UPDATE ${type} SET deleted_at = '${now()}' WHERE ${where}`, values);
    }

    async getItems(type, params = {}, withDeleted = false) {
        const { where, values } = getParams(params, await this.getColumns(type));
        const link = values.length > 0 ? `AND` : `WHERE`;
        const deleted = withDeleted ? '' : `${link} ISNULL(deleted_at)`;
        const results = await this.query(
            `SELECT * FROM ${type} ${values.length > 0 ? `WHERE ${where}` : ''} ${deleted}`,
            values,
        );
        return parseStoreOutputId(getResults(results));
    }

    async onInit() {
        this.client = this.createPool();
        this.emit('init');
    }

    createPool() {
        const { host, user, password, database, port, connectionLimit } = this.options;
        return mysql.createPool({
            host,
            user,
            password,
            database,
            port,
            connectionLimit,
        });
    }

    endPool() {
        const pool = this.client;
        this.client = null;
        // The migrations may change the columns before the next connection.
        this.columns = {};
        if (pool === null) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            pool.end((error) => {
                if (error) {
                    debug('end error %O', error);
                }
                resolve();
            });
        });
    }

    onInitialized() {
        debug('initialized');
        this.emit('initialized');
    }

    async onDestroy() {
        debug('destroying...');
        this.emit('destroy');
        await this.endPool();
    }

    onDestroyed() {
        debug('destroyed');
        return process.nextTick(() => this.emit('destroyed'));
    }

    onConnect() {
        debug('connecting...');
        this.emit('connect');

        if (this.client === null) {
            this.client = this.createPool();
        }

        // Checks that the database answers.
        return new Promise((resolve, reject) => {
            this.client.getConnection((err, connection) => {
                if (err) {
                    reject(err);
                    return;
                }
                connection.release();
                resolve();
            });
        });
    }

    onConnected() {
        debug('connected');
        return process.nextTick(() => this.emit('connected'));
    }

    onDisconnect() {
        this.emit('disconnect');
        return this.endPool();
    }

    onDisconnected() {
        debug('disconnected');

        return process.nextTick(() => this.emit('disconnected'));
    }

    onInvalidTransition(transition, from, to) {
        debug('ERROR: Invalid transition: %s from: %s to: %s', transition, from, to);
    }
}

export default MysqlStore;
