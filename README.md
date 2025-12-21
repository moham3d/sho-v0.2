# Al-Shorouk Radiology Management System

A comprehensive web-based healthcare management system designed to digitize radiology workflows, replacing paper-based forms with electronic assessments for nurses and physicians at Al-Shorouk Hospital.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Installation & Setup](#installation--setup)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [User Roles & Workflows](#user-roles--workflows)
- [Development Guide](#development-guide)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

The Al-Shorouk Radiology Management System is a Node.js/Express application that streamlines the radiology assessment process in healthcare facilities. The system replaces traditional paper forms (SH.MR.FRM.05 for nursing assessments and SH.MR.FRM.04 for radiology assessments) with digital web forms, ensuring better data management, workflow efficiency, and patient care quality.

### Key Objectives
- **Digital Transformation**: Replace paper-based radiology workflows with electronic forms
- **Role-Based Access**: Secure, role-specific access for nurses, radiologists, and administrators
- **Comprehensive Assessments**: Detailed patient evaluations including vital signs, fall risk assessments, and radiology procedures
- **Audit Trail**: Complete tracking of all patient interactions and form submissions
- **Data Integrity**: Robust validation and error handling for healthcare data

## ✨ Features

### 🏥 Core Healthcare Features
- **Patient Management**: Comprehensive patient records with SSN-based identification
- **Visit Tracking**: Complete patient visit lifecycle management
- **Nursing Assessments**: Detailed initial patient evaluations with automated age calculation and fall risk scoring
- **Radiology Assessments**: Comprehensive imaging procedure documentation and reporting
- **Signature Management**: SVG-based digital signatures for legal compliance

### 👥 User Management
- **Role-Based Access Control**: Admin, Nurse, and Radiologist roles with specific permissions
- **Data Access Layer**: Clean DAO abstraction for database operations
- **Session Management**: Secure authentication with encrypted password storage
- **User Activity Tracking**: Complete audit logs for compliance

### 📊 Data & Analytics
- **Real-time Dashboards**: Role-specific dashboards showing relevant patient information
- **Form Status Tracking**: Draft/submitted/approved workflow for all assessments
- **Search & Filter**: Advanced patient search capabilities
- **Reporting**: Comprehensive reporting tools for administrators

### 🔒 Security & Compliance
- **Data Encryption**: Bcrypt password hashing and secure session management
- **Input Validation**: Comprehensive client and server-side validation
- **Audit Logging**: Complete change tracking for regulatory compliance
- **Access Control**: Strict role-based permissions throughout the application

## 🏗️ Architecture

### Technology Stack
- **Backend**: Node.js with Express.js framework
- **Database**: SQLite with comprehensive schema design
- **Frontend**: EJS templating engine with Bootstrap 5
- **Authentication**: Express sessions with SQLite storage
- **Validation**: Client-side JavaScript and server-side validation
- **Testing**: Playwright for end-to-end testing

### Application Structure
```
├── server.js                 # Main application entry point
├── init-db.js               # Database initialization script
├── package.json             # Dependencies and scripts
├── plan.md                  # Project roadmap and progress
├── docs/
│   ├── schema.sql          # Database schema definition
│   ├── workflow.md         # Business process documentation
│   └── *.pdf               # Original paper forms
├── srv/
│   ├── admin.js            # Admin route handlers (DAO-integrated)
│   ├── nurse.js            # Nurse route handlers (DAO-integrated)
│   ├── radiologist.js      # Radiologist route handlers
│   ├── config/
│   │   └── session.js      # Session configuration (SQLite/Redis)
│   ├── db/
│   │   ├── connection.js   # Database connection wrapper
│   │   ├── database.js     # Singleton DB instance
│   │   └── dao/            # Data Access Objects
│   │       ├── index.js    # DAO factory
│   │       ├── PatientDAO.js
│   │       ├── VisitDAO.js
│   │       ├── UserDAO.js
│   │       └── AssessmentDAO.js
│   ├── middleware/         # Express middleware
│   │   ├── errorHandler.js
│   │   ├── rateLimiter.js
│   │   └── security.js
│   ├── services/
│   │   └── hl7Service.js   # HL7 message processing
│   ├── utils/
│   │   └── dateHelpers.js  # Date/age utilities
│   └── views/              # EJS templates
│       ├── partials/       # Reusable components
│       │   ├── layout-header.ejs
│       │   ├── layout-footer.ejs
│       │   ├── navigation.ejs
│       │   └── nurse-*.ejs # Nurse form partials
│       ├── admin-*.ejs     # Admin interface templates
│       ├── nurse-*.ejs     # Nurse interface templates
│       └── radiologist-*.ejs # Radiologist interface templates
├── public/
│   ├── css/
│   │   ├── custom.css      # Main stylesheet
│   │   ├── theme.css       # Theme variables
│   │   └── accessibility.css # Accessibility utilities
│   └── js/
│       └── form-validation.js # Client-side validation
├── tests/
│   └── smoke.spec.js       # Playwright smoke tests
└── database.db             # SQLite database file
```

### Database Design
The system uses a normalized SQLite database with the following key entities:
- **Patients**: Core patient information with SSN as primary key
- **Users**: Healthcare staff with role-based access
- **Patient Visits**: Visit tracking and status management
- **Form Submissions**: Assessment form lifecycle management
- **Nursing Assessments**: Comprehensive nursing evaluation data
- **Radiology Assessments**: Detailed imaging procedure documentation
- **User Signatures**: Digital signature management
- **Audit Log**: Complete change tracking

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn package manager
- Git (for version control)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sho-radiology-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Initialize the database**
   ```bash
   node init-db.js
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Open your browser to `http://localhost:3000`
   - Login with default credentials:
     - **Admin**: username: `admin`, password: `admin`
     - **Nurse**: username: `nurse`, password: `nurse`
     - **Radiologist**: username: `radiologist`, password: `radiologist`

### Production Setup

1. **Environment Configuration**
   ```bash
   export PORT=3000
   export NODE_ENV=production
   ```

2. **Database Backup**
   ```bash
   # Create backup before deployment
   cp database.db database.backup.db
   ```

3. **Start Production Server**
   ```bash
   npm start
   ```

## 🗄️ Database Schema

### Core Tables

#### Patients Table
```sql
CREATE TABLE patients (
    ssn TEXT PRIMARY KEY,
    mobile_number TEXT NOT NULL,
    phone_number TEXT,
    medical_number TEXT UNIQUE,
    full_name TEXT NOT NULL,
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relation TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    is_active INTEGER DEFAULT 1
);
```

#### User Management
```sql
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('nurse', 'physician', 'admin')),
    password_hash TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);
```

#### Visit Management
```sql
CREATE TABLE patient_visits (
    visit_id TEXT PRIMARY KEY,
    patient_ssn TEXT NOT NULL REFERENCES patients(ssn),
    visit_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    visit_status TEXT DEFAULT 'open' CHECK (visit_status IN ('open', 'in_progress', 'completed', 'cancelled')),
    primary_diagnosis TEXT,
    secondary_diagnosis TEXT,
    diagnosis_code TEXT,
    visit_type TEXT DEFAULT 'outpatient',
    department TEXT,
    created_by TEXT NOT NULL REFERENCES users(user_id),
    assigned_physician TEXT REFERENCES users(user_id),
    completed_at DATETIME,
    notes TEXT
);
```

### Assessment Tables

#### Nursing Assessments
Comprehensive nursing evaluation including:
- Vital signs (temperature, blood pressure, pulse, etc.)
- Fall risk assessment (Morse Scale)
- Pain assessment
- Functional assessment
- Educational needs identification

#### Radiology Assessments
Detailed imaging procedure documentation including:
- Patient preparation information
- Imaging parameters (dose, contrast usage)
- Clinical findings and impressions
- Treatment history
- Previous imaging records

## 📚 API Documentation

### Authentication Endpoints

#### POST /login
Authenticate user and create session
```javascript
// Request body
{
  "username": "nurse",
  "password": "nurse"
}

// Response: Redirect to role-specific dashboard
```

#### POST /logout
Destroy user session and redirect to login

### Nurse Endpoints

#### GET /nurse
Nurse dashboard with current visits and assessments

#### GET /nurse/search-patient
Patient search interface

#### POST /nurse/search-patient
Search for patients by SSN or name
```javascript
// Request body
{
  "searchType": "ssn",
  "searchValue": "123456789"
}
```

#### GET /nurse/assessment/:visitId
Load nursing assessment form for specific visit

#### POST /nurse/assessment/:visitId
Submit nursing assessment
```javascript
// Request body (comprehensive assessment data)
{
  "chiefComplaint": "Cough and fever",
  "temperature": 38.5,
  "bloodPressureSystolic": 120,
  "bloodPressureDiastolic": 80,
  // ... additional assessment fields
}
```

### Radiologist Endpoints

#### GET /radiologist
Radiologist dashboard showing waiting patients

#### GET /radiologist/start-assessment/:visitId
Load radiology assessment form for specific visit

#### POST /radiologist/assessment/:visitId
Submit radiology assessment
```javascript
// Request body (radiology assessment data)
{
  "findings": "Normal chest X-ray",
  "impression": "No acute pathology",
  "recommendations": "Follow up as needed",
  // ... additional radiology fields
}
```

### Admin Endpoints

#### GET /admin
Admin dashboard with system overview

#### GET /admin/users
User management interface

#### POST /admin/users
Create new user
```javascript
// Request body
{
  "username": "newnurse",
  "email": "nurse@hospital.com",
  "fullName": "New Nurse",
  "role": "nurse",
  "password": "password123"
}
```

#### GET /admin/patients
Patient management interface

#### GET /admin/visits
Visit management and oversight

## 👥 User Roles & Workflows

### Role Permissions Matrix

| Feature | Admin | Nurse | Physician |
|---------|-------|-------|-----------|
| User Management | ✅ | ❌ | ❌ |
| Patient Search | ✅ | ✅ | ✅ |
| Create Visits | ❌ | ✅ | ❌ |
| Nursing Assessments | ❌ | ✅ | ❌ |
| Radiology Assessments | ❌ | ❌ | ✅ |
| View All Records | ✅ | ❌ | ❌ |
| System Reports | ✅ | ❌ | ❌ |

### Nurse Workflow

1. **Login** → Redirected to nurse dashboard
2. **Patient Search** → Find existing patient or create new visit
3. **Assessment Form** → Complete comprehensive nursing evaluation
4. **Save Draft** → Save incomplete assessments for later
5. **Submit Assessment** → Finalize and submit for physician review

### Physician Workflow

1. **Login** → Redirected to physician dashboard
2. **Review Waiting Patients** → View patients with completed nursing assessments
3. **Start Assessment** → Begin radiology evaluation for selected patient
4. **Complete Radiology Form** → Document imaging procedure and findings
5. **Submit Assessment** → Finalize radiology report

### Administrator Workflow

1. **Login** → Access to all system functions
2. **User Management** → Create, update, deactivate user accounts
3. **Patient Oversight** → Review patient records and visit history
4. **System Monitoring** → View reports and audit logs
5. **Data Management** → Backup and maintenance operations

## 💻 Development Guide

### Code Organization

#### Server Structure (`server.js`)
- Express application setup
- Middleware configuration
- Authentication middleware
- Route mounting
- Database connection

#### Route Handlers
- **nurse.js**: All nurse-specific routes and business logic
- **admin.js**: Administrative functions and user management
- **doctor.js**: Physician assessment routes and radiology logic

#### Views (EJS Templates)
- **Role-specific dashboards**: `nurse-dashboard.ejs`, `doctor-dashboard.ejs`, `admin.ejs`
- **Form templates**: `nurse-form.ejs`, `radiology-form.ejs`
- **Shared components**: `navigation.ejs`, `login.ejs`

### Development Workflow

1. **Feature Development**
   ```bash
   # Create feature branch
   git checkout -b feature/new-assessment-field

   # Make changes
   # Test locally
   npm run dev

   # Run tests
   npx playwright test
   ```

2. **Database Changes**
   ```bash
   # Update schema.sql
   # Modify init-db.js if needed
   # Test with fresh database
   rm database.db && node init-db.js
   ```

3. **Code Standards**
   - Use async/await for database operations
   - Implement proper error handling
   - Add input validation for all forms
   - Follow consistent naming conventions
   - Add comments for complex business logic

### Key Development Patterns

#### Database Operations (Using DAOs)
```javascript
// Preferred pattern: Use DAO layer with async/await
const { createDAOs } = require('./db/dao');
const daos = createDAOs(db);

// In route handlers
app.get('/example', async (req, res) => {
    try {
        const patients = await daos.patients.findBySSN(ssn);
        const visits = await daos.visits.findActiveForNurse(nurseId);
        res.render('page', { patients, visits });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).send('Database error');
    }
});
```

#### Form Validation
```javascript
// Client-side validation
function validateForm() {
    const requiredFields = ['field1', 'field2'];
    let isValid = true;

    requiredFields.forEach(field => {
        const element = document.getElementById(field);
        if (!element.value.trim()) {
            element.classList.add('is-invalid');
            isValid = false;
        }
    });

    return isValid;
}
```

#### Session Management
```javascript
// Check authentication
function requireAuth(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login');
}

// Check role permissions
function requireRole(role) {
    return function(req, res, next) {
        if (req.session.role === role) {
            return next();
        }
        res.status(403).send('Access denied');
    };
}
```

## 🧪 Testing

### Test Setup
The project uses Playwright for end-to-end testing:

```bash
# Install Playwright browsers
npx playwright install

# Run all tests
npx playwright test

# Run tests in headed mode (visible browser)
npx playwright test --headed

# Run specific test file
npx playwright test tests/nurse-workflow.spec.js
```

### Test Structure
```
tests/
├── nurse-workflow.spec.js     # Nurse assessment workflow tests
├── physician-workflow.spec.js # Physician radiology workflow tests
├── admin-functions.spec.js    # Administrative function tests
└── integration.spec.js        # Full workflow integration tests
```

### Manual Testing Checklist

#### Nurse Workflow Testing
- [ ] Login as nurse
- [ ] Search for existing patient
- [ ] Create new patient visit
- [ ] Complete nursing assessment form
- [ ] Save draft and resume later
- [ ] Submit completed assessment
- [ ] Verify data persistence

#### Physician Workflow Testing
- [ ] Login as physician
- [ ] View waiting patients list
- [ ] Start radiology assessment
- [ ] Complete radiology form
- [ ] Submit assessment
- [ ] Verify visit completion

#### Admin Testing
- [ ] User creation and management
- [ ] Patient record access
- [ ] System reports generation
- [ ] Data backup procedures

## 🚢 Deployment

### Production Requirements
- Node.js 14+
- SQLite 3
- Web server (nginx recommended)
- SSL certificate for HTTPS
- Regular backup solution

### Deployment Steps

1. **Server Preparation**
   ```bash
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # Create application directory
   sudo mkdir -p /var/www/radiology-system
   sudo chown -R $USER:$USER /var/www/radiology-system
   ```

2. **Application Deployment**
   ```bash
   # Clone repository
   git clone <repository-url> /var/www/radiology-system
   cd /var/www/radiology-system

   # Install dependencies
   npm ci --production

   # Initialize database
   node init-db.js
   ```

3. **Process Management (PM2)**
   ```bash
   # Install PM2
   sudo npm install -g pm2

   # Create ecosystem file
   cat > ecosystem.config.js << EOF
   module.exports = {
     apps: [{
       name: 'radiology-system',
       script: 'server.js',
       instances: 1,
       exec_mode: 'fork',
       env: {
         NODE_ENV: 'production',
         PORT: 3000
       }
     }]
   }
   EOF

   # Start application
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

4. **Web Server Configuration (nginx)**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

5. **SSL Configuration**
   ```bash
   # Install certbot
   sudo apt install certbot python3-certbot-nginx

   # Get SSL certificate
   sudo certbot --nginx -d your-domain.com
   ```

### Backup Strategy

#### Database Backup
```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
sqlite3 /var/www/radiology-system/database.db ".backup '/var/backups/radiology_$DATE.db'"
find /var/backups -name "radiology_*.db" -mtime +30 -delete
```

#### Automated Backup (cron)
```bash
# Add to crontab
crontab -e
# Add: 0 2 * * * /path/to/backup-script.sh
```

### Monitoring & Maintenance

#### Health Checks
```bash
# PM2 monitoring
pm2 monit

# Application logs
pm2 logs radiology-system

# System resources
htop
df -h
```

#### Log Rotation
```bash
# Configure logrotate
cat > /etc/logrotate.d/radiology-system << EOF
/var/www/radiology-system/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
}
EOF
```

## 🤝 Contributing

### Development Process

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Add tests for new functionality**
5. **Ensure all tests pass**
   ```bash
   npx playwright test
   ```
6. **Update documentation if needed**
7. **Commit your changes**
   ```bash
   git commit -am 'Add new feature'
   ```
8. **Push to your branch**
   ```bash
   git push origin feature/your-feature-name
   ```
9. **Create a Pull Request**

### Code Review Guidelines

- **Security**: Ensure no sensitive data exposure
- **Performance**: Optimize database queries
- **Accessibility**: Maintain WCAG compliance
- **Testing**: Include appropriate test coverage
- **Documentation**: Update docs for API changes

### Commit Message Format
```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Testing
- `chore`: Maintenance

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:
- **Issues**: GitHub Issues
- **Documentation**: This README and `/docs` folder
- **Email**: [support@al-shorouk-hospital.com](mailto:support@al-shorouk-hospital.com)

## 🔄 Version History

### v1.0.0 (Current)
- Initial release with core radiology workflow
- Role-based access control
- Comprehensive assessment forms
- SQLite database backend
- Bootstrap 5 UI
- Playwright testing framework

### Planned Features
- [ ] Multi-language support
- [ ] Advanced reporting dashboard
- [ ] Mobile application
- [ ] Integration with hospital information systems
- [ ] Automated backup and recovery
- [ ] Real-time notifications

---

**Al-Shorouk Radiology Management System** - Digitizing Healthcare, One Assessment at a Time</content>
<parameter name="filePath">c:\Users\Mohamed\Desktop\sho\README.md