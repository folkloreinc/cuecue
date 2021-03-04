import createDebug from 'debug';
import isArray from 'lodash/isArray';
import Base from './Base';

class PubNubInput extends Base {
    constructor({ commands = null, ...opts } = {}) {
        super({
            channel: process.env.PUBNUB_INPUT_CHANNEL || 'cuecue:input',
            ...opts,
        });
        this.onMessage = this.onMessage.bind(this);
        this.onPresence = this.onPresence.bind(this);
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
            presence: this.onPresence,
        });

        const { channel, presence = false } = this.options;

        this.client.subscribe({
            channels: isArray(channel) ? channel : [channel],
            withPresence: presence,
        });
    }

    async onDestroy() {
        const { channel } = this.options;
        this.client.unsubscribe({
            channels: isArray(channel) ? channel : [channel],
        });

        this.client.removeListener({
            message: this.onMessage,
            presence: this.onPresence,
        });

        await super.onDestroy();
    }

    async onStart(session) {
        await super.onStart(session);
    }

    async onStop(session) {
        await super.onStop(session);
    }

    onMessage({ message = null }) {
        const { transformMessage = null, transformCommand = null } = this.options;
        const { command = null, args = [] } =
            (transformMessage !== null ? transformMessage(message) : message) || {};
        const { command: finalCommand = command, args: finalArgs = args } =
            (transformCommand !== null ? transformCommand(command, args) : null) || {};
        if (this.commands === null || this.commands.indexOf(finalCommand) !== -1) {
            this.debug('command: %s args: %o', finalCommand, finalArgs);
            this.emit('command', command, ...(isArray(finalArgs) ? finalArgs : [finalArgs]));
        } else {
            this.debug('message: %o', message);
        }
    }

    onPresence(presenceEvent) {
        const { transformPresence = null } = this.options;
        const { action = null } = presenceEvent || {};
        this.debug('presence: %s event: %o', action, presenceEvent);

        const { command = null, args = [] } =
            (transformPresence !== null ? transformPresence(action) : null) || {};

        if (command !== null) {
            this.emit('command', command, ...args);
        }
    }
}

export default PubNubInput;
