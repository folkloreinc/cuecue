import { Client } from 'node-osc';
import createDebug from 'debug';
import Base from './Base';

class OscOutput extends Base {
    constructor(opts) {
        super(opts);

        this.debug = createDebug('cuecue:output:osc');
    }

    cue(cue) {
        this.command('cue', cue);
    }

    interact(interaction) {
        this.command('interaction', interaction);
    }

    command(command, ...args) {
        this.debug(`command: ${command} message: ${args}`);
        return new Promise((resolve, reject) => {
            this.osc.send(command, ...args, (err) => {
                if (err) {
                    this.debug(`command error: ${command}`);
                    reject(err);
                    return;
                }
                this.debug(`command success: ${command}`);
                resolve();
            });
        });
    }

    async onStart() {
        await super.onStart();
        const { port, host } = this.options;
        this.osc = new Client(port, host);
    }
}

export default OscOutput;
