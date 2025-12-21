const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let dbInstance = null;

const connectDB = (dbPath) => {
    if (dbInstance) return dbInstance;

    dbInstance = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening database:', err.message);
        } else {
            console.log('Connected to SQLite database.');
        }
    });

    return dbInstance;
};

const getDB = () => {
    if (!dbInstance) {
        throw new Error('Database not initialized. Call connectDB first.');
    }
    return dbInstance;
};

// Also export a close function if needed, though usually handled by the main app shutdown
const closeDB = (callback) => {
    if (dbInstance) {
        dbInstance.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
                if (callback) callback(err);
            } else {
                console.log('SQLite connection closed.');
                dbInstance = null;
                if (callback) callback(null);
            }
        });
    } else {
        if (callback) callback(null);
    }
};

module.exports = {
    connectDB,
    getDB,
    closeDB
};
