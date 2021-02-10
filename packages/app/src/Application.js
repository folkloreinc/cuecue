import StateMachine from 'javascript-state-machine';
import EventEmitter from 'wolfy87-eventemitter';
import createDebug from 'debug';
import dayjs from 'dayjs';

import MemoryStore from './MemoryStore';

class Application extends EventEmitter {
    constructor(definition, opts = {}) {
        super();
        this.definition = {
            getHandle: (id) => `${id}_${dayjs().format('YYYY_mm_dd')}`,
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
        this.inputs = [];
        this.outputs = [];

        this.onInit = this.onInit.bind(this);
        this.onInitialized = this.onInitialized.bind(this);
        this.onDestroy = this.onDestroy.bind(this);
        this.onDestroyed = this.onDestroyed.bind(this);
        this.onStart = this.onStart.bind(this);
        this.onStarted = this.onStarted.bind(this);
        this.onWait = this.onWait.bind(this);
        this.onEnd = this.onEnd.bind(this);
        this.onCue = this.onCue.bind(this);
        this.onStop = this.onStop.bind(this);
        this.onStopped = this.onStopped.bind(this);

        this.state = new StateMachine({
            transitions: [
                { name: 'init', from: 'none', to: 'initialized' },
                { name: 'destroy', from: '*', to: 'none' },
                { name: 'start', from: ['initialized', 'stopped'], to: 'started' },
                { name: 'wait', from: ['started', 'ended', 'cued'], to: 'started' },
                {
                    name: 'cue',
                    from: ['started', 'ended', 'cued'],
                    to: 'cued',
                },
                {
                    name: 'end',
                    from: ['started', 'cued'],
                    to: 'ended',
                },
                {
                    name: 'stop',
                    from: ['started', 'ended', 'cued'],
                    to: 'stopped',
                },
            ],
            methods: {
                onBeforeInit: this.onInit,
                onAfterInit: this.onInitialized,
                onBeforeDestroy: this.onDestroy,
                onAfterDestroy: this.onDestroyed,
                onBeforeStart: this.onStart,
                onAfterStart: this.onStarted,
                onBeforeWait: this.onWait,
                onBeforeEnd: this.onEnd,
                onBeforeCue: this.onCue,
                onBeforeStop: this.onStop,
                onAfterStop: this.onStopped,
            },
        });

        this.init();
    }

    init() {
        return this.state.init();
    }

    destroy() {
        return this.state.destroy();
    }

    start() {
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

    wait() {
        return this.state.wait();
    }

    async reset() {
        await this.wait();
    }

    initialized() {
        return this.state.is('initialized');
    }

    started() {
        return this.state.is('started');
    }

    stopped() {
        return this.state.is('stopped');
    }

    addInput(input) {
        this.inputs = [...this.inputs, input];
        
        input.on('command', this.onInputCommand);
    }

    removeInput(input) {
        this.inputs = this.inputs.filter((it) => it !== input);
    }

    addOutput(output) {
        this.outputs = [...this.outputs, output];
    }

    removeOutput(output) {
        this.outputs = this.outputs.filter((it) => it !== output);
    }

    async onInit() {
        this.emit('init');

        if (this.store !== null && typeof this.store.init !== 'undefined') {
            await this.store.init();
        }
        
        await this.initInputs();
        
        await this.initOutputs();

        this.session = await this.ensureSession();

        this.debug(`Session #${this.session.id}.`);
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
        
        await this.startInputs();
        
        await this.startOutputs();

        this.emit('start');
    }

    async onStarted() {
        this.debug('started');
        
        await this.startSession();

        return process.nextTick(() => {
            this.emit('started');
            
            // Recover
            const { cue = null, ended = false } = this.session;
            if (ended) {
                this.end();
            } else if (cue !== null) {
                this.cue(cue);
            }
        });
    }

    async onWait() {
        await this.setSessionCue(null);

        this.cue = null;

        this.emit('wait');
    }

    async onEnd() {
        await this.endSession();

        this.cue = null;

        this.emit('end');
    }

    async onCue(state, cueId) {
        const { cues } = this.definition;
        const cue = cues.find(({ id }) => id === cueId) || null;
        if (cue === null) {
            return false;
        }

        await this.setSessionCue(cue);

        this.cue = cue;
        
        await this.sendCueToOutputs(cue);

        this.emit('cue', cue);

        return true;
    }

    async onStop() {
        this.emit('stop');

        this.step = null;
        
        await this.stopInputs();
        
        await this.stopOutputs();
    }

    onStopped() {
        this.debug('stopped');

        return process.nextTick(() => this.emit('stopped'));
    }
    
    async onInputCommand(command, ...args) {
        try {
            switch (command) {
                case 'start':
                    await this.start();
                    break;
                case 'cue':
                    await this.cue(args[0]);
                    break;
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
        } catch (e) {
            this.debug(`Error with command "${command}": ${e.message}`);
        }

        this.emit('input:command', command, ...args);
    }

    async ensureSession() {
        const { id, getHandle } = this.definition;

        this.debug('Ensuring session...');
        
        const handle = getHandle(id);

        const item = await this.store.findItem('sessions', {
            definition: id,
            handle,
        });

        if (item !== null) {
            this.debug('Session found.');
            return item;
        }

        this.debug(`Creating new session...`);

        const newItem = await this.store.addItem('sessions', {
            definition: id,
            handle,
            started: false,
            ended: false,
        });

        return newItem;
    }
    
    async startSession() {
        const { id } = this.session;
        this.session = await this.store.updateItem('sessions', id, {
            started: true,
            ended: false,
        });
    }
    
    async endSession() {
        const { id } = this.session;
        this.session =  await this.store.updateItem('sessions', id, {
            started: false,
            ended: true,
            cue: null,
        });
    }
    
    async setSessionCue(cue) {
        const { id } = this.session;
        this.session = await this.store.updateItem('sessions', id, {
            cue: cue !== null ? cue.id : null,
        });
    }

    initInputs() {
        return Promise.all(
            this.inputs.map((it) =>
                typeof it.init !== 'undefined' ? it.init() : Promise.resolve(),
            ),
        );
    }

    initOutputs() {
        return Promise.all(
            this.outputs.map((it) =>
                typeof it.init !== 'undefined' ? it.init() : Promise.resolve(),
            ),
        );
    }

    startInputs() {
        return Promise.all(
            this.inputs.map((it) =>
                typeof it.start !== 'undefined' ? it.start() : Promise.resolve(),
            ),
        );
    }

    startOutputs() {
        return Promise.all(
            this.outputs.map((it) =>
                typeof it.start !== 'undefined' ? it.start() : Promise.resolve(),
            ),
        );
    }

    stopInputs() {
        return Promise.all(
            this.inputs.map((it) =>
                typeof it.stop !== 'undefined' ? it.stop() : Promise.resolve(),
            ),
        );
    }

    stopOutputs() {
        return Promise.all(
            this.outputs.map((it) =>
                typeof it.stop !== 'undefined' ? it.stop() : Promise.resolve(),
            ),
        );
    }
    
    sendCueToOutputs(cue) {
        return Promise.all(
            this.outputs.map((it) =>
                typeof it.cue !== 'undefined' ? it.cue(cue) : Promise.resolve(),
            ),
        );
    }

    destroyInputs() {
        return Promise.all(
            this.inputs.map((it) =>
                typeof it.destroy !== 'undefined' ? it.destroy() : Promise.resolve(),
            ),
        );
    }

    destroyOutputs() {
        return Promise.all(
            this.outputs.map((it) =>
                typeof it.destroy !== 'undefined' ? it.destroy() : Promise.resolve(),
            ),
        );
    }
}

export default Application;
