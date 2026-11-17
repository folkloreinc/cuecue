import { BasePlugin } from '@cuecue/core';
import createDebug from 'debug';

class Base extends BasePlugin {
    constructor(opts = {}) {
        super({
            port: process.env.OSC_PORT || 8081,
            host: process.env.OSC_HOST || '0.0.0.0',
            ...opts,
        });

        this.osc = null;
        this.debug = createDebug('cuecue:osc');
    }

    async onInitialized() {
        const { host, port } = this.options;
        this.debug('started on %s:%s', host, port);
        await super.onInitialized();
    }

    async onDestroy() {
        await super.onDestroy();
        if (this.osc === null) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            this.osc.close(() => {
                this.osc = null;
                resolve();
            });
        });
    }
}

export default Base;
