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
        return new Promise((resolve) => {
            this.socket = io(
                namespace !== null ? host.replace(/\/$/, `/${namespace.replace(/^\//, '')}`) : host,
            );
            this.socket.once('connect', () => {
                resolve();
            });
        });
    }

    async closeSocket() {
        return new Promise((resolve) => {
            this.socket.once('disconnect', () => {
                resolve();
            });
            this.socket.close();
        });
    }
}

export default Base;
