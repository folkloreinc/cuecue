import mysql from 'mysql';
import StateMachine from 'javascript-state-machine';
import EventEmitter from 'wolfy87-eventemitter';
import createDebug from 'debug';
import isObject from 'lodash/isObject';

const debug = createDebug('cuecue:store:mysql');

const getWhereFromParams = (params, operator = 'AND') =>
    Object.keys(params)
        .reduce((items, key) => [...items, `${key} = ?`], [])
        .join(` ${operator} `);

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
            },
        });

        this.init();
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

    findItem(type, id) {
        return new Promise((resolve, reject) => {
            const where = getWhereFromParams(
                isObject(id)
                    ? id
                    : {
                          id,
                      },
            );
            const values = isObject(id) ? Object.keys(id).map((key) => id[key]) : [id];
            this.client.query(
                `SELECT * FROM ${type} WHERE ${where} LIMIT 1`,
                values,
                (error, results) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(results !== null && results.length === 1 ? results[0] : null);
                },
            );
        });
    }

    addItem(type, data) {
        return new Promise((resolve, reject) => {
            this.client.query(`INSERT INTO ${type} SET ?`, data, (error, results) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(results);
            });
        }).then(({ insertId }) => this.findItem(type, insertId));
    }

    updateItem(type, id, data) {
        return new Promise((resolve, reject) => {
            const fields = Object.keys(data)
                .reduce((items, key) => [...items, `${key} = ?`], [])
                .join(', ');
            const values = Object.keys(data).map((key) => data[key]);
            this.client.query(
                `UPDATE ${type} SET ${fields} WHERE id = ?`,
                [...values, id],
                (error, results) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(results);
                },
            );
        }).then(() => this.findItem(type, id));
    }

    deleteItem(type, id) {
        return this.deleteItems(type, {
            id,
        });
    }

    deleteItems(type, params = {}) {
        return new Promise((resolve, reject) => {
            const where = getWhereFromParams(params);
            const values = Object.keys(params).map((key) => params[key]);
            this.client.query(`DELETE FROM ${type} WHERE ${where}`, values, (error, results) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(results);
            });
        });
    }

    getItems(type, params = {}) {
        return new Promise((resolve, reject) => {
            const where = getWhereFromParams(params);
            const values = Object.keys(params).map((key) => params[key]);
            this.client.query(`SELECT * FROM ${type} WHERE ${where}`, values, (error, results) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(results);
            });
        });
    }

    onInit() {
        this.emit('init');

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
    }

    onInitialized() {
        debug('initialized');

        return process.nextTick(() => this.emit('initialized'));
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
}

export default MysqlStore;
