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
                externalId: { type: 'string', defaultValue: null },
                sessionId: { type: 'string', defaultValue: null },
                data: { type: 'json', defaultValue: null },
                created_at: { type: 'datetime', defaultValue: null },
                updated_at: { type: 'datetime', defaultValue: null },
                deleted_at: { type: 'datetime', defaultValue: null },
            },
            ifNotExists: true,
        })
        .then(() => db.addIndex('interactions', 'externalId_index', ['externalId']))
        .then(() => db.addIndex('interactions', 'sessionId_index', ['sessionId']));

exports.down = (db) =>
    db.dropTable('interactions', {
        ifExists: true,
    });
