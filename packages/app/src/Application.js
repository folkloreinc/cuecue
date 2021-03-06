import StateMachine from 'javascript-state-machine';
import EventEmitter from 'wolfy87-eventemitter';
import createDebug from 'debug';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';

import MemoryStore from './MemoryStore';

class Application extends EventEmitter {
    constructor(definition, opts = {}) {
        super();
        this.definition = definition;

        this.options = {
            store: new MemoryStore(),
            debugFunction: createDebug('cuecue:app'),
            getHandle: (id) => `${id}_${dayjs().format('YYYY_MM_DD')}_${Date.now().toString(36)}`,
            validateCommand: (command) =>
                [
                    'start',
                    'end',
                    'cue',
                    'uncue',
                    'define',
                    'interact',
                    'reset',
                    'resetInteractions',
                    'restart',
                    'kill',
                ].indexOf(command) !== -1,
            ...opts,
        };

        const { store } = this.options;

        this.debug = createDebug('cuecue:app');
        this.store = store;
        this.session = null;
        this.statefulCue = null;
        this.cueDurationInterval = null;
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
        this.onCued = this.onCued.bind(this);
        this.onStop = this.onStop.bind(this);
        this.onStopped = this.onStopped.bind(this);
        this.onInputCommand = this.onInputCommand.bind(this);
        this.onAfterTransition = this.onAfterTransition.bind(this);
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
                onAfterCue: this.onCued,
                onBeforeUncue: this.onUncue,
                onBeforeEnd: this.onEnd,
                onBeforeStop: this.onStop,
                onAfterStop: this.onStopped,
                onAfterTransition: this.onAfterTransition,
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
        if (this.stateless()) {
            this.debug('First init');
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

    cue(id, sessionData = null) {
        return this.state.cue(id, sessionData);
    }

    async interact(data, interactionId = null) {
        this.sendInteractToOutputs(data, interactionId);
        const interaction = await this.ensureInteraction(data, interactionId || uuidv4());
        this.sendInteractionToOutputs(interaction);
        return interaction;
    }

    uncue() {
        return this.state.uncue();
    }

    async define(...newCues) {
        const cues = await this.getCues();
        const mergedArray = [...newCues, ...cues]; // The order matters
        this.debug('humm %O', newCues, cues);
        const set = new Set();
        const mergedCues = mergedArray.filter((item) => {
            if (!set.has(item.id)) {
                set.add(item.id);
                return true;
            }
            return false;
        }, set);
        this.debug('ok %O', mergedCues);

        const list = await this.setCues([...mergedCues]);

        await this.sendCuesToOutputs(list);
    }

    async reset() {
        await this.resetSessionInteractions();
        await this.resetSession();
        await this.uncue();

        this.sendCommandToOutputs('reset');
    }

    async restart() {
        this.destroy();
        await this.start();
    }

    // eslint-disable-next-line class-methods-use-this
    kill() {
        // Test this with something else than nodemon
        process.kill(process.pid, 'SIGUSR2');
    }

    stateless() {
        return this.state.is('none');
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

    ended() {
        return this.state.is('ended');
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

    async resetInteractions(...args) {
        const ids = args || [];

        this.resetInteractidonsByIds(ids);

        await this.sendUninteractionsToOutputs(ids);
    }

    async resetSessionInteractions() {
        await this.store.deleteItems('interactions', {
            sessionId: this.session.id,
        });
    }

    async resetInteractidonsByIds(ids) {
        return Promise.all(
            ids.map((id) =>
                this.store.deleteItems('interactions', {
                    sessionId: this.session.id,
                    externalId: id,
                }),
            ),
        );
    }

    getInteractions() {
        const { id: sessionId = null } = this.session || {};
        return this.store.getItems('interactions', {
            sessionId,
        });
    }

    getInteractionsByCue(cueId) {
        const { id: sessionId = null } = this.session || {};
        return this.store.getItems('interactions', {
            sessionId,
            cueId,
        });
    }

    getInteractionsByInteractionId(interactionId) {
        const { id: sessionId = null } = this.session || {};
        return this.store.getItems('interactions', {
            sessionId,
            interactionId,
        });
    }

    getInteractionsByUser(userId) {
        const { id: sessionId = null } = this.session || {};
        return this.store.getItems('interactions', {
            sessionId,
            userId,
        });
    }

    getCues(session) {
        const { id: sessionId = null } = this.session || session || {};
        return this.store.getItems('cues', {
            sessionId,
        });
    }

    async setCues(cues, session) {
        const { id: sessionId = null } = this.session || session || {};
        if (sessionId !== null) {
            await this.store.deleteItems('cues', {
                sessionId,
            });
            await this.store.addItems(
                'cues',
                cues.map((cueDef) => ({ sessionId, ...cueDef })),
            );
            return this.store.getItems('cues', {
                sessionId,
            });
        }
        return Promise.resolve();
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

    async onAfterTransition(lastTransition) {
        const { id: sessionId = null } = this.session || {};
        const { transition, from, to } = lastTransition || {};
        this.debug('After transition: %O from: %s to: %s', transition, from, to);
        if (transition !== 'init') {
            await this.sendCommandToOutputs('state', { sessionId, currentState: to });
        }
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

        if (this.store !== null && typeof this.store.destroy !== 'undefined') {
            await this.store.destroy();
        }

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

        this.debug('Session #%s', this.session.id);

        this.debug('Session WTF %O', this.session);

        try {
            await this.startInputs();

            await this.startOutputs();
        } catch (e) {
            this.debug('Session error %O', e);
        }

        const cues = await this.getCues();

        this.sendCuesToOutputs(cues);

        this.sendCommandToOutputs('start');

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
            const { cue = null, ended = false, data = null } = this.session;
            if (ended) {
                this.end();
            } else if (cue !== null) {
                this.cue(cue, data);
            }
        });
    }

    async onUncue() {
        this.stopCueDurationInterval();
        this.statefulCue = null;

        await this.setSessionCue(null);

        await this.sendCommandToOutputs('uncue');

        this.emit('uncue');
    }

    async onCue(state, cueId, sessionData = null) {
        const cues = await this.getCues();
        const cue = cues.find(({ id }) => id === cueId) || null;

        if (cue === null) {
            this.debug('Cannot find cue %s', cueId);
            return false;
        }

        const { id = null, stateful = false } = cue;
        if (stateful) {
            this.debug('Stateful cue: %s', id);
            this.statefulCue = cue;
            await this.setSessionCue(cue, sessionData);
        }

        await this.sendCueToOutputs(cue, sessionData);

        this.emit('cue', cue, sessionData);

        this.debug('onCue %s %O', cueId, sessionData);

        return true;
    }

    async onCued(state, cueId) {
        const cues = await this.getCues();
        const cue = cues.find(({ id }) => id === cueId) || null;

        if (cue === null) {
            this.debug('Cannot find cue %s', cueId);
            return false;
        }

        const { duration = null } = cue;
        if (duration !== null) {
            this.startCueDurationInterval(cue);
        }
    }

    async onCueDurationEnd(cue) {
        this.debug('Cue %s duration is ended', cue.id);
        const { after_duration: afterDuration = null } = cue;
        const { cues = [] } = this.definition;
        switch (afterDuration) {
            case 'next':
                const cueIndex = cues.findIndex(it => it.id === cue.id);
                const nextCue = cueIndex !== -1 && cueIndex < (cues.length - 1) ? cues[cueIndex + 1] : null;
                if (nextCue !== null) {
                    this.cue(nextCue.id);
                }
                break;
            default:
                this.uncue();
                break;
        }
    }

    async onStop() {
        this.emit('stop');

        this.stopCueDurationInterval();
        this.statefulCue = null;

        this.sendCommandToOutputs('stop');

        await this.stopInputs();

        await this.stopOutputs();
    }

    onStopped() {
        this.debug('stopped');
        return process.nextTick(() => this.emit('stopped'));
    }

    async onEnd() {
        await this.endSession();

        this.stopCueDurationInterval();
        this.session = null;
        this.statefulCue = null;

        this.sendCommandToOutputs('end');

        this.emit('ended');
    }

    async onInputCommand(command, ...args) {
        this.debug('onInputCommand %s', command, args);

        try {
            const {
                inputCommands = null,
                validateCommand = null,
                transformCommand = null,
            } = this.options;

            const { command: finalCommand = command, args: finalArgs = args } =
                (transformCommand !== null ? transformCommand(command, args) : null) || {};

            if (inputCommands !== null && inputCommands.indexOf(finalCommand) === -1) {
                this.debug('command not allowed: %s %o', finalCommand, finalArgs);
                return;
            }

            if (validateCommand !== null && !validateCommand(finalCommand, ...finalArgs)) {
                this.debug('validateCommand failed: %s %o', finalCommand, finalArgs);
                return;
            }

            this.emit('input:command', finalCommand, finalArgs);

            this[finalCommand](...finalArgs);
            this.debug(this[finalCommand], finalArgs);
        } catch (e) {
            this.debug(`Error with command "${command}": ${e.message}`);
        }
    }

    async ensureInteraction(data, interactionId) {
        this.debug('Ensuring interaction %s... %O', interactionId, data);

        const interactionIdentifier = {
            id: interactionId,
            sessionId: this.session.id,
        };

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

    startCueDurationInterval(cue) {
        const { duration = null } = cue;
        const startTime = new Date().getTime();
        this.debug('Starting interval for %i for cue %s...', duration, cue.id);
        this.cueDurationInterval = setInterval(() => {
            const currentTime = new Date().getTime();
            const currentDuration = Math.floor((currentTime - startTime) / 1000);
            if (currentDuration >= duration) {
                clearInterval(this.cueDurationInterval);
                this.cueDurationInterval = null;
                this.onCueDurationEnd(cue);
            }
        }, 10);
    }

    stopCueDurationInterval() {
        if (this.cueDurationInterval !== null) {
            this.debug('Stopping interval for cue...',);
            clearInterval(this.cueDurationInterval);
            this.cueDurationInterval = null;
        }
    }

    async ensureSession() {
        const { getHandle } = this.options;
        const { id: definitionId, cues = [] } = this.definition;

        this.debug('Getting started session...');

        const item = await this.store.findItem('sessions', {
            definition: definitionId,
            started: true,
            ended: false,
        });

        if (item !== null) {
            this.debug('Session found %s.', item.id);
            return item;
        }

        const handle = getHandle(definitionId);

        this.debug('Creating new session "%s"...', handle);

        const newItem = await this.store.addItem('sessions', {
            id: handle,
            definition: definitionId,
            started: false,
            ended: false,
            cue: null,
        });

        this.debug('Setting initial "%s" cues...', cues !== null ? cues.length : 0);

        await this.setCues(cues, newItem);

        this.debug('New session "%s"', newItem !== null ? newItem.id : null);

        return newItem;
    }

    async resetSession() {
        const { id, handle } = this.session;
        this.debug('Resetting session "%s"...', handle);
        this.session = await this.store.updateItem('sessions', id, {
            started: true,
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

    async setSessionCue(cue, sessionData = null) {
        const { id, handle } = this.session;
        this.debug('Setting session "%s" %s, cue... %o', handle, id, cue);
        this.session = await this.store.updateItem('sessions', id, {
            cue: cue !== null ? cue.id : null,
            data: sessionData,
        });
    }

    async getSessionCue() {
        const cues = await this.getCues();
        const { cue: cueId = null } = this.session || {};
        const cue = cues.find((c) => c.id === cueId) || null;
        return cue;
    }

    getSessionData() {
        const { data = null } = this.session || {};
        return data;
    }

    /**
     * Call inputs and outputs
     */

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
        this.debug('Start inputs... %s', this.inputs.length);
        return Promise.all(
            this.inputs.map((it) =>
                typeof it.start !== 'undefined' ? it.start() : Promise.resolve(),
            ),
        );
    }

    startOutputs() {
        this.debug('Start outputs... %s', this.outputs.length);
        return Promise.all(
            this.outputs.map((it) =>
                typeof it.start !== 'undefined' ? it.start() : Promise.resolve(),
            ),
        );
    }

    sendCueToOutputs(cue, sessionData = null) {
        this.debug('Send cue to outputs: %O %O', cue, sessionData);
        return Promise.all(
            this.outputs.map((it) =>
                typeof it.cue !== 'undefined' ? it.cue(cue, sessionData) : Promise.resolve(),
            ),
        );
    }

    sendCuesToOutputs(cues) {
        this.debug('Send cues to outputs: %O', cues);
        return Promise.all(
            this.outputs.map((it) =>
                typeof it.cues !== 'undefined' ? it.cues(cues) : Promise.resolve(),
            ),
        );
    }

    sendInteractToOutputs(data, interactionId) {
        this.debug('Send interact to outputs: %O %s', data, interactionId);
        return Promise.all(
            this.outputs.map((it) =>
                typeof it.interact !== 'undefined'
                    ? it.interact(data, interactionId)
                    : Promise.resolve(),
            ),
        );
    }

    sendInteractionToOutputs(interaction) {
        this.debug('Send interaction to outputs: %O', interaction);
        return Promise.all(
            this.outputs.map((it) =>
                typeof it.interaction !== 'undefined'
                    ? it.interaction(interaction)
                    : Promise.resolve(),
            ),
        );
    }

    sendUninteractionToOutputs(interactionId) {
        this.debug('Send interact to outputs: %O %s', interactionId);
        return Promise.all(
            this.outputs.map((it) =>
                typeof it.uninteraction !== 'undefined'
                    ? it.uninteraction(interactionId)
                    : Promise.resolve(),
            ),
        );
    }

    sendUninteractionsToOutputs(interactionIds) {
        this.debug('Send uninteractions to outputs: %O', interactionIds);
        return Promise.all(
            this.outputs.map((it) =>
                typeof it.uninteractions !== 'undefined'
                    ? it.uninteractions(interactionIds)
                    : Promise.resolve(),
            ),
        );
    }

    sendCommandToOutputs(command, ...args) {
        this.debug(`Send command to outputs: %s %o`, command, args);
        return Promise.all(
            this.outputs.map((it) =>
                typeof it.command !== 'undefined'
                    ? it.command(command, ...args)
                    : Promise.resolve(),
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
