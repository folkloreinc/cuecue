import BasePlugin from './BasePlugin';

class BaseInput extends BasePlugin {
    command(command, ...args) {
        this.emit('command', command, ...args);
    }

    cue(cue, extraData = null) {
        this.emit('command', 'cue', cue, extraData);
    }

    interact(data, interactionId = null) {
        this.emit('command', 'interact', data, interactionId);
    }
}

export default BaseInput;
