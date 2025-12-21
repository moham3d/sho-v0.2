/**
 * Data Access Object (DAO) Index
 * Central export point for all DAOs in the Al-Shorouk Radiology System
 * 
 * Usage:
 *   const { PatientDAO, VisitDAO, UserDAO, AssessmentDAO, createDAOs } = require('./db/dao');
 *   
 *   // Create all DAOs with a database instance
 *   const daos = createDAOs(db);
 *   const patient = await daos.patients.findBySSN('12345678901234');
 *   
 *   // Or create individual DAOs
 *   const patientDAO = new PatientDAO(db);
 *   const patient = await patientDAO.findBySSN('12345678901234');
 */

const PatientDAO = require('./PatientDAO');
const VisitDAO = require('./VisitDAO');
const UserDAO = require('./UserDAO');
const AssessmentDAO = require('./AssessmentDAO');

/**
 * Create all DAO instances with a database connection
 * @param {Object} db - SQLite database instance
 * @returns {Object} - Object containing all DAO instances
 */
function createDAOs(db) {
    return {
        patients: new PatientDAO(db),
        visits: new VisitDAO(db),
        users: new UserDAO(db),
        assessments: new AssessmentDAO(db)
    };
}

module.exports = {
    PatientDAO,
    VisitDAO,
    UserDAO,
    AssessmentDAO,
    createDAOs
};
