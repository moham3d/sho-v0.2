/**
 * Visit Data Access Object (DAO)
 * Abstracts database operations for the patient_visits table
 */

class VisitDAO {
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
     * Find a visit by ID
     * @param {string} visitId - The visit ID
     * @returns {Promise<Object|null>}
     */
    async findById(visitId) {
        return this._get('SELECT * FROM patient_visits WHERE visit_id = ?', [visitId]);
    }

    /**
     * Find a visit with patient details
     * @param {string} visitId - The visit ID
     * @param {string} createdBy - User ID who created the visit (or 'hl7-system')
     * @returns {Promise<Object|null>}
     */
    async findWithPatient(visitId, createdBy = null) {
        let sql = `
            SELECT pv.*, p.full_name, p.mobile_number, p.medical_number, p.date_of_birth, p.gender,
                   p.phone_number, p.address, p.emergency_contact_name, p.emergency_contact_phone, p.emergency_contact_relation
            FROM patient_visits pv
            JOIN patients p ON pv.patient_ssn = p.ssn
            WHERE pv.visit_id = ?
        `;
        const params = [visitId];

        if (createdBy) {
            sql += ` AND (pv.created_by = ? OR pv.created_by = 'hl7-system')`;
            params.push(createdBy);
        }

        return this._get(sql, params);
    }

    /**
     * Create a new visit
     * @param {Object} visitData - Visit data object
     * @returns {Promise<Object>}
     */
    async create(visitData) {
        const { visit_id, patient_ssn, created_by, visit_status = 'open', department = null } = visitData;

        return this._run(`
            INSERT INTO patient_visits (visit_id, patient_ssn, created_by, visit_status, department)
            VALUES (?, ?, ?, ?, ?)
        `, [visit_id, patient_ssn, created_by, visit_status, department]);
    }

    /**
     * Update visit status
     * @param {string} visitId - Visit ID
     * @param {string} status - New status
     * @returns {Promise<Object>}
     */
    async updateStatus(visitId, status) {
        return this._run(`
            UPDATE patient_visits SET visit_status = ?, completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END
            WHERE visit_id = ?
        `, [status, status, visitId]);
    }

    /**
     * Get visits for a nurse (current active visits)
     * @param {string} userId - Nurse user ID
     * @param {number} limit - Maximum results
     * @returns {Promise<Array>}
     */
    async findActiveForNurse(userId, limit = 5) {
        return this._all(`
            SELECT
                pv.visit_id, pv.patient_ssn, pv.visit_date, pv.visit_status,
                pv.primary_diagnosis, pv.secondary_diagnosis, pv.diagnosis_code,
                pv.visit_type, pv.department, pv.created_at, pv.created_by,
                p.full_name as patient_name, p.medical_number, p.date_of_birth, p.gender,
                na.assessment_id, fs.submission_status,
                fs.submission_status = 'draft' as is_draft,
                us.signature_data as nurse_signature,
                (SELECT COUNT(*) FROM form_submissions fs2 WHERE fs2.visit_id = pv.visit_id) as total_assessments,
                CASE WHEN pv.created_by = 'hl7-system' THEN 'HL7' ELSE 'Manual' END as visit_source
            FROM patient_visits pv
            JOIN patients p ON pv.patient_ssn = p.ssn
            LEFT JOIN form_submissions fs ON fs.visit_id = pv.visit_id AND fs.form_id = 'form-05-uuid'
            LEFT JOIN nursing_assessments na ON na.submission_id = fs.submission_id
            LEFT JOIN user_signatures us ON na.nurse_signature_id = us.signature_id
            WHERE (pv.created_by = ? OR (pv.created_by = 'hl7-system' AND na.assessment_id IS NULL)) 
            AND pv.visit_status IN ('open', 'in_progress')
            ORDER BY pv.visit_date DESC, pv.created_at DESC
            LIMIT ?
        `, [userId, limit]);
    }

    /**
     * Get completed visits for a nurse
     * @param {string} userId - Nurse user ID
     * @param {number} limit - Maximum results
     * @returns {Promise<Array>}
     */
    async findCompletedForNurse(userId, limit = 10) {
        return this._all(`
            SELECT
                pv.visit_id, pv.patient_ssn, pv.visit_date, pv.visit_status,
                pv.primary_diagnosis, pv.secondary_diagnosis, pv.diagnosis_code,
                pv.visit_type, pv.department, pv.created_at, pv.created_by,
                p.full_name as patient_name, p.medical_number, p.date_of_birth, p.gender,
                na.assessment_id, fs.submission_status,
                fs.submission_status = 'draft' as is_draft,
                us.signature_data as nurse_signature,
                (SELECT COUNT(*) FROM form_submissions fs2 WHERE fs2.visit_id = pv.visit_id) as total_assessments,
                CASE WHEN pv.created_by = 'hl7-system' THEN 'HL7' ELSE 'Manual' END as visit_source
            FROM patient_visits pv
            JOIN patients p ON pv.patient_ssn = p.ssn
            LEFT JOIN form_submissions fs ON fs.visit_id = pv.visit_id AND fs.form_id = 'form-05-uuid'
            LEFT JOIN nursing_assessments na ON na.submission_id = fs.submission_id
            LEFT JOIN user_signatures us ON na.nurse_signature_id = us.signature_id
            WHERE (pv.created_by = ? OR pv.created_by = 'hl7-system') 
            AND fs.submission_status = 'submitted' AND na.assessment_id IS NOT NULL
            ORDER BY pv.visit_date DESC, pv.created_at DESC
            LIMIT ?
        `, [userId, limit]);
    }

    /**
     * Search nurse history (Completed assessments with filter)
     * @param {string} userId - Nurse user ID
     * @param {string} searchQuery - Search term (Name or SSN)
     * @param {number} limit - Limit for pagination
     * @param {number} offset - Offset for pagination
     * @returns {Promise<Array>}
     */
    async searchNurseHistory(userId, searchQuery = '', limit = 10, offset = 0) {
        const query = searchQuery ? `%${searchQuery.toLowerCase()}%` : '%';

        return this._all(`
            SELECT
                pv.visit_id, pv.patient_ssn, pv.visit_date, pv.visit_status,
                pv.primary_diagnosis, pv.secondary_diagnosis, pv.diagnosis_code,
                pv.department,
                p.full_name as patient_name, p.medical_number, p.date_of_birth, p.gender,
                na.assessment_id, fs.submission_status, fs.submitted_at
            FROM patient_visits pv
            JOIN patients p ON pv.patient_ssn = p.ssn
            JOIN form_submissions fs ON fs.visit_id = pv.visit_id AND fs.form_id = 'form-05-uuid'
            JOIN nursing_assessments na ON na.submission_id = fs.submission_id
            WHERE fs.submitted_by = ?
            AND fs.submission_status = 'submitted'
            AND (
                lower(p.full_name) LIKE ? OR 
                p.ssn LIKE ? OR 
                p.medical_number LIKE ?
            )
            ORDER BY fs.submitted_at DESC
            LIMIT ? OFFSET ?
        `, [userId, query, query, query, limit, offset]);
    }

    /**
     * Count nurse history records for pagination
     * @param {string} userId - Nurse user ID
     * @param {string} searchQuery - Search term
     * @returns {Promise<number>}
     */
    async countNurseHistory(userId, searchQuery = '') {
        const query = searchQuery ? `%${searchQuery.toLowerCase()}%` : '%';
        const result = await this._get(`
            SELECT COUNT(*) as count
            FROM patient_visits pv
            JOIN patients p ON pv.patient_ssn = p.ssn
            JOIN form_submissions fs ON fs.visit_id = pv.visit_id AND fs.form_id = 'form-05-uuid'
            JOIN nursing_assessments na ON na.submission_id = fs.submission_id
            WHERE fs.submitted_by = ?
            AND fs.submission_status = 'submitted'
            AND (
                lower(p.full_name) LIKE ? OR 
                p.ssn LIKE ? OR 
                p.medical_number LIKE ?
            )
        `, [userId, query, query, query]);
        return result ? result.count : 0;
    }

    /**
     * Search radiologist history
     * @param {string} userId - Radiologist user ID
     * @param {string} searchQuery - Search term (Name or SSN)
     * @param {number} limit - Limit for pagination
     * @param {number} offset - Offset for pagination
     * @returns {Promise<Array>}
     */
    async searchRadiologistHistory(userId, searchQuery = '', limit = 10, offset = 0) {
        const query = searchQuery ? `%${searchQuery.toLowerCase()}%` : '%';

        return this._all(`
            SELECT
                pv.visit_id, pv.patient_ssn, pv.visit_date, pv.visit_status,
                pv.primary_diagnosis, pv.department,
                p.full_name as patient_name, p.medical_number, p.date_of_birth, p.gender,
                CASE 
                    WHEN pet.record_id IS NOT NULL THEN 'PET CT'
                    WHEN ref.id IS NOT NULL THEN 'Radiology'
                    ELSE 'Unknown'
                END as form_type,
                COALESCE(ref.updated_at, ref.created_at, pet.updated_at, pet.created_at) as completed_at
            FROM patient_visits pv
            JOIN patients p ON pv.patient_ssn = p.ssn
            LEFT JOIN radiology_examination_form ref ON ref.visit_id = pv.visit_id AND ref.created_by = ?
            LEFT JOIN pet_ct_records pet ON pet.visit_id = pv.visit_id AND pet.created_by = ?
            WHERE (ref.id IS NOT NULL OR pet.record_id IS NOT NULL)
            AND (
                lower(p.full_name) LIKE ? OR 
                p.ssn LIKE ? OR 
                p.medical_number LIKE ?
            )
            ORDER BY completed_at DESC
            LIMIT ? OFFSET ?
        `, [userId, userId, query, query, query, limit, offset]);
    }

    /**
     * Count radiologist history records for pagination
     * @param {string} userId - Radiologist user ID
     * @param {string} searchQuery - Search term
     * @returns {Promise<number>}
     */
    async countRadiologistHistory(userId, searchQuery = '') {
        const query = searchQuery ? `%${searchQuery.toLowerCase()}%` : '%';
        const result = await this._get(`
            SELECT COUNT(*) as count
            FROM patient_visits pv
            JOIN patients p ON pv.patient_ssn = p.ssn
            LEFT JOIN radiology_examination_form ref ON ref.visit_id = pv.visit_id AND ref.created_by = ?
            LEFT JOIN pet_ct_records pet ON pet.visit_id = pv.visit_id AND pet.created_by = ?
            WHERE (ref.id IS NOT NULL OR pet.record_id IS NOT NULL)
            AND (
                lower(p.full_name) LIKE ? OR 
                p.ssn LIKE ? OR 
                p.medical_number LIKE ?
            )
        `, [userId, userId, query, query, query]);
        return result ? result.count : 0;
    }

    /**
     * Get total visit count
     * @returns {Promise<number>}
     */
    async count() {
        const result = await this._get('SELECT COUNT(*) as count FROM patient_visits');
        return result ? result.count : 0;
    }

    /**
     * Get visits over time for charts (last N days)
     * @param {number} days - Number of days to look back
     * @returns {Promise<Array>}
     */
    async getVisitsOverTime(days = 7) {
        return this._all(`
            SELECT DATE(visit_date) as date, COUNT(*) as count 
            FROM patient_visits 
            WHERE visit_date >= datetime('now', '-' || ? || ' days')
            GROUP BY DATE(visit_date)
            ORDER BY DATE(visit_date)
    `, [days]);
    }

    /**
     * Get visit status distribution for charts
     * @returns {Promise<Array>}
     */
    async getStatusDistribution() {
        return this._all('SELECT visit_status, COUNT(*) as count FROM patient_visits GROUP BY visit_status');
    }

    /**
     * Get department distribution for charts
     * @returns {Promise<Array>}
     */
    async getDepartmentDistribution() {
        return this._all('SELECT department, COUNT(*) as count FROM patient_visits WHERE department IS NOT NULL GROUP BY department');
    }

    /**
     * Get today's visit statistics
     * @returns {Promise<Object>}
     */
    async getTodayStats() {
        return this._get(`
SELECT
    (SELECT COUNT(*) FROM patient_visits WHERE DATE(visit_date) = DATE('now')) as new_visits,
    (SELECT COUNT(*) FROM patient_visits WHERE visit_status = 'completed' AND DATE(completed_at) = DATE('now')) as completed
        `);
    }

    /**
     * Generate a unique visit ID
     * @returns {string}
     */
    static generateVisitId() {
        return 'visit-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Search completed reports for admin
     * @param {string} searchQuery - SSN, Medical Number, or Visit ID
     * @returns {Promise<Array>}
     */
    async searchCompletedReports(searchQuery = '') {
        const query = searchQuery ? `%${searchQuery.toLowerCase()}%` : '%';

        return this._all(`
            SELECT
                pv.visit_id, pv.visit_date, pv.visit_status, pv.department,
                p.full_name as patient_name, p.medical_number, p.ssn,
                (SELECT COUNT(*) FROM form_submissions fs WHERE fs.visit_id = pv.visit_id AND fs.submission_status = 'submitted') as report_count
            FROM patient_visits pv
            JOIN patients p ON pv.patient_ssn = p.ssn
            WHERE (
                lower(p.full_name) LIKE ? OR 
                p.ssn LIKE ? OR 
                p.medical_number LIKE ? OR
                pv.visit_id LIKE ?
            )
            AND (pv.visit_status = 'completed' OR EXISTS (
                SELECT 1 FROM form_submissions fs 
                WHERE fs.visit_id = pv.visit_id AND fs.submission_status = 'submitted'
            ))
            ORDER BY pv.visit_date DESC, pv.created_at DESC
            LIMIT 20
        `, [query, query, query, query]);
    }
}

module.exports = VisitDAO;
