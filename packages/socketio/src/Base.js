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

        this.onConnect = this.onConnect.bind(this);

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
            namespace !== null ? host.replace(/\/?$/, `/${namespace.replace(/^\//, '')}`) : host,
        );
        this.socket.on('connect', this.onConnect);
        return Promise.resolve();
    }

    async closeSocket() {
        this.socket.off('connect', this.onConnect);
        this.socket.close();
        return Promise.resolve();
    }

    onConnect() {
        const { host, namespace } = this.options;
        this.debug('Connected on %s/%s', host, namespace || '');
    }
}

export default Base;
