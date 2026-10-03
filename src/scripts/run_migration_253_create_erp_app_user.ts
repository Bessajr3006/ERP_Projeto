import 'dotenv/config';
import mysql from 'mysql2/promise';
import logger from '../config/logger';

export default async function runMigration253CreateErpAppUser(): Promise<void> {
    const rootUser = process.env.MARIADB_ROOT_USER || 'root';
    const rootPassword = process.env.MARIADB_ROOT_PASSWORD || process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_NAME || 'bessa_erp';
    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT || '3306', 10);

    const appUser = process.env.DB_USER || 'erp_app';
    const appPassword = process.env.DB_PASSWORD;

    const migrationUser = process.env.DB_MIGRATION_USER || 'erp_migration';
    const migrationPassword = process.env.DB_MIGRATION_PASSWORD || appPassword;

    if (!appPassword) {
        logger.error('DB_PASSWORD must be defined to create application user erp_app.');
        return;
    }

    let connection;
    try {
        logger.info(`Running migration 253: configuring database users (${migrationUser} for migrations and ${appUser} for runtime)`);

        // Connect as root to provision users
        connection = await mysql.createConnection({
            host,
            port,
            user: rootUser,
            password: rootPassword,
            ...(process.env.MYSQL_UNIX_PORT ? { socketPath: process.env.MYSQL_UNIX_PORT } : {})
        });

        const safeDbName = dbName.replace(/`/g, '``');

        // 1. Provision Migration User with DDL privileges on application schema ONLY (no global privileges)
        if (migrationPassword) {
            await connection.query(`CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?`, [migrationUser, migrationPassword]);
            await connection.query(`ALTER USER ?@'%' IDENTIFIED BY ?`, [migrationUser, migrationPassword]);
            await connection.query(
                `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, REFERENCES, CREATE VIEW, SHOW VIEW ON \`${safeDbName}\`.* TO ?@'%'`,
                [migrationUser]
            );

            await connection.query(`CREATE USER IF NOT EXISTS ?@'localhost' IDENTIFIED BY ?`, [migrationUser, migrationPassword]);
            await connection.query(`ALTER USER ?@'localhost' IDENTIFIED BY ?`, [migrationUser, migrationPassword]);
            await connection.query(
                `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, REFERENCES, CREATE VIEW, SHOW VIEW ON \`${safeDbName}\`.* TO ?@'localhost'`,
                [migrationUser]
            );
            logger.info(`Migration user ${migrationUser} granted DDL privileges on ${dbName}.`);
        }

        // 2. Provision Runtime Application User (erp_app)
        // TODO: Remover CREATE, ALTER, INDEX do usuário erp_app assim que todos os pontos de DDL em runtime (ex: ensureColumn/ensureSchema) forem 100% eliminados/migrados.
        await connection.query(`CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?`, [appUser, appPassword]);
        await connection.query(`ALTER USER ?@'%' IDENTIFIED BY ?`, [appUser, appPassword]);
        await connection.query(
            `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX ON \`${safeDbName}\`.* TO ?@'%'`,
            [appUser]
        );

        await connection.query(`CREATE USER IF NOT EXISTS ?@'localhost' IDENTIFIED BY ?`, [appUser, appPassword]);
        await connection.query(`ALTER USER ?@'localhost' IDENTIFIED BY ?`, [appUser, appPassword]);
        await connection.query(
            `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX ON \`${safeDbName}\`.* TO ?@'localhost'`,
            [appUser]
        );

        // 3. Flush privileges
        await connection.query(`FLUSH PRIVILEGES`);

        logger.info(`Migration 253 finished: application user ${appUser} configured on schema ${dbName}.`);
    } catch (err) {
        logger.warn({ err }, 'Could not provision database users via root connection in migration 253. Manual SQL execution may be required if running as non-root.');
    } finally {
        if (connection) await connection.end();
    }
}

if (require.main === module) {
    runMigration253CreateErpAppUser().then(() => process.exit(0));
}
