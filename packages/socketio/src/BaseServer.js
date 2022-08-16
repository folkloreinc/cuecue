import { BasePlugin } from '@cuecue/core';
import createDebug from 'debug';
import { Server } from 'socket.io';

class BaseServer extends BasePlugin {
    constructor({ commands = null, ...opts } = {}) {
        super({
            port: process.env.SOCKETIO_PORT || 5000,
            namespace: process.env.SOCKETIO_NAMESPACE || null,
            transports: ['websocket', 'polling'],
            server: null,
            path: '/socket.io/',
            ...opts,
        });

        this.io = null;
        this.namespace = null;
        this.onConnection = this.onConnection.bind(this);

        this.commands = commands;
        this.debug = createDebug('cuecue:socketio-server');
    }

    async onInit() {
        await super.onInit();
        await this.createServer();
    }

    async onDestroy() {
        await this.closeServer();
        await super.onDestroy();
    }

    async createServer() {
        const { server, port, cors, transports, namespace, path } = this.options;
        const ioOptions = { transports, cors, path };
        this.io = new Server(server || port, ioOptions);

        this.namespace = namespace !== null ? this.io.of(namespace) : this.io;
        this.namespace.on('connection', this.onConnection);

        return Promise.resolve();
    }

    async closeServer() {
        this.namespace.off('connection', this.onConnection);
        return new Promise((resolve) => {
            this.io.close(() => {
                resolve();
            });
        });
    }

    onConnection(socket) {
        this.debug('Client connected %s', socket.id);
    }
}

export default BaseServer;
