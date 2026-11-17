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

describe('API routes', () => {
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

    const get = async (path, headers = {}) => {
        const response = await fetch(`${url}${path}`, { headers });
        return { status: response.status, body: await response.json() };
    };

    const post = async (path, body = undefined, headers = {}) => {
        const response = await fetch(`${url}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        return { status: response.status, body: await response.json() };
    };

    it('GET / welcomes', async () => {
        expect(await get('/')).toEqual({ status: 200, body: { message: 'Welcome to CueCue' } });
    });

    it('GET /cues lists the cues, GET /cues/:id finds one', async () => {
        const { body: cues } = await get('/cues');
        expect(cues.map(({ id }) => id)).toEqual(['intro', 'outro']);

        expect((await get('/cues/outro')).body).toMatchObject({ id: 'outro' });
        expect(await get('/cues/missing')).toEqual({
            status: 404,
            body: { success: false, error: 'not_found' },
        });
    });

    it('POST /cues/:id cues, GET /cues/current returns the current cue', async () => {
        expect((await get('/cues/current')).body).toBe(null);

        expect((await post('/cues/intro', { round: 1 })).body).toEqual({ success: true });
        await vi.waitFor(() => expect(app.getCurrentCueId()).toBe('intro'));
        expect(app.getSessionData()).toEqual({ round: 1 });
        expect((await get('/cues/current')).body).toMatchObject({ id: 'intro' });

        expect((await post('/cues/missing')).status).toBe(404);
    });

    it('POST /uncue uncues', async () => {
        await app.cue('intro');
        expect((await post('/uncue')).body).toEqual({ success: true });
        expect(app.getCurrentCueId()).toBe(null);
    });

    it('POST /cues/define defines a cue', async () => {
        expect((await post('/cues/define', { id: 'credits' })).body).toEqual({ success: true });
        expect((await app.getCues()).map(({ id }) => id)).toContain('credits');
    });

    it('POST /cues/define defines several cues', async () => {
        expect((await post('/cues/define', [{ id: 'credits' }, { id: 'bonus' }])).body).toEqual({
            success: true,
        });
        expect((await app.getCues()).map(({ id }) => id)).toEqual(
            expect.arrayContaining(['credits', 'bonus', 'intro', 'outro']),
        );
    });

    it('POST /interactions keeps an interaction per user, GET /interactions lists them', async () => {
        await app.cue('intro');
        await post('/interactions', { vote: 'a' }, { 'X-User-Id': 'user-1' });
        await post('/interactions', { vote: 'b' }, { 'X-User-Id': 'user-2' });
        await post('/interactions', { vote: 'c' }, { 'X-User-Id': 'user-1' });

        const { body: all } = await get('/interactions');
        expect(all.map(({ id, data }) => [id, data])).toEqual([
            ['user-1', { vote: 'c' }],
            ['user-2', { vote: 'b' }],
        ]);

        const { body: mine } = await get('/interactions', { 'X-User-Id': 'user-2' });
        expect(mine.map(({ id }) => id)).toEqual(['user-2']);
    });

    it('GET /cues/:id/interactions lists the interactions of a cue', async () => {
        await app.define({ id: 'vote', stateful: true, interaction: true });
        await app.cue('vote');
        await post('/interactions', { vote: 'a' }, { 'X-User-Id': 'user-1' });

        const { body } = await get('/cues/vote/interactions');
        expect(body.map(({ id }) => id)).toEqual(['user-1']);
        expect((await get('/cues/missing/interactions')).status).toBe(404);
    });

    it('GET /session/current and /app/state describe the app', async () => {
        expect((await get('/session/current')).body).toBe(app.session.id);
        expect((await get(`/session/${app.session.id}`)).body).toMatchObject({
            id: app.session.id,
            definition: 'demo',
        });
        expect((await get('/app/state')).body).toBe('idle');
    });

    it('GET /export/*.json exports the items of the store', async () => {
        await post('/interactions', { vote: 'a' }, { 'X-User-Id': 'user-1' });

        expect((await get('/export/sessions.json')).body.map(({ id }) => id)).toEqual([
            app.session.id,
        ]);
        expect((await get('/export/cues.json')).body.map(({ id }) => id)).toEqual([
            'intro',
            'outro',
        ]);
        expect((await get('/export/interactions.json')).body).toEqual([
            expect.objectContaining({ id: 'user-1', data: { vote: 'a' } }),
        ]);
    });

    it('GET /export/*.csv downloads a CSV, with nested fields flattened', async () => {
        await post('/interactions', { vote: 'a' }, { 'X-User-Id': 'user-1' });

        const response = await fetch(`${url}/export/interactions.csv`);
        expect(response.headers.get('content-type')).toMatch(/^text\/csv/);
        expect(response.headers.get('content-disposition')).toBe(
            'attachment; filename="interactions.csv"',
        );
        const [header, row] = (await response.text()).split('\n');
        expect(header).toBe('"id","sessionId","data.vote"');
        expect(row).toBe(`"user-1","${app.session.id}","a"`);
    });
});
