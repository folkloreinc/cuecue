import { Server } from 'node-osc';
import { afterEach, describe, expect, it, vi } from 'vitest';
import command from './osc-output';

const startServer = () =>
    new Promise((resolve) => {
        const server = new Server(0, '127.0.0.1', () => resolve(server));
    });

describe('cuecue osc-output', () => {
    let server;

    afterEach(async () => {
        vi.restoreAllMocks();
        process.exitCode = undefined;
        await new Promise((resolve) => {
            server?.close(resolve);
        });
    });

    it('sends an OSC message with its arguments', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        server = await startServer();
        const received = new Promise((resolve) => {
            server.on('message', resolve);
        });
        // node-osc doesn't expose the port it picked.
        const { port } = server._sock.address();

        await command.parseAsync(
            ['cue/1/start', 'now', '--host', '127.0.0.1', '--port', `${port}`],
            {
                from: 'user',
            },
        );

        expect(await received).toEqual(['/cue/1/start', 'now']);
        expect(process.exitCode).toBeUndefined();
    });
});
