import createDebug from 'debug';
import Base from './Base';

class PubNubOutput extends Base {
    constructor(opts = {}) {
        super({
            channel: process.env.PUBNUB_OUTPUT_CHANNEL || 'cuecue:output',
            ...opts,
        });
        this.debug = createDebug('cuecue:output:pubnub');
    }

    cue(cue, extraData = null) {
        this.command('cue', cue, extraData);
    }

    cues(cues) {
        this.command('cues', cues);
    }

    interact(data, interactionId = null) {
        this.command('interact', data, interactionId);
    }

    interaction(interaction) {
        this.command('interaction', interaction);
    }

    uninteraction(interactionId) {
        this.command('uninteract', interactionId);
    }

    uninteractions(interactionIds) {
        this.command('uninteractions', interactionIds);
    }

    async command(command, ...args) {
        const { channel, transformCommand = null, transformMessage = null } = this.options;
        const value = transformCommand !== null
            ? await transformCommand(command, args) : { command, args };

        if (value === false) {
            this.debug('command canceled: %s %o', command, args);
            return Promise.resolve();
        }

        const { command: finalCommand = command, args: finalArgs = args } = value || {};

        this.debug('command: %s message: %o', finalCommand, finalArgs);

        const message = {
            command: finalCommand,
            args: finalArgs,
        };

        const payload = {
            channel,
            message: transformMessage !== null ? await transformMessage(message) : message,
        };

        return new Promise((resolve, reject) => {
            this.debug('publish payload %O', payload);

            try {
                this.client.publish(payload, (status, response) => {
                    if (status.error) {
                        this.debug('publish error: %s %O %O', command, status, response);
                        reject(status.error);
                    }
                    this.debug('publish success: %s', command);
                    resolve();
                });
            } catch (e) {
                reject();
            }
        });
    }
}

export default PubNubOutput;
