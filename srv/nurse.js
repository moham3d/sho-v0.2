const sqlite3 = require('sqlite3').verbose();
const { parseHL7Date, calculateAge, getAgeCategory } = require('./utils/dateHelpers');
const { createDAOs, VisitDAO, AssessmentDAO } = require('./db/dao');

module.exports = function (app, db, requireAuth, requireRole) {
    // Initialize DAOs
    const daos = createDAOs(db);

    /**
     * Helper to process visits with parsed dates and calculated ages
     */
    function processVisitsWithAge(visits) {
        (visits || []).forEach(visit => {
            visit.parsed_date_of_birth = parseHL7Date(visit.date_of_birth);
            visit.calculated_age = calculateAge(visit.date_of_birth);
        });
        return visits;
    }

    // Nurse dashboard route
    app.get('/nurse', requireAuth, requireRole('nurse'), async (req, res) => {
        try {
            // Handle notification from query parameters
            const notification = req.query.notification ? {
                type: req.query.notification,
                message: req.query.message ? decodeURIComponent(req.query.message) : ''
            } : null;

            // Get current and completed visits using DAO
            const currentVisits = await daos.visits.findActiveForNurse(req.session.userId, 5);

            // Process visits to add parsed dates and ages
            processVisitsWithAge(currentVisits);


            res.render('nurse-dashboard', {
                user: req.session,
                notification: notification,
                currentVisits: currentVisits || [],
                visits: currentVisits || [],
                csrfToken: res.locals.csrfToken || ''
            });
        } catch (err) {
            console.error('Error loading nurse dashboard:', err);
            res.render('nurse-dashboard', {
                user: req.session,
                notification: { type: 'error', message: 'Error loading dashboard' },
                currentVisits: [],
                visits: [],
                csrfToken: res.locals.csrfToken || ''
            });
        }
    });

    // Nurse my assessments route
    app.get('/nurse/my-assessments', requireAuth, requireRole('nurse'), async (req, res) => {
        try {
            // Get visits assigned to this nurse that are in progress
            const visits = await daos.visits.findActiveForNurse(req.session.userId, 50);
            processVisitsWithAge(visits);

            res.render('nurse-assessments', {
                user: req.session,
                visits: visits || []
            });
        } catch (err) {
            console.error('Error getting nurse assessments:', err);
            res.status(500).send('Database error');
        }
    });

    // Nurse search patient route
    app.get('/nurse/search-patient', requireAuth, requireRole('nurse'), async (req, res) => {
        try {
            // Get nurse's current visits with assessment status
            const visits = await daos.visits.findActiveForNurse(req.session.userId, 10);
            processVisitsWithAge(visits);

            res.render('patient-search', {
                user: req.session,
                patient: null,
                error: null,
                visitId: null,
                currentVisits: visits || []
            });
        } catch (err) {
            console.error('Error getting nurse visits:', err);
            res.render('patient-search', {
                user: req.session,
                patient: null,
                error: null,
                visitId: null,
                currentVisits: []
            });
        }
    });

    // Nurse history route
    app.get('/nurse/history', requireAuth, requireRole('nurse'), async (req, res) => {
        try {
            const query = req.query.q || '';
            const page = parseInt(req.query.page) || 1;
            const limit = 10;
            const offset = (page - 1) * limit;

            const [history, totalCount] = await Promise.all([
                daos.visits.searchNurseHistory(req.session.userId, query, limit, offset),
                daos.visits.countNurseHistory(req.session.userId, query)
            ]);

            const totalPages = Math.ceil(totalCount / limit);

            // Process dates
            processVisitsWithAge(history);

            res.render('nurse-history', {
                user: req.session,
                history: history || [],
                searchQuery: query,
                currentPage: page,
                totalPages: totalPages,
                moment: require('moment')
            });
        } catch (err) {
            console.error('Error loading nurse history:', err);
            res.status(500).send('Database error');
        }
    });

    // API endpoint for patient autocomplete search
    app.get('/api/patients/search', requireAuth, requireRole('nurse'), async (req, res) => {
        try {
            const { q } = req.query;
            if (!q || q.length < 2) {
                return res.json([]);
            }

            const patients = await daos.patients.searchBySSN(q, 2);
            res.json(patients || []);
        } catch (err) {
            console.error('Patient search error:', err);
            res.status(500).json({ error: 'Search failed' });
        }
    });

    // Nurse search patient POST route
    app.post('/nurse/search-patient', requireAuth, requireRole('nurse'), async (req, res) => {
        const { ssn } = req.body;

        // Validate SSN format
        if (!ssn || !/^\d{14}$/.test(ssn)) {
            return res.render('patient-search', {
                user: req.session,
                patient: null,
                error: 'Please enter a valid 14-digit SSN',
                visitId: null,
                currentVisits: []
            });
        }

        try {
            // Get current visits for the template
            const currentVisits = await daos.visits.findActiveForNurse(req.session.userId, 10);
            processVisitsWithAge(currentVisits);

            // Find patient by SSN
            const patient = await daos.patients.findBySSN(ssn);

            if (!patient) {
                return res.render('patient-search', {
                    user: req.session,
                    patient: null,
                    error: 'Patient not found. Please register the patient first.',
                    visitId: null,
                    currentVisits: currentVisits || [],
                    searchedSSN: ssn
                });
            }

            // Create new visit
            const visitId = VisitDAO.generateVisitId();
            const submissionId = AssessmentDAO.generateSubmissionId();

            await daos.visits.create({
                visit_id: visitId,
                patient_ssn: ssn,
                created_by: req.session.userId
            });

            await daos.assessments.createSubmission({
                submission_id: submissionId,
                visit_id: visitId,
                form_id: 'form-05-uuid',
                submitted_by: req.session.userId,
                submission_status: 'draft'
            });

            // Redirect to nurse form with visit context
            res.redirect(`/nurse/assessment/${visitId}`);
        } catch (err) {
            console.error('Error in search-patient POST:', err);
            res.render('patient-search', {
                user: req.session,
                patient: null,
                error: 'Database error occurred',
                visitId: null,
                currentVisits: []
            });
        }
    });

    // Nurse add patient routes
    app.get('/nurse/add-patient', requireAuth, requireRole('nurse'), (req, res) => {
        const ssn = req.query.ssn || '';
        res.render('add-patient', { user: req.session, error: null, prefilledSSN: ssn });
    });

    app.post('/nurse/add-patient', requireAuth, requireRole('nurse'), async (req, res) => {
        const { ssn, full_name, mobile_number, phone_number, medical_number, date_of_birth, gender, address, emergency_contact_name, emergency_contact_phone, emergency_contact_relation } = req.body;

        // Validate required fields
        if (!ssn || !full_name || !mobile_number || !date_of_birth || !gender) {
            return res.render('add-patient', {
                user: req.session,
                error: 'Please fill in all required fields (SSN, Full Name, Mobile Number, Date of Birth, Gender)',
                prefilledSSN: ssn || ''
            });
        }

        // Validate SSN format (14-digit Egyptian SSN)
        if (!/^\d{14}$/.test(ssn)) {
            return res.render('add-patient', {
                user: req.session,
                error: 'SSN must be exactly 14 digits and contain only numbers',
                prefilledSSN: ssn || ''
            });
        }

        try {
            // Check if patient already exists
            const exists = await daos.patients.exists(ssn);
            if (exists) {
                return res.render('add-patient', {
                    user: req.session,
                    error: 'A patient with this SSN already exists',
                    prefilledSSN: ssn || ''
                });
            }

            // Create patient
            await daos.patients.create({
                ssn,
                full_name,
                mobile_number,
                phone_number: phone_number || null,
                medical_number: medical_number || null,
                date_of_birth,
                gender,
                address: address || null,
                emergency_contact_name: emergency_contact_name || null,
                emergency_contact_phone: emergency_contact_phone || null,
                emergency_contact_relation: emergency_contact_relation || null,
                created_by: req.session.userId
            });

            // Create visit and form submission
            const visitId = VisitDAO.generateVisitId();
            const submissionId = AssessmentDAO.generateSubmissionId();

            await daos.visits.create({
                visit_id: visitId,
                patient_ssn: ssn,
                created_by: req.session.userId
            });

            await daos.assessments.createSubmission({
                submission_id: submissionId,
                visit_id: visitId,
                form_id: 'form-05-uuid',
                submitted_by: req.session.userId,
                submission_status: 'draft'
            });

            // Redirect to nurse form with visit context
            res.redirect(`/nurse/assessment/${visitId}`);
        } catch (err) {
            console.error('Error creating patient:', err);

            // Handle specific constraint errors
            let errorMessage = 'Error creating patient record';
            if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('medical_number')) {
                errorMessage = 'A patient with this Medical Number already exists. Please use a different Medical Number.';
            } else if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('ssn')) {
                errorMessage = 'A patient with this SSN already exists.';
            }

            return res.render('add-patient', {
                user: req.session,
                error: errorMessage,
                prefilledSSN: ssn || ''
            });
        }
    });

    // Nurse assessment route
    app.get('/nurse/assessment/:visitId', requireAuth, requireRole('nurse'), async (req, res) => {
        const visitId = req.params.visitId;

        try {
            // Get visit and patient info (allow access to HL7-created visits)
            const visit = await daos.visits.findWithPatient(visitId, req.session.userId);

            if (!visit) {
                return res.status(404).send('Visit not found');
            }

            // Get user's signature and assessment data in parallel
            const [userSignature, assessmentResult] = await Promise.all([
                daos.assessments.getUserSignature(req.session.userId),
                daos.assessments.findNursingByVisitId(visitId)
            ]);

            const assessment = assessmentResult || null;
            const isCompleted = assessmentResult ? assessmentResult.submission_status === 'submitted' : false;
            const assessmentSignature = assessmentResult ? assessmentResult.assessment_signature : null;

            // Add parsed date to visit object
            if (visit) {
                visit.parsed_date_of_birth = parseHL7Date(visit.date_of_birth);
            }

            res.render('nurse-form', {
                user: req.session,
                visit: visit,
                assessment: assessment,
                isCompleted: isCompleted,
                assessmentSignature: assessmentSignature,
                userSignature: userSignature ? userSignature.signature_data : null
            });
        } catch (err) {
            console.error('Error loading assessment:', err);
            res.status(500).send('Error loading assessment');
        }
    });

    // Nurse form submission route
    // Nurse form submission route
    app.post('/submit-nurse-form', requireAuth, requireRole('nurse'), async (req, res) => {
        const formData = req.body;
        const visitId = formData.visit_id;

        // Server-side validation
        const validationErrors = validateNurseFormData(formData);
        if (validationErrors.length > 0) {
            return res.status(400).send('Validation errors: ' + validationErrors.join(', '));
        }

        // Sanitize form data: convert empty strings to null for numeric fields
        const sanitizedData = sanitizeFormData(formData);

        console.log('Nurse form submitted:', {
            visitId,
            hasSignature: !!formData.nurse_signature,
            signatureLength: formData.nurse_signature ? formData.nurse_signature.length : 0
        });

        try {
            // Check if form submission exists
            const existingFs = await daos.assessments.findSubmissionByVisit(visitId, 'form-05-uuid');
            let submissionId = existingFs ? existingFs.submission_id : AssessmentDAO.generateSubmissionId();

            // Check if assessment exists for this submission
            let existingAssessment = null;
            if (existingFs) {
                existingAssessment = await daos.assessments.findNursingBySubmissionId(submissionId);
            }

            // Prevent updates to completed assessments
            if (existingAssessment && existingFs && existingFs.submission_status === 'submitted') {
                return res.status(403).send('This assessment has been completed and cannot be modified. Please contact an administrator if changes are needed.');
            }

            // Handle signature storage - always required
            const signatureData = formData.nurse_signature;
            if (!signatureData || signatureData === '') {
                return res.status(400).send('Signature is required for submission');
            }

            // Save/update user signature
            const signatureId = await daos.assessments.saveUserSignature(req.session.userId, signatureData);

            // Prepare assessment data
            const assessmentId = existingAssessment ? existingAssessment.assessment_id : AssessmentDAO.generateAssessmentId('nurse');
            const assessmentData = buildAssessmentData(sanitizedData, assessmentId, submissionId, signatureId, req.session.userId);

            // Save assessment (insert or update)
            if (existingAssessment) {
                await updateNursingAssessment(assessmentId, assessmentData);
            } else {
                await insertNursingAssessment(assessmentData);
            }

            console.log('Nurse assessment saved successfully with ID:', assessmentId);

            // Handle form submission record
            if (!existingFs) {
                await daos.assessments.createSubmission({
                    submission_id: submissionId,
                    visit_id: visitId,
                    form_id: 'form-05-uuid',
                    submitted_by: req.session.userId,
                    submission_status: 'submitted'
                });
            } else if (existingFs.submission_status !== 'submitted') {
                await daos.assessments.updateSubmissionStatus(submissionId, 'submitted');
            }

            res.redirect('/nurse?notification=success&message=Nursing+assessment+submitted+successfully');
        } catch (err) {
            console.error('Error saving nurse assessment:', err);
            res.status(500).send('Error saving assessment: ' + err.message);
        }
    });

    // =========================================
    // Helper Functions
    // =========================================

    /**
     * Validate nurse form data
     */
    function validateNurseFormData(formData) {
        const errors = [];

        // Temperature validation (30.0 - 45.0 °C or empty)
        if (formData.temperature_celsius && formData.temperature_celsius !== '') {
            const temp = parseFloat(formData.temperature_celsius);
            if (isNaN(temp) || temp < 30.0 || temp > 45.0) {
                errors.push('Temperature must be between 30.0°C and 45.0°C');
            }
        }

        // Pulse validation (30 - 200 bpm or empty)
        if (formData.pulse_bpm && formData.pulse_bpm !== '') {
            const pulse = parseInt(formData.pulse_bpm);
            if (isNaN(pulse) || pulse < 30 || pulse > 200) {
                errors.push('Pulse rate must be between 30 and 200 bpm');
            }
        }

        // Blood pressure validation
        if (formData.blood_pressure_systolic && formData.blood_pressure_systolic !== '') {
            const systolic = parseInt(formData.blood_pressure_systolic);
            if (isNaN(systolic) || systolic < 60 || systolic > 250) {
                errors.push('Systolic blood pressure must be between 60 and 250 mmHg');
            }
        }

        if (formData.blood_pressure_diastolic && formData.blood_pressure_diastolic !== '') {
            const diastolic = parseInt(formData.blood_pressure_diastolic);
            if (isNaN(diastolic) || diastolic < 40 || diastolic > 150) {
                errors.push('Diastolic blood pressure must be between 40 and 150 mmHg');
            }
        }

        // Respiratory rate validation (5 - 60 breaths/min or empty)
        if (formData.respiratory_rate_per_min && formData.respiratory_rate_per_min !== '') {
            const rr = parseInt(formData.respiratory_rate_per_min);
            if (isNaN(rr) || rr < 5 || rr > 60) {
                errors.push('Respiratory rate must be between 5 and 60 breaths per minute');
            }
        }

        // Oxygen saturation validation (70 - 100% or empty)
        if (formData.oxygen_saturation_percent && formData.oxygen_saturation_percent !== '') {
            const spo2 = parseInt(formData.oxygen_saturation_percent);
            if (isNaN(spo2) || spo2 < 70 || spo2 > 100) {
                errors.push('Oxygen saturation must be between 70% and 100%');
            }
        }

        // Blood sugar validation (20 - 600 mg/dL or empty)
        if (formData.blood_sugar_mg_dl && formData.blood_sugar_mg_dl !== '') {
            const bsl = parseInt(formData.blood_sugar_mg_dl);
            if (isNaN(bsl) || bsl < 20 || bsl > 600) {
                errors.push('Blood sugar level must be between 20 and 600 mg/dL');
            }
        }

        // Weight validation (0.5 - 300 kg or empty)
        if (formData.weight_kg && formData.weight_kg !== '') {
            const weight = parseFloat(formData.weight_kg);
            if (isNaN(weight) || weight < 0.5 || weight > 300) {
                errors.push('Weight must be between 0.5 and 300 kg');
            }
        }

        // Height validation (20 - 250 cm or empty)
        if (formData.height_cm && formData.height_cm !== '') {
            const height = parseFloat(formData.height_cm);
            if (isNaN(height) || height < 20 || height > 250) {
                errors.push('Height must be between 20 and 250 cm');
            }
        }

        // Age validation (0 - 150 years or empty)
        if (formData.age && formData.age !== '') {
            const age = parseInt(formData.age);
            if (isNaN(age) || age < 0 || age > 150) {
                errors.push('Age must be between 0 and 150 years');
            }
        }

        return errors;
    }

    /**
     * Sanitize form data - convert empty strings to null for numeric fields
     */
    function sanitizeFormData(formData) {
        const sanitized = { ...formData };
        const numericFields = [
            'temperature_celsius', 'pulse_bpm', 'blood_pressure_systolic', 'blood_pressure_diastolic',
            'respiratory_rate_per_min', 'oxygen_saturation_percent', 'blood_sugar_mg_dl',
            'weight_kg', 'height_cm', 'age', 'morse_total_score'
        ];

        numericFields.forEach(field => {
            if (sanitized[field] === '') {
                sanitized[field] = null;
            }
        });

        return sanitized;
    }

    /**
     * Build assessment data object for database insertion
     */
    function buildAssessmentData(data, assessmentId, submissionId, signatureId, userId) {
        const morseScaleData = {
            history_falling: data.morse_history_falling,
            secondary_diagnosis: data.morse_secondary_diagnosis,
            ambulatory_aid: data.morse_ambulatory_aid,
            iv_therapy: data.morse_iv_therapy,
            gait: data.morse_gait,
            mental_status: data.morse_mental_status,
            total_score: parseInt(data.morse_total_score) || 0,
            risk_level: data.morse_risk_level || 'Low Risk'
        };

        const pediatricFallRiskData = {
            developmental_stage: data.pediatric_developmental_stage,
            activity_level: data.pediatric_activity_level,
            medication_use: data.pediatric_medication_use,
            environmental_factors: data.pediatric_environmental_factors,
            previous_falls: data.pediatric_previous_falls,
            cognitive_factors: data.pediatric_cognitive_factors,
            total_score: parseInt(data.pediatric_total_score) || 0,
            risk_level: data.pediatric_risk_level || 'Low Risk'
        };

        const elderlyAssessmentData = {
            orientation: data.elderly_orientation,
            memory: data.elderly_memory,
            bathing: data.elderly_bathing,
            dressing: data.elderly_dressing,
            toileting: data.elderly_toileting,
            medication_count: data.elderly_medication_count,
            high_risk_meds: data.elderly_high_risk_meds ? 1 : 0,
            falls: data.elderly_falls ? 1 : 0,
            incontinence: data.elderly_incontinence ? 1 : 0,
            delirium: data.elderly_delirium ? 1 : 0,
            living_situation: data.elderly_living_situation,
            social_support: data.elderly_social_support,
            total_score: parseInt(data.elderly_total_score) || 0,
            risk_level: data.elderly_risk_level || 'Low Risk'
        };

        return {
            assessment_id: assessmentId,
            submission_id: submissionId,
            mode_of_arrival: data.mode_of_arrival,
            age: data.age,
            chief_complaint: data.chief_complaint,
            accompanied_by: data.accompanied_by,
            language_spoken: data.language_spoken,
            temperature_celsius: data.temperature_celsius,
            pulse_bpm: data.pulse_bpm,
            blood_pressure_systolic: data.blood_pressure_systolic,
            blood_pressure_diastolic: data.blood_pressure_diastolic,
            respiratory_rate_per_min: data.respiratory_rate_per_min,
            oxygen_saturation_percent: data.oxygen_saturation_percent,
            blood_sugar_mg_dl: data.blood_sugar_mg_dl,
            weight_kg: data.weight_kg,
            height_cm: data.height_cm,
            psychological_problem: data.psychological_problem,
            is_smoker: data.is_smoker ? 1 : 0,
            has_allergies: data.has_allergies ? 1 : 0,
            medication_allergies: data.medication_allergies,
            food_allergies: data.food_allergies,
            other_allergies: data.other_allergies,
            diet_type: data.diet_type,
            appetite: data.appetite,
            has_git_problems: data.has_git_problems ? 1 : 0,
            has_weight_loss: data.has_weight_loss ? 1 : 0,
            has_weight_gain: data.has_weight_gain ? 1 : 0,
            feeding_status: data.feeding_status,
            hygiene_status: data.hygiene_status,
            toileting_status: data.toileting_status,
            ambulation_status: data.ambulation_status,
            uses_walker: data.uses_walker ? 1 : 0,
            uses_wheelchair: data.uses_wheelchair ? 1 : 0,
            uses_transfer_device: data.uses_transfer_device ? 1 : 0,
            uses_other_equipment: data.uses_other_equipment ? 1 : 0,
            pain_intensity: data.pain_intensity,
            pain_location: data.pain_location,
            pain_frequency: data.pain_frequency,
            pain_character: data.pain_character,
            morse_total_score: data.morse_total_score,
            morse_risk_level: data.morse_risk_level,
            morse_scale: JSON.stringify(morseScaleData),
            pediatric_fall_risk: JSON.stringify(pediatricFallRiskData),
            elderly_assessment: JSON.stringify(elderlyAssessmentData),
            needs_medication_education: data.needs_medication_education ? 1 : 0,
            needs_diet_nutrition_education: data.needs_diet_nutrition_education ? 1 : 0,
            needs_medical_equipment_education: data.needs_medical_equipment_education ? 1 : 0,
            needs_rehabilitation_education: data.needs_rehabilitation_education ? 1 : 0,
            needs_drug_interaction_education: data.needs_drug_interaction_education ? 1 : 0,
            needs_pain_symptom_education: data.needs_pain_symptom_education ? 1 : 0,
            needs_fall_prevention_education: data.needs_fall_prevention_education ? 1 : 0,
            other_needs: data.other_needs ? 1 : 0,
            nurse_signature_id: signatureId,
            assessed_by: userId,
            assessed_at: new Date().toISOString()
        };
    }

    /**
     * Insert new nursing assessment
     */
    function insertNursingAssessment(data) {
        const columns = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const values = Object.values(data);

        return new Promise((resolve, reject) => {
            db.run(`INSERT INTO nursing_assessments (${columns}) VALUES (${placeholders})`, values, function (err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }

    /**
     * Update existing nursing assessment
     */
    function updateNursingAssessment(assessmentId, data) {
        // Remove fields that shouldn't be updated
        const { assessment_id, submission_id, assessed_by, assessed_at, ...updateData } = data;

        const setClause = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(updateData), assessmentId];

        return new Promise((resolve, reject) => {
            db.run(`UPDATE nursing_assessments SET ${setClause} WHERE assessment_id = ?`, values, function (err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    }

};

