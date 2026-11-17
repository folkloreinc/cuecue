import { Client, Server } from 'node-osc';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OscInput from './OscInput';
import OscOutput from './OscOutput';

describe.each([
    ['OscInput', OscInput],
    ['OscOutput', OscOutput],
])('%s', (name, Plugin) => {
    it('can be destroyed before it is initialized', async () => {
        const plugin = new Plugin({ port: 0 });
        await expect(plugin.destroy()).resolves.not.toThrow();
    });
});

const startServer = () =>
    new Promise((resolve) => {
        const server = new Server(0, '127.0.0.1', () => resolve(server));
    });

const closeOsc = (osc) =>
    new Promise((resolve) => {
        osc.close(resolve);
    });

// node-osc doesn't expose the port it picked.
const portOf = (server) => server._sock.address().port;

describe('OscInput over UDP', () => {
    let input;
    let client;

    afterEach(async () => {
        if (client) await closeOsc(client);
        await input?.destroy();
    });

    const startInput = async (options = {}) => {
        input = new OscInput({ host: '127.0.0.1', port: 0, ...options });
        await input.init();
        client = new Client('127.0.0.1', portOf(input.osc));
        const commands = [];
        input.on('command', (...args) => commands.push(args));
        return commands;
    };

    it('emits the path as a command, with its arguments', async () => {
        const commands = await startInput();

        client.send('/cue', 'intro', 2);

        await vi.waitFor(() => expect(commands).toEqual([['cue', 'intro', 2]]));
    });

    it('applies transformCommand and only emits its commands', async () => {
        const commands = await startInput({
            commands: ['cue'],
            transformCommand: (command, args) =>
                command === 'go' ? { command: 'cue', args } : { command, args },
        });

        client.send('/end');
        client.send('/go', 'intro');

        await vi.waitFor(() => expect(commands).toEqual([['cue', 'intro']]));
    });
});

describe('OscOutput over UDP', () => {
    let output;
    let server;

    afterEach(async () => {
        await output?.destroy();
        if (server) await closeOsc(server);
    });

    const startOutput = async (options = {}) => {
        server = await startServer();
        const messages = [];
        server.on('message', (message) => messages.push(message));
        output = new OscOutput({ host: '127.0.0.1', port: portOf(server), ...options });
        await output.init();
        return messages;
    };

    it('sends a command as a path, without the arguments OSC can’t carry', async () => {
        const messages = await startOutput();

        await output.command('/cue/1/start');
        await output.command('volume', 0.5, 'main', null, { level: 1 }, [1, 2]);

        await vi.waitFor(() =>
            expect(messages).toEqual([['/cue/1/start'], ['/volume', 0.5, 'main']]),
        );
    });

    it('sends every command that transformCommand returns, unless refused', async () => {
        const messages = await startOutput({
            transformCommand: (command, args) =>
                command === 'cue'
                    ? [
                          { command: `/cue/${args[0].id}/start`, args: [] },
                          { command: '/log', args: ['cue'] },
                      ]
                    : false,
            acceptCommand: (command) => command !== '/log',
        });

        await output.cue({ id: 'intro' });
        await output.command('end');

        await vi.waitFor(() => expect(messages).toEqual([['/cue/intro/start']]));
    });
});
