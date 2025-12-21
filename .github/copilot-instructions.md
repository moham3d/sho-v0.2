# Al-Shorouk Radiology Management System - AI Agent Instructions

## Architecture Overview

**Role-Based Healthcare Workflow System**
- **Frontend**: EJS templates with Bootstrap 5, vanilla JavaScript
- **Backend**: Node.js Express with SQLite database
- **Authentication**: Session-based with bcrypt password hashing
- **Roles**: Admin (user management), Nurse (patient assessment), Physician/Doctor (radiology assessment)

**Key Components**:
- `server.js`: Main Express app with middleware, routes, and database connection
- `srv/`: Role-specific route modules (`admin.js`, `nurse.js`, `doctor.js`)
- `srv/views/`: EJS templates organized by role and function
- `public/`: Static assets (CSS, JS) with Bootstrap 5 styling
- `docs/schema.sql`: Comprehensive SQLite schema with healthcare-specific tables

## Critical Workflows

**Patient Visit Flow**:
1. Nurse searches/creates patient → fills nursing assessment form (SH.MR.FRM.05)
2. Doctor views waiting patients → completes radiology assessment (SH.MR.FRM.04)
3. Visit status updates to "completed"

**Database Initialization**:
```bash
node init-db.js  # Creates tables, inserts sample users/data
npm start        # Production server
npm run dev      # Development with nodemon
```

**Testing**: Playwright configured for E2E tests (`@playwright/test` in devDependencies)

## Project-Specific Patterns

**Database Design**:
- SSN (14-digit) as patient primary key
- UUIDs stored as TEXT fields in SQLite
- Complex healthcare forms with conditional logic (Morse fall scale varies by age)
- Form submissions with draft/submitted/approved status workflow

**Age Calculation**: Auto-calculated from SSN for fall risk assessment:
- Child: < 18 years
- Adult: 18-64 years
- Elderly: ≥ 65 years

**SQL Query Patterns**:
```sql
-- Complex joins for dashboard data
SELECT pv.visit_id, p.full_name as patient_name, na.assessment_id,
       fs.submission_status = 'draft' as is_draft
FROM patient_visits pv
JOIN patients p ON pv.patient_ssn = p.ssn
LEFT JOIN form_submissions fs ON fs.visit_id = pv.visit_id
LEFT JOIN nursing_assessments na ON na.submission_id = fs.submission_id
```

**Routing Structure**:
- Role-based middleware: `requireRole('nurse')`
- Modular routes: `nurseRoutes(app, db, requireAuth, requireRole)`
- Query parameter notifications: `?notification=success&message=Saved`

**Form Validation**:
- Client-side: `/public/js/form-validation.js`
- Server-side: Express route validation with database constraints
- Healthcare-specific validations (vital signs ranges, SSN format)

## Key Files & Directories

**Essential Reading**:
- `docs/schema.sql`: Database structure and relationships
- `docs/workflow.md`: Business logic and user scenarios
- `init-db.js`: Sample data and initialization patterns
- `server.js`: Authentication and routing setup

**Form Examples**:
- `srv/views/nurse-form.ejs`: Complex healthcare assessment form
- `srv/views/radiology-form.ejs`: Medical imaging documentation
- `srv/views/nurse-dashboard.ejs`: Role-specific dashboard with patient lists

**Styling**: `public/css/custom.css` extends Bootstrap 5 for healthcare UI

## Development Conventions

**Code Organization**:
- Server logic in `srv/` directory
- Views follow `{role}-{function}.ejs` naming
- Static assets in `public/` with subdirectories
- Documentation in `docs/` with SQL schema

**Database Patterns**:
- Foreign key relationships with CASCADE deletes
- JSON fields for complex assessments (fall risk scales)
- Audit fields: `created_by`, `assessed_by`, timestamps
- Status enums: `visit_status`, `submission_status`

**Security**: Session-based auth with role checking on all routes

**Error Handling**: Console logging with user-friendly flash messages

## Common Tasks

**Adding New Assessment Fields**:
1. Update `docs/schema.sql` table definition
2. Modify corresponding EJS form template
3. Update route handler in role-specific JS file
4. Test with sample data via `init-db.js`

**User Role Changes**: Update session checks and navigation in affected routes

**Database Queries**: Always join with patients table for user-friendly display names</content>
<parameter name="filePath">c:\Users\Mohamed\Desktop\sho\.github\copilot-instructions.md