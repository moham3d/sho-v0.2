/**
 * Date Helper Utilities for Al-Shorouk Radiology System
 * Handles HL7 date parsing and age calculations
 */

/**
 * Parse HL7 date format (YYYYMMDD) or standard date strings
 * @param {string|Date} dateString - Date in HL7 format or standard format
 * @returns {Date|null} - Parsed date or null if invalid
 */
function parseHL7Date(dateString) {
    if (!dateString || dateString === 'null') return null;

    // Handle HL7 date format (YYYYMMDD)
    if (typeof dateString === 'string' && dateString.length === 8 && /^\d{8}$/.test(dateString)) {
        const year = dateString.substring(0, 4);
        const month = dateString.substring(4, 6);
        const day = dateString.substring(6, 8);
        return new Date(`${year}-${month}-${day}`);
    }

    // Try standard date parsing
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
}

/**
 * Calculate age from date of birth
 * @param {string|Date} dateOfBirth - Date of birth
 * @returns {number|string} - Age in years or 'N/A' if invalid
 */
function calculateAge(dateOfBirth) {
    const birthDate = parseHL7Date(dateOfBirth);
    if (!birthDate) return 'N/A';

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age >= 0 ? age : 'N/A';
}

/**
 * Format date to readable string
 * @param {string|Date} date - Date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date or 'N/A'
 */
function formatDate(date, options = { year: 'numeric', month: 'short', day: 'numeric' }) {
    const parsed = parseHL7Date(date);
    if (!parsed) return 'N/A';
    return parsed.toLocaleDateString('en-US', options);
}

/**
 * Format datetime to readable string with time
 * @param {string|Date} datetime - DateTime to format
 * @returns {string} - Formatted datetime or 'N/A'
 */
function formatDateTime(datetime) {
    const parsed = parseHL7Date(datetime);
    if (!parsed) return 'N/A';
    return parsed.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Get age category based on age (for fall risk assessment)
 * @param {string|Date} dateOfBirth - Date of birth
 * @returns {string} - 'child', 'adult', or 'elderly'
 */
function getAgeCategory(dateOfBirth) {
    const age = calculateAge(dateOfBirth);
    if (age === 'N/A') return 'adult'; // Default to adult if unknown
    
    if (age < 18) return 'child';
    if (age >= 65) return 'elderly';
    return 'adult';
}

module.exports = {
    parseHL7Date,
    calculateAge,
    formatDate,
    formatDateTime,
    getAgeCategory
};
