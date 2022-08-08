import createDebug from 'debug';
import BaseServer from './BaseServer';

class ServerOutput extends BaseServer {
    constructor(opts = {}) {
        super({
            namespace: process.env.SOCKETIO_OUTPUT_NAMESPACE || null,
            ...opts,
        });

        this.socket = null;
        this.debug = createDebug('cuecue:output:socketio-server');
        this.debug('started on: %O %s', opts, process.env.SOCKETIO_OUTPUT_NAMESPACE);
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
        const {
            transformCommand = null,
            transformMessage = null,
            acceptCommand = null,
        } = this.options;
        const value =
            transformCommand !== null ? await transformCommand(command, args) : { command, args };

        if (value === false) {
            this.debug('command canceled: %s %o', command, args);
            return Promise.resolve();
        }

        const {
            command: finalCommand = command,
            args: finalArgs = args,
            namespace = null,
        } = value || {};

        if (acceptCommand !== null && !acceptCommand(finalCommand, finalArgs)) {
            this.debug('command refused: %s %o', finalCommand, finalArgs);
            return Promise.resolve();
        }

        this.debug('command: %s message: %o', finalCommand, finalArgs);

        const message = {
            command: finalCommand,
            args: finalArgs,
        };

        const payload = transformMessage !== null ? await transformMessage(message) : message;

        return namespace !== null ? this.sendToNamespace(payload) : this.send(payload);
    }

    async send(...args) {
        this.debug('send: %o', args);
        this.namespace.send(...args);
        return Promise.resolve();
    }

    async sendToNamespace(namespace, ...args) {
        this.debug('send: %o', args);
        this.io.of(namespace).send(...args);
        return Promise.resolve();
    }
}

export default ServerOutput;
