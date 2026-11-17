import Application from '@cuecue/app';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import PingpongOutput from './PingpongOutput';
import { signRequest } from './signature';

// @pingpong-io/server needs Node 24.
const nodeMajor = Number(process.versions.node.split('.')[0]);

const createLogger = () => ({ error: vi.fn() });

const waitFor = (condition, timeout = 2000) =>
    new Promise((resolve, reject) => {
        const started = Date.now();
        const check = () => {
            if (condition()) {
                resolve();
            } else if (Date.now() - started > timeout) {
                reject(new Error('Timed out'));
            } else {
                setTimeout(check, 10);
            }
        };
        check();
    });

describe('signRequest', () => {
    it('signs the timestamp, method, path and body hash with the secret', () => {
        // The example of Pingpong's protocol, computed with its own signRequest().
        expect(
            signRequest(
                'sk_test',
                { method: 'post', path: '/v1/messages', body: '{"a":1}' },
                1700000000,
            ),
        ).toBe('t=1700000000,v1=21a8e3000693737296af2634df1a21d540378b59d7500af7e5e422a5de1a759a');
    });
});

describe('PingpongOutput settings', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('reads its settings from the environment', () => {
        vi.stubEnv('PINGPONG_URL', 'https://pingpong.test');
        vi.stubEnv('PINGPONG_KEY', 'pk_test');
        vi.stubEnv('PINGPONG_SECRET', 'sk_test');
        vi.stubEnv('PINGPONG_CHANNEL', 'show');
        const output = new PingpongOutput();
        expect(output.options).toMatchObject({
            url: 'https://pingpong.test',
            key: 'pk_test',
            secret: 'sk_test',
            channel: 'show',
        });
    });

    it('prefers its options to the environment', () => {
        vi.stubEnv('PINGPONG_CHANNEL', 'show');
        const output = new PingpongOutput({
            url: 'https://pingpong.test',
            key: 'pk_test',
            secret: 'sk_test',
            channel: 'other',
        });
        expect(output.options.channel).toBe('other');
    });

    it('publishes to cuecue:output by default', () => {
        vi.stubEnv('PINGPONG_CHANNEL', '');
        const output = new PingpongOutput({
            url: 'https://pingpong.test',
            key: 'pk_test',
            secret: 'sk_test',
        });
        expect(output.options.channel).toBe('cuecue:output');
    });

    it('refuses to start without a URL, a key and a secret', () => {
        vi.stubEnv('PINGPONG_URL', '');
        vi.stubEnv('PINGPONG_KEY', '');
        vi.stubEnv('PINGPONG_SECRET', '');
        expect(() => new PingpongOutput()).toThrow(
            '@cuecue/pingpong: missing url (or PINGPONG_URL), key (or PINGPONG_KEY), secret (or PINGPONG_SECRET)',
        );
    });
});

describe.skipIf(nodeMajor < 24)('PingpongOutput with a Pingpong server', () => {
    let server;
    let project;
    let socket;
    let messages;

    beforeAll(async () => {
        const { startTestServer } = await import('@pingpong-io/server/testing');
        server = await startTestServer();
        project = await server.createProject('cuecue');
        socket = server.connect(project);
        messages = [];
        socket.on('message', (message) => messages.push(message));
        const ack = await socket.emitWithAck('subscribe', { channel: 'cuecue:output' });
        expect(ack).toMatchObject({ ok: true });
    });

    afterAll(async () => {
        await server?.close();
    });

    afterEach(() => {
        messages.length = 0;
        vi.restoreAllMocks();
    });

    const createOutput = (options = {}) =>
        new PingpongOutput({
            url: server.url,
            key: project.project.key,
            secret: project.secret,
            channel: 'cuecue:output',
            logger: createLogger(),
            ...options,
        });

    it('publishes a command as an event, with { command, args } as data', async () => {
        const output = createOutput();
        await output.cue({ id: 'intro' }, { round: 1 });
        await waitFor(() => messages.length === 1);
        expect(messages[0]).toEqual({
            channel: 'cuecue:output',
            event: 'cue',
            data: { command: 'cue', args: [{ id: 'intro' }, { round: 1 }] },
        });
        expect(output.options.logger.error).not.toHaveBeenCalled();
    });

    it('has the interface of the PubNub output', async () => {
        const output = createOutput();
        await output.cues([{ id: 'intro' }]);
        await output.interact({ vote: 'a' }, 'interaction-1');
        await output.interaction({ id: 'interaction-1' });
        await output.uninteraction('interaction-1');
        await output.uninteractions(['interaction-1']);
        await output.command('start', { sessionId: 'session-1' });
        await waitFor(() => messages.length === 6);
        expect(messages.map(({ event, data }) => [event, data])).toEqual([
            ['cues', { command: 'cues', args: [[{ id: 'intro' }]] }],
            ['interact', { command: 'interact', args: [{ vote: 'a' }, 'interaction-1'] }],
            ['interaction', { command: 'interaction', args: [{ id: 'interaction-1' }] }],
            ['uninteract', { command: 'uninteract', args: ['interaction-1'] }],
            ['uninteractions', { command: 'uninteractions', args: [['interaction-1']] }],
            ['start', { command: 'start', args: [{ sessionId: 'session-1' }] }],
        ]);
    });

    it('publishes in the order of the commands, even when some take longer', async () => {
        // The first commands take the longest: without waiting for each other, they would arrive
        // last.
        const output = createOutput({
            transformMessage: async (message) => {
                const index = Number(message.args[0].id.split('-')[1]);
                await new Promise((resolve) => {
                    setTimeout(resolve, 20 - index);
                });
                return message;
            },
        });
        const ids = Array.from({ length: 20 }, (_, index) => `cue-${index}`);
        await Promise.all(ids.map((id) => output.cue({ id })));
        await waitFor(() => messages.length === ids.length);
        expect(messages.map(({ data }) => data.args[0].id)).toEqual(ids);
    });

    it('applies transformCommand, acceptCommand and transformMessage', async () => {
        const output = createOutput({
            transformCommand: (command, args) =>
                command === 'interact' ? false : { command: `show:${command}`, args },
            acceptCommand: (command) => command !== 'show:uncue',
            transformMessage: (message) => ({ ...message, show: 'demo' }),
        });
        await output.command('interact', {});
        await output.command('uncue');
        await output.cue({ id: 'intro' });
        await waitFor(() => messages.length === 1);
        expect(messages[0]).toEqual({
            channel: 'cuecue:output',
            event: 'show:cue',
            data: { command: 'show:cue', args: [{ id: 'intro' }, null], show: 'demo' },
        });
    });

    it('publishes to several channels', async () => {
        const output = createOutput({ channel: ['cuecue:output', 'cuecue:other'] });
        await output.command('start');
        await waitFor(() => messages.length === 1);
        expect(messages[0].event).toBe('start');
    });

    it('signs its requests and never sends the secret', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const output = createOutput();
        await output.command('start');
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [url, { headers, body }] = fetchSpy.mock.calls[0];
        expect(String(url)).toBe(`${server.url}/v1/messages`);
        expect(headers['Pingpong-Key']).toBe(project.project.key);
        expect(headers['Pingpong-Signature']).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
        expect(JSON.stringify({ url, headers, body })).not.toContain(project.secret);
    });

    it('logs a refused publish and resolves', async () => {
        const output = createOutput({ secret: 'sk_wrong' });
        await expect(output.command('start')).resolves.toBeUndefined();
        expect(output.options.logger.error).toHaveBeenCalledWith(
            '[cuecue:pingpong] Publishing "start" failed: Pingpong answered 401 Unauthorized: The signature doesn\'t match the request.',
        );
        expect(messages).toEqual([]);
    });

    it('logs a publish to a server that is down and keeps publishing', async () => {
        const output = createOutput({ url: 'http://127.0.0.1:1' });
        await expect(output.command('start')).resolves.toBeUndefined();
        expect(output.options.logger.error).toHaveBeenCalledTimes(1);
        expect(output.options.logger.error.mock.calls[0][0]).toMatch(
            /^\[cuecue:pingpong\] Publishing "start" failed: /,
        );

        output.options.url = server.url;
        await output.command('end');
        await waitFor(() => messages.length === 1);
        expect(messages[0].event).toBe('end');
    });

    it('logs a transform that throws', async () => {
        const output = createOutput({
            transformCommand: () => {
                throw new Error('Broken transform');
            },
        });
        await output.command('start');
        expect(output.options.logger.error).toHaveBeenCalledWith(
            '[cuecue:pingpong] Publishing "start" failed: Broken transform',
        );
    });

    it('publishes the commands of an application', async () => {
        const app = new Application({ id: 'demo', cues: [{ id: 'intro' }] });
        const output = createOutput();
        app.output(output);
        await app.start();
        await waitFor(() => messages.some(({ event }) => event === 'start'));
        await app.cue('intro');
        await waitFor(() => messages.some(({ event }) => event === 'cue'));

        const events = messages.map(({ event }) => event);
        expect(events).toEqual(expect.arrayContaining(['cues', 'start', 'state', 'cue']));
        expect(events.indexOf('start')).toBeLessThan(events.indexOf('cue'));
        expect(messages.find(({ event }) => event === 'cue').data.args[0]).toMatchObject({
            id: 'intro',
        });
        expect(output.options.logger.error).not.toHaveBeenCalled();
        await app.destroy();
    });
});
