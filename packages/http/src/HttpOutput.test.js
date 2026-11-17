import Application from '@cuecue/app';
import { createServer } from 'http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HttpOutput from './HttpOutput';

describe('HttpOutput', () => {
    it('returns its requests, so that the app logs the failures', async () => {
        const logger = { error: vi.fn() };
        const app = new Application({ id: 'show', cues: [{ id: 'intro' }] }, { logger });
        app.output(new HttpOutput({ url: 'http://127.0.0.1:1/' }));

        await app.start();
        await app.cue('intro');

        // The app doesn't wait for its outputs: the failure comes once the request fails.
        await vi.waitFor(() =>
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringMatching(/^\[cuecue\] An output failed on "cue": /),
            ),
        );
    });
});

describe('HttpOutput requests', () => {
    let server;

    afterEach(async () => {
        await new Promise((resolve) => {
            server?.close(resolve);
        });
    });

    it('sends { command, args } with its method and headers', async () => {
        const requests = [];
        server = createServer((request, response) => {
            let body = '';
            request.on('data', (chunk) => {
                body += chunk;
            });
            request.on('end', () => {
                requests.push({
                    method: request.method,
                    url: request.url,
                    auth: request.headers.authorization,
                    body: JSON.parse(body),
                });
                response.end('{}');
            });
        });
        await new Promise((resolve) => {
            server.listen(0, '127.0.0.1', resolve);
        });
        const output = new HttpOutput({
            url: `http://127.0.0.1:${server.address().port}/hooks/cuecue`,
            method: 'PUT',
            headers: { Authorization: 'Bearer test' },
            transformMessage: (message) => ({ ...message, show: 'demo' }),
        });

        await output.cue({ id: 'intro' });
        await output.command('start', { sessionId: 'session-1' });

        expect(requests).toEqual([
            {
                method: 'PUT',
                url: '/hooks/cuecue',
                auth: 'Bearer test',
                body: { command: 'cue', args: [{ id: 'intro' }, null], show: 'demo' },
            },
            {
                method: 'PUT',
                url: '/hooks/cuecue',
                auth: 'Bearer test',
                body: { command: 'start', args: [{ sessionId: 'session-1' }], show: 'demo' },
            },
        ]);
    });

    it('cancels or refuses commands', async () => {
        const output = new HttpOutput({
            url: 'http://127.0.0.1:1/',
            transformCommand: (command, args) => (command === 'cue' ? false : { command, args }),
            acceptCommand: (command) => command !== 'end',
        });
        output.request = vi.fn();

        await output.cue({ id: 'intro' });
        await output.command('end');
        await output.command('start');

        expect(output.request.mock.calls).toEqual([[{ command: 'start', args: [] }]]);
    });
});
