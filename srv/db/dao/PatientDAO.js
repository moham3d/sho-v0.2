/**
 * Patient Data Access Object (DAO)
 * Abstracts database operations for the patients table
 */

class PatientDAO {
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
     * Find a patient by SSN
     * @param {string} ssn - The patient's SSN
     * @returns {Promise<Object|null>} - Patient object or null if not found
     */
    async findBySSN(ssn) {
        return this._get('SELECT * FROM patients WHERE ssn = ?', [ssn]);
    }

    /**
     * Search patients by SSN prefix (for autocomplete)
     * @param {string} query - SSN prefix to search
     * @param {number} limit - Maximum results to return
     * @returns {Promise<Array>} - Array of matching patients
     */
    async searchBySSN(query, limit = 10) {
        return this._all(`
            SELECT ssn, full_name, medical_number, mobile_number, date_of_birth, gender
            FROM patients
            WHERE ssn LIKE ?
            ORDER BY ssn
            LIMIT ?
        `, [`${query}%`, limit]);
    }

    /**
     * Check if a patient exists by SSN
     * @param {string} ssn - The patient's SSN
     * @returns {Promise<boolean>}
     */
    async exists(ssn) {
        const result = await this._get('SELECT ssn FROM patients WHERE ssn = ?', [ssn]);
        return !!result;
    }

    /**
     * Create a new patient
     * @param {Object} patientData - Patient data object
     * @returns {Promise<Object>} - Result with lastID and changes
     */
    async create(patientData) {
        const {
            ssn, full_name, mobile_number, phone_number, medical_number,
            date_of_birth, gender, address, emergency_contact_name,
            emergency_contact_phone, emergency_contact_relation, created_by
        } = patientData;

        return this._run(`
            INSERT INTO patients (
                ssn, full_name, mobile_number, phone_number, medical_number,
                date_of_birth, gender, address, emergency_contact_name,
                emergency_contact_phone, emergency_contact_relation, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            ssn, full_name, mobile_number, phone_number || null, medical_number || null,
            date_of_birth, gender, address || null, emergency_contact_name || null,
            emergency_contact_phone || null, emergency_contact_relation || null, created_by
        ]);
    }

    /**
     * Update a patient record
     * @param {string} ssn - Patient SSN
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} - Result with changes count
     */
    async update(ssn, updates) {
        const fields = Object.keys(updates);
        const values = Object.values(updates);

        if (fields.length === 0) return { changes: 0 };

        const setClause = fields.map(f => `${f} = ?`).join(', ');
        return this._run(`UPDATE patients SET ${setClause} WHERE ssn = ?`, [...values, ssn]);
    }

    /**
     * Get total patient count
     * @returns {Promise<number>}
     */
    async count() {
        const result = await this._get('SELECT COUNT(*) as count FROM patients');
        return result ? result.count : 0;
    }

    /**
     * Get all patients with pagination
     * @param {number} limit - Max records
     * @param {number} offset - Offset for pagination
     * @returns {Promise<Array>}
     */
    async findAll(limit = 50, offset = 0) {
        return this._all(`
            SELECT * FROM patients
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);
    }
}

module.exports = PatientDAO;
