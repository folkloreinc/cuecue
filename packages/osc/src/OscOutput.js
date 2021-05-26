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

    async onInit() {
        await super.onInit();
        const { host, port } = this.options;
        this.osc = new Client(host, port);
    }

    cue(cue, extraData = null) {
        this.command('cue', cue, extraData);
    }

    cues(cues) {
        this.command('cues', cues);
    }

    interaction(interaction) {
        this.command('interaction', interaction);
    }

    interact(data, interactionId = null) {
        this.command('interact', data, interactionId);
    }

    async command(command, ...args) {
        const { transformCommand = null } = this.options;
        const value =
            transformCommand !== null ? await transformCommand(command, args) : { command, args };

        if (value === false) {
            this.debug('command canceled: %s %o', command, args);
            return Promise.resolve();
        }

        const { command: finalCommand = command, args: finalArgs = args } = value || {};

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
}

export default OscOutput;
