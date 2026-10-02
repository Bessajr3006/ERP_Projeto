import 'dotenv/config';
import mysql from 'mysql2/promise';
import logger from '../config/logger';

export default async function runMigration253CreateErpAppUser(): Promise<void> {
    const rootUser = process.env.MARIADB_ROOT_USER || 'root';
    const rootPassword = process.env.MARIADB_ROOT_PASSWORD || process.env.DB_PASSWORD || '';
    const appUser = process.env.DB_USER || 'erp_app';
    const appPassword = process.env.DB_PASSWORD;
    const dbName = process.env.DB_NAME || 'bessa_erp';
    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT || '3306', 10);

    if (!appPassword) {
        logger.error('DB_PASSWORD must be defined to create application user erp_app.');
        return;
    }

    let connection;
    try {
        logger.info(`Running migration 253: create restricted application user ${appUser}`);

        // Connect as root to provision user
        connection = await mysql.createConnection({
            host,
            port,
            user: rootUser,
            password: rootPassword,
            ...(process.env.MYSQL_UNIX_PORT ? { socketPath: process.env.MYSQL_UNIX_PORT } : {})
        });

        // 1. Create user on '%' and set password
        await connection.query(`CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?`, [appUser, appPassword]);
        await connection.query(`ALTER USER ?@'%' IDENTIFIED BY ?`, [appUser, appPassword]);

        // 2. Grant SELECT, INSERT, UPDATE, DELETE on database
        await connection.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON \`${dbName.replace(/`/g, '``')}\`.* TO ?@'%'`, [appUser]);

        // 3. Create user on localhost
        await connection.query(`CREATE USER IF NOT EXISTS ?@'localhost' IDENTIFIED BY ?`, [appUser, appPassword]);
        await connection.query(`ALTER USER ?@'localhost' IDENTIFIED BY ?`, [appUser, appPassword]);
        await connection.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON \`${dbName.replace(/`/g, '``')}\`.* TO ?@'localhost'`, [appUser]);

        // 4. Flush privileges
        await connection.query(`FLUSH PRIVILEGES`);

        logger.info(`Migration 253 finished: user ${appUser} created with SELECT, INSERT, UPDATE, DELETE privileges on ${dbName}.`);
    } catch (err) {
        logger.warn({ err }, 'Could not provision erp_app via root connection in migration 253. Manual SQL execution may be required if running as non-root.');
    } finally {
        if (connection) await connection.end();
    }
}

if (require.main === module) {
    runMigration253CreateErpAppUser().then(() => process.exit(0));
}
