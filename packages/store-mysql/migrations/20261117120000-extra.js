// The fields of an item that have no column of their own (a cue's `duration`, an interaction's
// `cueId`…) go in `extra`, a JSON object.
const tables = ['sessions', 'cues', 'interactions'];

exports.up = (db) =>
    tables.reduce(
        (previous, table) =>
            previous.then(() => db.addColumn(table, 'extra', { type: 'json', defaultValue: null })),
        Promise.resolve(),
    );

exports.down = (db) =>
    tables.reduce(
        (previous, table) => previous.then(() => db.removeColumn(table, 'extra')),
        Promise.resolve(),
    );
