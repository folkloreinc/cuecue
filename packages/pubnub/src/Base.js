import { BasePlugin } from '@cuecue/core';
import createDebug from 'debug';
import PubNubClient from 'pubnub';
import { randomUUID } from 'crypto';

class Base extends BasePlugin {
    constructor({ commands = null, ...opts } = {}) {
        super({
            publishKey: process.env.PUBNUB_PUBLISH_KEY || null,
            subscribeKey: process.env.PUBNUB_SUBSCRIBE_KEY || null,
            uuid: process.env.PUBNUB_UUID || randomUUID(),
            channel: process.env.PUBNUB_CHANNEL || 'cuecue',
            ...opts,
        });

        this.client = null;
        this.commands = commands;
        this.debug = createDebug('cuecue:pubnub');
    }

    async onInit() {
        await super.onInit();
        const { publishKey, subscribeKey, uuid } = this.options;

        this.client = new PubNubClient({
            publishKey,
            subscribeKey,
            uuid,
        });
    }

    onStarted() {
        const { channel } = this.options;
        this.debug('started on channel:%s', channel);
        return process.nextTick(() => this.emit('started'));
    }
}

export default Base;
