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

    interaction(interaction) {
        this.command('interaction', interaction);
    }

    interact(data, interactionId = null) {
        this.command('interact', data, interactionId);
    }

    command(command, ...args) {
        this.debug('command: %s message: %o', command, args);
        const { channel, transformCommand = null, transformMessage = null } = this.options;
        const { command: finalCommand = command, args: finalArgs = args } = (transformCommand !==
        null
            ? transformCommand(command, args)
            : null) || { command, args };

        const message = {
            command: finalCommand,
            args: finalArgs,
        };
        const payload = {
            channel,
            message: transformMessage !== null ? transformMessage(message) : message,
        };

        return new Promise((resolve, reject) => {
            this.debug('publish payload %O', payload);
            this.client.publish(payload, (status) => {
                if (status.error) {
                    this.debug('command error: %s %O', command, status);
                    reject(status.error);
                    return;
                }
                this.debug('command success: %s', command);
                resolve();
            });
        });
    }
}

export default PubNubOutput;
