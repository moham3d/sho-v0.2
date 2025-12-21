const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, '..', 'database.db'));

async function check() {
    db.serialize(() => {
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='pet_ct_records'", (err, row) => {
            if (err) return console.error('Error checking pet_ct_records table:', err);
            console.log('pet_ct_records table exists:', !!row);
        });

        db.get("SELECT * FROM form_definitions WHERE form_code = 'SH.MR.FRM.06'", (err, fd) => {
            if (err) return console.error('Error querying form_definitions:', err);
            console.log('PET CT form definition present:', !!fd);
        });

        // Check recommendation logic for a sample visit
        db.get(`SELECT pv.visit_id, pv.primary_diagnosis, na.has_tumor_history,
            CASE WHEN (na.has_tumor_history = 1) OR (LOWER(pv.primary_diagnosis) LIKE '%tumor%') OR (pv.diagnosis_code LIKE 'C%') THEN 'pet-scan' ELSE 'radiology' END AS recommended_form
            FROM patient_visits pv
            LEFT JOIN form_submissions fs ON fs.visit_id = pv.visit_id AND fs.form_id = 'form-05-uuid'
            LEFT JOIN nursing_assessments na ON na.submission_id = fs.submission_id
            WHERE pv.visit_id = 'visit-002'
        `, (err, rec) => {
            if (err) return console.error('Error checking recommendation:', err);
            console.log('Recommendation for visit-002:', rec ? rec.recommended_form : 'not found');
            db.close();
        });
    });
}

check();