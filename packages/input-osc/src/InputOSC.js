import { Server } from 'node-osc';
import StateMachine from 'javascript-state-machine';
import EventEmitter from 'wolfy87-eventemitter';
import createDebug from 'debug';

const debug = createDebug('server:osc_remote');

class InputOSC extends EventEmitter {
    constructor({ commands = null, ...opts } = {}) {
        super();
        this.options = {
            port: process.env.OSC_PORT || 8081,
            host: process.env.OSC_HOST || '0.0.0.0',
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
        this.onMessage = this.onMessage.bind(this);

        this.server = null;
        this.commands = commands;

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

    initialized() {
        return this.state.is('initialized');
    }

    setCommands(commands) {
        this.commands = commands;
        return this;
    }

    onInit() {
        this.emit('init');
    }

    onInitialized() {
        debug('initialized');
        return process.nextTick(() => this.emit('initialized'));
    }

    onDestroy() {
        debug('destroying...');
        this.emit('destroy');
        return new Promise((resolve) => {
            this.server.off('message', this.onMessage);
            this.server.close(() => {
                resolve();
            });
        });
    }

    onDestroyed() {
        debug('destroyed');
        return process.nextTick(() => this.emit('destroyed'));
    }

    onStart() {
        const { port, host } = this.options;
        this.emit('start');

        this.server = new Server(port, host);
        this.server.on('message', this.onMessage);
    }

    onStarted() {
        const { port, host } = this.options;
        debug(`started on ${host}:${port}`);

        return process.nextTick(() => this.emit('started'));
    }

    onStop() {
        this.emit('close');

        return new Promise((resolve) => {
            this.server.off('message', this.onMessage);
            this.server.close(() => {
                resolve();
            });
        });
    }

    onStopped() {
        debug('closed');
        return process.nextTick(() => this.emit('closed'));
    }

    onMessage(message) {
        const [command = null, ...args] = message;
        if (command !== null && (this.commands === null || this.commands.indexOf(command) !== -1)) {
            debug(`command: ${command}`);
            this.emit('command', command, ...args);
        }
    }
}

export default InputOSC;
