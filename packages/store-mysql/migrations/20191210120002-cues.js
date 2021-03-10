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
                label: { type: 'string', defaultValue: null },
                handle: { type: 'string', defaultValue: null },
                sessionId: { type: 'string', defaultValue: null },
                group: { type: 'string', defaultValue: null },
                type: { type: 'string', defaultValue: null },
                interaction: { type: 'bool', defaultValue: false },
                stateful: { type: 'bool', defaultValue: false },
                data: { type: 'json', defaultValue: null },
            },
            ifNotExists: true,
        })
        .then(() => db.addIndex('cues', 'handle_index', ['handle']))
        .then(() => db.addIndex('cues', 'sessionId_index', ['sessionId']))
        .then(() => db.addIndex('cues', 'group_index', ['group']))
        .then(() => db.addIndex('cues', 'type_index', ['type']))
        .then(() => db.addIndex('cues', 'interaction_index', ['interaction']))
        .then(() => db.addIndex('cues', 'stateful_index', ['stateful']));

exports.down = (db) =>
    db.dropTable('cues', {
        ifExists: true,
    });
