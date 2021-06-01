import createDebug from 'debug';
import Base from './Base';

class SocketIOOutput extends Base {
    constructor(opts = {}) {
        super({
            namespace: process.env.SOCKETIO_OUTPUT_NAMESPACE || null,
            ...opts,
        });

        this.socket = null;
        this.onSocket = this.onSocket.bind(this);

        this.debug = createDebug('cuecue:output:socketio');
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
        const { transformCommand = null, transformMessage = null } = this.options;
        const value =
            transformCommand !== null ? await transformCommand(command, args) : { command, args };

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

        const payload = transformMessage !== null ? await transformMessage(message) : message;

        return this.send(payload);
    }

    async send(...args) {
        this.socket.send(...args);
        return Promise.resolve();
    }
}

export default SocketIOOutput;
