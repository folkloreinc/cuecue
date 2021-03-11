import mysql from 'mysql';
import StateMachine from 'javascript-state-machine';
import EventEmitter from 'wolfy87-eventemitter';
import createDebug from 'debug';
import isObject from 'lodash/isObject';
import { parseStoreInputId, parseStoreOutputId } from '@cuecue/core';
import { now, getParams, getInsertFields, getUpdateFields, getResult, getResults } from './utils';

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

    init() {
        return this.state.init();
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

    findItem(type, externalId = null, internalId = null) {
        return new Promise((resolve, reject) => {
            const idParams = isObject(externalId)
                ? externalId
                : {
                      ...(externalId !== null ? { externalId } : null),
                      ...(internalId !== null ? { internalId } : null),
                  };
            const { where, values } = getParams(idParams);
            this.client.query(
                `SELECT * FROM ${type} WHERE ${where} AND ISNULL(deleted_at) LIMIT 1`,
                values,
                (error, results) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    const result =
                        results !== null && results.length === 1 ? getResult(results[0]) : null;
                    resolve(parseStoreOutputId(result));
                },
            );
        });
    }

    addItem(type, data) {
        const parsedData = parseStoreInputId(data);
        const withCreated =
            parsedData !== null && !parsedData.created_at
                ? { ...parsedData, created_at: now() }
                : parsedData;
        const { columns, fields, values } = getInsertFields(withCreated);
        return new Promise((resolve, reject) => {
            this.client.query(
                `INSERT INTO ${type} (${columns}) VALUES(${fields})`,
                values,
                (error, results) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(results);
                },
            );
        }).then(({ insertId }) => this.findItem(type, null, insertId));
    }

    addItems(type, items) {
        return Promise.all(items.map((it) => this.addItem(type, it)));
    }

    updateItem(type, externalId, data) {
        const parsedData = parseStoreInputId(data);
        const withUpdated = { ...parsedData, updated_at: now() };
        return new Promise((resolve, reject) => {
            const { fields, values } = getUpdateFields(withUpdated);
            this.client.query(
                `UPDATE ${type} SET ${fields} WHERE externalId = ?`,
                [...values, externalId],
                (error, results) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(results);
                },
            );
        }).then(() => this.findItem(type, externalId));
    }

    deleteItem(type, externalId) {
        return this.deleteItems(type, {
            externalId,
        });
    }

    deleteItems(type, params = {}) {
        return new Promise((resolve, reject) => {
            const { where, values } = getParams(params);
            this.client.query(
                `UPDATE ${type} SET deleted_at = '${now()}' WHERE ${where}`,
                values,
                (error, results) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(results);
                },
            );
        });
    }

    getItems(type, params = {}) {
        return new Promise((resolve, reject) => {
            const { where, values } = getParams(params);
            this.client.query(
                `SELECT * FROM ${type} WHERE ${where} AND ISNULL(deleted_at)`,
                values,
                (error, results) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    const allResults = getResults(results);
                    resolve(parseStoreOutputId(allResults));
                },
            );
        });
    }

    async onInit() {
        const { host, user, password, database, port, autoConnect } = this.options;

        this.client = mysql.createConnection({
            host,
            user,
            password,
            database,
            port,
        });

        if (autoConnect) {
            this.connect();
        }

        this.emit('init');

        return Promise.resolve();
    }

    onInitialized() {
        debug('initialized');
        this.emit('initialized');
    }

    async onDestroy() {
        debug('destroying...');
        this.emit('destroy');

        await this.disconnect();

        if (this.client !== null) {
            return new Promise((resolve, reject) => {
                this.client.destroy((err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    this.client = null;
                    resolve();
                });
            });
        }
        return Promise.resolve();
    }

    onDestroyed() {
        debug('destroyed');
        return process.nextTick(() => this.emit('destroyed'));
    }

    onConnect() {
        debug('connecting...');
        this.emit('connect');

        return new Promise((resolve, reject) => {
            this.client.connect((err) => {
                if (err) {
                    reject(err);
                    return;
                }
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

        return new Promise((resolve, reject) => {
            this.client.end((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    onDisconnected() {
        debug('disconnected');

        return process.nextTick(() => this.emit('disconnected'));
    }

    onInvalidTransition(transition, from, to) {
        this.debug('ERROR: Current state', this.state.state);
        this.debug('ERROR: Invalid base transition: %s from: %s to: %s', transition, from, to);
    }
}

export default MysqlStore;
