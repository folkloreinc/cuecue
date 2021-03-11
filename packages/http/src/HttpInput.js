import { BaseInput } from '@cuecue/core';
import express, { Router } from 'express';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import cors from 'cors';
import createSession from 'express-session';
import createDebug from 'debug';

class HttpInput extends BaseInput {
    constructor(opts = {}) {
        super(opts);
        this.options = {
            port: process.env.PORT || 8080,
            publicPath: null,
            path: process.env.ROUTER_PATH || '/api',
            ...opts,
        };

        this.express = null;
        this.session = null;
        this.http = null;
        this.path = '/';
        this.router = new Router();
        this.debug = createDebug('cuecue:input:http');
    }

    cue(cue, extraData = null) {
        this.emit('command', 'cue', cue, extraData);
    }

    interact(data, interactionId = null) {
        this.emit('command', 'interact', data, interactionId);
    }

    getRouter() {
        return this.router;
    }

    setRouter(router) {
        this.router = router;
    }

    use(...args) {
        return this.express.use(...args);
    }

    async onInit() {
        this.emit('init');
        const { path } = this.options;

        this.express = express();
        this.http = createServer(this.express);

        this.session = createSession({
            secret: 'my-secret-session',
            resave: true,
            saveUninitialized: true,
        });

        this.express.use(cors());
        this.express.use(bodyParser.json());
        this.express.use(bodyParser.urlencoded({ extended: false }));

        // Use express-session middleware for express
        this.express.use(this.session);

        if (this.router !== null) {
            this.use(path, this.router);
        }

        await this.startServer();
    }

    async onDestroy() {
        this.debug('destroying...');
        this.emit('destroy');

        try {
            await this.stopServer();
        } catch (e) {
            this.debug('destroy error %O', e);
        }

        this.express = null;
        this.http = null;
        this.session = null;
    }

    onStarted() {
        const { port } = this.options;
        this.debug(`started on *:${port}`);
        return process.nextTick(() => this.emit('started'));
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

export default HttpInput;
