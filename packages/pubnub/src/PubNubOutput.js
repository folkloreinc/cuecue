import createDebug from 'debug';
import Base from './Base';

class PubNubOutput extends Base {
    constructor(opts = {}) {
        super({
            channel: process.env.PUBNUB_CHANNEL || 'cuecue:output',
            ...opts,
        });

        this.debug = createDebug('cuecue:output:pubnub');
    }

    cue(cue) {
        this.command('cue', cue);
    }

    interact(interaction) {
        this.command('interaction', interaction);
    }

    command(command, ...args) {
        this.debug('command: %s message: %o', command, args);
        const { channel } = this.options;
        const payload = {
            channel,
            message: {
                command,
                args,
            },
        };
        return new Promise((resolve, reject) => {
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
