import { afterEach, describe, expect, it, vi } from 'vitest';
import Application from './Application';
import MemoryStore from './MemoryStore';

const tick = () =>
    new Promise((resolve) => {
        setTimeout(resolve, 20);
    });

const createApp = (definition = {}, options = {}) =>
    new Application(
        { id: 'show', cues: [], ...definition },
        { logger: { error: vi.fn() }, ...options },
    );

afterEach(() => {
    vi.useRealTimers();
});

describe('Application with a failing output', () => {
    // Vitest fails the run on an unhandled rejection: these tests also check that there is none.
    const failingOutput = () => ({
        cue: vi.fn(() => Promise.reject(new Error('Output is down'))),
        cues: vi.fn(() => {
            throw new Error('Output is broken');
        }),
        command: vi.fn(() => Promise.reject(new Error('Output is down'))),
    });

    it('keeps running and logs the failures', async () => {
        const app = createApp({ cues: [{ id: 'intro', stateful: true }] });
        const output = failingOutput();
        app.output(output);

        await app.start();
        await app.cue('intro');
        await tick();

        expect(app.getCurrentCueId()).toBe('intro');
        expect(output.cue).toHaveBeenCalled();
        expect(app.options.logger.error).toHaveBeenCalledWith(
            '[cuecue] An output failed on "cue": Output is down',
        );
        expect(app.options.logger.error).toHaveBeenCalledWith(
            '[cuecue] An output failed on "cues": Output is broken',
        );
    });

    it('still sends to the other outputs', async () => {
        const app = createApp({ cues: [{ id: 'intro' }] });
        const working = { cue: vi.fn(() => Promise.resolve()) };
        app.output(failingOutput());
        app.output(working);

        await app.start();
        await app.cue('intro');

        expect(working.cue).toHaveBeenCalledWith(expect.objectContaining({ id: 'intro' }), null);
    });
});

describe('Application commands from inputs', () => {
    const createInput = () => {
        const listeners = [];
        return {
            on: (event, listener) => listeners.push(listener),
            send: (command, ...args) =>
                Promise.all(listeners.map((listener) => listener(command, ...args))),
        };
    };

    it('ignores reset after the session ended', async () => {
        const app = createApp();
        const input = createInput();
        app.input(input);
        await app.start();
        await input.send('end');
        await tick();

        await input.send('reset');
        await input.send('resetInteractions', 'interaction-1');
        await tick();

        expect(app.ended()).toBe(true);
    });

    it('logs a command that fails', async () => {
        const app = createApp();
        const input = createInput();
        app.input(input);
        await app.start();
        app.define = () => Promise.reject(new Error('Store is down'));

        await input.send('define', { id: 'intro' });

        expect(app.options.logger.error).toHaveBeenCalledWith(
            '[cuecue] The command "define" failed: Store is down',
        );
    });
});

describe('Application cue durations', () => {
    it('uncues a cue at the end of its duration', async () => {
        vi.useFakeTimers();
        const app = createApp({ cues: [{ id: 'intro', stateful: true, duration: 2 }] });
        await app.start();
        await app.cue('intro');

        await vi.advanceTimersByTimeAsync(1900);
        expect(app.getCurrentCueId()).toBe('intro');
        await vi.advanceTimersByTimeAsync(200);
        expect(app.getCurrentCueId()).toBe(null);
    });

    it('forgets the duration of a cue once another cue starts', async () => {
        vi.useFakeTimers();
        const app = createApp({
            cues: [
                { id: 'intro', stateful: true, duration: 1 },
                { id: 'vote', stateful: true },
            ],
        });
        const uncued = vi.fn();
        app.on('uncue', uncued);
        await app.start();
        await app.cue('intro');
        await vi.advanceTimersByTimeAsync(500);
        await app.cue('vote');

        await vi.advanceTimersByTimeAsync(5000);

        expect(app.getCurrentCueId()).toBe('vote');
        expect(uncued).not.toHaveBeenCalled();
    });

    it('keeps the duration of a cue when the next cue doesn’t exist', async () => {
        vi.useFakeTimers();
        const app = createApp({ cues: [{ id: 'intro', stateful: true, duration: 1 }] });
        await app.start();
        await app.cue('intro');
        await app.cue('missing');

        await vi.advanceTimersByTimeAsync(1100);

        expect(app.getCurrentCueId()).toBe(null);
    });

    it('goes to the next cue of the session, defined ones included', async () => {
        vi.useFakeTimers();
        const app = createApp({
            cues: [{ id: 'intro', stateful: true, duration: 1, after_duration: 'next' }],
        });
        await app.start();
        await app.define(
            { id: 'intro', stateful: true, duration: 1, after_duration: 'next' },
            {
                id: 'vote',
                stateful: true,
            },
        );
        await app.cue('intro');

        await vi.advanceTimersByTimeAsync(1100);

        expect(app.getCurrentCueId()).toBe('vote');
    });
});

const createRecorder = () => {
    const calls = [];
    const record =
        (method) =>
        (...args) => {
            calls.push([method, ...args]);
            return Promise.resolve();
        };
    return {
        calls,
        commands: () =>
            calls.filter(([method]) => method === 'command').map(([, command]) => command),
        output: {
            cue: record('cue'),
            cues: record('cues'),
            interact: record('interact'),
            interaction: record('interaction'),
            uninteractions: record('uninteractions'),
            command: record('command'),
        },
    };
};

describe('Application lifecycle', () => {
    it('starts idle, with a new session', async () => {
        const app = createApp({ id: 'show' });
        expect(app.stateless()).toBe(true);

        await app.start();
        await tick();

        expect(app.idle()).toBe(true);
        expect(app.session).toMatchObject({ definition: 'show', started: true, ended: false });
        expect(app.session.id).toMatch(/^show_\d{4}_\d{2}_\d{2}_/);
    });

    it('sends its cues, start and its state to the outputs', async () => {
        const app = createApp({ cues: [{ id: 'intro' }] });
        const recorder = createRecorder();
        app.output(recorder.output);

        await app.start();
        await tick();

        expect(recorder.calls[0]).toEqual([
            'cues',
            [expect.objectContaining({ id: 'intro', sessionId: app.session.id })],
        ]);
        expect(recorder.calls).toContainEqual(['command', 'start', { sessionId: app.session.id }]);
        expect(recorder.calls).toContainEqual([
            'command',
            'state',
            { sessionId: app.session.id, currentState: 'idle' },
        ]);
    });

    it('cues and uncues', async () => {
        const app = createApp({ cues: [{ id: 'intro', stateful: true }] });
        const recorder = createRecorder();
        app.output(recorder.output);
        await app.start();

        await app.cue('intro', { round: 1 });
        expect(app.state.state).toBe('cued');
        expect(app.getCurrentCueId()).toBe('intro');
        expect(app.getSessionData()).toEqual({ round: 1 });
        expect(await app.getSessionCue()).toMatchObject({ id: 'intro' });
        expect(recorder.calls).toContainEqual([
            'cue',
            expect.objectContaining({ id: 'intro' }),
            { round: 1 },
        ]);

        await app.uncue();
        expect(app.idle()).toBe(true);
        expect(app.getCurrentCueId()).toBe(null);
        expect(await app.getSessionCue()).toBe(null);
        expect(recorder.calls).toContainEqual(['command', 'uncue', { sessionId: app.session.id }]);
    });

    it('sends a cue that isn’t stateful without keeping it', async () => {
        const app = createApp({
            cues: [{ id: 'intro', stateful: true }, { id: 'applause' }],
        });
        const recorder = createRecorder();
        app.output(recorder.output);
        await app.start();
        await app.cue('intro');

        await app.cue('applause');

        expect(recorder.calls).toContainEqual([
            'cue',
            expect.objectContaining({ id: 'applause' }),
            null,
        ]);
        expect(app.getCurrentCueId()).toBe('intro');
    });

    it('ignores a cue it doesn’t have', async () => {
        const app = createApp({ cues: [{ id: 'intro', stateful: true }] });
        const recorder = createRecorder();
        app.output(recorder.output);
        await app.start();

        await app.cue('missing');

        expect(app.idle()).toBe(true);
        expect(recorder.calls.filter(([method]) => method === 'cue')).toEqual([]);
    });

    it('ignores commands that its state doesn’t allow', async () => {
        const app = createApp({ cues: [{ id: 'intro' }] });

        await app.cue('intro');
        expect(app.stateless()).toBe(true);

        await app.start();
        await app.start();
        expect(app.idle()).toBe(true);
    });

    it('ends its session, then starts a new one', async () => {
        const app = createApp({ cues: [{ id: 'intro', stateful: true }] });
        const recorder = createRecorder();
        app.output(recorder.output);
        await app.start();
        await tick();
        const first = app.session.id;
        await app.cue('intro');

        await app.end();
        expect(app.ended()).toBe(true);
        expect(app.session).toBe(null);
        expect(app.getCurrentCueId()).toBe(null);
        expect(recorder.commands()).toContain('end');
        expect(await app.store.findItem('sessions', first)).toMatchObject({
            started: false,
            ended: true,
            cue: null,
        });

        // Two sessions of the same definition in the same millisecond would share a handle.
        await new Promise((resolve) => {
            setTimeout(resolve, 5);
        });
        await app.start();
        await tick();
        expect(app.idle()).toBe(true);
        expect(app.session.id).not.toBe(first);
    });

    it('stops, then starts again in the same session', async () => {
        const app = createApp();
        const recorder = createRecorder();
        app.output(recorder.output);
        await app.start();
        await tick();
        const { id } = app.session;

        await app.stop();
        expect(app.stopped()).toBe(true);
        expect(recorder.commands()).toContain('stop');

        await app.start();
        await tick();
        expect(app.idle()).toBe(true);
        expect(app.session.id).toBe(id);
    });

    it('resumes the started session of its store, with its cue', async () => {
        const store = new MemoryStore();
        const first = createApp({ cues: [{ id: 'intro', stateful: true }] }, { store });
        await first.start();
        await tick();
        await first.cue('intro', { round: 2 });

        const second = createApp({ cues: [{ id: 'intro', stateful: true }] }, { store });
        const cued = new Promise((resolve) => {
            second.once('cue', (...args) => resolve(args));
        });
        await second.start();

        const [cue, data] = await cued;
        expect(second.session.id).toBe(first.session.id);
        expect(cue).toMatchObject({ id: 'intro' });
        expect(data).toEqual({ round: 2 });
        await vi.waitFor(() => expect(second.getCurrentCueId()).toBe('intro'));
    });

    it('resets its session: no cue, no interactions', async () => {
        const app = createApp({ cues: [{ id: 'intro', stateful: true }] });
        const recorder = createRecorder();
        app.output(recorder.output);
        await app.start();
        await app.cue('intro');
        await app.interact({ vote: 'a' }, 'interaction-1');

        await app.reset();

        expect(app.idle()).toBe(true);
        expect(app.getCurrentCueId()).toBe(null);
        expect(await app.getInteractions()).toEqual([]);
        expect(recorder.commands()).toContain('reset');
    });
});

describe('Application cues', () => {
    it('defines new cues, which replace the cues with the same id', async () => {
        const app = createApp({
            cues: [
                { id: 'intro', label: 'Intro' },
                { id: 'vote', label: 'Vote' },
            ],
        });
        const recorder = createRecorder();
        app.output(recorder.output);
        await app.start();

        await app.define({ id: 'vote', label: 'New vote' }, { id: 'credits' });

        const cues = await app.getCues();
        expect(cues.map(({ id, label }) => [id, label])).toEqual([
            ['vote', 'New vote'],
            ['credits', undefined],
            ['intro', 'Intro'],
        ]);
        expect(recorder.calls.at(-1)).toEqual(['cues', cues]);
    });

    it('keeps the cues of each session apart', async () => {
        const store = new MemoryStore();
        const show = createApp({ id: 'show', cues: [{ id: 'intro' }] }, { store });
        const other = createApp({ id: 'other', cues: [{ id: 'credits' }] }, { store });
        await show.start();
        await other.start();

        expect((await show.getCues()).map(({ id }) => id)).toEqual(['intro']);
        expect((await other.getCues()).map(({ id }) => id)).toEqual(['credits']);
    });
});

describe('Application interactions', () => {
    it('ignores interactions outside a session', async () => {
        const app = createApp();
        expect(await app.interact({ vote: 'a' })).toBe(null);
    });

    it('keeps an interaction and sends it to the outputs', async () => {
        const app = createApp();
        const recorder = createRecorder();
        app.output(recorder.output);
        await app.start();

        const interaction = await app.interact({ vote: 'a' }, 'interaction-1');

        expect(interaction).toMatchObject({
            id: 'interaction-1',
            sessionId: app.session.id,
            data: { vote: 'a' },
        });
        expect(recorder.calls).toContainEqual(['interact', { vote: 'a' }, 'interaction-1']);
        expect(recorder.calls).toContainEqual(['interaction', interaction]);
        expect(await app.getInteractions()).toEqual([interaction]);
    });

    it('gives an id to an interaction without one', async () => {
        const app = createApp();
        await app.start();

        const interaction = await app.interact({ vote: 'a' });

        expect(interaction.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('updates an interaction with the same id instead of adding one', async () => {
        const app = createApp();
        await app.start();

        await app.interact({ vote: 'a' }, 'interaction-1');
        await app.interact({ vote: 'b' }, 'interaction-1');

        const interactions = await app.getInteractions();
        expect(interactions).toHaveLength(1);
        expect(interactions[0].data).toEqual({ vote: 'b' });
    });

    it('ties interactions to the current cue when it takes interactions', async () => {
        const app = createApp({
            cues: [
                { id: 'vote', stateful: true, interaction: true },
                { id: 'credits', stateful: true },
            ],
        });
        await app.start();
        await app.cue('vote');
        await app.interact({ vote: 'a' }, 'interaction-1');
        await app.cue('credits');
        await app.interact({ vote: 'b' }, 'interaction-2');

        expect((await app.getInteractionsByCue('vote')).map(({ id }) => id)).toEqual([
            'interaction-1',
        ]);
        expect(
            (await app.getInteractions()).find(({ id }) => id === 'interaction-2'),
        ).not.toHaveProperty('cueId');
    });

    it('resets some interactions and tells the outputs', async () => {
        const app = createApp();
        const recorder = createRecorder();
        app.output(recorder.output);
        await app.start();
        await app.interact({ vote: 'a' }, 'interaction-1');
        await app.interact({ vote: 'b' }, 'interaction-2');

        await app.resetInteractions('interaction-1');

        expect((await app.getInteractions()).map(({ id }) => id)).toEqual(['interaction-2']);
        expect(recorder.calls).toContainEqual(['uninteractions', ['interaction-1']]);
    });
});

describe('Application commands during a transition', () => {
    // Settles with 'timeout' when the promise doesn't settle in time, instead of hanging the test.
    const settled = (promise, ms = 500) =>
        Promise.race([
            promise.then(() => 'settled'),
            new Promise((resolve) => {
                setTimeout(() => resolve('timeout'), ms);
            }),
        ]);

    const createInput = () => {
        const listeners = [];
        return {
            on: (event, listener) => listeners.push(listener),
            send: (command, ...args) =>
                Promise.all(listeners.map((listener) => listener(command, ...args))),
        };
    };

    // An output that only answers when told to, like an unreachable PubNub before its timeout.
    const createSlowOutput = () => {
        const calls = [];
        const pending = [];
        const record =
            (method) =>
            (...args) => {
                calls.push(method === 'command' ? [method, args[0], args[1]] : [method, args[0]]);
                return new Promise((resolve) => {
                    pending.push(resolve);
                });
            };
        return {
            calls,
            answerAll: () => pending.splice(0).forEach((resolve) => resolve()),
            output: {
                cue: record('cue'),
                cues: record('cues'),
                command: record('command'),
            },
        };
    };

    // A store that takes some time to save, like MySQL.
    class SlowStore extends MemoryStore {
        async updateItem(...args) {
            await new Promise((resolve) => {
                setTimeout(resolve, 10);
            });
            return super.updateItem(...args);
        }
    }

    const cues = [
        { id: 'intro', stateful: true },
        { id: 'vote', stateful: true },
    ];

    it('doesn’t wait for the outputs to finish a transition', async () => {
        const app = createApp({ cues });
        const slow = createSlowOutput();
        app.output(slow.output);
        await settled(app.start());

        expect(await settled(app.cue('intro'))).toBe('settled');
        expect(app.getCurrentCueId()).toBe('intro');
        expect(await settled(app.uncue())).toBe('settled');
        expect(await settled(app.end())).toBe('settled');
        expect(app.ended()).toBe(true);
    });

    it('runs a command sent while a cue waits for its outputs', async () => {
        const app = createApp({ cues });
        const slow = createSlowOutput();
        app.output(slow.output);
        await settled(app.start());

        const first = app.cue('intro');
        const second = app.cue('vote');

        expect(await settled(Promise.all([first, second]))).toBe('settled');
        expect(app.getCurrentCueId()).toBe('vote');
        slow.answerAll();
    });

    it('runs the commands of its inputs one after the other, in order', async () => {
        const app = createApp({ cues }, { store: new SlowStore() });
        const input = createInput();
        app.input(input);
        const recorder = createRecorder();
        app.output(recorder.output);
        await app.start();
        await tick();

        const sent = [
            input.send('cue', 'intro'),
            input.send('cue', 'vote'),
            input.send('uncue'),
            input.send('cue', 'intro'),
            input.send('end'),
        ];

        expect(await settled(Promise.all(sent))).toBe('settled');
        expect(app.ended()).toBe(true);
        expect(app.options.logger.error).not.toHaveBeenCalled();
        const sessionId = recorder.calls.find(([, command]) => command === 'start')[2].sessionId;
        expect(await app.store.findItem('sessions', sessionId)).toMatchObject({ ended: true });
        const messages = recorder.calls
            .map(([method, arg]) => (method === 'cue' ? `cue ${arg.id}` : arg))
            .filter((message) => typeof message === 'string' && message !== 'state');
        expect(messages).toEqual(['start', 'cue intro', 'cue vote', 'uncue', 'cue intro', 'end']);
    });

    it('keeps the order of the messages to each output', async () => {
        const app = createApp({ cues });
        const slow = createSlowOutput();
        app.output(slow.output);
        await settled(app.start());
        slow.calls.splice(0);

        await settled(Promise.all([app.cue('intro'), app.cue('vote'), app.uncue()]));

        expect(slow.calls).toEqual([
            ['cue', expect.objectContaining({ id: 'intro' })],
            ['command', 'state', expect.objectContaining({ currentState: 'cued' })],
            ['cue', expect.objectContaining({ id: 'vote' })],
            ['command', 'state', expect.objectContaining({ currentState: 'cued' })],
            ['command', 'uncue', expect.anything()],
            ['command', 'state', expect.objectContaining({ currentState: 'idle' })],
        ]);
        slow.answerAll();
    });

    it('restarts once the running transition ends', async () => {
        const app = createApp({ cues });
        await app.start();
        await tick();

        const cued = app.cue('intro');
        const restarted = app.restart();

        expect(await settled(Promise.all([cued, restarted]))).toBe('settled');
        expect(app.stateless()).toBe(false);
        expect(app.options.logger.error).not.toHaveBeenCalled();
    });
});

describe('Application inputs', () => {
    const createInput = () => {
        const listeners = new Set();
        return {
            on: (event, listener) => listeners.add(listener),
            off: (event, listener) => listeners.delete(listener),
            send: (command, ...args) =>
                Promise.all([...listeners].map((listener) => listener(command, ...args))),
        };
    };

    it('runs the commands of its inputs', async () => {
        const app = createApp({ cues: [{ id: 'intro', stateful: true }] });
        const input = createInput();
        app.input(input);

        await input.send('start');
        await tick();
        await input.send('cue', 'intro');

        expect(app.getCurrentCueId()).toBe('intro');
    });

    it('refuses the commands that validateCommand refuses', async () => {
        const app = createApp(
            {},
            { validateCommand: (command) => ['start', 'cue'].includes(command) },
        );
        const input = createInput();
        app.input(input);
        await app.start();

        await input.send('end');
        await input.send('destroy');

        expect(app.idle()).toBe(true);
    });

    it('only runs inputCommands when they are set', async () => {
        const app = createApp(
            { cues: [{ id: 'intro', stateful: true }] },
            { inputCommands: ['cue'] },
        );
        const input = createInput();
        app.input(input);
        await app.start();

        await input.send('cue', 'intro');
        await input.send('end');

        expect(app.getCurrentCueId()).toBe('intro');
        expect(app.ended()).toBe(false);
    });

    it('applies transformCommand', async () => {
        const app = createApp(
            { cues: [{ id: 'intro', stateful: true }] },
            {
                transformCommand: (command, args) =>
                    command === 'go' ? { command: 'cue', args } : null,
            },
        );
        const input = createInput();
        app.input(input);
        await app.start();

        await input.send('go', 'intro');

        expect(app.getCurrentCueId()).toBe('intro');
    });

    it('stops listening to a removed input', async () => {
        const app = createApp({ cues: [{ id: 'intro', stateful: true }] });
        const input = createInput();
        app.input(input);
        await app.start();

        app.removeInput(input);
        await input.send('cue', 'intro');

        expect(app.getCurrentCueId()).toBe(null);
    });
});
