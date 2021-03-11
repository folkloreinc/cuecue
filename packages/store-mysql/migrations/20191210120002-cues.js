exports.up = (db) =>
    db
        .createTable('cues', {
            columns: {
                id: {
                    type: 'int',
                    unsigned: true,
                    notNull: true,
                    primaryKey: true,
                    autoIncrement: true,
                },
                externalId: { type: 'string', defaultValue: null },
                sessionId: { type: 'string', defaultValue: null },
                type: { type: 'string', defaultValue: null },
                label: { type: 'string', defaultValue: null },
                interactive: { type: 'bool', defaultValue: false },
                stateful: { type: 'bool', defaultValue: false },
                data: { type: 'json', defaultValue: null },
                created_at: { type: 'datetime', defaultValue: null },
                updated_at: { type: 'datetime', defaultValue: null },
                deleted_at: { type: 'datetime', defaultValue: null },
            },
            ifNotExists: true,
        })
        .then(() => db.addIndex('cues', 'externalId_index', ['externalId']))
        .then(() => db.addIndex('cues', 'sessionId_index', ['sessionId']))
        .then(() => db.addIndex('cues', 'type_index', ['type']))
        .then(() => db.addIndex('cues', 'interactive_index', ['interactive']))
        .then(() => db.addIndex('cues', 'stateful_index', ['stateful']));

exports.down = (db) =>
    db.dropTable('cues', {
        ifExists: true,
    });
