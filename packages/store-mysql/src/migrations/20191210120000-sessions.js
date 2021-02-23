exports.up = (db) =>
    db
        .createTable('sessions', {
            columns: {
                id: {
                    type: 'int',
                    unsigned: true,
                    notNull: true,
                    primaryKey: true,
                    autoIncrement: true,
                },
                handle: { type: 'string', defaultValue: null },
                definition: { type: 'string', defaultValue: null },
                started: { type: 'bool', defaultValue: false },
                ended: { type: 'bool', defaultValue: false },
                cue: { type: 'string', defaultValue: null },
                data: { type: 'text', defaultValue: null },
            },
            ifNotExists: true,
        })
        .then(() => db.addIndex('sessions', 'session_handle_index', ['handle']));

exports.down = (db) =>
    db.dropTable('sessions', {
        ifExists: true,
    });
