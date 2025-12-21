/**
 * Rate Limiting Middleware for Al-Shorouk Radiology System
 * Protects against abuse and brute force attacks
 */

const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
        console.warn('Rate limit exceeded for IP:', req.ip, 'Path:', req.path);
        res.status(429).json({
            error: 'Too many requests from this IP, please try again later.',
            retryAfter: '15 minutes'
        });
    }
});

/**
 * Login rate limiter
 * 5 attempts per 15 minutes per IP
 * Protects against brute force attacks
 */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    skipSuccessfulRequests: true, // Don't count successful logins
    message: {
        error: 'Too many login attempts from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    handler: (req, res) => {
        console.warn('Login rate limit exceeded for IP:', req.ip, 'Username:', req.body.username);
        res.status(429).json({
            error: 'Too many login attempts. Please try again later.',
            retryAfter: '15 minutes'
        });
    }
});

/**
 * Form submission rate limiter
 * 30 submissions per 15 minutes per IP
 */
const formLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Limit each IP to 30 form submissions per windowMs
    message: {
        error: 'Too many form submissions from this IP, please slow down.',
        retryAfter: '15 minutes'
    },
    handler: (req, res) => {
        console.warn('Form submission rate limit exceeded for IP:', req.ip, 'Path:', req.path);
        res.status(429).json({
            error: 'Too many form submissions. Please slow down.',
            retryAfter: '15 minutes'
        });
    }
});

/**
 * Patient search rate limiter
 * 60 searches per 15 minutes per IP
 */
const searchLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 60, // Limit each IP to 60 searches per windowMs
    message: {
        error: 'Too many search requests from this IP, please slow down.',
        retryAfter: '15 minutes'
    },
    handler: (req, res) => {
        console.warn('Search rate limit exceeded for IP:', req.ip);
        res.status(429).json({
            error: 'Too many search requests. Please slow down.',
            retryAfter: '15 minutes'
        });
    }
});

/**
 * HL7 message rate limiter (if needed for API endpoints)
 * 1000 messages per hour
 */
const hl7Limiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1000, // Limit to 1000 HL7 messages per hour
    message: {
        error: 'Too many HL7 messages from this IP, please contact system administrator.',
        retryAfter: '1 hour'
    },
    handler: (req, res) => {
        console.error('HL7 rate limit exceeded for IP:', req.ip);
        res.status(429).json({
            error: 'Too many HL7 messages. Please contact system administrator.',
            retryAfter: '1 hour'
        });
    }
});

module.exports = {
    apiLimiter,
    loginLimiter,
    formLimiter,
    searchLimiter,
    hl7Limiter
};
