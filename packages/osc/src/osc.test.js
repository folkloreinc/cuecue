import { describe, expect, it } from 'vitest';
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
