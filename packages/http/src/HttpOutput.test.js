import Application from '@cuecue/app';
import { describe, expect, it, vi } from 'vitest';
import HttpOutput from './HttpOutput';

describe('HttpOutput', () => {
    it('returns its requests, so that the app logs the failures', async () => {
        const logger = { error: vi.fn() };
        const app = new Application({ id: 'show', cues: [{ id: 'intro' }] }, { logger });
        app.output(new HttpOutput({ url: 'http://127.0.0.1:1/' }));

        await app.start();
        await app.cue('intro');

        expect(logger.error).toHaveBeenCalledWith(
            expect.stringMatching(/^\[cuecue\] An output failed on "cue": /),
        );
    });
});
