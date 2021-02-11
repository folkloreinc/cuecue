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
        this.emit('init');
    }

    onInitialized() {
        this.debug('initialized');
        return process.nextTick(() => this.emit('initialized'));
    }

    onDestroy() {
        this.debug('destroying...');
        this.emit('destroy');
    }

    onDestroyed() {
        this.debug('destroyed');
        return process.nextTick(() => this.emit('destroyed'));
    }

    onStart() {
        this.emit('start');
    }

    onStarted() {
        this.debug('started');
        return process.nextTick(() => this.emit('started'));
    }

    onStop() {
        this.emit('stop');
    }

    onStopped() {
        this.debug('stopped');
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
}

export default BasePlugin;
