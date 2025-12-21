/**
 * Database Connection Wrapper for Al-Shorouk Radiology System
 * Provides promisified database operations and transaction support
 */

const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

class Database {
    constructor(dbPath) {
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
                throw err;
            }
            console.log('Connected to SQLite database:', dbPath);
        });

        // Keep original callback-based methods for backward compatibility
        this.originalRun = this.db.run.bind(this.db);
        this.originalGet = this.db.get.bind(this.db);
        this.originalAll = this.db.all.bind(this.db);
        
        // Promisified methods
        this.run = promisify(this.db.run.bind(this.db));
        this.get = promisify(this.db.get.bind(this.db));
        this.all = promisify(this.db.all.bind(this.db));
    }

    /**
     * Execute a SQL query (INSERT, UPDATE, DELETE)
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise} - Promise resolving to result
     */
    async runAsync(sql, params = []) {
        return this.run(sql, params);
    }

    /**
     * Get a single row from database
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise} - Promise resolving to row or undefined
     */
    async getAsync(sql, params = []) {
        return this.get(sql, params);
    }

    /**
     * Get all rows matching query
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise} - Promise resolving to array of rows
     */
    async allAsync(sql, params = []) {
        return this.all(sql, params);
    }

    /**
     * Begin a database transaction
     * @returns {Promise}
     */
    async beginTransaction() {
        return this.run('BEGIN TRANSACTION');
    }

    /**
     * Commit current transaction
     * @returns {Promise}
     */
    async commit() {
        return this.run('COMMIT');
    }

    /**
     * Rollback current transaction
     * @returns {Promise}
     */
    async rollback() {
        return this.run('ROLLBACK');
    }

    /**
     * Execute multiple queries in a transaction
     * @param {Function} callback - Async function containing queries
     * @returns {Promise}
     */
    async transaction(callback) {
        try {
            await this.beginTransaction();
            const result = await callback(this);
            await this.commit();
            return result;
        } catch (error) {
            await this.rollback();
            throw error;
        }
    }

    /**
     * Close database connection
     * @returns {Promise}
     */
    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                    reject(err);
                } else {
                    console.log('Database connection closed.');
                    resolve();
                }
            });
        });
    }

    /**
     * Get database connection (for backward compatibility)
     * @returns {sqlite3.Database}
     */
    getConnection() {
        return this.db;
    }
}

module.exports = Database;
