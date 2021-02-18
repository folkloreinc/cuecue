import createDebug from 'debug';
import isArray from 'lodash/isArray';
import Base from './Base';

class PubNubInput extends Base {
    constructor({ commands = null, ...opts } = {}) {
        super({
            channel: process.env.PUBNUB_CHANNEL || 'cuecue:input',
            ...opts,
        });

        this.onMessage = this.onMessage.bind(this);

        this.commands = commands;
        this.debug = createDebug('cuecue:input:pubnub');
    }

    setInputCommands(commands) {
        this.commands = commands;
        return this;
    }

    async onInit() {
        await super.onInit();

        this.client.addListener({
            message: this.onMessage,
        });
    }

    async onDestroy() {
        this.client.removeListener({
            message: this.onMessage,
        });

        await super.onDestroy();
    }

    async onStart() {
        await super.onStart();

        const { channel } = this.options;
        this.client.subscribe({
            channels: isArray(channel) ? channel : [channel],
        });
    }

    async onStop() {
        await super.onStop();

        const { channel } = this.options;
        this.client.unsubscribe({
            channels: isArray(channel) ? channel : [channel],
        });
    }

    onMessage({ message = null }) {
        const { transformMessage = null, transformCommand = null } = this.options;
        const { command = null, args = [] } = (transformMessage !== null ? transformMessage(message) : message) || {};
        const { command: finalCommand = command, args: finalArgs = args } =
            (transformCommand !== null ? transformCommand(command, args) : null) || {};
        if (this.commands === null || this.commands.indexOf(finalCommand) !== -1) {
            this.debug('command: %s args: %o', finalCommand, finalArgs);
            this.emit('command', command, ...finalArgs);
        } else {
            this.debug('message: %o', message);
        }
    }
}

export default PubNubInput;
