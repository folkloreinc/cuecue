import Application from '@cuecue/app';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

// Against a real MySQL, migrated with `npm run migrate:up -w @cuecue/store-mysql`: set
// MYSQL_TEST_HOST, MYSQL_TEST_PORT, MYSQL_TEST_USER, MYSQL_TEST_PASSWORD and MYSQL_TEST_DB. The
// tests empty its tables.
const {
    MYSQL_TEST_HOST: testHost,
    MYSQL_TEST_PORT: testPort = '3306',
    MYSQL_TEST_USER: testUser,
    MYSQL_TEST_PASSWORD: testPassword = '',
    MYSQL_TEST_DB: testDatabase,
} = process.env;

describe.skipIf(!testHost)('MysqlStore with MySQL', () => {
    let store;

    const createTestStore = () =>
        new MysqlStore({
            host: testHost,
            port: Number(testPort),
            user: testUser,
            password: testPassword,
            database: testDatabase,
        });

    const query = (sql) =>
        new Promise((resolve, reject) => {
            store.client.query(sql, (error, results) => (error ? reject(error) : resolve(results)));
        });

    beforeEach(async () => {
        store = createTestStore();
        await store.init();
        await store.connect();
        await Promise.all(
            ['sessions', 'cues', 'interactions'].map((table) => query(`TRUNCATE TABLE ${table}`)),
        );
    });

    afterEach(async () => {
        await store.destroy();
    });

    it('adds, finds, updates and deletes items by their id', async () => {
        const session = await store.addItem('sessions', {
            id: 'show_1',
            definition: 'show',
            started: false,
            ended: false,
            cue: null,
        });
        expect(session).toMatchObject({ id: 'show_1', definition: 'show', cue: null });
        expect(session.created_at).toBeInstanceOf(Date);

        expect(await store.findItem('sessions', 'show_1')).toMatchObject({ id: 'show_1' });
        expect(
            await store.findItem('sessions', { definition: 'show', started: false }),
        ).toMatchObject({ id: 'show_1' });

        const updated = await store.updateItem('sessions', 'show_1', {
            started: true,
            data: { round: 1 },
        });
        expect(updated).toMatchObject({ id: 'show_1', started: 1, data: { round: 1 } });

        await store.deleteItem('sessions', 'show_1');
        expect(await store.findItem('sessions', 'show_1')).toBe(null);
        expect(await store.getItems('sessions')).toEqual([]);
        expect(await store.getItems('sessions', {}, true)).toHaveLength(1);
    });

    it('gets the items that match', async () => {
        await store.addItems('cues', [
            { id: 'intro', sessionId: 'a', stateful: true, data: { duration: 2 } },
            { id: 'vote', sessionId: 'a' },
            { id: 'intro', sessionId: 'b' },
        ]);

        expect((await store.getItems('cues', { sessionId: 'a' })).map(({ id }) => id)).toEqual([
            'intro',
            'vote',
        ]);
        expect(await store.getItems('cues', { sessionId: 'a', id: 'intro' })).toEqual([
            expect.objectContaining({ id: 'intro', stateful: 1, data: { duration: 2 } }),
        ]);

        await store.deleteItems('cues', { sessionId: 'a' });
        expect((await store.getItems('cues')).map(({ sessionId }) => sessionId)).toEqual(['b']);
    });

    it('runs an application', async () => {
        const app = new Application(
            {
                id: 'show',
                cues: [
                    { id: 'intro', stateful: true },
                    { id: 'vote', stateful: true, label: 'Vote' },
                ],
            },
            { store, logger: { error: vi.fn() } },
        );
        await app.start();
        await vi.waitFor(() => expect(app.session.started).toBeTruthy());

        await app.cue('intro', { round: 1 });
        expect(app.getCurrentCueId()).toBe('intro');
        expect(await app.getSessionCue()).toMatchObject({ id: 'intro' });
        expect(app.getSessionData()).toEqual({ round: 1 });

        await app.define({ id: 'credits' });
        expect((await app.getCues()).map(({ id }) => id)).toEqual(['credits', 'intro', 'vote']);

        await app.cue('vote');
        await app.interact({ vote: 'a' }, 'user-1');
        await app.interact({ vote: 'b' }, 'user-1');
        await app.interact({ vote: 'c' }, 'user-2');
        expect((await app.getInteractions()).map(({ id, data }) => [id, data])).toEqual([
            ['user-1', { vote: 'b' }],
            ['user-2', { vote: 'c' }],
        ]);
        expect((await app.getInteractionsByUser('user-2')).map(({ id }) => id)).toEqual(['user-2']);

        await app.resetInteractions('user-1');
        expect((await app.getInteractions()).map(({ id }) => id)).toEqual(['user-2']);

        const sessionId = app.session.id;
        await app.end();
        expect(await store.findItem('sessions', sessionId)).toMatchObject({
            started: 0,
            ended: 1,
            cue: null,
        });
        expect(app.options.logger.error).not.toHaveBeenCalled();
    });

    // The tables only have the columns of their migrations: a cue with `interaction`, `duration` or
    // `after_duration` fails with "Unknown column", and interactions have no `cueId` for
    // getInteractionsByCue(). Fixing it needs a schema change (a JSON column for the other fields?).
    it.todo('stores cues with fields beyond its columns, and interactions tied to a cue');
});
