// Load environment variables
require('dotenv').config();

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');
const hl7 = require('simple-hl7');
const net = require('net');
const morgan = require('morgan');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const multer = require('multer');

// Import route modules
const nurseRoutes = require('./srv/nurse');
const adminRoutes = require('./srv/admin');
const radiologistRoutes = require('./srv/radiologist');

// Import middleware
const errorHandler = require('./srv/middleware/errorHandler');
const { loginLimiter, apiLimiter } = require('./srv/middleware/rateLimiter');
const { csrfProtection, validateCsrfToken, sanitizeInput, securityHeaders, securityAudit, parameterPollutionProtection } = require('./srv/middleware/security');

const uuid = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const HL7_PORT = process.env.HL7_PORT || 2576;

// Create logs directory if not exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Create access log stream
const accessLogStream = fs.createWriteStream(
    path.join(logsDir, 'access.log'),
    { flags: 'a' }
);

// PHASE 4: Production Security - Helmet (security headers)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://code.jquery.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            connectSrc: ["'self'", "https://cdn.jsdelivr.net"]
        }
    },
    crossOriginEmbedderPolicy: false // Allow embedding if needed
}));

// PHASE 4: Compression
app.use(compression());

// PHASE 3: Custom security headers
app.use(securityHeaders);

// PHASE 3: Security audit logging
app.use(securityAudit);

// Logging middleware
app.use(morgan('combined', { stream: accessLogStream })); // File logging
if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev')); // Console logging in development
}

// PHASE 3: Parameter pollution protection
app.use(parameterPollutionProtection);

// Middleware
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(bodyParser.json({ limit: '10mb' }));

// PHASE 3: Input sanitization
app.use(sanitizeInput);
app.use(express.static('public'));

// Session configuration
app.use(session({
    store: new SQLiteStore({ db: process.env.SESSION_DB_PATH || 'sessions.db', dir: __dirname }),
    secret: process.env.SESSION_SECRET || 'al-shorouk-radiology-secret-key-2025',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.COOKIE_SECURE === 'true',
        httpOnly: true, // PHASE 3: Prevent XSS
        maxAge: parseInt(process.env.COOKIE_MAX_AGE) || 24 * 60 * 60 * 1000
    }
}));

// PHASE 3: CSRF Protection (must be after session)
app.use(csrfProtection);

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'srv/views'));

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login');
}

function requireRole(role) {
    return function (req, res, next) {
        if (req.session.userId && req.session.role === role) {
            return next();
        }
        res.status(403).send('Access denied');
    };
}

// Database setup
const { connectDB, closeDB } = require('./srv/db/database');
const db = connectDB(process.env.DB_PATH || 'database.db');

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/temp';
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, JPEG, and PNG are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
        files: 5 // Max 5 files per upload
    },
    fileFilter: fileFilter
});

// Make upload available to routes
app.locals.upload = upload;
app.locals.db = db;

// Routes
app.get('/', requireAuth, (req, res) => {
    // Redirect based on role
    if (req.session.role === 'admin') {
        res.redirect('/admin');
    } else if (req.session.role === 'nurse') {
        res.redirect('/nurse');
    } else if (req.session.role === 'radiologist') {
        res.redirect('/radiologist');
    } else {
        // Fallback for unknown roles
        res.redirect('/login');
    }
});

app.get('/login', (req, res) => {
    res.render('login', { error: null, csrfToken: res.locals.csrfToken });
});

// PHASE 3: Login with rate limiting
app.post('/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return res.render('login', { error: 'Database error', csrfToken: res.locals.csrfToken });
        }

        if (!user) {
            return res.render('login', { error: 'Invalid username or password', csrfToken: res.locals.csrfToken });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.render('login', { error: 'Invalid username or password' });
        }

        // Set session
        req.session.userId = user.user_id;
        req.session.username = user.username;
        req.session.role = user.role;
        req.session.fullName = user.full_name;

        // Redirect based on role
        if (user.role === 'admin') {
            res.redirect('/admin');
        } else if (user.role === 'nurse') {
            res.redirect('/nurse');
        } else if (user.role === 'radiologist') {
            res.redirect('/radiologist');
        } else {
            res.redirect('/');
        }
    });
});

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destruction error:', err);
        }
        res.redirect('/login');
    });
});

// Register routes
nurseRoutes(app, db, requireAuth, requireRole);
adminRoutes(app, db, requireAuth, requireRole);
radiologistRoutes(app, db, requireAuth, requireRole);

// Document routes
const documentRoutes = require('./srv/documentRoutes');
documentRoutes(app, db, upload, requireAuth, requireRole, validateCsrfToken);

// Error handling middleware (must be after all routes)
errorHandler(app);

const httpServer = app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Store server reference for graceful shutdown
app.locals.httpServer = httpServer;

// Initialize HL7 Server
const { startHL7Server } = require('./srv/services/hl7Service');
const hl7Server = startHL7Server(HL7_PORT, db);

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n⏳ Shutting down gracefully...');

    // Close HTTP server
    app.locals.httpServer.close(() => {
        console.log('✓ HTTP server closed');
    });

    // Close HL7 server
    hl7Server.close(() => {
        console.log('✓ HL7 server closed');
    });

    // Close database
    closeDB((err) => {
        if (err) {
            console.error('✗ Error closing database:', err.message);
        } else {
            console.log('✓ Database connection closed');
        }
        console.log('👋 Goodbye!');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.emit('SIGINT');
});
