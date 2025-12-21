/**
 * User Data Access Object (DAO)
 * Abstracts database operations for the users table
 */

class UserDAO {
    constructor(db) {
        this.db = db;
    }

    /**
     * Promisified db.get helper
     */
    _get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    /**
     * Promisified db.all helper
     */
    _all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    /**
     * Promisified db.run helper
     */
    _run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }

    /**
     * Find a user by ID
     * @param {string} userId - The user ID
     * @returns {Promise<Object|null>}
     */
    async findById(userId) {
        return this._get('SELECT user_id, username, email, full_name, role, is_active, created_at FROM users WHERE user_id = ?', [userId]);
    }

    /**
     * Find a user by username (includes password for auth)
     * @param {string} username - The username
     * @returns {Promise<Object|null>}
     */
    async findByUsername(username) {
        return this._get('SELECT * FROM users WHERE username = ?', [username]);
    }

    /**
     * Find a user by email
     * @param {string} email - The email address
     * @returns {Promise<Object|null>}
     */
    async findByEmail(email) {
        return this._get('SELECT user_id, username, email, full_name, role, is_active, created_at FROM users WHERE email = ?', [email]);
    }

    /**
     * Get all users with optional filtering
     * @param {Object} options - Filter options
     * @returns {Promise<Array>}
     */
    async findAll(options = {}) {
        const { limit = 50, offset = 0, role = null, isActive = null } = options;
        let sql = 'SELECT user_id, username, email, full_name, role, is_active, created_at FROM users WHERE 1=1';
        const params = [];

        if (role) {
            sql += ' AND role = ?';
            params.push(role);
        }

        if (isActive !== null) {
            sql += ' AND is_active = ?';
            params.push(isActive ? 1 : 0);
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        return this._all(sql, params);
    }

    /**
     * Get recent users (for dashboard)
     * @param {number} limit - Maximum results
     * @returns {Promise<Array>}
     */
    async findRecent(limit = 5) {
        return this._all(`
            SELECT user_id, username, email, full_name, role, is_active, created_at 
            FROM users 
            ORDER BY created_at DESC 
            LIMIT ?
        `, [limit]);
    }

    /**
     * Create a new user
     * @param {Object} userData - User data object
     * @returns {Promise<Object>}
     */
    async create(userData) {
        const { user_id, username, password_hash, email, full_name, role, is_active = 1 } = userData;

        return this._run(`
            INSERT INTO users (user_id, username, password_hash, email, full_name, role, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [user_id, username, password_hash, email, full_name, role, is_active]);
    }

    /**
     * Update a user
     * @param {string} userId - User ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>}
     */
    async update(userId, updates) {
        const fields = Object.keys(updates);
        const values = Object.values(updates);

        if (fields.length === 0) return { changes: 0 };

        const setClause = fields.map(f => `${f} = ?`).join(', ');
        return this._run(`UPDATE users SET ${setClause} WHERE user_id = ?`, [...values, userId]);
    }

    /**
     * Update user password
     * @param {string} userId - User ID
     * @param {string} passwordHash - New password hash
     * @returns {Promise<Object>}
     */
    async updatePassword(userId, passwordHash) {
        return this._run('UPDATE users SET password_hash = ? WHERE user_id = ?', [passwordHash, userId]);
    }

    /**
     * Deactivate a user
     * @param {string} userId - User ID
     * @returns {Promise<Object>}
     */
    async deactivate(userId) {
        return this._run('UPDATE users SET is_active = 0 WHERE user_id = ?', [userId]);
    }

    /**
     * Activate a user
     * @param {string} userId - User ID
     * @returns {Promise<Object>}
     */
    async activate(userId) {
        return this._run('UPDATE users SET is_active = 1 WHERE user_id = ?', [userId]);
    }

    /**
     * Delete a user
     * @param {string} userId - User ID
     * @returns {Promise<Object>}
     */
    async delete(userId) {
        return this._run('DELETE FROM users WHERE user_id = ?', [userId]);
    }

    /**
     * Get total user count
     * @returns {Promise<number>}
     */
    async count() {
        const result = await this._get('SELECT COUNT(*) as count FROM users');
        return result ? result.count : 0;
    }

    /**
     * Check if username exists
     * @param {string} username - Username to check
     * @param {string} excludeUserId - Optional user ID to exclude (for updates)
     * @returns {Promise<boolean>}
     */
    async usernameExists(username, excludeUserId = null) {
        let sql = 'SELECT user_id FROM users WHERE username = ?';
        const params = [username];

        if (excludeUserId) {
            sql += ' AND user_id != ?';
            params.push(excludeUserId);
        }

        const result = await this._get(sql, params);
        return !!result;
    }

    /**
     * Check if email exists
     * @param {string} email - Email to check
     * @param {string} excludeUserId - Optional user ID to exclude (for updates)
     * @returns {Promise<boolean>}
     */
    async emailExists(email, excludeUserId = null) {
        let sql = 'SELECT user_id FROM users WHERE email = ?';
        const params = [email];

        if (excludeUserId) {
            sql += ' AND user_id != ?';
            params.push(excludeUserId);
        }

        const result = await this._get(sql, params);
        return !!result;
    }

    /**
     * Generate a unique user ID
     * @returns {string}
     */
    static generateUserId() {
        return 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
}

module.exports = UserDAO;
