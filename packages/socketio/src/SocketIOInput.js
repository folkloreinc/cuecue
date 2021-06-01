import createDebug from 'debug';
import isArray from 'lodash/isArray';
import Base from './Base';

class SocketIOInput extends Base {
    constructor({ commands = null, ...opts } = {}) {
        super({
            namespace: process.env.SOCKETIO_INPUT_NAMESPACE || null,
            ...opts,
        });
        this.onCommand = this.onCommand.bind(this);
        this.commands = commands;
        this.debug = createDebug('cuecue:input:socketio');
    }

    setInputCommands(commands) {
        this.commands = commands;
        return this;
    }

    async onInit() {
        await super.onInit();
        this.socket.on('command', this.onCommand);
    }

    async onDestroy() {
        this.socket.off('command', this.onCommand);
        await super.onDestroy();
    }

    async onCommand(message) {
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

export default SocketIOInput;
