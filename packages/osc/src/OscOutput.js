import { Client } from 'node-osc';
import createDebug from 'debug';
import isObject from 'lodash/isObject';
import isArray from 'lodash/isArray';
import Base from './Base';

class OscOutput extends Base {
    constructor(opts) {
        super(opts);

        this.debug = createDebug('cuecue:output:osc');
    }

    cue(cue, extraData = null) {
        this.command('cue', cue, extraData);
    }

    interaction(interaction) {
        this.command('interaction', interaction);
    }

    interact(data, interactionId = null) {
        this.command('interact', data, interactionId);
    }

    command(command, ...args) {
        const { transformCommand = null } = this.options;
        const { command: finalCommand = command, args: finalArgs = args } =
            (transformCommand !== null ? transformCommand(command, args) : null) || {};

        this.debug('command: %s %o', finalCommand, finalArgs);

        return new Promise((resolve, reject) => {
            const path = finalCommand.replace(/^\/?/, '/');
            const sendArgs = finalArgs.filter((it) => it !== null && !isObject(it) && !isArray(it));
            this.osc.send(path, ...sendArgs, (err) => {
                if (err) {
                    this.debug('send error: %s %o', path, sendArgs);
                    reject(err);
                    return;
                }
                this.debug('send success: %s %o', path, sendArgs);
                resolve();
            });
        });
    }

    async onStart() {
        await super.onStart();
        const { port, host } = this.options;
        this.osc = new Client(host, port);
    }
}

export default OscOutput;
