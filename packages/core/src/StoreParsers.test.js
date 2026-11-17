import { describe, expect, it } from 'vitest';
import { parseInputId, parseOutputId } from './StoreParsers';

describe('parseInputId', () => {
    it('moves id to externalId, for stores with their own ids', () => {
        expect(parseInputId({ id: 'intro', label: 'Intro' })).toEqual({
            externalId: 'intro',
            label: 'Intro',
        });
        expect(parseInputId([{ id: 'intro' }, { label: 'Vote' }])).toEqual([
            { externalId: 'intro' },
            { label: 'Vote' },
        ]);
    });

    it('returns null for anything else', () => {
        expect(parseInputId(null)).toBe(null);
        expect(parseInputId('intro')).toBe(null);
    });
});

describe('parseOutputId', () => {
    it('moves externalId back to id', () => {
        expect(parseOutputId({ id: 12, externalId: 'intro', label: 'Intro' })).toEqual({
            id: 'intro',
            label: 'Intro',
        });
        expect(parseOutputId([{ externalId: 'intro' }, { id: 3 }])).toEqual([
            { id: 'intro' },
            { id: 3 },
        ]);
    });

    it('returns null for anything else', () => {
        expect(parseOutputId(null)).toBe(null);
    });

    it('round-trips with parseInputId', () => {
        const cue = { id: 'intro', label: 'Intro', data: { a: 1 } };
        expect(parseOutputId(parseInputId(cue))).toEqual(cue);
    });
});
