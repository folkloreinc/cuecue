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
        const { transformCommand = null } = this.options;
        const [oscPath = null, ...args] = message;
        const command = oscPath.replace(/^\//, '');
        const { command: finalCommand = command, args: finalArgs = args } =
            (transformCommand !== null ? transformCommand(command, args) : null) || {};
        if (this.commands === null || this.commands.indexOf(finalCommand) !== -1) {
            this.debug('command: %s %o', finalCommand, finalArgs);
            this.emit('command', finalCommand, ...finalArgs);
        }
    }
}

export default OscInput;
