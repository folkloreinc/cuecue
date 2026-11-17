import { BaseOutput } from '@cuecue/core';
import createDebug from 'debug';
import isArray from 'lodash/isArray';
import { KEY_HEADER, SIGNATURE_HEADER, signRequest } from './signature';

const PUBLISH_PATH = '/v1/messages';

/**
 * Publishes the app's commands to a Pingpong channel through its signed HTTP API. The event is the
 * command, and the data is `{ command, args }`, as `@cuecue/pubnub`'s output sends them.
 *
 * Messages leave one at a time, in the order of the commands, so that clients receive them in that
 * order. A failed publish is logged and never rejects: the show keeps running when Pingpong doesn't
 * answer.
 */
class PingpongOutput extends BaseOutput {
    constructor(opts = {}) {
        super({
            url: process.env.PINGPONG_URL || null,
            key: process.env.PINGPONG_KEY || null,
            secret: process.env.PINGPONG_SECRET || null,
            channel: process.env.PINGPONG_CHANNEL || 'cuecue:output',
            timeout: 5000,
            logger: console,
            ...opts,
        });

        const missing = [
            ['url', 'PINGPONG_URL'],
            ['key', 'PINGPONG_KEY'],
            ['secret', 'PINGPONG_SECRET'],
        ].filter(([option]) => !this.options[option]);
        if (missing.length > 0) {
            throw new Error(
                `@cuecue/pingpong: missing ${missing
                    .map(([option, variable]) => `${option} (or ${variable})`)
                    .join(', ')}`,
            );
        }

        this.queue = Promise.resolve();
        this.debug = createDebug('cuecue:output:pingpong');
    }

    cue(cue, extraData = null) {
        return this.command('cue', cue, extraData);
    }

    cues(cues) {
        return this.command('cues', cues);
    }

    interact(data, interactionId = null) {
        return this.command('interact', data, interactionId);
    }

    interaction(interaction) {
        return this.command('interaction', interaction);
    }

    uninteraction(interactionId) {
        return this.command('uninteract', interactionId);
    }

    uninteractions(interactionIds) {
        return this.command('uninteractions', interactionIds);
    }

    /**
     * Publishes a command. Resolves once it is published, or once its failure is logged.
     */
    command(command, ...args) {
        const published = this.queue.then(() => this.publishCommand(command, args));
        this.queue = published;
        return published;
    }

    async publishCommand(command, args) {
        try {
            const {
                transformCommand = null,
                transformMessage = null,
                acceptCommand = null,
            } = this.options;

            const value =
                transformCommand !== null
                    ? await transformCommand(command, args)
                    : { command, args };

            if (value === false) {
                this.debug('command canceled: %s %o', command, args);
                return;
            }

            const { command: finalCommand = command, args: finalArgs = args } = value || {};

            if (acceptCommand !== null && !acceptCommand(finalCommand, finalArgs)) {
                this.debug('command refused: %s %o', finalCommand, finalArgs);
                return;
            }

            const message = {
                command: finalCommand,
                args: finalArgs,
            };
            const data = transformMessage !== null ? await transformMessage(message) : message;

            await this.publish(finalCommand, data);
            this.debug('published: %s %o', finalCommand, finalArgs);
        } catch (error) {
            const { logger } = this.options;
            logger.error(`[cuecue:pingpong] Publishing "${command}" failed: ${error.message}`);
        }
    }

    /**
     * Sends one message to Pingpong. Rejects when Pingpong refuses it or doesn't answer.
     */
    async publish(event, data) {
        const { url, key, secret, channel, timeout } = this.options;
        const endpoint = new URL(PUBLISH_PATH, url);
        const body = JSON.stringify({
            channels: isArray(channel) ? channel : [channel],
            event,
            data,
        });
        const signature = signRequest(secret, {
            method: 'POST',
            path: `${endpoint.pathname}${endpoint.search}`,
            body,
        });

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [KEY_HEADER]: key,
                [SIGNATURE_HEADER]: signature,
            },
            body,
            signal: AbortSignal.timeout(timeout),
        });

        if (!response.ok) {
            const problem = await response.json().catch(() => null);
            const { title = response.statusText, detail = null } = problem || {};
            throw new Error(
                `Pingpong answered ${response.status} ${title}${detail !== null ? `: ${detail}` : ''}`,
            );
        }
    }
}

export default PingpongOutput;
