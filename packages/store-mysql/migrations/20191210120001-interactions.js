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
                userId: { type: 'string', defaultValue: null },
                data: { type: 'json', defaultValue: null },
            },
            ifNotExists: true,
        })
        .then(() => db.addIndex('interactions', 'handle_index', ['handle']))
        .then(() => db.addIndex('interactions', 'sessionId_index', ['sessionId']))
        .then(() => db.addIndex('interactions', 'cueId_index', ['cueId']))
        .then(() => db.addIndex('interactions', 'userId_index', ['userId']))
        .then(() => db.addIndex('interactions', 'interactionId_index', ['interactionId']));

exports.down = (db) =>
    db.dropTable('interactions', {
        ifExists: true,
    });
