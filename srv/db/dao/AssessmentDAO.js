/**
 * Assessment Data Access Object (DAO)
 * Abstracts database operations for assessments (nursing and radiology)
 */

class AssessmentDAO {
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

    // =========================================
    // Form Submissions
    // =========================================

    /**
     * Find form submission by visit ID and form ID
     * @param {string} visitId - Visit ID
     * @param {string} formId - Form ID (e.g., 'form-05-uuid')
     * @returns {Promise<Object|null>}
     */
    async findSubmissionByVisit(visitId, formId = 'form-05-uuid') {
        return this._get(
            'SELECT submission_id, submission_status FROM form_submissions WHERE visit_id = ? AND form_id = ?',
            [visitId, formId]
        );
    }

    /**
     * Create a form submission
     * @param {Object} data - Submission data
     * @returns {Promise<Object>}
     */
    async createSubmission(data) {
        const { submission_id, visit_id, form_id, submitted_by, submission_status = 'draft' } = data;
        return this._run(`
            INSERT INTO form_submissions (submission_id, visit_id, form_id, submitted_by, submission_status)
            VALUES (?, ?, ?, ?, ?)
        `, [submission_id, visit_id, form_id, submitted_by, submission_status]);
    }

    /**
     * Update submission status
     * @param {string} submissionId - Submission ID
     * @param {string} status - New status ('draft' or 'submitted')
     * @returns {Promise<Object>}
     */
    async updateSubmissionStatus(submissionId, status) {
        return this._run(`
            UPDATE form_submissions 
            SET submission_status = ?, submitted_at = CASE WHEN ? = 'submitted' THEN CURRENT_TIMESTAMP ELSE submitted_at END
            WHERE submission_id = ?
        `, [status, status, submissionId]);
    }

    // =========================================
    // Nursing Assessments
    // =========================================

    /**
     * Find nursing assessment by submission ID
     * @param {string} submissionId - Submission ID
     * @returns {Promise<Object|null>}
     */
    async findNursingBySubmissionId(submissionId) {
        return this._get('SELECT * FROM nursing_assessments WHERE submission_id = ?', [submissionId]);
    }

    /**
     * Find nursing assessment with submission status by visit ID
     * @param {string} visitId - Visit ID
     * @returns {Promise<Object|null>}
     */
    async findNursingByVisitId(visitId) {
        return this._get(`
            SELECT na.*, fs.submission_status, us.signature_data as assessment_signature
            FROM nursing_assessments na
            JOIN form_submissions fs ON na.submission_id = fs.submission_id
            LEFT JOIN user_signatures us ON na.nurse_signature_id = us.signature_id
            WHERE fs.visit_id = ?
        `, [visitId]);
    }

    /**
     * Check if nursing assessment is completed
     * @param {string} visitId - Visit ID
     * @returns {Promise<boolean>}
     */
    async isNursingCompleted(visitId) {
        const result = await this._get(`
            SELECT fs.submission_status 
            FROM form_submissions fs 
            JOIN nursing_assessments na ON na.submission_id = fs.submission_id
            WHERE fs.visit_id = ? AND fs.form_id = 'form-05-uuid'
        `, [visitId]);
        return result && result.submission_status === 'submitted';
    }

    // =========================================
    // User Signatures
    // =========================================

    /**
     * Get user signature
     * @param {string} userId - User ID
     * @returns {Promise<Object|null>}
     */
    async getUserSignature(userId) {
        return this._get('SELECT signature_id, signature_data FROM user_signatures WHERE user_id = ?', [userId]);
    }

    /**
     * Save or update user signature
     * @param {string} userId - User ID
     * @param {string} signatureData - Base64 signature data
     * @returns {Promise<string>} - Signature ID
     */
    async saveUserSignature(userId, signatureData) {
        const existing = await this.getUserSignature(userId);

        if (existing) {
            await this._run(
                'UPDATE user_signatures SET signature_data = ?, updated_at = CURRENT_TIMESTAMP WHERE signature_id = ?',
                [signatureData, existing.signature_id]
            );
            return existing.signature_id;
        } else {
            const signatureId = 'sig-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            await this._run(
                'INSERT INTO user_signatures (signature_id, user_id, signature_data) VALUES (?, ?, ?)',
                [signatureId, userId, signatureData]
            );
            return signatureId;
        }
    }

    // =========================================
    // Statistics
    // =========================================

    /**
     * Get total assessment count (nursing + radiology)
     * @returns {Promise<number>}
     */
    async count() {
        const result = await this._get(`
            SELECT (SELECT COUNT(*) FROM nursing_assessments) + (SELECT COUNT(*) FROM radiology_examination_form) as count
        `);
        return result ? result.count : 0;
    }

    /**
     * Get recent activity (visits and form submissions)
     * @param {number} limit - Maximum results
     * @returns {Promise<Array>}
     */
    async getRecentActivity(limit = 10) {
        return this._all(`
            SELECT 
                'Available' as type,
                'New Visit' as action,
                p.full_name || ' - ' || v.department as details,
                v.created_at as timestamp,
                u.username as user
            FROM patient_visits v
            LEFT JOIN patients p ON v.patient_ssn = p.ssn
            LEFT JOIN users u ON v.created_by = u.user_id
            UNION ALL
            SELECT 
                'Assessment' as type,
                'Form Submitted' as action,
                'Form: ' || f.form_id as details,
                f.submitted_at as timestamp,
                u.username as user
            FROM form_submissions f
            LEFT JOIN users u ON f.submitted_by = u.user_id
            ORDER BY timestamp DESC
            LIMIT ?
        `, [limit]);
    }

    /**
     * Generate a unique assessment ID
     * @param {string} prefix - Prefix for the ID (e.g., 'nurse', 'rad')
     * @returns {string}
     */
    static generateAssessmentId(prefix = 'assess') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate a unique submission ID
     * @returns {string}
     */
    static generateSubmissionId() {
        return 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
}

module.exports = AssessmentDAO;
