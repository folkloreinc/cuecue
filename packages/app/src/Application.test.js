import { afterEach, describe, expect, it, vi } from 'vitest';
import Application from './Application';

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
