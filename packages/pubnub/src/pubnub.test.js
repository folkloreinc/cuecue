import { describe, expect, it } from 'vitest';
import PubNubInput from './PubNubInput';
import PubNubOutput from './PubNubOutput';

describe('PubNubInput', () => {
    it('emits the command that transformCommand returns', async () => {
        const input = new PubNubInput({
            transformCommand: () => ({ command: 'cue', args: ['intro'] }),
        });
        const emitted = [];
        input.on('command', (...args) => emitted.push(args));

        await input.onMessage({ message: { command: 'go', args: [] } });

        expect(emitted).toEqual([['cue', 'intro']]);
    });
});

describe('PubNubOutput', () => {
    it('rejects a failed publish with an error, so the app can log it', async () => {
        const output = new PubNubOutput();
        output.client = {
            publish: (payload, callback) =>
                callback({ error: true, category: 'PNNetworkIssuesCategory' }),
        };

        await expect(output.cue({ id: 'intro' })).rejects.toThrow(
            'PubNub publish failed: PNNetworkIssuesCategory',
        );
    });
});
