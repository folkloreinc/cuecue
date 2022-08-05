import { BasePlugin } from '@cuecue/core';
import createDebug from 'debug';
import io from 'socket.io';

class BaseServer extends BasePlugin {
    constructor({ commands = null, ...opts } = {}) {
        super({
            port: process.env.SOCKETIO_PORT || 3000,
            namespace: process.env.SOCKETIO_NAMESPACE || null,
            server: null,
            ...opts,
        });

        this.io = null;
        this.namespace = null;
        this.onConnection = this.onConnection.bind(this);

        this.commands = commands;
        this.debug = createDebug('cuecue:socketio');
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
        const { server, port, cors, namespace } = this.options;
        const ioOptions = { cors };
        this.io = io(ioOptions);

        this.namespace = namespace !== null ? this.io.of(namespace) : this.io;
        this.namespace.on('connection', this.onConnection);

        this.io.listen(server || port);

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
