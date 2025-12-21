/**
 * Session Configuration Module
 * Supports SQLite (development) and Redis (production) session stores
 */

const session = require('express-session');

/**
 * Create session middleware with appropriate store
 * Uses Redis in production (if REDIS_URL is set) or SQLite in development
 */
function createSessionMiddleware() {
    const isProduction = process.env.NODE_ENV === 'production';
    const redisUrl = process.env.REDIS_URL;

    // Base session configuration
    const sessionConfig = {
        secret: process.env.SESSION_SECRET || 'al-shorouk-radiology-secret-key-2025',
        resave: false,
        saveUninitialized: false,
        name: 'sid', // Custom session cookie name (more secure than default 'connect.sid')
        cookie: {
            secure: process.env.COOKIE_SECURE === 'true' || isProduction,
            httpOnly: true, // Prevent XSS access to cookies
            sameSite: 'strict', // CSRF protection
            maxAge: parseInt(process.env.COOKIE_MAX_AGE) || 24 * 60 * 60 * 1000 // 24 hours
        }
    };

    // Use Redis store in production if REDIS_URL is configured
    if (isProduction && redisUrl) {
        try {
            const RedisStore = require('connect-redis').default;
            const { createClient } = require('redis');

            const redisClient = createClient({
                url: redisUrl,
                legacyMode: false
            });

            redisClient.connect().catch(console.error);

            redisClient.on('error', (err) => {
                console.error('[Session] Redis Client Error:', err);
            });

            redisClient.on('connect', () => {
                console.log('[Session] Redis connected successfully');
            });

            sessionConfig.store = new RedisStore({
                client: redisClient,
                prefix: 'sho:sess:' // Prefix for session keys
            });

            console.log('[Session] Using Redis session store');
        } catch (error) {
            console.warn('[Session] Redis not available, falling back to SQLite:', error.message);
            // Fall back to SQLite
            sessionConfig.store = createSQLiteStore(session);
        }
    } else {
        // Use SQLite store for development or when Redis is not configured
        sessionConfig.store = createSQLiteStore(session);
        console.log('[Session] Using SQLite session store');
    }

    return session(sessionConfig);
}

/**
 * Create SQLite session store
 */
function createSQLiteStore(session) {
    const SQLiteStore = require('connect-sqlite3')(session);
    return new SQLiteStore({
        db: process.env.SESSION_DB_PATH || 'sessions.db',
        dir: process.cwd()
    });
}

/**
 * Session security middleware
 * Regenerates session ID on privilege changes
 */
function regenerateSession(req, callback) {
    const oldSession = req.session;
    req.session.regenerate((err) => {
        if (err) {
            console.error('[Session] Failed to regenerate session:', err);
            return callback(err);
        }
        // Copy over important session data
        Object.assign(req.session, {
            userId: oldSession.userId,
            username: oldSession.username,
            fullName: oldSession.fullName,
            role: oldSession.role,
            isAuthenticated: oldSession.isAuthenticated
        });
        callback(null);
    });
}

/**
 * Destroy session securely
 */
function destroySession(req, callback) {
    req.session.destroy((err) => {
        if (err) {
            console.error('[Session] Failed to destroy session:', err);
            return callback(err);
        }
        callback(null);
    });
}

module.exports = {
    createSessionMiddleware,
    regenerateSession,
    destroySession
};
