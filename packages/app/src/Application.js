import StateMachine from 'javascript-state-machine';
import EventEmitter from 'wolfy87-eventemitter';
import createDebug from 'debug';
import dayjs from 'dayjs';
import isObject from 'lodash/isObject';

import MemoryStore from './MemoryStore';

class Application extends EventEmitter {
    constructor(definition, opts = {}) {
        super();
        this.definition = {
            getHandle: (id) => `${id}_${dayjs().format('YYYY_MM_DD')}`,
            ...definition,
        };

        this.options = {
            store: new MemoryStore(),
            debugFunction: createDebug('cuecue:app'),
            ...opts,
        };

        const { store } = this.options;

        this.debug = createDebug('cuecue:app');
        this.store = store;
        this.session = null;
        this.currentCue = null;
        this.interactions = [];
        this.inputs = [];
        this.outputs = [];

        this.onInit = this.onInit.bind(this);
        this.onInitialized = this.onInitialized.bind(this);
        this.onDestroy = this.onDestroy.bind(this);
        this.onDestroyed = this.onDestroyed.bind(this);
        this.onStart = this.onStart.bind(this);
        this.onIdle = this.onIdle.bind(this);
        this.onUncue = this.onUncue.bind(this);
        this.onEnd = this.onEnd.bind(this);
        this.onCue = this.onCue.bind(this);
        this.onStop = this.onStop.bind(this);
        this.onStopped = this.onStopped.bind(this);
        this.onInputCommand = this.onInputCommand.bind(this);
        this.onInvalidTransition = this.onInvalidTransition.bind(this);
        this.onPendingTransition = this.onPendingTransition.bind(this);

        this.state = new StateMachine({
            transitions: [
                { name: 'init', from: 'none', to: 'initialized' },
                { name: 'destroy', from: '*', to: 'none' },
                { name: 'start', from: ['initialized', 'stopped', 'ended'], to: 'idle' },
                { name: 'stop', from: ['idle', 'cued'], to: 'stopped' },
                { name: 'cue', from: ['idle', 'cued'], to: 'cued' },
                { name: 'uncue', from: ['idle', 'cued'], to: 'idle' },
                { name: 'end', from: ['idle', 'cued'], to: 'ended' },
            ],
            methods: {
                onBeforeInit: this.onInit,
                onAfterInit: this.onInitialized,
                onBeforeDestroy: this.onDestroy,
                onAfterDestroy: this.onDestroyed,
                onBeforeStart: this.onStart,
                onAfterStart: this.onIdle,
                onBeforeCue: this.onCue,
                onBeforeUncue: this.onUncue,
                onBeforeEnd: this.onEnd,
                onBeforeStop: this.onStop,
                onAfterStop: this.onStopped,
                onInvalidTransition: this.onInvalidTransition,
                onPendingTransition: this.onPendingTransition,
            },
        });
    }

    init() {
        return this.state.init();
    }

    destroy() {
        return this.state.destroy();
    }

    async start() {
        if (!this.initialized()) {
            await this.init();
        }
        return this.state.start();
    }

    stop() {
        return this.state.stop();
    }

    end() {
        return this.state.end();
    }

    cue(id) {
        return this.state.cue(id);
    }

    cues() {
        const { cues = [] } = this.definition;
        return cues;
    }

    async interactOnCue(cueArg, data, userId = null) {
        if (!this.state.is('cued')) {
            return null;
        }

        const cueId = isObject(cueArg) ? cueArg.id : cueArg;

        const cue = this.cues().find((it) => it.id === cueId) || null;
        if (cue === null) {
            return null;
        }

        const { interaction: hasInteraction = false } = cue;
        if (!hasInteraction) {
            return null;
        }

        const interaction = await this.ensureInteraction(data, cueId, userId);

        this.sendInteractionToOutputs(interaction);

        return interaction;
    }

    async interact(data, userId = null) {
        const interaction = await this.ensureInteraction(data, null, userId);

        this.sendInteractionToOutputs(interaction);

        return interaction;
    }

    uncue() {
        return this.state.uncue();
    }

    async reset() {
        await this.resetInteractions();
        await this.resetSession();
        await this.uncue();
    }

    initialized() {
        return this.state.is('initialized');
    }

    started() {
        return this.state.is('idle');
    }

    idle() {
        return this.state.is('idle');
    }

    stopped() {
        return this.state.is('stopped');
    }

    input(input) {
        this.inputs = [...this.inputs, input];

        input.on('command', this.onInputCommand);
    }

    removeInput(input) {
        input.off('command', this.onInputCommand);

        this.inputs = this.inputs.filter((it) => it !== input);
    }

    output(output) {
        this.outputs = [...this.outputs, output];
    }

    removeOutput(output) {
        this.outputs = this.outputs.filter((it) => it !== output);
    }

    async resetInteractions() {
        await this.store.deleteItems('interactions', {
            session_id: this.session.id,
        });
    }

    getInteractions() {
        return this.store.getItems('interactions', {
            session_id: this.session.id,
        });
    }

    getInteractionsByCue(cueId) {
        return this.store.getItems('interactions  ', {
            session_id: this.session.id,
            cue: cueId,
        });
    }

    getInteractionsByUser(userId) {
        return this.store.getItems('interactions  ', {
            session_id: this.session.id,
            user_id: userId,
        });
    }

    async onInvalidTransition(transition, from, to) {
        this.debug('Invalid transition: %s from: %s to: %s', transition, from, to);
    }

    onPendingTransition(transition, from, to) {
        this.debug('Pending transition: %s from: %s to: %s', transition, from, to);
        return new Promise((resolve) => {
            if (transition === 'init') {
                this.once('initialized', resolve);
            }
        });
    }

    async onInit() {
        this.emit('init');

        if (this.store !== null && typeof this.store.init !== 'undefined') {
            await this.store.init();
        }

        await this.initInputs();

        await this.initOutputs();
    }

    onInitialized() {
        this.debug('initialized');

        return process.nextTick(() => this.emit('initialized'));
    }

    async onDestroy() {
        this.debug('destroying...');

        this.emit('destroy');

        this.destroyInputs();

        this.destroyOutputs();

        await this.store.destroy();

        this.event = null;
        this.inputs = [];
        this.outputs = [];
    }

    onDestroyed() {
        this.debug('destroyed');

        return process.nextTick(() => this.emit('destroyed'));
    }

    async onStart() {
        this.debug('starting...');

        this.session = await this.ensureSession();

        this.debug(`Session #${this.session.id}.`);

        await this.startInputs();

        await this.startOutputs();

        this.emit('start');
    }

    async onIdle() {
        if (!this.session.started && !this.session.ended) {
            await this.startSession();
        }

        this.debug('idle');

        return process.nextTick(() => {
            this.emit('idle');

            // Recover
            const { cue = null, ended = false } = this.session;
            if (ended) {
                this.end();
            } else if (cue !== null) {
                this.cue(cue);
            }
        });
    }

    async onUncue() {
        this.currentCue = null;

        await this.setSessionCue(null);

        await this.sendCommandToOutputs('uncue');

        this.emit('uncue');
    }

    async onCue(state, cueId) {
        const { cues } = this.definition;
        const cue = cues.find(({ id }) => id === cueId) || null;
        if (cue === null) {
            return false;
        }

        this.debug('Cue %s', cueId);

        this.currentCue = cue;

        await this.setSessionCue(cue);

        await this.sendCueToOutputs(cue);

        this.emit('cue', cue);

        return true;
    }

    async onStop() {
        this.emit('stop');

        this.currentCue = null;

        await this.stopInputs();

        await this.stopOutputs();
    }

    onStopped() {
        this.debug('stopped');

        return process.nextTick(() => this.emit('stopped'));
    }

    async onEnd() {
        await this.endSession();

        this.session = null;
        this.currentCue = null;

        this.emit('end');
    }

    async onInputCommand(command, ...args) {
        try {
            switch (command) {
                case 'start':
                    await this.start();
                    break;
                case 'interact': {
                    const [data, metadata = null] = args;
                    const { cueId = null, userId } = metadata || {};
                    if (cueId !== null) {
                        await this.interactOnCue(cueId, data, userId);
                    } else {
                        await this.interact(data, userId);
                    }
                    break;
                }
                case 'cue': {
                    const [cueId] = args;
                    await this.cue(cueId);
                    break;
                }
                case 'wait':
                    await this.wait();
                    break;
                case 'end':
                    await this.end();
                    break;
                case 'reset':
                    await this.reset();
                    break;
                default:
                    break;
            }
            this.emit('input:command', command, ...args);
        } catch (e) {
            this.debug(`Error with command "${command}": ${e.message}`);
        }
    }

    async ensureInteraction(data, cueId = null, userId = null) {
        this.debug('Ensuring interaction... %O', data);

        const interactionIdentifier = {
            session_id: this.session.id,
        };

        if (cueId !== null) {
            interactionIdentifier.cue_id = cueId;
        }

        if (userId !== null) {
            interactionIdentifier.user_id = userId;
        }

        let interaction = await this.store.findItem('interactions', interactionIdentifier);
        if (interaction !== null) {
            interaction = await this.store.updateItem('interactions', interaction.id, {
                data,
            });
        } else {
            interaction = await this.store.addItem('interactions', {
                ...interactionIdentifier,
                data,
            });
        }

        return interaction;
    }

    async ensureSession() {
        const { id, getHandle } = this.definition;

        const handle = getHandle(id);

        this.debug('Ensuring session "%s"...', handle);

        const item = await this.store.findItem('sessions', {
            definition: id,
            handle,
        });

        if (item !== null) {
            this.debug('Session found.');
            return item;
        }

        this.debug('Creating new session "%s"...', handle);

        const newItem = await this.store.addItem('sessions', {
            definition: id,
            handle,
            started: false,
            ended: false,
            cue: null,
        });

        return newItem;
    }

    async resetSession() {
        const { id, handle } = this.session;
        this.debug('Resetting session "%s"...', handle);
        this.session = await this.store.updateItem('sessions', id, {
            started: false,
            ended: false,
            cue: null,
        });
    }

    async startSession() {
        const { id, handle } = this.session;
        this.debug('Starting session "%s"...', handle);
        this.session = await this.store.updateItem('sessions', id, {
            started: true,
            ended: false,
        });
    }

    async endSession() {
        const { id, handle } = this.session;
        this.debug('Ending session "%s"...', handle);
        this.session = await this.store.updateItem('sessions', id, {
            started: false,
            ended: true,
            cue: null,
        });
    }

    async setSessionCue(cue) {
        const { id, handle } = this.session;
        this.debug('Setting session "%s" cue... %o', handle, cue);
        this.session = await this.store.updateItem('sessions', id, {
            cue: cue !== null ? cue.id : null,
        });
    }

    initInputs() {
        this.debug('Init inputs...');
        return Promise.all(
            this.inputs.map((it) =>
                typeof it.init !== 'undefined' ? it.init() : Promise.resolve(),
            ),
        );
    }

    initOutputs() {
        this.debug('Init outputs...');
        return Promise.all(
            this.outputs.map((it) =>
                typeof it.init !== 'undefined' ? it.init() : Promise.resolve(),
            ),
        );
    }

    startInputs() {
        this.debug('Start inputs...');
        return Promise.all(
            this.inputs.map((it) =>
                typeof it.start !== 'undefined' ? it.start() : Promise.resolve(),
            ),
        );
    }

    startOutputs() {
        this.debug('Start outputs...');
        return Promise.all(
            this.outputs.map((it) =>
                typeof it.start !== 'undefined' ? it.start() : Promise.resolve(),
            ),
        );
    }

    sendCueToOutputs(cue) {
        this.debug('Send cue to outputs: %O', cue);
        return Promise.all(
            this.outputs.map((it) =>
                typeof it.cue !== 'undefined' ? it.cue(cue) : Promise.resolve(),
            ),
        );
    }

    sendInteractionToOutputs(interaction) {
        this.debug('Send interaction to outputs: %O', interaction);
        return Promise.all(
            this.outputs.map((it) =>
                typeof it.cue !== 'undefined' ? it.interact(interaction) : Promise.resolve(),
            ),
        );
    }

    sendCommandToOutputs(command, ...args) {
        this.debug(`Send command to outputs: %s %o`, command, args);
        return Promise.all(
            this.outputs.map((it) =>
                typeof it.cue !== 'undefined' ? it.command(command, ...args) : Promise.resolve(),
            ),
        );
    }

    stopInputs() {
        this.debug('Stop inputs...');
        return Promise.all(
            this.inputs.map((it) =>
                typeof it.stop !== 'undefined' ? it.stop() : Promise.resolve(),
            ),
        );
    }

    stopOutputs() {
        this.debug('Stop inputs...');
        return Promise.all(
            this.outputs.map((it) =>
                typeof it.stop !== 'undefined' ? it.stop() : Promise.resolve(),
            ),
        );
    }

    destroyInputs() {
        this.debug('Destroying inputs...');
        return Promise.all(
            this.inputs.map((it) =>
                typeof it.destroy !== 'undefined' ? it.destroy() : Promise.resolve(),
            ),
        );
    }

    destroyOutputs() {
        this.debug('Destroying outputs...');
        return Promise.all(
            this.outputs.map((it) =>
                typeof it.destroy !== 'undefined' ? it.destroy() : Promise.resolve(),
            ),
        );
    }
}

export default Application;
