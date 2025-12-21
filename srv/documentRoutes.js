/**
 * Document Upload Routes for Al-Shorouk Radiology System
 * Handles document upload, view, download, and delete operations
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { processUploadedDocument } = require('./utils/documentScanner');

module.exports = function(app, db, upload, requireAuth, requireRole, validateCsrfToken) {
    
    /**
     * Upload document(s) for a visit
     * POST /documents/upload
     */
    app.post('/documents/upload', requireAuth, upload.array('documents', 5), validateCsrfToken, async (req, res) => {
        const { visit_id, document_type, description, tags, is_confidential } = req.body;
        const files = req.files;
        
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        
        if (!visit_id) {
            // Clean up uploaded files
            files.forEach(file => fs.unlinkSync(file.path));
            return res.status(400).json({ error: 'Visit ID is required' });
        }
        
        try {
            // Validate visit exists
            const visit = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM patient_visits WHERE visit_id = ?', [visit_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (!visit) {
                files.forEach(file => fs.unlinkSync(file.path));
                return res.status(404).json({ error: 'Visit not found' });
            }
            
            // Determine category based on user role
            let category = 'administrative';
            if (req.session.role === 'nurse') category = 'nursing';
            else if (req.session.role === 'radiologist') category = 'radiology';
            
            // Process each file
            const documentIds = [];
            const processingResults = [];
            
            for (const file of files) {
                const documentId = `DOC-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
                const ext = path.extname(file.originalname);
                const fileName = `${documentId}${ext}`;
                const targetDir = path.join('uploads', 'patients', visit.patient_ssn, 'visits', visit_id, category);
                const targetPath = path.join(targetDir, fileName);
                
                // Create directory if not exists
                fs.mkdirSync(targetDir, { recursive: true });
                
                // Move file
                fs.renameSync(file.path, targetPath);
                
                // Process image files to scanned B&W format
                try {
                    const scanResult = await processUploadedDocument(targetPath, {
                        brightness: 1.1,
                        contrast: 1.3,
                        threshold: 128,
                        quality: 90
                    });
                    processingResults.push(scanResult);
                    console.log(`Document processing result for ${fileName}:`, scanResult.message);
                } catch (error) {
                    console.error(`Error processing document ${fileName}:`, error);
                    // Continue even if processing fails - original file is still saved
                }
                
                // Insert into database
                await new Promise((resolve, reject) => {
                    db.run(`
                        INSERT INTO visit_documents (
                            document_id, visit_id, patient_ssn, document_type,
                            document_category, file_name, original_file_name,
                            file_size, file_type, file_path, uploaded_by,
                            uploaded_by_name, description, tags, is_confidential
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        documentId, visit_id, visit.patient_ssn, document_type || 'other',
                        category, fileName, file.originalname,
                        file.size, file.mimetype, targetPath, req.session.userId,
                        req.session.fullName, description || null, tags || null, is_confidential ? 1 : 0
                    ], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                
                documentIds.push(documentId);
            }
            
            // Update visit document count
            await new Promise((resolve, reject) => {
                db.run(`
                    UPDATE patient_visits 
                    SET document_count = (
                        SELECT COUNT(*) FROM visit_documents 
                        WHERE visit_id = ? AND status = 'active'
                    ) 
                    WHERE visit_id = ?
                `, [visit_id, visit_id], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            // Log activity
            db.run(`
                INSERT INTO activity_log (user_id, user_name, action_type, entity_type, entity_id, description)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                req.session.userId,
                req.session.fullName,
                'document_uploaded',
                'document',
                documentIds.join(','),
                `Uploaded ${files.length} document(s) for visit ${visit_id}`
            ]);
            
            res.json({ 
                success: true, 
                message: `${files.length} document(s) uploaded successfully`,
                document_ids: documentIds
            });
        } catch (error) {
            console.error('Error uploading documents:', error);
            // Clean up any uploaded files
            files.forEach(file => {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            });
            res.status(500).json({ error: 'Failed to upload documents' });
        }
    });
    
    /**
     * Get documents for a visit
     * GET /documents/visit/:visitId
     */
    app.get('/documents/visit/:visitId', requireAuth, (req, res) => {
        const visitId = req.params.visitId;
        
        db.all(`
            SELECT 
                document_id,
                document_type,
                document_category,
                original_file_name,
                file_size,
                file_type,
                upload_date,
                uploaded_by,
                uploaded_by_name,
                description,
                tags,
                is_confidential
            FROM visit_documents
            WHERE visit_id = ? AND status = 'active'
            ORDER BY upload_date DESC
        `, [visitId], (err, documents) => {
            if (err) {
                console.error('Error fetching documents:', err);
                return res.status(500).json({ error: 'Failed to fetch documents' });
            }
            
            res.json({ documents });
        });
    });
    
    /**
     * View document in browser
     * GET /documents/view/:documentId
     */
    app.get('/documents/view/:documentId', requireAuth, (req, res) => {
        db.get('SELECT * FROM visit_documents WHERE document_id = ?', [req.params.documentId], (err, document) => {
            if (err || !document) {
                return res.status(404).send('Document not found');
            }
            
            // Check permissions for confidential documents
            if (document.is_confidential && req.session.role !== 'admin' && req.session.userId !== document.uploaded_by) {
                return res.status(403).send('Access denied to confidential document');
            }
            
            // Check if file exists
            if (!fs.existsSync(document.file_path)) {
                return res.status(404).send('Document file not found on server');
            }
            
            // Set appropriate content type
            res.contentType(document.file_type);
            res.sendFile(path.resolve(document.file_path));
        });
    });
    
    /**
     * Download document
     * GET /documents/download/:documentId
     */
    app.get('/documents/download/:documentId', requireAuth, (req, res) => {
        db.get('SELECT * FROM visit_documents WHERE document_id = ?', [req.params.documentId], (err, document) => {
            if (err || !document) {
                return res.status(404).send('Document not found');
            }
            
            // Check permissions for confidential documents
            if (document.is_confidential && req.session.role !== 'admin' && req.session.userId !== document.uploaded_by) {
                return res.status(403).send('Access denied to confidential document');
            }
            
            // Check if file exists
            if (!fs.existsSync(document.file_path)) {
                return res.status(404).send('Document file not found on server');
            }
            
            res.download(path.resolve(document.file_path), document.original_file_name);
            
            // Log activity
            db.run(`
                INSERT INTO activity_log (user_id, user_name, action_type, entity_type, entity_id, description)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                req.session.userId,
                req.session.fullName,
                'document_downloaded',
                'document',
                document.document_id,
                `Downloaded document: ${document.original_file_name}`
            ]);
        });
    });
    
    /**
     * Delete document
     * DELETE /documents/:documentId
     */
    app.delete('/documents/:documentId', requireAuth, (req, res) => {
        db.get('SELECT * FROM visit_documents WHERE document_id = ?', [req.params.documentId], (err, document) => {
            if (err || !document) {
                return res.status(404).json({ error: 'Document not found' });
            }
            
            // Check permissions (only uploader or admin can delete)
            if (document.uploaded_by !== req.session.userId && req.session.role !== 'admin') {
                return res.status(403).json({ error: 'Permission denied' });
            }
            
            // Soft delete (update status)
            db.run('UPDATE visit_documents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
                ['deleted', req.params.documentId], (err) => {
                if (err) {
                    console.error('Error deleting document:', err);
                    return res.status(500).json({ error: 'Failed to delete document' });
                }
                
                // Update visit document count
                db.run(`
                    UPDATE patient_visits 
                    SET document_count = (
                        SELECT COUNT(*) FROM visit_documents 
                        WHERE visit_id = ? AND status = 'active'
                    ) 
                    WHERE visit_id = ?
                `, [document.visit_id, document.visit_id]);
                
                // Log activity
                db.run(`
                    INSERT INTO activity_log (user_id, user_name, action_type, entity_type, entity_id, description)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    req.session.userId,
                    req.session.fullName,
                    'document_deleted',
                    'document',
                    document.document_id,
                    `Deleted document: ${document.original_file_name}`
                ]);
                
                res.json({ success: true, message: 'Document deleted successfully' });
            });
        });
    });
    
    /**
     * Get document statistics for admin dashboard
     * GET /documents/stats
     */
    app.get('/documents/stats', requireAuth, requireRole('admin'), (req, res) => {
        db.get(`
            SELECT 
                COUNT(*) as total_documents,
                SUM(file_size) as total_size,
                COUNT(DISTINCT visit_id) as visits_with_documents,
                COUNT(DISTINCT patient_ssn) as patients_with_documents
            FROM visit_documents
            WHERE status = 'active'
        `, (err, stats) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch statistics' });
            }
            
            res.json({ stats });
        });
    });
};
