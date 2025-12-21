/**
 * Database Migration Script for Document Upload Feature
 * Adds visit_documents and activity_log tables
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || './database.db';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  Database Migration - Document Upload Feature             ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('✗ Error opening database:', err.message);
        process.exit(1);
    }
    console.log('✓ Connected to database:', DB_PATH);
});

// Run migrations
db.serialize(() => {
    console.log('\n--- Creating visit_documents table ---');
    
    db.run(`
        CREATE TABLE IF NOT EXISTS visit_documents (
            document_id TEXT PRIMARY KEY,
            visit_id TEXT NOT NULL,
            patient_ssn TEXT NOT NULL,
            document_type TEXT NOT NULL,
            document_category TEXT,
            file_name TEXT NOT NULL,
            original_file_name TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            file_type TEXT NOT NULL,
            file_path TEXT NOT NULL,
            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            uploaded_by TEXT NOT NULL,
            uploaded_by_name TEXT,
            description TEXT,
            tags TEXT,
            is_confidential INTEGER DEFAULT 0,
            requires_signature INTEGER DEFAULT 0,
            signed_by TEXT,
            signed_at DATETIME,
            status TEXT DEFAULT 'active',
            version INTEGER DEFAULT 1,
            parent_document_id TEXT,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (visit_id) REFERENCES patient_visits(visit_id) ON DELETE CASCADE,
            FOREIGN KEY (patient_ssn) REFERENCES patients(ssn) ON DELETE CASCADE,
            FOREIGN KEY (uploaded_by) REFERENCES users(user_id) ON DELETE SET NULL,
            FOREIGN KEY (parent_document_id) REFERENCES visit_documents(document_id) ON DELETE SET NULL
        )
    `, (err) => {
        if (err) {
            console.error('✗ Error creating visit_documents table:', err.message);
        } else {
            console.log('✓ visit_documents table created');
        }
    });

    console.log('\n--- Creating indexes for visit_documents ---');
    
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_visit_documents_visit ON visit_documents(visit_id)',
        'CREATE INDEX IF NOT EXISTS idx_visit_documents_patient ON visit_documents(patient_ssn)',
        'CREATE INDEX IF NOT EXISTS idx_visit_documents_type ON visit_documents(document_type)',
        'CREATE INDEX IF NOT EXISTS idx_visit_documents_uploader ON visit_documents(uploaded_by)',
        'CREATE INDEX IF NOT EXISTS idx_visit_documents_date ON visit_documents(upload_date)',
        'CREATE INDEX IF NOT EXISTS idx_visit_documents_status ON visit_documents(status)'
    ];

    indexes.forEach((sql, index) => {
        db.run(sql, (err) => {
            if (err) {
                console.error(`✗ Error creating index ${index + 1}:`, err.message);
            } else {
                console.log(`✓ Index ${index + 1} created`);
            }
        });
    });

    console.log('\n--- Creating activity_log table ---');
    
    db.run(`
        CREATE TABLE IF NOT EXISTS activity_log (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_id TEXT,
            user_name TEXT,
            action_type TEXT NOT NULL,
            entity_type TEXT,
            entity_id TEXT,
            description TEXT,
            ip_address TEXT,
            user_agent TEXT,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
        )
    `, (err) => {
        if (err) {
            console.error('✗ Error creating activity_log table:', err.message);
        } else {
            console.log('✓ activity_log table created');
        }
    });

    console.log('\n--- Creating indexes for activity_log ---');
    
    const logIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log(timestamp)',
        'CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action_type)'
    ];

    logIndexes.forEach((sql, index) => {
        db.run(sql, (err) => {
            if (err) {
                console.error(`✗ Error creating log index ${index + 1}:`, err.message);
            } else {
                console.log(`✓ Log index ${index + 1} created`);
            }
        });
    });

    console.log('\n--- Adding document_count column to patient_visits ---');
    
    // Check if column exists first
    db.all("PRAGMA table_info(patient_visits)", (err, rows) => {
        if (err) {
            console.error('✗ Error checking table info:', err.message);
            return;
        }
        
        const columnExists = rows.some(row => row.name === 'document_count');
        
        if (columnExists) {
            console.log('✓ document_count column already exists');
        } else {
            db.run(`ALTER TABLE patient_visits ADD COLUMN document_count INTEGER DEFAULT 0`, (err) => {
                if (err) {
                    console.error('✗ Error adding document_count column:', err.message);
                } else {
                    console.log('✓ document_count column added');
                }
            });
        }
        
        // Close database after all operations
        setTimeout(() => {
            db.close((err) => {
                if (err) {
                    console.error('✗ Error closing database:', err.message);
                } else {
                    console.log('\n✓ Migration completed successfully!');
                    console.log('✓ Database connection closed\n');
                }
            });
        }, 1000);
    });
});
