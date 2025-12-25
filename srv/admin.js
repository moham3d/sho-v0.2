const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const { createDAOs } = require('./db/dao');

module.exports = function (app, db, requireAuth, requireRole) {
    // Initialize DAOs
    const daos = createDAOs(db);

    // Admin dashboard route
    app.get('/admin', requireAuth, requireRole('admin'), async (req, res) => {
        try {
            // Use DAOs for statistics
            const [userCount, patientCount, visitCount, assessmentCount] = await Promise.all([
                daos.users.count(),
                daos.patients.count(),
                daos.visits.count(),
                daos.assessments.count()
            ]);

            const todayStats = await daos.visits.getTodayStats();

            // Report Search
            let searchResults = [];
            const searchQuery = req.query.report_search || '';

            if (searchQuery) {
                searchResults = await daos.visits.searchCompletedReports(searchQuery);
            }

            // Get recent users for the dashboard
            const users = await daos.users.findRecent(5);

            res.render('admin', {
                user: req.session,
                users: users,
                searchQuery: searchQuery,
                searchResults: searchResults,
                stats: {
                    users: userCount,
                    patients: patientCount,
                    visits: visitCount,
                    assessments: assessmentCount,
                    today_visits: todayStats ? todayStats.new_visits : 0,
                    today_completed: todayStats ? todayStats.completed : 0
                },
                charts: {
                    status: [], // Empty arrays to prevent EJS errors if referenced
                    departments: [],
                    timeline: []
                },
                activity: [] // Empty as we are replacing it with search
            });

        } catch (err) {
            console.error('Dashboard Error:', err);
            res.status(500).send('Database error loading dashboard');
        }
    });

    // Data Export Routes
    app.get('/admin/export/patients', requireAuth, requireRole('admin'), (req, res) => {
        const sql = `SELECT ssn, full_name, medical_number, mobile_number, gender, date_of_birth, address, created_at FROM patients ORDER BY created_at DESC`;

        db.all(sql, [], (err, rows) => {
            if (err) {
                console.error('Export Error:', err);
                return res.status(500).send('Error exporting data');
            }

            // CSV Header
            let csv = 'SSN,Full Name,Medical Number,Mobile Number,Gender,Date of Birth,Address,Created At\n';

            // CSV Rows
            rows.forEach(row => {
                const escapedAddress = row.address ? `"${row.address.replace(/"/g, '""')}"` : '';
                const escapedName = row.full_name ? `"${row.full_name.replace(/"/g, '""')}"` : '';

                csv += `${row.ssn},${escapedName},${row.medical_number || ''},${row.mobile_number || ''},${row.gender || ''},${row.date_of_birth || ''},${escapedAddress},${row.created_at || ''}\n`;
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=patients_export_' + new Date().toISOString().split('T')[0] + '.csv');
            res.send(csv);
        });
    });

    app.get('/admin/export/visits', requireAuth, requireRole('admin'), (req, res) => {
        const sql = `
            SELECT pv.visit_id, pv.visit_date, pv.visit_status, pv.department, u.full_name as consultant_name, 
                   pv.patient_ssn, p.full_name as patient_name, p.medical_number
            FROM patient_visits pv
            JOIN patients p ON pv.patient_ssn = p.ssn
            LEFT JOIN users u ON pv.created_by = u.user_id
            ORDER BY pv.visit_date DESC
        `;

        db.all(sql, [], (err, rows) => {
            if (err) {
                console.error('Export Error:', err);
                return res.status(500).send('Error exporting data');
            }

            // CSV Header
            let csv = 'Visit ID,Date,Status,Department,Consultant,Patient SSN,Patient Name,Medical Number\n';

            // CSV Rows
            rows.forEach(row => {
                const escapedName = row.patient_name ? `"${row.patient_name.replace(/"/g, '""')}"` : '';
                const escapedConsultant = row.consultant_name ? `"${row.consultant_name.replace(/"/g, '""')}"` : '';
                const date = row.visit_date ? new Date(row.visit_date).toLocaleString() : '';

                csv += `${row.visit_id},"${date}",${row.visit_status},${row.department || ''},${escapedConsultant},${row.patient_ssn},${escapedName},${row.medical_number || ''}\n`;
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=visits_export_' + new Date().toISOString().split('T')[0] + '.csv');
            res.send(csv);
        });
    });

    app.get('/admin/users', requireAuth, requireRole('admin'), (req, res) => {
        const { search, role, status } = req.query;

        let sql = `
            SELECT user_id, username, email, full_name, role, is_active, created_at
            FROM users
            WHERE 1=1
        `;

        const params = [];

        if (search) {
            sql += ` AND (full_name LIKE ? OR username LIKE ? OR email LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (role && role !== 'all') {
            sql += ` AND role = ?`;
            params.push(role);
        }

        if (status && status !== 'all') {
            if (status === 'active') {
                sql += ` AND is_active = 1`;
            } else if (status === 'inactive') {
                sql += ` AND is_active = 0`;
            }
        }

        sql += ` ORDER BY created_at DESC`;

        db.all(sql, params, (err, users) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Database error');
            }

            // Get notification from session and clear it
            const notification = req.session.notification;
            if (req.session.notification) {
                delete req.session.notification;
            }

            res.render('admin-users', {
                user: req.session,
                users: users || [],
                filters: { search, role, status },
                notification: notification
            });
        });
    });

    app.get('/admin/users/new', requireAuth, requireRole('admin'), (req, res) => {
        res.render('user-form', { user: req.session, editUser: null, isNew: true });
    });

    app.post('/admin/users', requireAuth, requireRole('admin'), async (req, res) => {
        const { username, email, full_name, role, password, user_signature } = req.body;

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const userId = 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

            db.run('INSERT INTO users (user_id, username, email, full_name, role, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, username, email, full_name, role, hashedPassword], function (err) {
                    if (err) {
                        console.error('Database error:', err);
                        return res.render('user-form', {
                            user: req.session,
                            editUser: null,
                            isNew: true,
                            error: 'Error creating user: ' + err.message
                        });
                    }

                    // Save signature if provided
                    if (user_signature && user_signature !== '') {
                        const signatureId = 'sig-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                        db.run('INSERT INTO user_signatures (signature_id, user_id, signature_data) VALUES (?, ?, ?)',
                            [signatureId, userId, user_signature], function (sigErr) {
                                if (sigErr) {
                                    console.error('Error saving signature:', sigErr);
                                    // User created but signature failed - could delete user or handle differently
                                }
                                req.session.notification = { type: 'success', message: 'User created successfully' };
                                res.redirect('/admin/users');
                            });
                    } else {
                        // No signature provided, just redirect
                        req.session.notification = { type: 'success', message: 'User created successfully' };
                        res.redirect('/admin/users');
                    }
                });
        } catch (error) {
            console.error('Password hashing error:', error);
            res.render('user-form', {
                user: req.session,
                editUser: null,
                isNew: true,
                error: 'Error creating user'
            });
        }
    });

    app.get('/admin/users/:id/edit', requireAuth, requireRole('admin'), (req, res) => {
        const userId = req.params.id;
        db.get('SELECT user_id, username, email, full_name, role, is_active FROM users WHERE user_id = ?', [userId], (err, user) => {
            if (err || !user) {
                return res.status(404).send('User not found');
            }

            // Get user's signature if exists
            db.get('SELECT signature_data FROM user_signatures WHERE user_id = ?', [userId], (err, signature) => {
                if (signature) {
                    user.signature_data = signature.signature_data;
                }
                res.render('user-form', { user: req.session, editUser: user, isNew: false });
            });
        });
    });

    app.post('/admin/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
        const userId = req.params.id;
        const { username, email, full_name, role, password, is_active, user_signature } = req.body;

        // Check if user has existing signature
        db.get('SELECT signature_id, signature_data FROM user_signatures WHERE user_id = ?', [userId], async (err, existingSignature) => {
            if (err) {
                console.error('Error checking existing signature:', err);
                return res.status(500).send('Database error');
            }

            // Require signature only if none exists and none provided
            if (!existingSignature && (!user_signature || user_signature === '')) {
                // Get user data for re-rendering form
                db.get('SELECT user_id, username, email, full_name, role, is_active FROM users WHERE user_id = ?', [userId], (err, user) => {
                    if (user) {
                        if (existingSignature) user.signature_data = existingSignature.signature_data;
                        return res.render('user-form', {
                            user: req.session,
                            editUser: user,
                            isNew: false,
                            error: 'User signature is required'
                        });
                    }
                });
                return;
            }

            let updateQuery = 'UPDATE users SET username = ?, email = ?, full_name = ?, role = ?, is_active = ? WHERE user_id = ?';
            let params = [username, email, full_name, role, is_active ? 1 : 0, userId];

            if (password) {
                const hashedPassword = await bcrypt.hash(password, 10);
                updateQuery = 'UPDATE users SET username = ?, email = ?, full_name = ?, role = ?, password_hash = ?, is_active = ? WHERE user_id = ?';
                params = [username, email, full_name, role, hashedPassword, is_active ? 1 : 0, userId];
            }

            db.run(updateQuery, params, function (err) {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).send('Error updating user');
                }

                // Update signature only if provided
                if (user_signature && user_signature !== '') {
                    const signatureId = existingSignature ? existingSignature.signature_id : 'sig-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                    const signatureSql = existingSignature ?
                        'UPDATE user_signatures SET signature_data = ?, updated_at = CURRENT_TIMESTAMP WHERE signature_id = ?' :
                        'INSERT INTO user_signatures (signature_id, user_id, signature_data) VALUES (?, ?, ?)';

                    const signatureValues = existingSignature ?
                        [user_signature, signatureId] :
                        [signatureId, userId, user_signature];

                    db.run(signatureSql, signatureValues, function (sigErr) {
                        if (sigErr) {
                            console.error('Error saving signature:', sigErr);
                            // User updated but signature failed - could handle differently
                        }
                        req.session.notification = { type: 'success', message: 'User updated successfully' };
                        res.redirect('/admin/users');
                    });
                } else {
                    // No new signature, just redirect
                    req.session.notification = { type: 'success', message: 'User updated successfully' };
                    res.redirect('/admin/users');
                }
            });
        });
    });

    app.post('/admin/users/:id/delete', requireAuth, requireRole('admin'), (req, res) => {
        const userId = req.params.id;
        db.run('DELETE FROM users WHERE user_id = ?', [userId], function (err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Error deleting user');
            }
            req.session.notification = { type: 'success', message: 'User deleted successfully' };
            res.redirect('/admin/users');
        });
    });

    // Admin patient management routes
    app.get('/admin/patients', requireAuth, requireRole('admin'), (req, res) => {
        const { search, gender, date_from, date_to } = req.query;

        let sql = `
            SELECT ssn, full_name, mobile_number, medical_number, date_of_birth, gender,
                   address, emergency_contact_name, emergency_contact_phone, created_at
            FROM patients
            WHERE 1=1
        `;

        const params = [];

        if (search) {
            sql += ` AND (full_name LIKE ? OR medical_number LIKE ? OR ssn LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (gender && gender !== 'all') {
            sql += ` AND gender = ?`;
            params.push(gender);
        }

        if (date_from) {
            sql += ` AND DATE(created_at) >= ?`;
            params.push(date_from);
        }

        if (date_to) {
            sql += ` AND DATE(created_at) <= ?`;
            params.push(date_to);
        }

        sql += ` ORDER BY created_at DESC`;

        db.all(sql, params, (err, patients) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Database error');
            }

            // Get notification from session and clear it
            const notification = req.session.notification;
            if (req.session.notification) {
                delete req.session.notification;
            }

            res.render('admin-patients', {
                user: req.session,
                patients: patients || [],
                filters: { search, gender, date_from, date_to },
                notification: notification
            });
        });
    });

    app.get('/admin/patients/new', requireAuth, requireRole('admin'), (req, res) => {
        // Get notification from session and clear it
        const notification = req.session.notification;
        if (req.session.notification) {
            delete req.session.notification;
        }

        res.render('admin-patient-form', { user: req.session, patient: null, isNew: true, error: null, notification: notification });
    });

    app.post('/admin/patients', requireAuth, requireRole('admin'), (req, res) => {
        const { ssn, full_name, mobile_number, phone_number, medical_number, date_of_birth, gender, address, emergency_contact_name, emergency_contact_phone, emergency_contact_relation } = req.body;

        // Validate required fields
        if (!ssn || !full_name || !mobile_number || !date_of_birth || !gender) {
            // Get notification from session and clear it
            const notification = req.session.notification;
            if (req.session.notification) {
                delete req.session.notification;
            }

            return res.render('admin-patient-form', {
                user: req.session,
                patient: null,
                isNew: true,
                error: 'Please fill in all required fields (SSN, Full Name, Mobile Number, Date of Birth, Gender)',
                notification: notification
            });
        }

        // Validate SSN format (14-digit Egyptian SSN)
        if (!/^\d{14}$/.test(ssn)) {
            // Get notification from session and clear it
            const notification = req.session.notification;
            if (req.session.notification) {
                delete req.session.notification;
            }

            return res.render('admin-patient-form', {
                user: req.session,
                patient: null,
                isNew: true,
                error: 'SSN must be exactly 14 digits and contain only numbers',
                notification: notification
            });
        }

        // Check if patient already exists
        db.get('SELECT ssn FROM patients WHERE ssn = ?', [ssn], (err, existingPatient) => {
            if (err) {
                console.error('Error checking patient existence:', err);
                // Get notification from session and clear it
                const notification = req.session.notification;
                if (req.session.notification) {
                    delete req.session.notification;
                }

                return res.render('admin-patient-form', {
                    user: req.session,
                    patient: null,
                    isNew: true,
                    error: 'Database error occurred',
                    notification: notification
                });
            }

            if (existingPatient) {
                // Get notification from session and clear it
                const notification = req.session.notification;
                if (req.session.notification) {
                    delete req.session.notification;
                }

                return res.render('admin-patient-form', {
                    user: req.session,
                    patient: null,
                    isNew: true,
                    error: 'A patient with this SSN already exists',
                    notification: notification
                });
            }

            // Insert new patient
            db.run(`INSERT INTO patients (
                ssn, full_name, mobile_number, phone_number, medical_number,
                date_of_birth, gender, address, emergency_contact_name,
                emergency_contact_phone, emergency_contact_relation, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [ssn, full_name, mobile_number, phone_number || null, medical_number || null,
                    date_of_birth, gender, address || null, emergency_contact_name || null,
                    emergency_contact_phone || null, emergency_contact_relation || null, req.session.userId],
                function (err) {
                    if (err) {
                        // Check for specific database constraint errors
                        let errorMessage = 'Error creating patient record';
                        let logMessage = 'Database error occurred while creating patient';

                        if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('medical_number')) {
                            errorMessage = 'A patient with this Medical Number already exists. Please use a different Medical Number.';
                            logMessage = 'Attempted to create patient with duplicate medical number';
                        } else if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('ssn')) {
                            errorMessage = 'A patient with this SSN already exists.';
                            logMessage = 'Attempted to create patient with duplicate SSN';
                        }

                        console.error('Patient creation failed:', logMessage);

                        // Get notification from session and clear it
                        const notification = req.session.notification;
                        if (req.session.notification) {
                            delete req.session.notification;
                        }

                        return res.render('admin-patient-form', {
                            user: req.session,
                            patient: null,
                            isNew: true,
                            error: errorMessage,
                            notification: notification
                        });
                    }

                    // Store success message in session
                    req.session.notification = {
                        type: 'success',
                        message: 'Patient record created successfully.'
                    };

                    res.redirect('/admin/patients');
                });
        });
    });

    app.get('/admin/patients/:ssn/edit', requireAuth, requireRole('admin'), (req, res) => {
        const ssn = req.params.ssn;
        db.get('SELECT * FROM patients WHERE ssn = ?', [ssn], (err, patient) => {
            if (err || !patient) {
                return res.status(404).send('Patient not found');
            }

            // Get notification from session and clear it
            const notification = req.session.notification;
            if (req.session.notification) {
                delete req.session.notification;
            }

            res.render('admin-patient-form', { user: req.session, patient: patient, isNew: false, error: null, notification: notification });
        });
    });

    app.post('/admin/patients/:ssn', requireAuth, requireRole('admin'), (req, res) => {
        const ssn = req.params.ssn;
        const { full_name, mobile_number, phone_number, medical_number, date_of_birth, gender, address, emergency_contact_name, emergency_contact_phone, emergency_contact_relation } = req.body;

        // Validate required fields
        if (!full_name || !mobile_number || !date_of_birth || !gender) {
            db.get('SELECT * FROM patients WHERE ssn = ?', [ssn], (err, patient) => {
                // Get notification from session and clear it
                const notification = req.session.notification;
                if (req.session.notification) {
                    delete req.session.notification;
                }

                return res.render('admin-patient-form', {
                    user: req.session,
                    patient: patient,
                    isNew: false,
                    error: 'Please fill in all required fields (Full Name, Mobile Number, Date of Birth, Gender)',
                    notification: notification
                });
            });
            return;
        }

        db.run(`UPDATE patients SET
            full_name = ?, mobile_number = ?, phone_number = ?, medical_number = ?,
            date_of_birth = ?, gender = ?, address = ?, emergency_contact_name = ?,
            emergency_contact_phone = ?, emergency_contact_relation = ?, updated_at = CURRENT_TIMESTAMP
            WHERE ssn = ?`,
            [full_name, mobile_number, phone_number || null, medical_number || null,
                date_of_birth, gender, address || null, emergency_contact_name || null,
                emergency_contact_phone || null, emergency_contact_relation || null, ssn],
            function (err) {
                if (err) {
                    console.error('Error updating patient:', err);
                    return res.status(500).send('Error updating patient');
                }

                if (this.changes === 0) {
                    return res.status(404).send('Patient not found');
                }

                // Store success message in session
                req.session.notification = {
                    type: 'success',
                    message: 'Patient record updated successfully.'
                };

                res.redirect('/admin/patients');
            });
    });

    app.post('/admin/patients/:ssn/delete', requireAuth, requireRole('admin'), (req, res) => {
        const ssn = req.params.ssn;

        // First, delete related visits and assessments
        db.run('DELETE FROM nursing_assessments WHERE submission_id IN (SELECT submission_id FROM form_submissions WHERE visit_id IN (SELECT visit_id FROM patient_visits WHERE patient_ssn = ?))', [ssn], function (err) {
            if (err) {
                console.error('Error deleting nursing assessments:', err);
                return res.status(500).send('Error deleting patient');
            }

            db.run('DELETE FROM radiology_examination_form WHERE visit_id IN (SELECT visit_id FROM patient_visits WHERE patient_ssn = ?)', [ssn], function (err) {
                if (err) {
                    console.error('Error deleting radiology assessments:', err);
                    return res.status(500).send('Error deleting patient');
                }

                db.run('DELETE FROM form_submissions WHERE visit_id IN (SELECT visit_id FROM patient_visits WHERE patient_ssn = ?)', [ssn], function (err) {
                    if (err) {
                        console.error('Error deleting form submissions:', err);
                        return res.status(500).send('Error deleting patient');
                    }

                    db.run('DELETE FROM patient_visits WHERE patient_ssn = ?', [ssn], function (err) {
                        if (err) {
                            console.error('Error deleting visits:', err);
                            return res.status(500).send('Error deleting patient');
                        }

                        // Finally, delete the patient
                        db.run('DELETE FROM patients WHERE ssn = ?', [ssn], function (err) {
                            if (err) {
                                console.error('Error deleting patient:', err);
                                return res.status(500).send('Error deleting patient');
                            }

                            if (this.changes === 0) {
                                return res.status(404).send('Patient not found');
                            }

                            // Store success message in session
                            req.session.notification = {
                                type: 'success',
                                message: 'Patient and all associated records have been deleted successfully.'
                            };

                            res.redirect('/admin/patients');
                        });
                    });
                });
            });
        });
    });

    app.get('/admin/visits', requireAuth, requireRole('admin'), (req, res) => {
        const { search, status, department, date_from, date_to } = req.query;

        let sql = `
            SELECT
                pv.visit_id, pv.patient_ssn, pv.visit_date, pv.visit_status,
                pv.primary_diagnosis, pv.secondary_diagnosis, pv.diagnosis_code,
                pv.visit_type, pv.department, pv.created_at, pv.completed_at,
                p.full_name as patient_name, p.medical_number,
                u.full_name as created_by_name,
                (SELECT COUNT(*) FROM form_submissions fs WHERE fs.visit_id = pv.visit_id) as assessment_count
            FROM patient_visits pv
            JOIN patients p ON pv.patient_ssn = p.ssn
            LEFT JOIN users u ON pv.created_by = u.user_id
            WHERE 1=1
        `;

        const params = [];

        if (search) {
            sql += ` AND (p.full_name LIKE ? OR p.medical_number LIKE ? OR pv.patient_ssn LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (status && status !== 'all') {
            sql += ` AND pv.visit_status = ?`;
            params.push(status);
        }

        if (department && department !== 'all') {
            sql += ` AND pv.department = ?`;
            params.push(department);
        }

        if (date_from) {
            sql += ` AND DATE(pv.visit_date) >= ?`;
            params.push(date_from);
        }

        if (date_to) {
            sql += ` AND DATE(pv.visit_date) <= ?`;
            params.push(date_to);
        }

        sql += ` ORDER BY pv.visit_date DESC, pv.created_at DESC`;

        db.all(sql, params, (err, visits) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Database error');
            }

            // Get unique departments for filter dropdown
            db.all('SELECT DISTINCT department FROM patient_visits WHERE department IS NOT NULL ORDER BY department', [], (err, departments) => {
                // Get notification from session and clear it
                const notification = req.session.notification;
                if (req.session.notification) {
                    delete req.session.notification;
                }

                res.render('admin-visits', {
                    user: req.session,
                    visits: visits || [],
                    departments: departments || [],
                    filters: { search, status, department, date_from, date_to },
                    notification: notification
                });
            });
        });
    });

    // Delete visit route - must come before the :visitId routes
    app.post('/admin/visits/:visitId/delete', requireAuth, requireRole('admin'), (req, res) => {
        console.log('Delete visit route hit for visitId:', req.params.visitId);
        console.log('User session:', req.session.userId, req.session.role);

        const visitId = req.params.visitId;

        // First, delete related assessments and form submissions
        db.run('DELETE FROM nursing_assessments WHERE submission_id IN (SELECT submission_id FROM form_submissions WHERE visit_id = ?)', [visitId], function (err) {
            if (err) {
                console.error('Error deleting nursing assessments:', err);
                return res.status(500).send('Error deleting visit');
            }

            db.run('DELETE FROM radiology_examination_form WHERE visit_id = ?', [visitId], function (err) {
                if (err) {
                    console.error('Error deleting radiology assessments:', err);
                    return res.status(500).send('Error deleting visit');
                }

                db.run('DELETE FROM form_submissions WHERE visit_id = ?', [visitId], function (err) {
                    if (err) {
                        console.error('Error deleting form submissions:', err);
                        return res.status(500).send('Error deleting visit');
                    }

                    // Finally, delete the visit itself
                    db.run('DELETE FROM patient_visits WHERE visit_id = ?', [visitId], function (err) {
                        if (err) {
                            console.error('Error deleting visit:', err);
                            return res.status(500).send('Error deleting visit');
                        }

                        if (this.changes === 0) {
                            return res.status(404).send('Visit not found');
                        }

                        console.log(`Visit ${visitId} and all related data deleted successfully`);

                        // Store success message in session
                        req.session.notification = {
                            type: 'success',
                            message: 'Visit and all associated assessments have been deleted successfully.'
                        };

                        // Redirect back to the previous page or admin visits
                        const referrer = req.get('Referer') || '/admin/visits';
                        res.redirect(referrer);
                    });
                });
            });
        });
    });

    // Create new visit route
    app.get('/admin/visits/new', requireAuth, requireRole('admin'), (req, res) => {
        // Get all patients for dropdown
        db.all('SELECT ssn, full_name, medical_number FROM patients ORDER BY full_name', [], (err, patients) => {
            if (err) {
                console.error('Error getting patients:', err);
                return res.status(500).send('Database error');
            }

            // Get all users for created_by dropdown
            db.all('SELECT user_id, full_name, role FROM users ORDER BY full_name', [], (err, users) => {
                if (err) {
                    console.error('Error getting users:', err);
                    return res.status(500).send('Database error');
                }

                // Get notification from session and clear it
                const notification = req.session.notification;
                if (req.session.notification) {
                    delete req.session.notification;
                }

                res.render('admin-visit-form', {
                    user: req.session,
                    visit: null,
                    patients: patients || [],
                    users: users || [],
                    notification: notification
                });
            });
        });
    });

    // Create visit POST route
    app.post('/admin/visits', requireAuth, requireRole('admin'), (req, res) => {
        const { patient_ssn, visit_date, visit_status, primary_diagnosis, secondary_diagnosis,
            diagnosis_code, visit_type, department, created_by } = req.body;

        // Validate required fields
        if (!patient_ssn || !visit_date || !visit_status) {
            req.session.notification = {
                type: 'error',
                message: 'Patient SSN, visit date, and status are required.'
            };
            return res.redirect('/admin/visits/new');
        }

        // Validate patient exists
        db.get('SELECT ssn FROM patients WHERE ssn = ?', [patient_ssn], (err, patient) => {
            if (err) {
                console.error('Error checking patient:', err);
                req.session.notification = {
                    type: 'error',
                    message: 'Database error occurred.'
                };
                return res.redirect('/admin/visits/new');
            }

            if (!patient) {
                req.session.notification = {
                    type: 'error',
                    message: 'Selected patient does not exist.'
                };
                return res.redirect('/admin/visits/new');
            }

            // Generate visit ID
            const visitId = 'visit-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

            // Insert new visit
            db.run(`INSERT INTO patient_visits (
                visit_id, patient_ssn, visit_date, visit_status, primary_diagnosis,
                secondary_diagnosis, diagnosis_code, visit_type, department, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [visitId, patient_ssn, visit_date, visit_status, primary_diagnosis || null,
                    secondary_diagnosis || null, diagnosis_code || null, visit_type || null,
                    department || null, created_by || req.session.userId], function (err) {
                        if (err) {
                            console.error('Error creating visit:', err);
                            req.session.notification = {
                                type: 'error',
                                message: 'Error creating visit record.'
                            };
                            return res.redirect('/admin/visits/new');
                        }

                        req.session.notification = {
                            type: 'success',
                            message: 'Visit created successfully.'
                        };
                        res.redirect('/admin/visits');
                    });
        });
    });

    // Edit visit route
    app.get('/admin/visits/:visitId/edit', requireAuth, requireRole('admin'), (req, res) => {
        const visitId = req.params.visitId;

        // Get visit details
        db.get('SELECT * FROM patient_visits WHERE visit_id = ?', [visitId], (err, visit) => {
            if (err || !visit) {
                return res.status(404).send('Visit not found');
            }

            // Get all patients for dropdown
            db.all('SELECT ssn, full_name, medical_number FROM patients ORDER BY full_name', [], (err, patients) => {
                if (err) {
                    console.error('Error getting patients:', err);
                    return res.status(500).send('Database error');
                }

                // Get all users for created_by dropdown
                db.all('SELECT user_id, full_name, role FROM users ORDER BY full_name', [], (err, users) => {
                    if (err) {
                        console.error('Error getting users:', err);
                        return res.status(500).send('Database error');
                    }

                    // Get notification from session and clear it
                    const notification = req.session.notification;
                    if (req.session.notification) {
                        delete req.session.notification;
                    }

                    res.render('admin-visit-form', {
                        user: req.session,
                        visit: visit,
                        patients: patients || [],
                        users: users || [],
                        notification: notification
                    });
                });
            });
        });
    });

    // Update visit POST route
    app.post('/admin/visits/:visitId', requireAuth, requireRole('admin'), (req, res) => {
        const visitId = req.params.visitId;
        const { patient_ssn, visit_date, visit_status, primary_diagnosis, secondary_diagnosis,
            diagnosis_code, visit_type, department, created_by } = req.body;

        // Validate required fields
        if (!patient_ssn || !visit_date || !visit_status) {
            req.session.notification = {
                type: 'error',
                message: 'Patient SSN, visit date, and status are required.'
            };
            return res.redirect(`/admin/visits/${visitId}/edit`);
        }

        // Validate patient exists
        db.get('SELECT ssn FROM patients WHERE ssn = ?', [patient_ssn], (err, patient) => {
            if (err) {
                console.error('Error checking patient:', err);
                req.session.notification = {
                    type: 'error',
                    message: 'Database error occurred.'
                };
                return res.redirect(`/admin/visits/${visitId}/edit`);
            }

            if (!patient) {
                req.session.notification = {
                    type: 'error',
                    message: 'Selected patient does not exist.'
                };
                return res.redirect(`/admin/visits/${visitId}/edit`);
            }

            // Update visit
            db.run(`UPDATE patient_visits SET
                patient_ssn = ?, visit_date = ?, visit_status = ?, primary_diagnosis = ?,
                secondary_diagnosis = ?, diagnosis_code = ?, visit_type = ?, department = ?,
                created_by = ?, updated_at = CURRENT_TIMESTAMP
                WHERE visit_id = ?`,
                [patient_ssn, visit_date, visit_status, primary_diagnosis || null,
                    secondary_diagnosis || null, diagnosis_code || null, visit_type || null,
                    department || null, created_by || req.session.userId, visitId], function (err) {
                        if (err) {
                            console.error('Database error:', err);
                            req.session.notification = {
                                type: 'error',
                                message: 'Error updating visit record.'
                            };
                            return res.redirect(`/admin/visits/${visitId}/edit`);
                        }

                        if (this.changes === 0) {
                            req.session.notification = {
                                type: 'error',
                                message: 'Visit not found or no changes made.'
                            };
                            return res.redirect(`/admin/visits/${visitId}/edit`);
                        }

                        req.session.notification = {
                            type: 'success',
                            message: 'Visit updated successfully.'
                        };
                        res.redirect('/admin/visits');
                    });
        });
    });

    // Assessment Management Routes
    app.get('/admin/assessments', requireAuth, requireRole('admin'), (req, res) => {
        const { search, type, status, date_from, date_to } = req.query;

        let nursingSql = `
            SELECT
                'nursing' AS assessment_type,
                na.assessment_id AS id,
                na.submission_id,
                na.assessed_at AS assessment_date,
                fs.submission_status,
                p.full_name AS patient_name,
                p.medical_number,
                pv.visit_id,
                pv.visit_date,
                u.full_name AS assessed_by_name,
                na.chief_complaint,
                NULL AS diagnosis,
                NULL AS reason_for_examination,
                nus.signature_data AS nurse_signature,
                NULL AS physician_signature
            FROM nursing_assessments na
            JOIN form_submissions fs ON na.submission_id = fs.submission_id
            JOIN patient_visits pv ON fs.visit_id = pv.visit_id
            JOIN patients p ON pv.patient_ssn = p.ssn
            LEFT JOIN users u ON na.assessed_by = u.user_id
            LEFT JOIN user_signatures nus ON na.nurse_signature_id = nus.signature_id
            WHERE 1=1
        `;
        let radiologySql = `
            SELECT
                'radiology' AS assessment_type,
                ref.id AS id,
                NULL AS submission_id,
                ref.created_at AS assessment_date,
                CASE 
                    WHEN ref.form_status IN ('completed', 'reviewed', 'finalized') THEN 'submitted'
                    ELSE ref.form_status
                END AS submission_status,
                p.full_name AS patient_name,
                p.medical_number,
                pv.visit_id,
                pv.visit_date,
                u.full_name AS assessed_by_name,
                NULL AS chief_complaint,
                NULL AS diagnosis,
                ref.patient_complaint AS reason_for_examination,
                NULL AS nurse_signature,
                rus.signature_data AS physician_signature
            FROM radiology_examination_form ref
            JOIN patient_visits pv ON ref.visit_id = pv.visit_id
            JOIN patients p ON pv.patient_ssn = p.ssn
            LEFT JOIN users u ON ref.created_by = u.user_id
            LEFT JOIN user_signatures rus ON ref.radiologist_signature_id = rus.signature_id
            WHERE 1=1
        `;

        const nursingParams = [];
        const radiologyParams = [];

        if (search) {
            const like = `%${search}%`;
            nursingSql += ' AND (p.full_name LIKE ? OR p.medical_number LIKE ? OR pv.visit_id LIKE ?)';
            nursingParams.push(like, like, like);
            radiologySql += ' AND (p.full_name LIKE ? OR p.medical_number LIKE ? OR pv.visit_id LIKE ?)';
            radiologyParams.push(like, like, like);
        }

        if (status && status !== 'all') {
            nursingSql += ' AND fs.submission_status = ?';
            nursingParams.push(status);
            // For radiology, map "submitted" filter to include completed/reviewed/finalized statuses
            if (status === 'submitted') {
                radiologySql += ' AND ref.form_status IN (\'completed\', \'reviewed\', \'finalized\')';
            } else {
                radiologySql += ' AND ref.form_status = ?';
                radiologyParams.push(status);
            }
        }

        if (date_from) {
            nursingSql += ' AND DATE(na.assessed_at) >= ?';
            nursingParams.push(date_from);
            radiologySql += ' AND DATE(ref.created_at) >= ?';
            radiologyParams.push(date_from);
        }

        if (date_to) {
            nursingSql += ' AND DATE(na.assessed_at) <= ?';
            nursingParams.push(date_to);
            radiologySql += ' AND DATE(ref.created_at) <= ?';
            radiologyParams.push(date_to);
        }

        let finalSql = '';
        let finalParams = [];

        if (type === 'nursing') {
            finalSql = `${nursingSql} ORDER BY assessment_date DESC`;
            finalParams = nursingParams;
        } else if (type === 'radiology') {
            finalSql = `${radiologySql} ORDER BY assessment_date DESC`;
            finalParams = radiologyParams;
        } else {
            finalSql = `${nursingSql}
            UNION ALL
            ${radiologySql}
            ORDER BY assessment_date DESC`;
            finalParams = [...nursingParams, ...radiologyParams];
        }

        db.all(finalSql, finalParams, (err, assessments) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Database error');
            }

            // Get notification from session and clear it
            const notification = req.session.notification;
            if (req.session.notification) {
                delete req.session.notification;
            }

            res.render('admin-assessments', {
                user: req.session,
                assessments: assessments || [],
                filters: { search, type, status, date_from, date_to },
                notification: notification
            });
        });

    });

    // Delete assessment route
    app.post('/admin/assessments/:assessmentId/delete', requireAuth, requireRole('admin'), (req, res) => {
        const assessmentId = req.params.assessmentId;
        const assessmentType = req.query.type; // 'nursing' or 'radiology'

        if (!assessmentType || !['nursing', 'radiology'].includes(assessmentType)) {
            req.session.notification = {
                type: 'error',
                message: 'Invalid assessment type.'
            };
            return res.redirect('/admin/assessments');
        }

        // First, get the submission_id for the assessment
        let getSubmissionSql;
        if (assessmentType === 'nursing') {
            getSubmissionSql = 'SELECT submission_id FROM nursing_assessments WHERE assessment_id = ?';
        } else {
            getSubmissionSql = 'SELECT fs.submission_id FROM form_submissions fs JOIN radiology_examination_form ref ON fs.visit_id = ref.visit_id WHERE ref.id = ? AND fs.form_id = \'form-03-uuid\'';
        }

        db.get(getSubmissionSql, [assessmentId], (err, result) => {
            if (err) {
                console.error('Error getting submission:', err);
                req.session.notification = {
                    type: 'error',
                    message: 'Database error occurred.'
                };
                return res.redirect('/admin/assessments');
            }

            if (!result) {
                req.session.notification = {
                    type: 'error',
                    message: 'Assessment not found.'
                };
                return res.redirect('/admin/assessments');
            }

            const submissionId = result.submission_id;

            // Delete the assessment
            let deleteAssessmentSql;
            if (assessmentType === 'nursing') {
                deleteAssessmentSql = 'DELETE FROM nursing_assessments WHERE assessment_id = ?';
            } else {
                deleteAssessmentSql = 'DELETE FROM radiology_examination_form WHERE id = ?';
            }

            db.run(deleteAssessmentSql, [assessmentId], function (err) {
                if (err) {
                    console.error('Error deleting assessment:', err);
                    req.session.notification = {
                        type: 'error',
                        message: 'Error deleting assessment.'
                    };
                    return res.redirect('/admin/assessments');
                }

                // Delete the form submission
                db.run('DELETE FROM form_submissions WHERE submission_id = ?', [submissionId], function (err) {
                    if (err) {
                        console.error('Error deleting form submission:', err);
                        req.session.notification = {
                            type: 'error',
                            message: 'Assessment deleted but error cleaning up form submission.'
                        };
                        return res.redirect('/admin/assessments');
                    }

                    req.session.notification = {
                        type: 'success',
                        message: `${assessmentType.charAt(0).toUpperCase() + assessmentType.slice(1)} assessment deleted successfully.`
                    };
                    res.redirect('/admin/assessments');
                });
            });
        });
    });

    // View assessment details
    app.get('/admin/assessments/:assessmentId', requireAuth, requireRole('admin'), (req, res) => {
        const assessmentId = req.params.assessmentId;
        const assessmentType = req.query.type; // 'nursing' or 'radiology'

        if (!assessmentType || !['nursing', 'radiology'].includes(assessmentType)) {
            return res.status(400).send('Invalid assessment type');
        }

        let sql;
        if (assessmentType === 'nursing') {
            sql = `
                SELECT
                    'nursing' as assessment_type,
                    na.*,
                    fs.submission_status,
                    pv.visit_id, pv.visit_date, pv.visit_status as visit_status,
                    p.full_name as patient_name, p.medical_number, p.mobile_number,
                    p.date_of_birth, p.gender, p.address,
                    u.full_name as assessed_by_name,
                    us.signature_data as nurse_signature
                FROM nursing_assessments na
                JOIN form_submissions fs ON na.submission_id = fs.submission_id
                JOIN patient_visits pv ON fs.visit_id = pv.visit_id
                JOIN patients p ON pv.patient_ssn = p.ssn
                LEFT JOIN users u ON na.assessed_by = u.user_id
                LEFT JOIN user_signatures us ON na.nurse_signature_id = us.signature_id
                WHERE na.assessment_id = ?
            `;
        } else {
            sql = `
                SELECT
                    'radiology' AS assessment_type,
                    ref.id AS radiology_id,
                    NULL AS submission_id,
                    ref.patient_complaint AS reason_for_study,
                    ref.ctd1vol,
                    ref.dlp,
                    ref.kv,
                    ref.mas,
                    ref.has_gypsum_splint AS gypsum_splint_presence,
                    ref.gypsum_splint_note AS xrays_before_splint,
                    ref.has_chronic_disease AS chronic_diseases,
                    ref.has_pacemaker AS pacemaker,
                    ref.has_surgical_implants AS slats_screws_artificial_joints,
                    ref.is_pregnant AS pregnancy_status,
                    ref.has_fever AS fever,
                    ref.has_previous_operations AS previous_operations,
                    ref.has_tumor_history AS tumor_history,
                    ref.tumor_location AS tumor_location_type,
                    ref.has_previous_investigations AS previous_investigations,
                    ref.has_fall_risk_medications AS fall_risk_medications,
                    ref.current_medications,
                    ref.patient_signature,
                    CASE WHEN ref.form_status IN ('completed', 'reviewed', 'finalized') THEN 'submitted' ELSE ref.form_status END AS submission_status,
                    ref.created_at AS assessed_at,
                    pv.visit_id, pv.visit_date, pv.visit_status as visit_status,
                    p.full_name as patient_name, p.medical_number as patient_medical_number,
                    p.mobile_number, p.date_of_birth, p.gender, p.address,
                    u.full_name as assessed_by_name,
                    rus.signature_data AS physician_signature
                FROM radiology_examination_form ref
                JOIN patient_visits pv ON ref.visit_id = pv.visit_id
                JOIN patients p ON pv.patient_ssn = p.ssn
                LEFT JOIN users u ON ref.created_by = u.user_id
                LEFT JOIN user_signatures rus ON ref.radiologist_signature_id = rus.signature_id
                WHERE ref.id = ?
            `;
        }

        db.get(sql, [assessmentId], (err, assessment) => {
            if (err || !assessment) {
                return res.status(404).send('Assessment not found');
            }

            // Get notification from session and clear it
            const notification = req.session.notification;
            if (req.session.notification) {
                delete req.session.notification;
            }

            res.render('admin-assessment-detail', {
                user: req.session,
                assessment: assessment,
                notification: notification
            });
        });
    });

    app.get('/admin/visits/:visitId', requireAuth, requireRole('admin'), (req, res) => {
        const visitId = req.params.visitId;

        // Get visit details with patient info
        db.get(`
            SELECT
                pv.*, p.full_name, p.medical_number, p.mobile_number, p.phone_number,
                p.date_of_birth, p.gender, p.address, p.emergency_contact_name,
                p.emergency_contact_phone, p.emergency_contact_relation,
                u.full_name as created_by_name
            FROM patient_visits pv
            JOIN patients p ON pv.patient_ssn = p.ssn
            LEFT JOIN users u ON pv.created_by = u.user_id
            WHERE pv.visit_id = ?
        `, [visitId], (err, visit) => {
            if (err || !visit) {
                return res.status(404).send('Visit not found');
            }

            // Get nursing assessment
            db.get(`
                SELECT na.*, u.full_name as assessed_by_name, us.signature_data as nurse_signature
                FROM nursing_assessments na
                JOIN form_submissions fs ON na.submission_id = fs.submission_id
                LEFT JOIN users u ON na.assessed_by = u.user_id
                LEFT JOIN user_signatures us ON na.nurse_signature_id = us.signature_id
                WHERE fs.visit_id = ?
            `, [visitId], (err, nursingAssessment) => {

                // Get radiology assessment
                db.get(`
                    SELECT
                        ref.id AS radiology_id,
                        ref.*,
                        submitter.full_name AS assessed_by_name,
                        rs.signature_data AS physician_signature,
                        ref.created_at AS assessed_at,
                        ref.patient_complaint AS reason_for_study,
                        ref.form_type AS modality,
                        NULL AS treating_physician,
                        NULL AS department,
                        NULL AS diagnosis,
                        ref.radiologist_notes AS findings,
                        ref.additional_notes AS impression,
                        ref.technician_notes AS recommendations
                    FROM radiology_examination_form ref
                    LEFT JOIN users submitter ON ref.created_by = submitter.user_id
                    LEFT JOIN user_signatures rs ON ref.radiologist_signature_id = rs.signature_id
                    WHERE ref.visit_id = ?
                `, [visitId], (err, radiologyAssessment) => {

                    // Get notification from session and clear it
                    const notification = req.session.notification;
                    if (req.session.notification) {
                        delete req.session.notification;
                    }

                    res.render('admin-visit-detail', {
                        user: req.session,
                        visit: visit,
                        nursingAssessment: nursingAssessment || null,
                        radiologyAssessment: radiologyAssessment || null,
                        notification: notification
                    });
                });
            });
        });
    });

    app.get('/admin/visits/:visitId/print', requireAuth, requireRole('admin'), (req, res) => {
        const visitId = req.params.visitId;
        // Immediately redirect legacy print requests to the compact print view
        return res.redirect('/admin/visits/' + visitId + '/print-compact');
    });

    // Compact print view (optimized for 1-2 pages)
    app.get('/admin/visits/:visitId/print-compact', requireAuth, requireRole('admin'), async (req, res) => {
        const visitId = req.params.visitId;

        // small promisified helper to avoid callback nesting
        const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        try {
            // Get visit details with patient information
            const visit = await dbGet(`SELECT pv.*, p.* FROM patient_visits pv JOIN patients p ON pv.patient_ssn = p.ssn WHERE pv.visit_id = ?`, [visitId]);
            if (!visit) {
                return res.status(404).send('Visit not found');
            }

            // Get nursing assessment (if any)
            let nursingAssessment = null;
            try {
                nursingAssessment = await dbGet(`SELECT na.*, fs.submission_status, u.full_name as assessed_by_name, ns.signature_data AS nurse_signature FROM nursing_assessments na JOIN form_submissions fs ON na.submission_id = fs.submission_id LEFT JOIN users u ON na.assessed_by = u.user_id LEFT JOIN user_signatures ns ON na.nurse_signature_id = ns.signature_id WHERE fs.visit_id = ?`, [visitId]);
            } catch (errNa) {
                console.error('Error fetching nursing assessment:', errNa);
                nursingAssessment = null;
            }

            // Try to get a radiology_examination_form (preferred)
            let radiologyAssessment = null;
            try {
                radiologyAssessment = await dbGet(`SELECT ref.*, u.full_name as assessed_by_name, rs.signature_data AS radiologist_signature FROM radiology_examination_form ref LEFT JOIN users u ON ref.created_by = u.user_id LEFT JOIN user_signatures rs ON ref.radiologist_signature_id = rs.signature_id WHERE ref.visit_id = ?`, [visitId]);
            } catch (errRef) {
                console.error('Error fetching radiology_examination_form:', errRef);
                radiologyAssessment = null;
            }

            if (radiologyAssessment) {
                radiologyAssessment.form_source = 'radiology';
                return res.render('visit-print-compact', {
                    visit: visit,
                    nursingAssessment: nursingAssessment || null,
                    radiologyAssessment: radiologyAssessment || null
                });
            }

            // No radiology_examination_form found - check PET CT records
            let petRecord = null;
            try {
                petRecord = await dbGet(`SELECT pcr.*, u.full_name as assessed_by_name FROM pet_ct_records pcr LEFT JOIN users u ON pcr.created_by = u.user_id WHERE pcr.visit_id = ?`, [visitId]);
            } catch (errPet) {
                console.error('Error fetching PET CT record:', errPet);
                petRecord = null;
            }

            if (petRecord) {
                petRecord.form_source = 'pet_ct';
                // normalize to template expectations
                petRecord.examination_date = petRecord.exam_date || petRecord.examination_date;
                petRecord.patient_complaint = petRecord.diagnosis_details || petRecord.reason_details || petRecord.patient_complaint;
                petRecord.radiologist_signature = petRecord.physician_signature || null;
            }

            // Render compact print with either PET or nothing for radiology
            return res.render('visit-print-compact', {
                visit: visit,
                nursingAssessment: nursingAssessment || null,
                radiologyAssessment: petRecord || null
            });
        } catch (err) {
            console.error('Error in print-compact route:', err);
            return res.status(500).send('Server error');
        }
    });

    // Bulk delete users
    app.post('/admin/users/bulk-delete', requireAuth, requireRole('admin'), (req, res) => {
        const { userIds } = req.body;
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No user IDs provided' });
        }

        // Prevent deleting self
        const filteredUserIds = userIds.filter(id => id !== req.session.userId);
        if (filteredUserIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
        }

        // Delete user signatures first
        db.serialize(() => {
            db.run(
                `DELETE FROM user_signatures WHERE user_id IN (${filteredUserIds.map(() => '?').join(',')})`,
                filteredUserIds,
                function (err) {
                    if (err) {
                        console.error('Error deleting user signatures:', err);
                        return res.status(500).json({ success: false, message: 'Error deleting user signatures' });
                    }
                    // Delete users
                    db.run(
                        `DELETE FROM users WHERE user_id IN (${filteredUserIds.map(() => '?').join(',')})`,
                        filteredUserIds,
                        function (err2) {
                            if (err2) {
                                console.error('Error deleting users:', err2);
                                return res.status(500).json({ success: false, message: 'Error deleting users' });
                            }
                            return res.json({ success: true, deleted: this.changes });
                        }
                    );
                }
            );
        });
    });

};