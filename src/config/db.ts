import mysql, { PoolOptions, Pool } from 'mysql2/promise';
import logger from './logger';

// Define strict typing for database connection configuration
const dbConfig: PoolOptions = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bessa_erp',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    // Support for Unix socket connection as requested (Antigravity environment)
    ...(process.env.MYSQL_UNIX_PORT && { socketPath: process.env.MYSQL_UNIX_PORT }),
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10, // max idle connections, the default value is the same as `connectionLimit`
    idleTimeout: 60000, // idle connections timeout, in milliseconds, the default value 60000
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
};

// Create a connection pool to optimize interactions with the database
const pool: Pool = mysql.createPool(dbConfig);

/**
 * Validates the database connection.
 * @returns Promise<boolean> True if connection is successful, false otherwise.
 */
export const checkDbConnection = async (): Promise<boolean> => {
    try {
        const connection = await pool.getConnection();
        logger.info('[DB] Conectado ao banco MySQL com sucesso.');
        connection.release();
        return true;
    } catch (error) {
        logger.error({ err: error }, '[DB] Falha ao conectar ao banco de dados');
        return false;
    }
};

export default pool;
