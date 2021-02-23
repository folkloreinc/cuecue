exports.up = (db) =>
    db
        .createTable('interactions', {
            columns: {
                id: {
                    type: 'int',
                    unsigned: true,
                    notNull: true,
                    primaryKey: true,
                    autoIncrement: true,
                },
                handle: { type: 'string', defaultValue: null },
                interactionId: { type: 'string', defaultValue: null },
                sessionId: { type: 'string', defaultValue: null },
                cueId: { type: 'string', defaultValue: null },
                step: { type: 'text', defaultValue: null },
                data: { type: 'text', defaultValue: null },
            },
            ifNotExists: true,
        })
        .then(() => db.addIndex('interactions', 'handle_index', ['handle'], true))
        .then(() => db.addIndex('interactions', 'interaction_id_index', ['interaction_id'], true));

exports.down = (db) =>
    db.dropTable('interactions', {
        ifExists: true,
    });
