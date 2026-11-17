import { describe, expect, it } from 'vitest';
import MemoryStore from './MemoryStore';

describe('MemoryStore', () => {
    it('adds an item with its id, or a new one', () => {
        const store = new MemoryStore();

        expect(store.addItem('cues', { id: 'intro', label: 'Intro' })).toEqual({
            id: 'intro',
            label: 'Intro',
        });
        expect(store.addItem('cues', { label: 'Vote' }).id).toMatch(/^[0-9a-f-]{36}$/);
        expect(store.getItems('cues')).toHaveLength(2);
    });

    it('replaces an item added again with the same id', () => {
        const store = new MemoryStore();
        store.addItem('cues', { id: 'intro', label: 'Intro' });
        store.addItem('cues', { id: 'intro', label: 'New intro' });

        expect(store.getItems('cues')).toEqual([{ id: 'intro', label: 'New intro' }]);
    });

    it('adds several items', () => {
        const store = new MemoryStore();
        expect(store.addItems('cues', [{ id: 'intro' }, { id: 'vote' }])).toEqual([
            { id: 'intro' },
            { id: 'vote' },
        ]);
    });

    it('finds an item by id or by its fields', () => {
        const store = new MemoryStore({
            sessions: [
                { id: 'a', definition: 'show', started: true, ended: true },
                { id: 'b', definition: 'show', started: true, ended: false },
            ],
        });

        expect(store.findItem('sessions', 'a')).toMatchObject({ id: 'a' });
        expect(store.findItem('sessions', { definition: 'show', ended: false })).toMatchObject({
            id: 'b',
        });
        expect(store.findItem('sessions', 'c')).toBe(null);
        expect(store.findItem('cues', 'a')).toBe(null);
    });

    it('updates an item, keeping its other fields', () => {
        const store = new MemoryStore({ sessions: [{ id: 'a', cue: null, started: false }] });

        expect(store.updateItem('sessions', 'a', { cue: 'intro' })).toEqual({
            id: 'a',
            cue: 'intro',
            started: false,
        });
        expect(store.findItem('sessions', 'a').cue).toBe('intro');
        expect(store.updateItem('sessions', 'missing', { cue: 'intro' })).toBe(null);
    });

    it('gets the items that match, with nested fields', () => {
        const store = new MemoryStore({
            interactions: [
                { id: '1', sessionId: 'a', cueId: 'vote', data: { choice: 'x' } },
                { id: '2', sessionId: 'a', data: { choice: 'y' } },
                { id: '3', sessionId: 'b', cueId: 'vote' },
            ],
        });

        expect(store.getItems('interactions', { sessionId: 'a' }).map(({ id }) => id)).toEqual([
            '1',
            '2',
        ]);
        expect(
            store.getItems('interactions', { sessionId: 'a', cueId: 'vote' }).map(({ id }) => id),
        ).toEqual(['1']);
        expect(
            store.getItems('interactions', { data: { choice: 'y' } }).map(({ id }) => id),
        ).toEqual(['2']);
        expect(store.getItems('sessions')).toEqual([]);
    });

    it('deletes one item, or the items that match', () => {
        const store = new MemoryStore({
            interactions: [
                { id: '1', sessionId: 'a' },
                { id: '2', sessionId: 'a' },
                { id: '3', sessionId: 'b' },
            ],
        });

        store.deleteItem('interactions', '1');
        expect(store.getItems('interactions').map(({ id }) => id)).toEqual(['2', '3']);

        store.deleteItems('interactions', { sessionId: 'a' });
        expect(store.getItems('interactions').map(({ id }) => id)).toEqual(['3']);
    });
});
