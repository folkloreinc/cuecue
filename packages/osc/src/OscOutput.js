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
        const { transformCommand = null, acceptCommand = null } = this.options;
        const value =
            transformCommand !== null ? await transformCommand(command, args) : { command, args };

        if (value === false) {
            this.debug('command canceled: %s %o', command, args);
            return Promise.resolve();
        }

        const values = isArray(value) ? value : [value];
        return Promise.all(values.map((val) => {
            const { command: finalCommand = command, args: finalArgs = args } = val || {};

            if (acceptCommand !== null && !acceptCommand(finalCommand, finalArgs)) {
                this.debug('command refused: %s %o', finalCommand, finalArgs);
                return Promise.resolve();
            }

            this.debug('command: %s %o', finalCommand, finalArgs);
            const path = finalCommand.replace(/^\/?/, '/');
            const sendArgs = finalArgs.filter((it) => it !== null && !isObject(it) && !isArray(it));
            return this.send(path, ...sendArgs);
        }));
    }

    async send(path, ...args) {
        return new Promise((resolve, reject) => {
            this.osc.send(path, ...args, (err) => {
                if (err) {
                    this.debug('send error: %s %o', path, args);
                    reject(err);
                    return;
                }
                this.debug('send success: %s %o', path, args);
                resolve();
            });
        });
    }
}

export default OscOutput;
