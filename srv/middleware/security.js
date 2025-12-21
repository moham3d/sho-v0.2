/**
 * Security Middleware for Al-Shorouk Radiology System
 * Implements CSRF protection and other security headers
 */

const crypto = require('crypto');

/**
 * Generate CSRF token
 */
function generateCsrfToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * CSRF Protection Middleware
 * Alternative to deprecated csurf package
 */
function csrfProtection(req, res, next) {
    // Skip CSRF for GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        // Generate token for session if not exists
        if (!req.session.csrfToken) {
            req.session.csrfToken = generateCsrfToken();
        }
        // Make token available to views
        res.locals.csrfToken = req.session.csrfToken;
        return next();
    }

    // For multipart forms (file uploads), check headers first
    const contentType = req.headers['content-type'] || '';
    const token = req.body._csrf || req.headers['x-csrf-token'];

    // If it's a multipart form and no token in headers, defer validation
    if (contentType.includes('multipart/form-data') && !req.headers['x-csrf-token']) {
        // For multipart forms, we'll validate after body parsing
        // Store a flag to validate later
        req._csrfDeferred = true;
        res.locals.csrfToken = req.session.csrfToken;
        return next();
    }

    const sessionToken = req.session.csrfToken;

    if (!token || !sessionToken || token !== sessionToken) {
        console.warn('CSRF token validation failed for:', req.path, 'IP:', req.ip);
        return res.status(403).json({
            error: 'Invalid CSRF token. Please refresh the page and try again.'
        });
    }

    // Token is valid, make it available to views
    res.locals.csrfToken = req.session.csrfToken;
    next();
}

/**
 * Validate CSRF token after body parsing (for multipart forms)
 */
function validateCsrfToken(req, res, next) {
    // If CSRF was deferred, validate now
    if (req._csrfDeferred) {
        const token = req.body._csrf || req.headers['x-csrf-token'];
        const sessionToken = req.session.csrfToken;

        if (!token || !sessionToken || token !== sessionToken) {
            console.warn('Deferred CSRF token validation failed for:', req.path, 'IP:', req.ip);
            // Clean up any uploaded files
            if (req.files) {
                const fs = require('fs');
                req.files.forEach(file => {
                    try {
                        if (fs.existsSync(file.path)) {
                            fs.unlinkSync(file.path);
                        }
                    } catch (err) {
                        console.error('Error cleaning up file:', err);
                    }
                });
            }
            return res.status(403).json({
                error: 'Invalid CSRF token. Please refresh the page and try again.'
            });
        }
    }

    next();
}

/**
 * Input Sanitization Middleware
 * Sanitizes user input to prevent XSS
 */
function sanitizeInput(req, res, next) {
    // Sanitize body
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                // Don't sanitize signature data or other base64 content
                if (!key.includes('signature') && !key.includes('image')) {
                    req.body[key] = req.body[key].trim();
                }
            }
        });
    }

    // Sanitize query params
    if (req.query) {
        Object.keys(req.query).forEach(key => {
            if (typeof req.query[key] === 'string') {
                req.query[key] = req.query[key].trim();
            }
        });
    }

    next();
}

/**
 * Security Headers Middleware
 * Sets various security headers
 */
function securityHeaders(req, res, next) {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS filter in browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy (basic)
    res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://code.jquery.com; " +
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
        "img-src 'self' data: https:; " +
        "font-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
        "connect-src 'self' https://cdn.jsdelivr.net;"
    );
    
    next();
}

/**
 * Request logging for security audit
 */
function securityAudit(req, res, next) {
    // Log sensitive operations
    const sensitiveRoutes = ['/login', '/logout', '/admin', '/submit-nurse-form', '/submit-radiology-form'];
    const isSensitive = sensitiveRoutes.some(route => req.path.includes(route));
    
    if (isSensitive) {
        console.log('Security Audit:', {
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.path,
            ip: req.ip,
            user: (req.session && req.session.userId) ? req.session.userId : 'anonymous',
            userAgent: req.headers['user-agent']
        });
    }
    
    next();
}

/**
 * Protect against parameter pollution
 */
function parameterPollutionProtection(req, res, next) {
    // Ensure single values for important parameters
    ['username', 'password', 'ssn', 'visit_id'].forEach(param => {
        if (req.body && req.body[param] && Array.isArray(req.body[param])) {
            req.body[param] = req.body[param][0];
        }
        if (req.query && req.query[param] && Array.isArray(req.query[param])) {
            req.query[param] = req.query[param][0];
        }
    });
    
    next();
}

module.exports = {
    csrfProtection,
    validateCsrfToken,
    sanitizeInput,
    securityHeaders,
    securityAudit,
    parameterPollutionProtection,
    generateCsrfToken
};
