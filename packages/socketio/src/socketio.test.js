import { io } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import ClientInput from './ClientInput';
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
