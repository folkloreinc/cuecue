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
                externalId: { type: 'string', defaultValue: null },
                definition: { type: 'string', defaultValue: null },
                cue: { type: 'string', defaultValue: null },
                started: { type: 'bool', defaultValue: false },
                ended: { type: 'bool', defaultValue: false },
                data: { type: 'json', defaultValue: null },
                created_at: { type: 'datetime', defaultValue: null },
                updated_at: { type: 'datetime', defaultValue: null },
                deleted_at: { type: 'datetime', defaultValue: null },
            },
            ifNotExists: true,
        })
        .then(() => db.addIndex('sessions', 'externalId_index', ['externalId']))
        .then(() => db.addIndex('sessions', 'start_end_index', ['started', 'ended']));

exports.down = (db) =>
    db.dropTable('sessions', {
        ifExists: true,
    });
