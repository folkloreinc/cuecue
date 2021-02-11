import { BaseInput } from '@cuecue/core';
import createDebug from 'debug';
import isObject from 'lodash/isObject';

class HttpInput extends BaseInput {
    constructor(opts = {}) {
        super(opts);

        this.debug = createDebug('cuecue:input:http');
    }

    cue(cue) {
        this.emit('command', 'cue', cue);
    }

    wait() {
        this.emit('command', 'wait');
    }

    interactOnCue(cue, data, userId = null) {
        this.emit('command', 'interact', data, {
            cueId: isObject(cue) ? cue.id : cue,
            userId,
        });
    }

    interact(data, userId = null) {
        this.emit('command', 'interact', data, {
            userId,
        });
    }
}

export default HttpInput;
