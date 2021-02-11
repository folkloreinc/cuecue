import { Server } from 'node-osc';
import createDebug from 'debug';
import Base from './Base';

class OscInput extends Base {
    constructor({ commands = null, ...opts } = {}) {
        super(opts);
        this.commands = commands;
        this.debug = createDebug('cuecue:input:osc');
        this.onMessage = this.onMessage.bind(this);
    }

    setInputCommands(commands) {
        this.commands = commands;
        return this;
    }

    async onDestroy() {
        this.osc.off('message', this.onMessage);
        await super.onDestroy();
    }

    async onStart() {
        await super.onStart();
        const { port, host } = this.options;
        return new Promise((resolve) => {
            this.osc = new Server(port, host, () => {
                resolve();
            });
            this.osc.on('message', this.onMessage);
        });
    }

    async onStop() {
        this.osc.off('message', this.onMessage);
        await super.onStop();
    }

    onMessage(message) {
        const [oscPath = null, ...args] = message;
        const command = oscPath.replace(/^\//, '');
        if (command !== null && (this.commands === null || this.commands.indexOf(command) !== -1)) {
            this.debug('command: %s %o', command, args);
            this.emit('command', command, ...args);
        }
    }
}

export default OscInput;
