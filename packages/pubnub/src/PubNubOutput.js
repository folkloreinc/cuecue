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

    interaction(interaction) {
        this.command('interaction', interaction);
    }

    interact(data, interactionId = null) {
        this.command('interact', data, interactionId);
    }

    async command(command, ...args) {
        this.debug('command: %s message: %o', command, args);

        const { channel, transformCommand = null, transformMessage = null } = this.options;
        const { command: finalCommand = command, args: finalArgs = args } = (transformCommand !==
        null
            ? await transformCommand(command, args)
            : null) || { command, args };

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
