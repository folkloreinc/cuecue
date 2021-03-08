import StateMachine from 'javascript-state-machine';
import EventEmitter from 'wolfy87-eventemitter';
import createDebug from 'debug';

class BasePlugin extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.options = {
            ...opts,
        };

        this.onInit = this.onInit.bind(this);
        this.onInitialized = this.onInitialized.bind(this);
        this.onDestroy = this.onDestroy.bind(this);
        this.onDestroyed = this.onDestroyed.bind(this);
        this.onStart = this.onStart.bind(this);
        this.onStarted = this.onStarted.bind(this);
        this.onStop = this.onStop.bind(this);
        this.onStopped = this.onStopped.bind(this);
        this.onPendingTransition = this.onPendingTransition.bind(this);
        this.onInvalidTransition = this.onInvalidTransition.bind(this);

        this.debug = createDebug('cuecue:input');

        this.state = new StateMachine({
            transitions: [
                { name: 'init', from: 'none', to: 'initialized' },
                { name: 'destroy', from: '*', to: 'none' },
                { name: 'start', from: ['initialized', 'stopped'], to: 'started' },
                { name: 'stop', from: 'started', to: 'stopped' },
            ],
            methods: {
                onBeforeInit: this.onInit,
                onAfterInit: this.onInitialized,
                onBeforeDestroy: this.onDestroy,
                onAfterDestroy: this.onDestroyed,
                onBeforeStart: this.onStart,
                onAfterStart: this.onStarted,
                onBeforeStop: this.onStop,
                onAfterStop: this.onStopped,
                onPendingTransition: this.onPendingTransition,
                onInvalidTransition: this.onInvalidTransition,
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

    started() {
        return this.state.is('started');
    }

    initialized() {
        return this.state.is('initialized');
    }

    onInit() {
        this.debug('onInit');
        this.emit('init');
    }

    onInitialized() {
        this.debug('onInitialized');
        return process.nextTick(() => this.emit('initialized'));
    }

    onDestroy() {
        this.debug('onDestroy');
        this.emit('destroy');
    }

    onDestroyed() {
        this.debug('onDestroyed');
        return process.nextTick(() => this.emit('destroyed'));
    }

    onStart() {
        this.debug('onStart');
        this.emit('start');
    }

    onStarted() {
        this.debug('onStarted');
        return process.nextTick(() => this.emit('started'));
    }

    onStop() {
        this.debug('onStop');
        this.emit('stop');
    }

    onStopped() {
        this.debug('onStopped');
        return process.nextTick(() => this.emit('stopped'));
    }

    onPendingTransition(transition, from, to) {
        this.debug('Pending transition: %s from: %s to: %s', transition, from, to);
        return new Promise((resolve) => {
            if (transition === 'init') {
                this.once('initialized', resolve);
            }
        });
    }

    onInvalidTransition(transition, from, to) {
        console.log(this.state.state);
        this.debug('ERROR: Invalid base transition: %s from: %s to: %s', transition, from, to);
    }
}

export default BasePlugin;
