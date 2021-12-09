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
        this.onConnection = this.onConnection.bind(this);

        this.commands = commands;
        this.debug = createDebug('cuecue:socketio');
    }

    async onInit() {
        await super.onInit();
        await this.createServer();
    }

    async onDestroy() {
        await this.closeSocket();
        await super.onDestroy();
    }

    async connectSocket() {
        const { server, port } = this.options;
        const ioOptions = {};
        this.io = io(ioOptions);

        this.io.on('connection', this.onConnection);

        this.io.listen(server || port);

        return Promise.resolve();
    }

    async closeSocket() {
        this.io.off('connection', this.onConnection);
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
