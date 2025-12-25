const sqlite3 = require('sqlite3').verbose();
const { parseHL7Date, calculateAge, getAgeCategory } = require('./utils/dateHelpers');
const { createDAOs } = require('./db/dao');

module.exports = function (app, db, requireAuth, requireRole) {
    const daos = createDAOs(db);

    // Radiologist dashboard route
    app.get('/radiologist', requireAuth, requireRole('radiologist'), (req, res) => {
        // Get current visits that have completed nursing assessments but no radiology assessment
        db.all(`
            SELECT
                pv.visit_id, pv.patient_ssn, pv.visit_date, pv.visit_status,
                pv.primary_diagnosis, pv.secondary_diagnosis, pv.diagnosis_code,
                pv.visit_type, pv.department, pv.created_at,
                p.full_name as patient_name, p.medical_number, p.date_of_birth, p.gender,
                na.assessment_id, fs.submission_status as nursing_status,
                nus.signature_data as nurse_signature,
                ref.id as radiology_form_entry_id, ref.form_status as radiology_status,
                ref.radiologist_signature_id as radiologist_signature_id,
                rus.signature_data as radiologist_signature,
                -- Intelligent form recommendation: prefer PET CT for oncology-related cases or when nursing notes indicate tumor/cancer
                CASE
                    WHEN (
                        LOWER(COALESCE(na.chief_complaint, '')) LIKE '%tumor%' OR
                        LOWER(COALESCE(na.chief_complaint, '')) LIKE '%cancer%' OR
                        LOWER(COALESCE(pv.primary_diagnosis, '')) LIKE '%tumor%' OR
                        LOWER(COALESCE(pv.primary_diagnosis, '')) LIKE '%neoplasm%' OR
                        (pv.diagnosis_code IS NOT NULL AND pv.diagnosis_code LIKE 'C%')
                    ) THEN 'pet-scan'
                    ELSE 'radiology'
                END AS recommended_form
            FROM patient_visits pv
            JOIN patients p ON pv.patient_ssn = p.ssn
            LEFT JOIN form_submissions fs ON fs.visit_id = pv.visit_id AND fs.form_id = 'form-05-uuid'
            LEFT JOIN nursing_assessments na ON na.submission_id = fs.submission_id
            LEFT JOIN user_signatures nus ON na.nurse_signature_id = nus.signature_id
            LEFT JOIN radiology_examination_form ref ON ref.patient_id = p.ssn AND ref.visit_id = pv.visit_id
            LEFT JOIN user_signatures rus ON ref.radiologist_signature_id = rus.signature_id
            WHERE pv.visit_status IN ('open', 'in_progress')
            AND fs.submission_status = 'submitted'
            AND (ref.id IS NULL OR ref.form_status != 'completed')
            ORDER BY pv.visit_date DESC, pv.created_at DESC
            LIMIT 10
        `, [], (err, waitingVisits) => {
            if (err) {
                console.error('Error getting radiologist waiting visits for dashboard:', err);
                waitingVisits = [];
            }

            // Process visits to add parsed dates and ages
            (waitingVisits || []).forEach(visit => {
                visit.parsed_date_of_birth = parseHL7Date(visit.date_of_birth);
                visit.calculated_age = calculateAge(visit.date_of_birth);
            });

            res.render('radiologist-dashboard', {
                user: req.session,
                waitingVisits: waitingVisits || [],
                selectedPatient: req.session.selectedPatient || null,
                selectedVisit: req.session.selectedVisit || null
            });
        });
    });

    // Radiologist history route
    app.get('/radiologist/history', requireAuth, requireRole('radiologist'), async (req, res) => {
        try {
            const query = req.query.q || '';
            const history = await daos.visits.searchRadiologistHistory(req.session.userId, query);

            // Process dates
            (history || []).forEach(visit => {
                visit.parsed_date_of_birth = parseHL7Date(visit.date_of_birth);
                visit.calculated_age = calculateAge(visit.date_of_birth);
            });

            res.render('radiologist-history', {
                user: req.session,
                history: history || [],
                searchQuery: query,
                moment: require('moment')
            });
        } catch (err) {
            console.error('Error loading radiologist history:', err);
            res.status(500).send('Database error');
        }
    });

    // Radiologist start assessment route - direct access with visit_id
    app.get('/radiologist/start-assessment/:visitId', requireAuth, requireRole('radiologist'), (req, res) => {
        const visitId = req.params.visitId;

        // Get visit and patient info (allow HL7-created visits)
        db.get(`
            SELECT pv.*, p.full_name, p.mobile_number, p.medical_number, p.date_of_birth, p.gender,
                   p.phone_number, p.address, p.emergency_contact_name, p.emergency_contact_phone, p.emergency_contact_relation
            FROM patient_visits pv
            JOIN patients p ON pv.patient_ssn = p.ssn
            WHERE pv.visit_id = ?
        `, [visitId], (err, visit) => {
            if (err || !visit) {
                return res.redirect('/radiologist?error=Visit not found or not accessible');
            }

            // Check if nursing assessment is completed
            db.get('SELECT submission_status FROM form_submissions WHERE visit_id = ? AND form_id = ?', [visitId, 'form-05-uuid'], (err, fs) => {
                if (err || !fs || fs.submission_status !== 'submitted') {
                    return res.redirect('/radiologist?error=Nursing assessment not completed for this visit');
                }

                // Set session variables for radiology form
                req.session.selectedPatient = {
                    ssn: visit.patient_ssn,
                    full_name: visit.full_name,
                    mobile_number: visit.mobile_number,
                    medical_number: visit.medical_number,
                    date_of_birth: visit.date_of_birth,
                    gender: visit.gender,
                    phone_number: visit.phone_number,
                    address: visit.address,
                    emergency_contact_name: visit.emergency_contact_name,
                    emergency_contact_phone: visit.emergency_contact_phone,
                    emergency_contact_relation: visit.emergency_contact_relation
                };

                req.session.selectedVisit = {
                    visit_id: visit.visit_id,
                    visit_date: visit.visit_date,
                    visit_status: visit.visit_status,
                    primary_diagnosis: visit.primary_diagnosis,
                    secondary_diagnosis: visit.secondary_diagnosis,
                    diagnosis_code: visit.diagnosis_code,
                    visit_type: visit.visit_type,
                    department: visit.department
                };

                // Redirect to radiology form
                res.redirect('/radiology-form');
            });
        });
    });

    // Radiologist start PET scan assessment route
    app.get('/radiologist/start-pet-scan/:visitId', requireAuth, requireRole('radiologist'), (req, res) => {
        const visitId = req.params.visitId;

        // Get visit and patient info (allow HL7-created visits)
        db.get(`
            SELECT pv.*, p.full_name, p.mobile_number, p.medical_number, p.date_of_birth, p.gender,
                   p.phone_number, p.address, p.emergency_contact_name, p.emergency_contact_phone, p.emergency_contact_relation
            FROM patient_visits pv
            JOIN patients p ON pv.patient_ssn = p.ssn
            WHERE pv.visit_id = ?
        `, [visitId], (err, visit) => {
            if (err || !visit) {
                return res.redirect('/radiologist?error=Visit not found or not accessible');
            }

            // Check if nursing assessment is completed
            db.get('SELECT submission_status FROM form_submissions WHERE visit_id = ? AND form_id = ?', [visitId, 'form-05-uuid'], (err, fs) => {
                if (err || !fs || fs.submission_status !== 'submitted') {
                    return res.redirect('/radiologist?error=Nursing assessment not completed for this visit');
                }

                // Set session variables for PET scan form
                req.session.selectedPatient = {
                    ssn: visit.patient_ssn,
                    full_name: visit.full_name,
                    mobile_number: visit.mobile_number,
                    medical_number: visit.medical_number,
                    date_of_birth: visit.date_of_birth,
                    gender: visit.gender,
                    phone_number: visit.phone_number,
                    address: visit.address,
                    emergency_contact_name: visit.emergency_contact_name,
                    emergency_contact_phone: visit.emergency_contact_phone,
                    emergency_contact_relation: visit.emergency_contact_relation
                };

                req.session.selectedVisit = {
                    visit_id: visit.visit_id,
                    visit_date: visit.visit_date,
                    visit_status: visit.visit_status,
                    primary_diagnosis: visit.primary_diagnosis,
                    secondary_diagnosis: visit.secondary_diagnosis,
                    diagnosis_code: visit.diagnosis_code,
                    visit_type: visit.visit_type,
                    department: visit.department
                };

                // Redirect to PET scan form
                res.redirect('/pet-scan-form');
            });
        });
    });

    app.post('/radiologist/search-patient', requireAuth, requireRole('radiologist'), (req, res) => {
        const { ssn } = req.body;

        // Validate SSN format
        if (!ssn || !/^\d{14}$/.test(ssn)) {
            return res.render('radiologist-dashboard', { user: req.session, patient: null, error: 'Please enter a valid 14-digit SSN' });
        }

        db.get('SELECT * FROM patients WHERE ssn = ?', [ssn], (err, patient) => {
            if (err) {
                console.error('Database error:', err);
                return res.render('radiologist-dashboard', { user: req.session, patient: null, error: 'Database error' });
            }

            if (!patient) {
                return res.render('radiologist-dashboard', { user: req.session, patient: null, error: 'Patient not found. Please ensure the patient is registered.' });
            }

            // Store patient in session for radiology form access
            req.session.selectedPatient = patient;

            // Check for current visit or create new one
            db.get('SELECT * FROM patient_visits WHERE patient_ssn = ? ORDER BY created_at DESC LIMIT 1', [ssn], (err, visit) => {
                if (err) {
                    console.error('Error checking visits:', err);
                    return res.render('radiologist-dashboard', { user: req.session, patient: patient, error: 'Error checking patient visits' });
                }

                if (!visit) {
                    // Create new visit
                    const visitId = 'visit-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                    db.run('INSERT INTO patient_visits (visit_id, patient_ssn, created_by) VALUES (?, ?, ?)',
                        [visitId, ssn, req.session.userId], function (err) {
                            if (err) {
                                console.error('Error creating visit:', err);
                                return res.render('radiologist-dashboard', { user: req.session, patient: patient, error: 'Error creating visit' });
                            }
                            req.session.selectedVisit = { visit_id: visitId };
                            res.render('radiologist-dashboard', { user: req.session, patient: patient, error: null });
                        });
                } else {
                    req.session.selectedVisit = visit;
                    res.render('radiologist-dashboard', { user: req.session, patient: patient, error: null });
                }
            });
        });
    });

    app.get('/radiology-form', requireAuth, requireRole('radiologist'), (req, res) => {
        if (!req.session.selectedPatient || !req.session.selectedVisit) {
            return res.redirect('/radiologist');
        }

        // Get user's signature
        db.get('SELECT signature_data FROM user_signatures WHERE user_id = ?', [req.session.userId], (err, userSignature) => {
            res.render('radiology-form', {
                user: req.session,
                patient: req.session.selectedPatient,
                visit: req.session.selectedVisit,
                userSignature: userSignature ? userSignature.signature_data : null
            });
        });
    });

    // PET scan form route
    app.get('/pet-scan-form', requireAuth, requireRole('radiologist'), (req, res) => {
        if (!req.session.selectedPatient || !req.session.selectedVisit) {
            return res.redirect('/radiologist');
        }

        // Get user's signature
        db.get('SELECT signature_data FROM user_signatures WHERE user_id = ?', [req.session.userId], (err, userSignature) => {
            res.render('pet-scan-form', {
                user: req.session,
                patient: req.session.selectedPatient,
                visit: req.session.selectedVisit,
                userSignature: userSignature ? userSignature.signature_data : null
            });
        });
    });

    app.post('/submit-radiology-form', requireAuth, requireRole('radiologist'), (req, res) => {
        const formData = req.body;
        console.log('Radiology form submitted:', formData);

        const parseCheckbox = (value) => {
            if (Array.isArray(value)) {
                return value.some(v => v === 'on' || v === 'true' || v === '1') ? 1 : 0;
            }
            return value === 'on' || value === 'true' || value === true || value === 1 || value === '1' ? 1 : 0;
        };

        const parseNumber = (value) => {
            if (value === undefined || value === null || value === '') {
                return null;
            }
            const num = Number(value);
            return Number.isNaN(num) ? null : num;
        };

        const calculateAgeFromDob = (dob) => {
            if (!dob) {
                return null;
            }
            const birthDate = new Date(dob);
            if (Number.isNaN(birthDate.getTime())) {
                return null;
            }
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            return age >= 0 ? age : null;
        };

        if (!req.session.selectedVisit) {
            return res.status(400).send('No patient visit selected');
        }

        // Handle signatures
        const radiologistSignatureData = formData.radiologist_signature;
        const patientSignatureData = formData.patient_signature;

        if (!radiologistSignatureData || radiologistSignatureData === '') {
            return res.status(400).send('Radiologist signature is required');
        }

        if (!patientSignatureData || patientSignatureData === '') {
            return res.status(400).send('Patient signature is required');
        }

        // Check if user already has a signature
        db.get('SELECT signature_id FROM user_signatures WHERE user_id = ?', [req.session.userId], (err, existingSignature) => {
            if (err) {
                console.error('Error checking existing signature:', err);
                return res.status(500).send('Database error');
            }

            const signatureId = existingSignature ? existingSignature.signature_id : 'sig-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

            const signatureSql = existingSignature ?
                'UPDATE user_signatures SET signature_data = ?, updated_at = CURRENT_TIMESTAMP WHERE signature_id = ?' :
                'INSERT INTO user_signatures (signature_id, user_id, signature_data) VALUES (?, ?, ?)';

            const signatureValues = existingSignature ?
                [radiologistSignatureData, signatureId] :
                [signatureId, req.session.userId, radiologistSignatureData];

            db.run(signatureSql, signatureValues, function (sigErr) {
                if (sigErr) {
                    console.error('Error saving signature:', sigErr);
                    return res.status(500).send('Error saving signature');
                }

                // Now proceed with form submission using direct patient relationship
                function proceedWithRadiologySubmission() {
                    // Generate UUID-like string for the form record
                    const formId = 'rad-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

                    const selectedPatient = req.session.selectedPatient || {};
                    const selectedVisit = req.session.selectedVisit || {};

                    // Insert into radiology examination form with all new fields
                    const sql = `
                        INSERT INTO radiology_examination_form (
                            id, patient_id, visit_id, created_by, form_type, examination_date,
                            ctd1vol, dlp, kv, mas, patient_complaint,
                            has_gypsum_splint, gypsum_splint_details,
                            has_chronic_disease, chronic_disease_details, current_medications,
                            has_allergy, allergy_medication, allergy_medication_details,
                            allergy_food, allergy_food_details, allergy_others, allergy_others_details,
                            has_previous_operations, operation_details, operation_date, operation_reason,
                            has_tumor_history, tumor_location, tumor_type,
                            has_swelling, swelling_location,
                            has_previous_investigations, previous_investigation_type, previous_investigation_date,
                            has_fall_risk_medications, fall_risk_medication_details, has_fever,
                            is_pregnant, is_lactating,
                            has_pacemaker, has_cochlear_implant, has_aneurysmal_clips, has_intraocular_foreign_body,
                            implant_details, has_surgical_implants, surgical_implant_details,
                            has_critical_result, critical_result_details,
                            patient_signature, radiologist_signature_id,
                            form_status, additional_notes, radiologist_notes
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    const values = [
                        formId,
                        selectedPatient.ssn || req.body.patient_ssn,
                        selectedVisit.visit_id,
                        req.session.userId,
                        formData.form_type || 'xray',
                        formData.examination_date || null,
                        formData.ctd1vol || null,
                        formData.dlp || null,
                        formData.kv || null,
                        formData.mas || null,
                        formData.reason_for_examination || '',
                        parseCheckbox(formData.has_gypsum_splint),
                        formData.gypsum_splint_details || null,
                        parseCheckbox(formData.has_chronic_disease),
                        formData.chronic_disease_details || null,
                        formData.current_medications || null,
                        parseCheckbox(formData.has_allergy),
                        parseCheckbox(formData.allergy_medication),
                        formData.allergy_medication_details || null,
                        parseCheckbox(formData.allergy_food),
                        formData.allergy_food_details || null,
                        parseCheckbox(formData.allergy_others),
                        formData.allergy_others_details || null,
                        parseCheckbox(formData.has_previous_operations),
                        formData.operation_details || null,
                        formData.operation_date || null,
                        formData.operation_reason || null,
                        parseCheckbox(formData.has_tumor_history),
                        formData.tumor_location || null,
                        formData.tumor_type || null,
                        parseCheckbox(formData.has_swelling),
                        formData.swelling_location || null,
                        parseCheckbox(formData.has_previous_investigations),
                        formData.previous_investigation_type || null,
                        formData.previous_investigation_date || null,
                        parseCheckbox(formData.has_fall_risk_medications),
                        formData.fall_risk_medication_details || null,
                        parseCheckbox(formData.has_fever),
                        parseCheckbox(formData.is_pregnant),
                        parseCheckbox(formData.is_lactating),
                        parseCheckbox(formData.has_pacemaker),
                        parseCheckbox(formData.has_cochlear_implant),
                        parseCheckbox(formData.has_aneurysmal_clips),
                        parseCheckbox(formData.has_intraocular_foreign_body),
                        formData.implant_details || null,
                        parseCheckbox(formData.has_surgical_implants),
                        formData.surgical_implant_details || null,
                        parseCheckbox(formData.has_critical_result),
                        formData.critical_finding || null,
                        patientSignatureData,
                        signatureId,
                        formData.form_status || 'completed',
                        formData.additional_notes || null,
                        formData.radiologist_notes || null
                    ];

                    db.run(sql, values, function (err) {
                        if (err) {
                            console.error('Error inserting radiology examination form:', err.message);
                            return res.status(500).send('Error saving assessment');
                        }

                        // Create form submission entry linking to the visit
                        const submissionId = 'sub-rad-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                        db.run('INSERT INTO form_submissions (submission_id, visit_id, form_id, submitted_by, submission_status) VALUES (?, ?, ?, ?, ?)',
                            [submissionId, selectedVisit.visit_id, 'form-03-uuid', req.session.userId, 'submitted'], function (fsErr) {
                                if (fsErr) {
                                    console.error('Error creating form submission for radiology:', fsErr);
                                    return res.status(500).send('Error creating form submission');
                                }

                                // Mark visit as completed after radiology assessment
                                db.run('UPDATE patient_visits SET visit_status = ?, updated_at = CURRENT_TIMESTAMP WHERE visit_id = ?',
                                    ['completed', selectedVisit.visit_id], function (updateErr) {
                                        if (updateErr) {
                                            console.error('Error updating visit status:', updateErr);
                                            // Don't fail the whole operation, just log the error
                                        } else {
                                            console.log('Visit marked as completed:', selectedVisit.visit_id);
                                        }
                                    });

                                console.log('Radiology examination form saved with ID:', formId);
                                req.session.notification = { type: 'success', message: 'Radiology examination form submitted successfully!' };
                                res.redirect('/radiologist');
                            });
                    });
                } proceedWithRadiologySubmission();
            });
        });
    });

    // POST handler for PET CT form submission
    app.post('/submit-pet-scan-form', requireAuth, requireRole('radiologist'), (req, res) => {
        const formData = req.body;

        if (!req.session.selectedVisit || !req.session.selectedPatient) {
            return res.status(400).send('No patient visit selected');
        }

        const parseCheckbox = (v) => (v === 'on' || v === '1' || v === 'true' || v === 1 || v === true) ? 1 : 0;
        const parseNumber = (v) => (v === undefined || v === null || v === '') ? null : Number(v);

        // Basic validation
        if (!formData.radiologist_signature) {
            return res.status(400).send('Radiologist signature is required');
        }

        // Save radiologist signature if missing in user_signatures
        db.get('SELECT signature_id FROM user_signatures WHERE user_id = ?', [req.session.userId], (err, existingSig) => {
            if (err) {
                console.error('Error checking existing signature:', err);
                return res.status(500).send('Database error');
            }

            const signatureId = existingSig ? existingSig.signature_id : 'sig-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            const sigSql = existingSig ? 'UPDATE user_signatures SET signature_data = ?, updated_at = CURRENT_TIMESTAMP WHERE signature_id = ?' : 'INSERT INTO user_signatures (signature_id, user_id, signature_data) VALUES (?, ?, ?)';
            const sigParams = existingSig ? [formData.radiologist_signature, signatureId] : [signatureId, req.session.userId, formData.radiologist_signature];

            db.run(sigSql, sigParams, function (sigErr) {
                if (sigErr) {
                    console.error('Error saving radiologist signature for PET scan:', sigErr);
                    return res.status(500).send('Error saving signature');
                }

                // Create a new pet record
                const recordId = 'pet-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                const patientId = req.session.selectedPatient.ssn;
                const visitId = req.session.selectedVisit.visit_id;

                const petParams = [
                    recordId,
                    patientId,
                    visitId,
                    req.session.userId,
                    formData.facility || null,
                    formData.treating_physician || null,
                    parseNumber(formData.fasting_hours),
                    formData.diabetic_patient || null,
                    parseNumber(formData.blood_sugar_level),
                    parseNumber(formData.weight_kg),
                    parseNumber(formData.height_cm),
                    formData.dose || null,
                    formData.injection_site || null,
                    formData.injection_time || null,
                    formData.preparation_time || null,
                    parseNumber(formData.ctdivol),
                    parseNumber(formData.dlp),
                    formData.contrast_used || null,
                    parseNumber(formData.kidney_function_urea),
                    parseNumber(formData.kidney_function_creatinine),
                    formData.exam_date || null,
                    formData.first_time_exam || null,
                    formData.comparison_study || null,
                    formData.previous_exam_code || null,
                    formData.previous_report || null,
                    formData.previous_cd || null,
                    formData.comparison_date || null,
                    parseCheckbox(formData.has_ultrasound),
                    parseCheckbox(formData.has_xray),
                    parseCheckbox(formData.has_ct),
                    parseCheckbox(formData.has_mammography),
                    parseCheckbox(formData.has_mri),
                    parseCheckbox(formData.has_kidney_scan_dtpa),
                    parseCheckbox(formData.has_bone_scan_mdp),
                    parseCheckbox(formData.has_biopsy),
                    parseCheckbox(formData.has_endoscopy),
                    parseCheckbox(formData.has_surgery),
                    formData.other_attachments || null,
                    formData.patient_signature || null,
                    formData.phone_number || null,
                    formData.tumor_location || null,
                    formData.tumor_type || null,
                    formData.diagnosis_details || null,
                    formData.reason_for_study || null,
                    formData.reason_details || null,
                    formData.chemotherapy || null,
                    formData.chemo_type || null,
                    formData.chemo_details || null,
                    parseNumber(formData.chemo_sessions_number),
                    formData.radiotherapy || null,
                    formData.radio_anatomical_site || null,
                    parseNumber(formData.radio_sessions_number),
                    formData.radio_last_session_date || null,
                    formData.hormonal_treatment || null,
                    formData.hormonal_last_dose_date || null,
                    formData.surgery_type || null,
                    formData.last_surgery_date || null,
                    formData.other_notes || null,
                    signatureId,
                    formData.form_status || 'submitted'
                ];

                const petInsertSql = `
                    INSERT INTO pet_ct_records (
                        record_id, patient_id, visit_id, created_by, facility, treating_physician,
                        fasting_hours, diabetic_patient, blood_sugar_level, weight_kg, height_cm,
                        dose, injection_site, injection_time, preparation_time,
                        ctdivol, dlp, contrast_used, kidney_function_urea, kidney_function_creatinine, exam_date,
                        first_time_exam, comparison_study, previous_exam_code, previous_report, previous_cd, comparison_date,
                        has_ultrasound, has_xray, has_ct, has_mammography, has_mri, has_kidney_scan_dtpa, has_bone_scan_mdp,
                        has_biopsy, has_endoscopy, has_surgery, other_attachments, patient_signature, phone_number,
                        tumor_location, tumor_type, diagnosis_details, reason_for_study, reason_details,
                        chemotherapy, chemo_type, chemo_details, chemo_sessions_number, radiotherapy, radio_anatomical_site,
                        radio_sessions_number, radio_last_session_date, hormonal_treatment, hormonal_last_dose_date,
                        surgery_type, last_surgery_date, other_notes, physician_signature, form_status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                db.run(petInsertSql, petParams, function (petErr) {
                    if (petErr) {
                        console.error('Error inserting PET CT record:', petErr);
                        return res.status(500).send('Error saving PET CT record');
                    }

                    // Create form submission entry linking to the visit
                    const submissionId = 'sub-pet-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                    db.run('INSERT INTO form_submissions (submission_id, visit_id, form_id, submitted_by, submission_status) VALUES (?, ?, ?, ?, ?)',
                        [submissionId, visitId, 'form-06-uuid', req.session.userId, 'submitted'], function (fsErr) {
                            if (fsErr) {
                                console.error('Error creating form submission for PET CT:', fsErr);
                                return res.status(500).send('Error creating form submission');
                            }

                            // Optionally mark visit as in_progress -> completed depending on form_status
                            const newVisitStatus = (formData.form_status === 'completed') ? 'completed' : 'in_progress';
                            db.run('UPDATE patient_visits SET visit_status = ?, updated_at = CURRENT_TIMESTAMP WHERE visit_id = ?', [newVisitStatus, visitId], function (updErr) {
                                if (updErr) {
                                    console.error('Error updating visit status after PET CT submission:', updErr);
                                }

                                // Respond success and redirect to dashboard
                                res.redirect('/radiologist?message=PET CT form submitted successfully');
                            });
                        });
                });
            });
        });
    });

    // Radiologist view completed assessment route
    app.get('/radiologist/view-assessment/:visitId', requireAuth, requireRole('radiologist'), (req, res) => {
        const visitId = req.params.visitId;

        // Get visit, patient, nursing assessment, and radiology assessment data
        db.get(`
            SELECT
                pv.visit_id, pv.patient_ssn, pv.visit_date, pv.visit_status,
                pv.primary_diagnosis, pv.secondary_diagnosis, pv.diagnosis_code,
                pv.visit_type, pv.department, pv.created_at,
                p.full_name as patient_name, p.medical_number, p.date_of_birth, p.gender,
                p.mobile_number, p.phone_number, p.address,
                p.emergency_contact_name, p.emergency_contact_phone, p.emergency_contact_relation
            FROM patient_visits pv
            JOIN patients p ON pv.patient_ssn = p.ssn
            WHERE pv.visit_id = ?
        `, [visitId], (err, visitData) => {
            if (err || !visitData) {
                console.error('Error getting visit data:', err);
                return res.status(404).send('Visit not found');
            }

            // Get nursing assessment data
            db.get(`
                SELECT na.*, fs.submission_status as nursing_status, fs.submitted_at as nursing_submitted_at,
                       u.full_name as nurse_name, nus.signature_data as nurse_signature
                FROM nursing_assessments na
                JOIN form_submissions fs ON na.submission_id = fs.submission_id
                LEFT JOIN users u ON fs.submitted_by = u.user_id
                LEFT JOIN user_signatures nus ON na.nurse_signature_id = nus.signature_id
                WHERE fs.visit_id = ? AND fs.form_id = 'form-05-uuid'
            `, [visitId], (err, nursingData) => {
                if (err) {
                    console.error('Error getting nursing data:', err);
                    nursingData = null;
                }

                // Get radiology assessment data
                db.get(`
                    SELECT ref.*, u.full_name as radiologist_name, dus.signature_data as radiologist_signature
                    FROM radiology_examination_form ref
                    LEFT JOIN users u ON ref.created_by = u.user_id
                    LEFT JOIN user_signatures dus ON ref.radiologist_signature_id = dus.signature_id
                    WHERE ref.visit_id = ? AND ref.patient_id = ?
                `, [visitId, visitData.patient_ssn], (err, radiologyData) => {
                    if (err) {
                        console.error('Error getting radiology data:', err);
                        radiologyData = null;
                    }

                    res.render('radiologist-view-assessment', {
                        user: req.session,
                        visit: visitData,
                        nursingAssessment: nursingData,
                        radiologyAssessment: radiologyData
                    });
                });
            });
        });
    });

};