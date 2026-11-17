import { io } from 'socket.io-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ClientInput from './ClientInput';
import ClientOutput from './ClientOutput';
import ServerInput from './ServerInput';
import ServerOutput from './ServerOutput';

const rename = () => ({ command: 'cue', args: ['intro'] });

describe.each([
    ['ServerInput', ServerInput],
    ['ClientInput', ClientInput],
])('%s', (name, Input) => {
    it('emits the command that transformCommand returns', async () => {
        const input = new Input({ transformCommand: rename });
        const emitted = [];
        input.on('command', (...args) => emitted.push(args));

        await input.onMessage({ command: 'go', args: [] });

        expect(emitted).toEqual([['cue', 'intro']]);
    });
});

describe('ServerOutput', () => {
    let output;
    let socket;

    afterEach(async () => {
        socket?.disconnect();
        await output?.destroy();
    });

    it('sends to the namespace that transformCommand returns', async () => {
        output = new ServerOutput({
            port: 0,
            transformCommand: (command, args) => ({ command, args, namespace: '/show' }),
        });
        await output.init();
        // Socket.IO refuses clients on a namespace that the server doesn't have yet.
        output.io.of('/show');
        const { port } = output.io.httpServer.address();
        socket = io(`http://127.0.0.1:${port}/show`, { transports: ['websocket'] });
        await new Promise((resolve) => {
            socket.on('connect', resolve);
        });
        const received = new Promise((resolve) => {
            socket.on('message', resolve);
        });

        await output.cue({ id: 'intro' });

        expect(await received).toEqual({ command: 'cue', args: [{ id: 'intro' }, null] });
    });
});

describe('Socket.IO clients and servers', () => {
    const plugins = [];

    afterEach(async () => {
        await Promise.all(plugins.splice(0).map((plugin) => plugin.destroy()));
    });

    const start = async (plugin) => {
        plugins.push(plugin);
        await plugin.init();
        return plugin;
    };

    const urlOf = (server) => `http://127.0.0.1:${server.io.httpServer.address().port}`;

    it('ClientOutput sends commands to a ServerInput', async () => {
        const input = await start(new ServerInput({ port: 0 }));
        const commands = [];
        input.on('command', (...args) => commands.push(args));
        const output = await start(new ClientOutput({ host: urlOf(input) }));
        await vi.waitFor(() => expect(output.socket.connected).toBe(true));

        await output.cue({ id: 'intro' }, { round: 1 });

        await vi.waitFor(() => expect(commands).toEqual([['cue', { id: 'intro' }, { round: 1 }]]));
    });

    it('ServerOutput sends commands to a ClientInput', async () => {
        const output = await start(new ServerOutput({ port: 0 }));
        const input = await start(new ClientInput({ host: urlOf(output) }));
        const commands = [];
        input.on('command', (...args) => commands.push(args));
        await vi.waitFor(() => expect(input.socket.connected).toBe(true));

        await output.command('start', { sessionId: 'session-1' });

        await vi.waitFor(() => expect(commands).toEqual([['start', { sessionId: 'session-1' }]]));
    });

    it('ServerInput only emits its commands', async () => {
        const input = await start(new ServerInput({ port: 0, commands: ['cue'] }));
        const commands = [];
        input.on('command', (...args) => commands.push(args));
        const output = await start(new ClientOutput({ host: urlOf(input) }));
        await vi.waitFor(() => expect(output.socket.connected).toBe(true));

        await output.command('end');
        await output.command('cue', 'intro');

        await vi.waitFor(() => expect(commands).toEqual([['cue', 'intro']]));
    });
});
