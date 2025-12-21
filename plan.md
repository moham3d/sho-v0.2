# Project Stabilization and Modernization Plan

## Executive Summary
The Al-Shorouk Radiology Management System is currently in a functional **Prototype/Alpha** state. While key workflows for Admins, Nurses, and Radiologists are implemented, significant technical debt poses risks to scalability, maintainability, and reliability. This plan outlines a phased approach to stabilize the core system, refactor critical components, and enhance the user experience.

## 1. Current Health Assessment

### 🚨 Critical Risks
*   **Zero Automated Coverage:** Despite documentation claiming otherwise, `tests/` directory is missing. Any refactoring carries high regression risk.
*   **Fragile HL7 Server:** Current implementation relies on manual socket/string parsing (using `net` module and string splitting), making it brittle and prone to data loss with complex messages.
*   **Monolithic Architecture:** `server.js` (500+ lines) handles too many responsibilities (Config, Middleware, HL7, Routing).

### 🏗 Technical Debt
*   **Frontend:** View files are massive (e.g., `nurse-form.ejs` is 114KB), lacking component reusability.
*   **Database:** Raw SQL queries are scattered throughout route handlers, making schema changes or migration difficult.
*   **Documentation:** Discrepancies exist between docs ("Physician" role) and code ("Radiologist" role).

## 2. Strategic Roadmap

### Phase 1: Stabilization ✅ COMPLETED
*Goal: Stop the bleeding and ensure the system doesn't break during future changes.*
1.  **Establish Testing Net:** ✅ COMPLETED
    *   ✅ Initialized Playwright test framework
    *   ✅ Created comprehensive smoke tests in `tests/smoke.spec.js`:
        - Authentication tests (login/logout for all roles, invalid credentials)
        - Admin dashboard and user management tests
        - Nurse dashboard and patient workflow tests
        - Accessibility verification tests
        - Static asset loading tests
        - API endpoint tests
2.  **Server Decoupling:** ✅ COMPLETED
    *   ✅ Extracted HL7 logic into `srv/services/hl7Service.js`
    *   ✅ Extracted Database setup into `srv/db/` (connection.js, database.js)
    *   ✅ Created middleware modules in `srv/middleware/`
    *   ✅ Created session configuration in `srv/config/session.js`
3.  **Documentation Sync:** ✅ COMPLETED
    *   ✅ Updated `README.md` to use "Radiologist" role (not "Physician"/"Doctor")
    *   ✅ Updated project structure to reflect DAO layer and new modules
    *   ✅ Documented DAO usage patterns in development guide

### Phase 2: Refactoring ✅ COMPLETED
*Goal: Improve verified code quality and developer experience.*
1.  **Frontend Modularization:** ✅ COMPLETED
    *   ✅ Implemented Layout system for EJS (`partials/layout-header.ejs`, `partials/layout-footer.ejs`).
    *   ✅ Broke down `nurse-form.ejs` into reusable partials:
        - `partials/nurse-vital-signs.ejs`
        - `partials/nurse-psychosocial.ejs`
        - `partials/nurse-nutritional.ejs`
        - `partials/nurse-functional.ejs`
        - `partials/nurse-pain.ejs`
        - `partials/nurse-morse-fall.ejs`
        - `partials/nurse-pediatric-fall.ejs`
        - `partials/nurse-elderly-assessment.ejs`
        - `partials/nurse-educational.ejs`
2.  **Database Layer (DAO):** ✅ COMPLETED
    *   ✅ Created DAO classes in `srv/db/dao/`:
        - `PatientDAO.js` - Patient CRUD and search operations
        - `VisitDAO.js` - Visit management and nurse dashboard queries
        - `UserDAO.js` - User authentication and management
        - `AssessmentDAO.js` - Form submissions and signatures
        - `index.js` - Central export with `createDAOs()` factory
    *   ✅ Refactored `srv/nurse.js` to use DAOs (async/await, ~40% code reduction)
    *   ✅ Refactored `srv/admin.js` dashboard route to use DAOs
3.  **HL7 Robustness:** ✅ COMPLETED
    *   ✅ Refactored `srv/services/hl7Service.js` to use `simple-hl7` library
    *   ✅ Added fallback to manual parsing for non-standard messages
    *   ✅ Improved error handling and logging with `[HL7]` prefix
    *   ✅ Added proper ACK message generation

### Phase 3: Enhancements & Polish ✅ COMPLETED
*Goal: Production Readiness and User Satisfaction.*
1.  **Accessibility Audit:** ✅ COMPLETED
    *   ✅ Created `public/css/accessibility.css` with comprehensive accessibility utilities:
        - Skip links, enhanced focus styles, screen reader utilities
        - Reduced motion support, high contrast mode
        - Keyboard navigation enhancements, touch target sizing
        - Form accessibility, loading states, modal & table accessibility
    *   ✅ Added accessibility.css to layout-header.ejs for site-wide inclusion
    *   ✅ Refactored `admin-users.ejs` with ARIA labels, semantic HTML (sections, roles), and proper heading hierarchy
2.  **CSS Modernization:** ✅ COMPLETED
    *   ✅ `custom.css` already well-organized with CSS variables and clear sections
    *   ✅ Created modular accessibility.css for separation of concerns
    *   ✅ Applied layout system to more views for consistent styling
3.  **Security**: ✅ COMPLETED
    *   ✅ Created `srv/config/session.js` module supporting both SQLite and Redis session stores
    *   ✅ Auto-detects environment and uses Redis when `REDIS_URL` is set in production
    *   ✅ Added session regeneration and secure destruction helpers
    *   ✅ Enhanced cookie security (httpOnly, sameSite, custom name)

## 3. Discussion Points for Team
*   **Testing Strategy:** Should we prioritize End-to-End (Playwright) over Unit tests given the current lack of structure?
*   **Database Migration:** Is SQLite sufficient for the next phase, or should we prepare for PostgreSQL/MySQL?
*   **HL7 Integration:** Do we need to support specific HL7 message types beyond ADT^A01 immediately?
