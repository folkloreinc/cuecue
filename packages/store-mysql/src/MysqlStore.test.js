import { describe, expect, it } from 'vitest';
import MysqlStore from './MysqlStore';

// No MySQL server answers on port 1: the store must fail without stopping the process. Node stops
// the test run on an unhandled 'error' event, so these tests also check that there is none.
const createStore = () =>
    new MysqlStore({ host: '127.0.0.1', port: 1, user: 'cuecue', database: 'cuecue' });

describe('MysqlStore without a database', () => {
    it('rejects queries', async () => {
        const store = createStore();
        await store.init();

        await expect(store.getItems('cues')).rejects.toThrow();
        await expect(store.findItem('sessions', 'show')).rejects.toThrow();

        await store.destroy();
    });

    it('fails to connect without stopping the process', async () => {
        const store = createStore();
        await store.init();

        await expect(store.connect()).rejects.toThrow();

        await store.destroy();
    });

    it('can be destroyed, connected or not', async () => {
        const store = createStore();
        await store.init();
        await store.destroy();
        expect(store.state.state).toBe('none');
        expect(store.client).toBe(null);

        await expect(createStore().destroy()).resolves.not.toThrow();
    });
});
