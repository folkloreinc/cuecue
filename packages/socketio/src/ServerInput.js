import createDebug from 'debug';
import isArray from 'lodash/isArray';
import BaseServer from './BaseServer';

class ServerInput extends BaseServer {
    constructor({ commands = null, ...opts } = {}) {
        super({
            namespace: process.env.SOCKETIO_INPUT_NAMESPACE || null,
            ...opts,
        });
        this.onSocketConnection = this.onSocketConnection.bind(this);
        this.onMessage = this.onMessage.bind(this);
        this.commands = commands;
        this.debug = createDebug('cuecue:input:socketio-server');
    }

    setInputCommands(commands) {
        this.commands = commands;
        return this;
    }

    async onInit() {
        await super.onInit();
        const { namespace } = this.namespace;
        if (namespace !== null) {
            this.io.of(namespace).on('connection', this.onSocketConnection);
        } else {
            this.io.on('connection', this.onSocketConnection);
        }
    }

    async onDestroy() {
        const { namespace } = this.namespace;
        if (namespace !== null) {
            this.io.of(namespace).off('connection', this.onSocketConnection);
        } else {
            this.io.off('connection', this.onSocketConnection);
        }
        await super.onDestroy();
    }

    async onSocketConnection(socket) {
        socket.on('message', this.onMessage);
    }

    async onMessage(message) {
        const { transformMessage = null, transformCommand = null } = this.options;

        const { command = null, args = [] } =
            (transformMessage !== null ? await transformMessage(message) : message) || {};
        const { command: finalCommand = command, args: finalArgs = args } =
            (transformCommand !== null ? await transformCommand(command, args) : null) || {};

        if (this.commands === null || this.commands.indexOf(finalCommand) !== -1) {
            this.debug('command: %s args: %o', finalCommand, finalArgs);
            this.emit('command', command, ...(isArray(finalArgs) ? finalArgs : [finalArgs]));
        } else {
            this.debug('message: %o', message);
        }
    }
}

export default ServerInput;
