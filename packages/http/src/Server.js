import express from 'express';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import cors from 'cors';
import StateMachine from 'javascript-state-machine';
import EventEmitter from 'wolfy87-eventemitter';
import createSession from 'express-session';
import createDebug from 'debug';

class Server extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.options = {
            port: process.env.PORT || 8080,
            publicPath: null,
            ...opts,
        };

        this.onInit = this.onInit.bind(this);
        this.onInitialized = this.onInitialized.bind(this);
        this.onDestroy = this.onDestroy.bind(this);
        this.onDestroyed = this.onDestroyed.bind(this);
        this.onStart = this.onStart.bind(this);
        this.onStop = this.onStop.bind(this);
        this.onStarted = this.onStarted.bind(this);
        this.onStopped = this.onStopped.bind(this);

        this.app = null;
        this.session = null;
        this.http = null;

        this.debug = createDebug('cuecue:server');

        this.state = new StateMachine({
            transitions: [
                { name: 'init', from: 'none', to: 'initialized' },
                { name: 'destroy', from: '*', to: 'none' },
                { name: 'start', from: ['initialized', 'stopped'], to: 'started' },
                { name: 'stop', from: 'started', to: 'stopped' },
            ],
            methods: {
                onBeforeInit: this.onInit,
                onAfterInit: this.onInitialized,
                onBeforeDestroy: this.onDestroy,
                onAfterDestroy: this.onDestroyed,
                onBeforeStart: this.onStart,
                onAfterStart: this.onStarted,
                onBeforeStop: this.onStop,
                onAfterStop: this.onStopped,
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

    async start() {
        if (!this.initialized()) {
            await this.init();
        }
        return this.state.start();
    }

    stop() {
        return this.state.stop();
    }

    initialized() {
        return this.state.is('initialized');
    }

    started() {
        return this.state.is('started');
    }

    stopped() {
        return this.state.is('stopped');
    }

    destroyed() {
        return this.state.is('destroyed');
    }

    use(...args) {
        return this.app.use(...args);
    }

    async onInit() {
        this.emit('init');

        this.app = express();
        this.http = createServer(this.app);

        this.session = createSession({
            secret: 'my-secret-session',
            resave: true,
            saveUninitialized: true,
        });

        this.app.use(cors());
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: false }));

        // Use express-session middleware for express
        this.app.use(this.session);

        await this.startServer();
    }

    onInitialized() {
        this.debug('initialized');
        return process.nextTick(() => this.emit('initialized'));
    }

    async onDestroy() {
        this.debug('destroying...');
        this.emit('destroy');

        try {
            await this.stopServer();
            if (this.session !== null && typeof this.session.close !== 'undefined') {
                this.session.close();
            }
        } catch (e) {
            console.log(e); // eslint-disable-line
        }

        this.app = null;
        this.http = null;
    }

    onDestroyed() {
        this.debug('destroyed');
        return process.nextTick(() => this.emit('destroyed'));
    }

    onStart() {
        this.debug('starting...');
        this.emit('start');
    }

    onStarted() {
        const { port } = this.options;
        this.debug(`started on *:${port}`);
        return process.nextTick(() => this.emit('started'));
    }

    onStop() {
        this.emit('stop');
    }

    onStopped() {
        this.debug('Stopped.');
        return process.nextTick(() => this.emit('stopped'));
    }

    startServer() {
        const { port } = this.options;
        return new Promise((resolve, reject) => {
            this.http.listen(port, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    stopServer() {
        this.debug('Stopping...');
        return new Promise((resolve, reject) => {
            this.http.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }
}

export default Server;
