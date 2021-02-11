import createDebug from 'debug';
import isArray from 'lodash/isArray';
import Base from './Base';

class PubNubInput extends Base {
    constructor({ commands = null, ...opts } = {}) {
        super(opts);
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
        this.pubnub.subscribe({
            channels: isArray(channel) ? channel : [channel],
        });
    }

    async onStop() {
        await super.onStop();
        
        const { channel } = this.options;
        this.pubnub.unsubscribe({
            channels: isArray(channel) ? channel : [channel],
        });
    }

    onMessage({ message = null }) {
        const { command = null, args = [] } = message || {};
        if (command !== null && (this.commands === null || this.commands.indexOf(command) !== -1)) {
            this.debug(`command: ${command}`);
            this.emit('command', command, ...args);
        }
    }
}

export default PubNubInput;
