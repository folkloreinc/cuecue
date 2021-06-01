import { BasePlugin } from '@cuecue/core';
import createDebug from 'debug';
import { io } from 'socket.io-client';

class Base extends BasePlugin {
    constructor({ commands = null, ...opts } = {}) {
        super({
            host: process.env.SOCKETIO_HOST || 'localhost',
            namespace: process.env.SOCKETIO_NAMESPACE || null,
            ...opts,
        });

        this.commands = commands;
        this.debug = createDebug('cuecue:socketio');
    }

    async onInit() {
        await super.onInit();
        await this.connectSocket();
    }

    async onDestroy() {
        await this.closeSocket();
        await super.onDestroy();
    }

    async connectSocket() {
        const { host, namespace } = this.options;
        this.socket = io(
            namespace !== null ? host.replace(/\/$/, `/${namespace.replace(/^\//, '')}`) : host,
        );
        return Promise.resolve();
    }

    async closeSocket() {
        this.socket.close();
        return Promise.resolve();
    }
}

export default Base;
