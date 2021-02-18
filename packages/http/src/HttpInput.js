import { BaseInput } from '@cuecue/core';
import createDebug from 'debug';

class HttpInput extends BaseInput {
    constructor(opts = {}) {
        super(opts);

        this.debug = createDebug('cuecue:input:http');
    }

    cue(cue, extraData = null) {
        this.emit('command', 'cue', cue, extraData);
    }

    wait() {
        this.emit('command', 'wait');
    }

    interact(data, interactionId = null) {
        this.emit('command', 'interact', data, interactionId);
    }
}

export default HttpInput;
