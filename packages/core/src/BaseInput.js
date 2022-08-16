import BasePlugin from './BasePlugin';

class BaseInput extends BasePlugin {
    cue(cue, extraData = null) {
        this.emit('command', 'cue', cue, extraData);
    }

    interact(data, interactionId = null) {
        this.emit('command', 'interact', data, interactionId);
    }
}

export default BaseInput;
