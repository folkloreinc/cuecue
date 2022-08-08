import createDebug from 'debug';
import isArray from 'lodash/isArray';
import BaseServer from './BaseServer';

class ServerInput extends BaseServer {
    constructor({ commands = null, ...opts } = {}) {
        super({
            namespace: process.env.SOCKETIO_INPUT_NAMESPACE || null,
            cors: {
                origin: 'http://localhost:5000',
            },
            ...opts,
        });
        this.onConnection = this.onConnection.bind(this);
        this.onMessage = this.onMessage.bind(this);
        this.commands = commands;
        this.debug = createDebug('cuecue:input:socketio-server');
        this.debug('started on: %O %s', opts, process.env.SOCKETIO_INPUT_NAMESPACE);
    }

    setInputCommands(commands) {
        this.commands = commands;
        return this;
    }

    async onConnection(socket) {
        await super.onConnection(socket);
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
