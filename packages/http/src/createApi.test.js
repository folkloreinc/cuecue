import Application from '@cuecue/app';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HttpInput from './HttpInput';
import createApi from './createApi';

const definition = {
    id: 'demo',
    cues: [{ id: 'intro', stateful: true }, { id: 'outro' }],
};

describe('POST /commands', () => {
    let app;
    let input;
    let url;

    beforeEach(async () => {
        app = new Application(definition);
        input = new HttpInput({ port: 0 });
        input.setRouter(createApi(app, input));
        app.input(input);
        await app.start();
        url = `http://127.0.0.1:${input.http.address().port}/api`;
    });

    afterEach(async () => {
        await input.stopServer();
    });

    const post = (body) =>
        fetch(`${url}/commands`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

    const until = (event) =>
        new Promise((resolve) => {
            app.once(event, (...args) => resolve(args));
        });

    it('sends a command and its arguments to the app', async () => {
        const cued = until('cue');
        const response = await post({ command: 'cue', args: ['intro', { round: 1 }] });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ success: true });

        const [cue, sessionData] = await cued;
        expect(cue).toMatchObject({ id: 'intro' });
        expect(sessionData).toEqual({ round: 1 });
        await vi.waitFor(() => expect(app.getCurrentCueId()).toBe('intro'));
    });

    it('sends commands without arguments', async () => {
        const commands = [];
        app.on('input:command', (command, args) => commands.push([command, args]));
        const response = await post({ command: 'uncue' });
        expect(await response.json()).toEqual({ success: true });
        expect(commands).toEqual([['uncue', []]]);
    });

    it('sends commands that had no route of their own, such as define', async () => {
        await post({ command: 'define', args: [{ id: 'credits' }] });
        await vi.waitFor(async () => {
            expect((await app.getCues()).map(({ id }) => id)).toContain('credits');
        });
    });

    it('leaves out the commands the app doesn’t accept', async () => {
        const destroy = vi.spyOn(app, 'destroy');
        const commands = [];
        app.on('input:command', (command) => commands.push(command));
        const response = await post({ command: 'destroy' });
        expect(await response.json()).toEqual({ success: true });
        expect(commands).toEqual([]);
        expect(destroy).not.toHaveBeenCalled();
    });

    it.each([[{}], [{ command: '' }], [{ command: 42 }], [{ command: 'cue', args: 'intro' }]])(
        'refuses %j',
        async (body) => {
            const commands = [];
            app.on('input:command', (command) => commands.push(command));
            const response = await post(body);
            expect(response.status).toBe(422);
            expect(await response.json()).toEqual({ success: false, error: 'invalid_command' });
            expect(commands).toEqual([]);
        },
    );
});
