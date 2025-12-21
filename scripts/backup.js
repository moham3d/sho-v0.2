/**
 * Database Backup Script for Al-Shorouk Radiology System
 * Creates timestamped backups of the SQLite database
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Configuration
const DB_PATH = process.env.DB_PATH || './database.db';
const SESSION_DB_PATH = process.env.SESSION_DB_PATH || './sessions.db';
const BACKUP_DIR = './backups';
const MAX_BACKUPS = 30; // Keep last 30 backups

/**
 * Create backup directory if it doesn't exist
 */
function ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log('✓ Created backup directory:', BACKUP_DIR);
    }
}

/**
 * Generate backup filename with timestamp
 */
function getBackupFilename(dbName) {
    const timestamp = new Date().toISOString()
        .replace(/:/g, '-')
        .replace(/\..+/, '');
    return `${dbName}_${timestamp}.db`;
}

/**
 * Copy database file
 */
function backupDatabase(dbPath, backupPath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(dbPath)) {
            return reject(new Error(`Database file not found: ${dbPath}`));
        }

        fs.copyFile(dbPath, backupPath, (err) => {
            if (err) {
                return reject(err);
            }
            
            const stats = fs.statSync(backupPath);
            const sizeKB = (stats.size / 1024).toFixed(2);
            console.log(`✓ Backed up ${path.basename(dbPath)} (${sizeKB} KB)`);
            resolve(backupPath);
        });
    });
}

/**
 * Clean old backups, keep only last MAX_BACKUPS
 */
function cleanOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.endsWith('.db'))
            .map(file => ({
                name: file,
                path: path.join(BACKUP_DIR, file),
                time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time); // Sort by newest first

        // Remove old backups
        if (files.length > MAX_BACKUPS) {
            const filesToRemove = files.slice(MAX_BACKUPS);
            filesToRemove.forEach(file => {
                fs.unlinkSync(file.path);
                console.log(`✓ Removed old backup: ${file.name}`);
            });
            console.log(`✓ Cleaned ${filesToRemove.length} old backup(s)`);
        }
    } catch (err) {
        console.error('Error cleaning old backups:', err.message);
    }
}

/**
 * Main backup function
 */
async function performBackup() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  Al-Shorouk Radiology System - Database Backup            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`Started: ${new Date().toLocaleString()}\n`);

    try {
        // Ensure backup directory exists
        ensureBackupDir();

        // Backup main database
        const mainBackupPath = path.join(BACKUP_DIR, getBackupFilename('database'));
        await backupDatabase(DB_PATH, mainBackupPath);

        // Backup session database (optional)
        if (fs.existsSync(SESSION_DB_PATH)) {
            const sessionBackupPath = path.join(BACKUP_DIR, getBackupFilename('sessions'));
            await backupDatabase(SESSION_DB_PATH, sessionBackupPath);
        }

        // Clean old backups
        cleanOldBackups();

        console.log('\n✓ Backup completed successfully!');
        console.log(`Location: ${path.resolve(BACKUP_DIR)}`);
        
        // List recent backups
        const backups = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.endsWith('.db'))
            .slice(0, 5);
        
        if (backups.length > 0) {
            console.log('\nRecent backups:');
            backups.forEach((file, index) => {
                const stats = fs.statSync(path.join(BACKUP_DIR, file));
                const sizeKB = (stats.size / 1024).toFixed(2);
                console.log(`  ${index + 1}. ${file} (${sizeKB} KB)`);
            });
        }

    } catch (err) {
        console.error('\n✗ Backup failed:', err.message);
        process.exit(1);
    }

    console.log(`\nCompleted: ${new Date().toLocaleString()}`);
}

/**
 * Restore database from backup
 */
function restoreBackup(backupFile) {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  Al-Shorouk Radiology System - Database Restore           ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    const backupPath = path.join(BACKUP_DIR, backupFile);
    
    if (!fs.existsSync(backupPath)) {
        console.error('✗ Backup file not found:', backupPath);
        process.exit(1);
    }

    // Create backup of current database before restoring
    const currentBackup = path.join(BACKUP_DIR, `current_before_restore_${Date.now()}.db`);
    fs.copyFileSync(DB_PATH, currentBackup);
    console.log('✓ Current database backed up to:', currentBackup);

    // Restore backup
    fs.copyFileSync(backupPath, DB_PATH);
    console.log('✓ Database restored from:', backupFile);
    console.log('\n⚠ Please restart the application for changes to take effect.');
}

// CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args[0] === 'restore' && args[1]) {
        restoreBackup(args[1]);
    } else if (args[0] === 'list') {
        ensureBackupDir();
        const backups = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.endsWith('.db'))
            .map(file => {
                const stats = fs.statSync(path.join(BACKUP_DIR, file));
                return {
                    name: file,
                    size: (stats.size / 1024).toFixed(2),
                    date: stats.mtime.toLocaleString()
                };
            });
        
        console.log('\nAvailable backups:');
        if (backups.length === 0) {
            console.log('  No backups found.');
        } else {
            backups.forEach((backup, index) => {
                console.log(`  ${index + 1}. ${backup.name}`);
                console.log(`     Size: ${backup.size} KB, Date: ${backup.date}`);
            });
        }
    } else {
        performBackup();
    }
}

module.exports = {
    performBackup,
    restoreBackup,
    ensureBackupDir
};
