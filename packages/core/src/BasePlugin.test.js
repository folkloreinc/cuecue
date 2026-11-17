import { describe, expect, it, vi } from 'vitest';
import BaseInput from './BaseInput';
import BasePlugin from './BasePlugin';

describe('BasePlugin', () => {
    it('goes through init, start, stop and destroy, and emits each step', async () => {
        const plugin = new BasePlugin({ name: 'test' });
        const events = [];
        [
            'init',
            'initialized',
            'start',
            'started',
            'stop',
            'stopped',
            'destroy',
            'destroyed',
        ].forEach((event) => plugin.on(event, () => events.push(event)));

        await plugin.start();
        expect(plugin.started()).toBe(true);
        await plugin.stop();
        expect(plugin.started()).toBe(false);
        await plugin.start();
        expect(plugin.started()).toBe(true);
        await plugin.destroy();
        await new Promise((resolve) => {
            process.nextTick(resolve);
        });

        expect(plugin.options).toEqual({ name: 'test' });
        // The "-ed" events come on the next tick, after the steps that follow.
        const steps = ['init', 'start', 'stop', 'start', 'destroy'];
        expect(events.filter((event) => steps.includes(event))).toEqual(steps);
        expect(events.filter((event) => !steps.includes(event)).sort()).toEqual([
            'destroyed',
            'initialized',
            'started',
            'started',
            'stopped',
        ]);
    });

    it('ignores a transition its state doesn’t allow', async () => {
        const plugin = new BasePlugin();
        expect(() => plugin.stop()).not.toThrow();
        expect(plugin.state.state).toBe('none');
    });
});

describe('BaseInput', () => {
    it('emits commands', () => {
        const input = new BaseInput();
        const listener = vi.fn();
        input.on('command', listener);

        input.command('start');
        input.cue('intro', { round: 1 });
        input.interact({ vote: 'a' }, 'interaction-1');

        expect(listener.mock.calls).toEqual([
            ['start'],
            ['cue', 'intro', { round: 1 }],
            ['interact', { vote: 'a' }, 'interaction-1'],
        ]);
    });
});
