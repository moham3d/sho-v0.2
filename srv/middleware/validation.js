/**
 * Input Validation Middleware for Al-Shorouk Radiology System
 * Uses express-validator for comprehensive input validation
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware to check validation results
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.error('Validation errors:', errors.array());
        return res.status(400).json({ 
            errors: errors.array(),
            message: 'Validation failed'
        });
    }
    next();
};

/**
 * SSN Validation (14 digits for Egyptian national ID)
 */
const validateSSN = () => {
    return body('ssn')
        .trim()
        .isLength({ min: 14, max: 14 })
        .withMessage('SSN must be exactly 14 digits')
        .isNumeric()
        .withMessage('SSN must contain only numbers')
        .custom((value) => {
            // Additional validation: Check if SSN follows Egyptian format
            // First digit: century (2 or 3)
            // Next 2 digits: year
            // Next 2 digits: month (01-12)
            // Next 2 digits: day (01-31)
            const century = value.charAt(0);
            const month = parseInt(value.substring(3, 5));
            const day = parseInt(value.substring(5, 7));
            
            if (century !== '2' && century !== '3') {
                throw new Error('Invalid SSN format: century must be 2 or 3');
            }
            if (month < 1 || month > 12) {
                throw new Error('Invalid SSN format: invalid month');
            }
            if (day < 1 || day > 31) {
                throw new Error('Invalid SSN format: invalid day');
            }
            return true;
        });
};

/**
 * Patient Registration Validation
 */
const validatePatientRegistration = [
    validateSSN(),
    body('full_name')
        .trim()
        .notEmpty()
        .withMessage('Full name is required')
        .isLength({ min: 3, max: 100 })
        .withMessage('Full name must be between 3 and 100 characters')
        .matches(/^[a-zA-Z\u0600-\u06FF\s]+$/)
        .withMessage('Full name must contain only letters and spaces'),
    body('mobile_number')
        .trim()
        .notEmpty()
        .withMessage('Mobile number is required')
        .matches(/^(010|011|012|015)\d{8}$/)
        .withMessage('Invalid Egyptian mobile number format (must start with 010, 011, 012, or 015)'),
    body('date_of_birth')
        .optional()
        .isISO8601()
        .withMessage('Invalid date format')
        .custom((value) => {
            const birthDate = new Date(value);
            const today = new Date();
            const age = today.getFullYear() - birthDate.getFullYear();
            if (age < 0 || age > 150) {
                throw new Error('Invalid age');
            }
            return true;
        }),
    body('gender')
        .optional()
        .isIn(['male', 'female', 'other'])
        .withMessage('Gender must be male, female, or other'),
    body('address')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Address must not exceed 500 characters'),
    validate
];

/**
 * User Creation/Update Validation
 */
const validateUser = [
    body('username')
        .trim()
        .notEmpty()
        .withMessage('Username is required')
        .isLength({ min: 3, max: 50 })
        .withMessage('Username must be between 3 and 50 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username must contain only letters, numbers, and underscores'),
    body('full_name')
        .trim()
        .notEmpty()
        .withMessage('Full name is required')
        .isLength({ min: 3, max: 100 })
        .withMessage('Full name must be between 3 and 100 characters'),
    body('role')
        .notEmpty()
        .withMessage('Role is required')
        .isIn(['admin', 'nurse', 'radiologist'])
        .withMessage('Role must be admin, nurse, or radiologist'),
    body('password')
        .if(body('user_id').not().exists()) // Only required for new users
        .notEmpty()
        .withMessage('Password is required for new users')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    validate
];

/**
 * Login Validation
 */
const validateLogin = [
    body('username')
        .trim()
        .notEmpty()
        .withMessage('Username is required'),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    validate
];

/**
 * Nursing Assessment Validation
 */
const validateNursingAssessment = [
    body('visit_id')
        .notEmpty()
        .withMessage('Visit ID is required')
        .isUUID()
        .withMessage('Invalid visit ID format'),
    body('vital_signs.temperature')
        .optional()
        .isFloat({ min: 35, max: 42 })
        .withMessage('Temperature must be between 35°C and 42°C'),
    body('vital_signs.pulse')
        .optional()
        .isInt({ min: 40, max: 200 })
        .withMessage('Pulse must be between 40 and 200 bpm'),
    body('vital_signs.blood_pressure_systolic')
        .optional()
        .isInt({ min: 70, max: 250 })
        .withMessage('Systolic BP must be between 70 and 250 mmHg'),
    body('vital_signs.blood_pressure_diastolic')
        .optional()
        .isInt({ min: 40, max: 150 })
        .withMessage('Diastolic BP must be between 40 and 150 mmHg'),
    body('vital_signs.respiratory_rate')
        .optional()
        .isInt({ min: 8, max: 60 })
        .withMessage('Respiratory rate must be between 8 and 60 breaths/min'),
    body('vital_signs.oxygen_saturation')
        .optional()
        .isInt({ min: 70, max: 100 })
        .withMessage('Oxygen saturation must be between 70% and 100%'),
    body('nurse_signature')
        .if(body('action').equals('submit'))
        .notEmpty()
        .withMessage('Signature is required for final submission'),
    validate
];

/**
 * Visit ID Parameter Validation
 */
const validateVisitId = [
    param('visitId')
        .notEmpty()
        .withMessage('Visit ID is required')
        .isUUID()
        .withMessage('Invalid visit ID format'),
    validate
];

/**
 * Search Query Validation
 */
const validateSearch = [
    query('q')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Search query must be between 2 and 100 characters')
        .matches(/^[a-zA-Z0-9\s\u0600-\u06FF]+$/)
        .withMessage('Search query contains invalid characters'),
    validate
];

/**
 * Sanitize HTML input to prevent XSS
 */
const sanitizeHtml = (value) => {
    if (typeof value !== 'string') return value;
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
};

module.exports = {
    validate,
    validateSSN,
    validatePatientRegistration,
    validateUser,
    validateLogin,
    validateNursingAssessment,
    validateVisitId,
    validateSearch,
    sanitizeHtml
};
