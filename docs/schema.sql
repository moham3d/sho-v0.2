-- SQLite version of the radiology management schema
-- Adapted from schema1.sql

-- Patients table (SSN as primary identifier)
CREATE TABLE IF NOT EXISTS patients (
    ssn TEXT PRIMARY KEY, -- Social Security Number as primary key
    mobile_number TEXT NOT NULL,
    phone_number TEXT, -- Additional phone number (landline, work, etc.)
    medical_number TEXT UNIQUE, -- Hospital/Medical record number if exists
    full_name TEXT NOT NULL,
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    address TEXT, -- Patient address
    emergency_contact_name TEXT, -- Emergency contact information
    emergency_contact_phone TEXT,
    emergency_contact_relation TEXT, -- Relationship to patient
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT, -- Reference to user who created the record
    is_active INTEGER DEFAULT 1
);

-- User management for nurses and radiologists
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY, -- Using TEXT for UUID
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('nurse', 'radiologist', 'admin')),
    password_hash TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- Patient visits
CREATE TABLE IF NOT EXISTS patient_visits (
    visit_id TEXT PRIMARY KEY, -- Using TEXT for UUID
    patient_ssn TEXT NOT NULL REFERENCES patients(ssn) ON DELETE CASCADE,
    visit_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    visit_status TEXT DEFAULT 'open' CHECK (visit_status IN ('open', 'in_progress', 'completed', 'cancelled')),
    primary_diagnosis TEXT, -- التشخيص الأساسي
    secondary_diagnosis TEXT, -- التشخيص الثانوي
    diagnosis_code TEXT, -- ICD-10 or other coding system
    visit_type TEXT DEFAULT 'outpatient' CHECK (visit_type IN ('outpatient', 'inpatient', 'emergency', 'consultation')),
    department TEXT, -- Department/Unit
    created_by TEXT NOT NULL REFERENCES users(user_id), -- Nurse who created the visit
    assigned_radiologist TEXT REFERENCES users(user_id), -- Radiologist assigned to the visit
    completed_at DATETIME,
    notes TEXT,
    document_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Form definitions (SH.MR.FRM.05, SH.MR.FRM.04, etc.)
CREATE TABLE IF NOT EXISTS form_definitions (
    form_id TEXT PRIMARY KEY, -- Using TEXT for UUID
    form_code TEXT UNIQUE NOT NULL, -- e.g., 'SH.MR.FRM.05'
    form_name TEXT NOT NULL,
    form_version TEXT NOT NULL,
    form_description TEXT,
    form_role TEXT NOT NULL CHECK (form_role IN ('nurse', 'radiologist', 'both')),
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Form submissions for each visit
CREATE TABLE IF NOT EXISTS form_submissions (
    submission_id TEXT PRIMARY KEY, -- Using TEXT for UUID
    visit_id TEXT NOT NULL REFERENCES patient_visits(visit_id) ON DELETE CASCADE,
    form_id TEXT NOT NULL REFERENCES form_definitions(form_id),
    submitted_by TEXT NOT NULL REFERENCES users(user_id),
    submission_status TEXT DEFAULT 'draft' CHECK (submission_status IN ('draft', 'submitted', 'approved', 'rejected')),
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_by TEXT REFERENCES users(user_id),
    approved_at DATETIME,
    UNIQUE(visit_id, form_id) -- One submission per form per visit
);

-- Nursing assessments
CREATE TABLE IF NOT EXISTS nursing_assessments (
    assessment_id TEXT PRIMARY KEY, -- Using TEXT for UUID
    submission_id TEXT NOT NULL REFERENCES form_submissions(submission_id) ON DELETE CASCADE,

    -- Basic assessment info
    mode_of_arrival TEXT, -- Mode of arrival
    arrival_other_desc TEXT, -- Other arrival description
    age INTEGER CHECK (age IS NULL OR (age >= 0 AND age <= 150)),
    chief_complaint TEXT, -- Chief complaint
    accompanied_by TEXT, -- Accompanied by
    language_spoken TEXT DEFAULT 'arabic', -- Language spoken
    language_other_desc TEXT, -- Other language description

    -- Vital signs
    temperature_celsius REAL CHECK (temperature_celsius IS NULL OR (temperature_celsius >= 30.0 AND temperature_celsius <= 45.0)),
    pulse_bpm INTEGER CHECK (pulse_bpm IS NULL OR (pulse_bpm >= 30 AND pulse_bpm <= 200)),
    blood_pressure_systolic INTEGER CHECK (blood_pressure_systolic IS NULL OR (blood_pressure_systolic >= 70 AND blood_pressure_systolic <= 250)),
    blood_pressure_diastolic INTEGER CHECK (blood_pressure_diastolic IS NULL OR (blood_pressure_diastolic >= 40 AND blood_pressure_diastolic <= 150)),
    respiratory_rate_per_min INTEGER CHECK (respiratory_rate_per_min IS NULL OR (respiratory_rate_per_min >= 8 AND respiratory_rate_per_min <= 60)),
    oxygen_saturation_percent REAL CHECK (oxygen_saturation_percent IS NULL OR (oxygen_saturation_percent >= 70.0 AND oxygen_saturation_percent <= 100.0)),
    blood_sugar_mg_dl INTEGER CHECK (blood_sugar_mg_dl IS NULL OR blood_sugar_mg_dl >= 0),
    weight_kg REAL CHECK (weight_kg IS NULL OR (weight_kg > 0 AND weight_kg <= 500)),
    height_cm REAL CHECK (height_cm IS NULL OR (height_cm > 0 AND height_cm <= 300)),

    -- General assessment
    general_condition TEXT,
    consciousness_level TEXT,
    skin_condition TEXT,
    mobility_status TEXT,

    -- Psychosocial history
    psychological_problem TEXT CHECK (psychological_problem IN ('none', 'depressed', 'agitated', 'anxious', 'isolated', 'confused', 'other')),
    psychological_other_desc TEXT,
    is_smoker INTEGER DEFAULT 0,
    has_allergies INTEGER DEFAULT 0,
    medication_allergies TEXT,
    food_allergies TEXT,
    other_allergies TEXT,

    -- Nutritional screening
    diet_type TEXT DEFAULT 'regular' CHECK (diet_type IN ('regular', 'special')),
    special_diet_desc TEXT,
    appetite TEXT CHECK (appetite IN ('good', 'poor')),
    has_git_problems INTEGER DEFAULT 0,
    git_problems_desc TEXT,
    has_weight_loss INTEGER DEFAULT 0,
    has_weight_gain INTEGER DEFAULT 0,
    refer_to_nutritionist INTEGER DEFAULT 0,

    -- Functional assessment
    feeding_status TEXT CHECK (feeding_status IN ('independent', 'needs_supervision', 'totally_dependent')),
    hygiene_status TEXT CHECK (hygiene_status IN ('independent', 'needs_supervision', 'totally_dependent')),
    toileting_status TEXT CHECK (toileting_status IN ('independent', 'needs_supervision', 'totally_dependent')),
    ambulation_status TEXT CHECK (ambulation_status IN ('independent', 'needs_supervision', 'totally_dependent')),
    has_musculoskeletal_problems INTEGER DEFAULT 0,
    has_deformities INTEGER DEFAULT 0,
    has_contractures INTEGER DEFAULT 0,
    is_amputee INTEGER DEFAULT 0,
    is_bedridden INTEGER DEFAULT 0,
    has_musculoskeletal_pain INTEGER DEFAULT 0,
    uses_walker INTEGER DEFAULT 0,
    uses_wheelchair INTEGER DEFAULT 0,
    uses_transfer_device INTEGER DEFAULT 0,
    uses_raised_toilet_seat INTEGER DEFAULT 0,
    uses_other_equipment INTEGER DEFAULT 0,
    other_equipment_desc TEXT,

    -- Pain assessment
    pain_intensity INTEGER CHECK (pain_intensity IS NULL OR pain_intensity BETWEEN 0 AND 10),
    pain_location TEXT,
    pain_frequency TEXT,
    pain_duration TEXT,
    pain_character TEXT,
    action_taken TEXT,

    -- Fall risk assessment (Morse Scale) - Updated for new implementation
    fall_history_3months INTEGER DEFAULT 0,
    secondary_diagnosis INTEGER DEFAULT 0,
    ambulatory_aid TEXT CHECK (ambulatory_aid IN ('none', 'bed_rest_chair', 'crutches_walker', 'furniture')),
    iv_therapy INTEGER DEFAULT 0,
    gait_status TEXT CHECK (gait_status IN ('normal', 'weak', 'impaired')),
    mental_status TEXT CHECK (mental_status IN ('oriented', 'forgets_limitations', 'unaware')),
    morse_total_score INTEGER,
    morse_risk_level TEXT,

    -- New comprehensive fall risk assessments (JSON format)
    morse_scale TEXT, -- JSON: {history_falling, secondary_diagnosis, ambulatory_aid, iv_therapy, gait, mental_status, total_score, risk_level}
    pediatric_fall_risk TEXT, -- JSON: {developmental_stage, activity_level, medication_use, environmental_factors, previous_falls, cognitive_factors, total_score, risk_level}
    elderly_assessment TEXT, -- JSON: {orientation, memory, bathing, dressing, toileting, medication_count, high_risk_meds, falls, incontinence, delirium, living_situation, social_support, total_score, risk_level}

    -- Pediatric fall risk (Humpty Dumpty Scale)
    age_score INTEGER,
    gender_score INTEGER,
    diagnosis_score INTEGER,
    cognitive_score INTEGER,
    environmental_score INTEGER,
    surgery_anesthesia_score INTEGER,
    medication_score INTEGER,
    humpty_total_score INTEGER,

    -- Educational needs
    needs_medication_education INTEGER DEFAULT 0,
    needs_diet_nutrition_education INTEGER DEFAULT 0,
    needs_medical_equipment_education INTEGER DEFAULT 0,
    needs_rehabilitation_education INTEGER DEFAULT 0,
    needs_drug_interaction_education INTEGER DEFAULT 0,
    needs_pain_symptom_education INTEGER DEFAULT 0,
    needs_fall_prevention_education INTEGER DEFAULT 0,
    other_needs INTEGER DEFAULT 0,
    other_needs_desc TEXT,
    
    -- Elderly assessment
    daily_activities TEXT CHECK (daily_activities IN ('independent', 'needs_help', 'dependent')),
    cognitive_assessment TEXT CHECK (cognitive_assessment IN ('normal', 'mild_delirium', 'moderate_delirium', 'severe_delirium')),
    mood_assessment TEXT CHECK (mood_assessment IN ('depressed', 'not_depressed')),
    speech_disorder INTEGER DEFAULT 0,
    hearing_disorder INTEGER DEFAULT 0,
    vision_disorder INTEGER DEFAULT 0,
    sleep_disorder INTEGER DEFAULT 0,

    -- Disabled patients assessment
    disability_type TEXT CHECK (disability_type IN ('hearing', 'visual', 'mobility', 'other')),
    disability_other_desc TEXT,
    has_assistive_devices INTEGER DEFAULT 0,
    assistive_devices_desc TEXT,

    -- Abuse and neglect screening
    has_signs_of_abuse INTEGER DEFAULT 0,
    abuse_description TEXT,
    reported_to_authorities INTEGER DEFAULT 0,
    reporting_date DATETIME,

    -- Audit fields
    nurse_signature_id TEXT REFERENCES user_signatures(signature_id), -- Reference to user's signature
    assessed_by TEXT NOT NULL REFERENCES users(user_id),
        assessed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Radiology examination form (SH.MR.FRM.03)
CREATE TABLE IF NOT EXISTS radiology_examination_form (
    -- Primary Key (UUID stored as TEXT in SQLite)
    id TEXT PRIMARY KEY,

    -- Foreign Keys (adapted for SQLite schema)
    patient_id TEXT REFERENCES patients(ssn) ON DELETE CASCADE,
    visit_id TEXT REFERENCES patient_visits(visit_id) ON DELETE CASCADE,
    created_by TEXT REFERENCES users(user_id),

    -- Form Type
    form_type TEXT CHECK (form_type IN ('xray', 'ct', 'mri')) NOT NULL,
    examination_date DATE,

    -- Technical Parameters (at top of form)
    ctd1vol TEXT,
    dlp TEXT,
    kv TEXT,
    mas TEXT,

    -- Patient Complaint (شكوى المريض)
    patient_complaint TEXT NOT NULL,

    -- Gypsum Splint (هل يوجد جبيرة جبس بمكان عمل الأشعة)
    has_gypsum_splint INTEGER DEFAULT 0,
    gypsum_splint_details TEXT,
    gypsum_splint_note TEXT DEFAULT 'في حالة وجود جبيرة البد من احضار صور الأشعة قبل تركيب الجبيره',

    -- Chronic Diseases (هل تعاني من أي أمراض مزمنة)
    has_chronic_disease INTEGER DEFAULT 0,
    chronic_disease_details TEXT,

    -- Current Medications (هل يتم تناول أدوية حاليا اذكرها)
    current_medications TEXT,

    -- Allergies (هل تعاني من أي حساسية)
    has_allergy INTEGER DEFAULT 0,
    allergy_medication INTEGER DEFAULT 0,
    allergy_medication_details TEXT,
    allergy_food INTEGER DEFAULT 0,
    allergy_food_details TEXT,
    allergy_others INTEGER DEFAULT 0,
    allergy_others_details TEXT,

    -- Previous Operations (هل أجريت أي عمليات)
    has_previous_operations INTEGER DEFAULT 0,
    operation_details TEXT,
    operation_date DATE,
    operation_reason TEXT,

    -- Tumor History (هل يوجد تاريخ مرضى لأي أورام)
    has_tumor_history INTEGER DEFAULT 0,
    tumor_location TEXT,
    tumor_type TEXT,

    -- Swelling (هل تعاني من أي تورم)
    has_swelling INTEGER DEFAULT 0,
    swelling_location TEXT,

    -- Previous Investigations (هل أجريت أي فحوصات أشعة سابقة)
    has_previous_investigations INTEGER DEFAULT 0,
    previous_investigation_type TEXT,
    previous_investigation_date DATE,

    -- Fall Risk Medications (هل يتم تناول ادوية تسبب نعاس أو دوار أو عدم اتزان)
    has_fall_risk_medications INTEGER DEFAULT 0,
    fall_risk_medication_details TEXT,

    -- Fever (هل تعاني من ارتفاع درجة الحرارة)
    has_fever INTEGER DEFAULT 0,

    -- For Women - Pregnancy (بالنسبة للسيدات: هل يوجد حمل)
    is_pregnant INTEGER DEFAULT 0,

    -- For Women - Lactation (بالنسبة للسيدات: هل يوجد رضاعة)
    is_lactating INTEGER DEFAULT 0,

    -- Medical Devices and Implants
    -- Pacemaker (هل تم تركيب جهاز منظم لضربات القلب)
    has_pacemaker INTEGER DEFAULT 0,

    -- Cochlear Implant, Aneurysmal Clips, Intraocular Foreign Body
    -- (هل يوجد زراعة القوقعة، مشابك الأوعية الدموية، جسم غريب داخل العين)
    has_cochlear_implant INTEGER DEFAULT 0,
    has_aneurysmal_clips INTEGER DEFAULT 0,
    has_intraocular_foreign_body INTEGER DEFAULT 0,
    implant_details TEXT,

    -- Slats/Screws/Artificial Joints (هل تم تركيب شرائح-مسامير-مفاصل صناعية)
    has_surgical_implants INTEGER DEFAULT 0,
    surgical_implant_details TEXT,

    -- Critical Results Section (في حالة وجود نتيجة حرجة)
    has_critical_result INTEGER DEFAULT 0,
    critical_result_details TEXT,
    critical_result_notified INTEGER DEFAULT 0,
    critical_result_notified_to TEXT, -- Doctor/Patient/Family
    critical_result_recorded_in_book INTEGER DEFAULT 0,

    -- Digital Signatures
    patient_signature TEXT, -- Base64 encoded signature
    radiologist_signature_id TEXT REFERENCES user_signatures(signature_id), -- Foreign key to user signatures

    -- Form Metadata
    form_status TEXT DEFAULT 'draft' CHECK (form_status IN ('draft', 'completed', 'reviewed', 'finalized')),

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    reviewed_at DATETIME,
    reviewed_by TEXT REFERENCES users(user_id),

    -- Audit Trail
    last_modified_by TEXT REFERENCES users(user_id),
    version INTEGER DEFAULT 1,

    -- Notes
    additional_notes TEXT,
    radiologist_notes TEXT,
    technician_notes TEXT
);

-- PET CT Medical Form Table (SH.MR.FRM.06)
CREATE TABLE IF NOT EXISTS pet_ct_records (
    -- Primary Key (UUID stored as TEXT in SQLite)
    record_id TEXT PRIMARY KEY,

    -- Foreign Keys (adapted for radiology management system)
    patient_id TEXT REFERENCES patients(ssn) ON DELETE CASCADE,
    visit_id TEXT REFERENCES patient_visits(visit_id) ON DELETE CASCADE,
    created_by TEXT REFERENCES users(user_id),

    -- Basic Patient Information
    facility TEXT,
    treating_physician TEXT,

    -- Patient Vitals and Pre-scan Info
    fasting_hours INTEGER,
    diabetic_patient TEXT CHECK(diabetic_patient IN ('Yes', 'No', 'نعم', 'لا')),
    blood_sugar_level REAL,
    weight_kg REAL,
    height_cm REAL,

    -- Injection Details
    dose TEXT,
    injection_site TEXT,
    injection_time TEXT,
    preparation_time TEXT,

    -- CT Dosimetry
    ctdivol REAL,
    dlp REAL,

    -- Contrast and Kidney Function
    contrast_used TEXT CHECK(contrast_used IN ('Yes', 'No', 'بالصبغة', 'بدون صبغة')),
    kidney_function_urea REAL,
    kidney_function_creatinine REAL,
    exam_date DATE,

    -- Study Type
    first_time_exam TEXT CHECK(first_time_exam IN ('Yes', 'No', 'نعم', 'لا')),
    comparison_study TEXT CHECK(comparison_study IN ('Yes', 'No', 'نعم', 'لا')),
    previous_exam_code TEXT,
    previous_report TEXT,
    previous_cd TEXT,
    comparison_date DATE,

    -- Medical History Attachments (Boolean flags)
    has_ultrasound BOOLEAN DEFAULT 0,
    has_xray BOOLEAN DEFAULT 0,
    has_ct BOOLEAN DEFAULT 0,
    has_mammography BOOLEAN DEFAULT 0,
    has_mri BOOLEAN DEFAULT 0,
    has_kidney_scan_dtpa BOOLEAN DEFAULT 0,
    has_bone_scan_mdp BOOLEAN DEFAULT 0,
    has_biopsy BOOLEAN DEFAULT 0,
    has_endoscopy BOOLEAN DEFAULT 0,
    has_surgery BOOLEAN DEFAULT 0,
    other_attachments TEXT,

    -- Contact Information
    patient_signature TEXT,
    phone_number TEXT,

    -- Diagnosis
    tumor_location TEXT, -- Right/Left
    tumor_type TEXT,
    diagnosis_details TEXT,

    -- Reason for Study
    reason_for_study TEXT CHECK(reason_for_study IN ('Follow up', 'Initial assessment', 'Response of therapy', 'متابعة', 'تقييم أولي', 'استجابة للعلاج')),
    reason_details TEXT,

    -- Chemotherapy Information
    chemotherapy TEXT CHECK(chemotherapy IN ('Yes', 'No', 'نعم', 'لا')),
    chemo_type TEXT CHECK(chemo_type IN ('Tablets', 'Infusion', 'أقراص', 'حقن')),
    chemo_details TEXT,
    chemo_sessions_number INTEGER,

    -- Radiotherapy Information
    radiotherapy TEXT CHECK(radiotherapy IN ('Yes', 'No', 'نعم', 'لا')),
    radio_anatomical_site TEXT,
    radio_sessions_number INTEGER,
    radio_last_session_date DATE,

    -- Hormonal Treatment
    hormonal_treatment TEXT CHECK(hormonal_treatment IN ('Yes', 'No', 'نعم', 'لا')),
    hormonal_last_dose_date DATE,

    -- Surgery Information
    surgery_type TEXT,
    last_surgery_date DATE,

    -- Additional Information
    other_notes TEXT,

    -- Administrative
    physician_signature TEXT,
    form_status TEXT DEFAULT 'draft' CHECK (form_status IN ('draft', 'completed', 'reviewed', 'finalized')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    reviewed_at DATETIME,
    reviewed_by TEXT REFERENCES users(user_id),
    last_modified_by TEXT REFERENCES users(user_id),
    version INTEGER DEFAULT 1
);

-- User signatures for reusable signatures across forms
CREATE TABLE IF NOT EXISTS user_signatures (
    signature_id TEXT PRIMARY KEY, -- Using TEXT for UUID
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    signature_data TEXT NOT NULL, -- Base64 encoded signature image
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id) -- One signature per user
);

-- Document upload feature tables
CREATE TABLE IF NOT EXISTS visit_documents (
    document_id TEXT PRIMARY KEY,
    visit_id TEXT NOT NULL,
    patient_ssn TEXT NOT NULL,
    document_type TEXT NOT NULL,
    document_category TEXT,
    file_name TEXT NOT NULL,
    original_file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    uploaded_by TEXT NOT NULL,
    uploaded_by_name TEXT,
    description TEXT,
    tags TEXT,
    is_confidential INTEGER DEFAULT 0,
    requires_signature INTEGER DEFAULT 0,
    signed_by TEXT,
    signed_at DATETIME,
    status TEXT DEFAULT 'active',
    version INTEGER DEFAULT 1,
    parent_document_id TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (visit_id) REFERENCES patient_visits(visit_id) ON DELETE CASCADE,
    FOREIGN KEY (patient_ssn) REFERENCES patients(ssn) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (parent_document_id) REFERENCES visit_documents(document_id) ON DELETE SET NULL
);

-- Activity logging for audit trail
CREATE TABLE IF NOT EXISTS activity_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    user_name TEXT,
    action_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    description TEXT,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Audit trail for all changes
CREATE TABLE IF NOT EXISTS audit_log (
    audit_id TEXT PRIMARY KEY, -- Using TEXT for UUID
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values TEXT, -- JSON as TEXT
    new_values TEXT, -- JSON as TEXT
    changed_by TEXT NOT NULL REFERENCES users(user_id),
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT
);

-- Indexes for performance
CREATE INDEX idx_patients_mobile ON patients(mobile_number);
CREATE INDEX idx_patients_phone ON patients(phone_number);
CREATE INDEX idx_patients_medical_number ON patients(medical_number);
CREATE INDEX idx_patients_name ON patients(full_name);
CREATE INDEX idx_visits_patient ON patient_visits(patient_ssn);
CREATE INDEX idx_visits_date ON patient_visits(visit_date);
CREATE INDEX idx_visits_status ON patient_visits(visit_status);
CREATE INDEX idx_visits_radiologist ON patient_visits(assigned_radiologist);
CREATE INDEX idx_visits_diagnosis ON patient_visits(primary_diagnosis);

-- Form submission indexes
CREATE INDEX idx_submissions_visit ON form_submissions(visit_id);
CREATE INDEX idx_submissions_form ON form_submissions(form_id);
CREATE INDEX idx_submissions_status ON form_submissions(submission_status);

-- Assessment indexes
CREATE INDEX idx_nursing_assessment ON nursing_assessments(submission_id);
CREATE INDEX idx_radiology_examination_patient_id ON radiology_examination_form(patient_id);
CREATE INDEX idx_radiology_examination_form_type ON radiology_examination_form(form_type);
CREATE INDEX idx_radiology_examination_created_at ON radiology_examination_form(created_at);
CREATE INDEX idx_radiology_examination_status ON radiology_examination_form(form_status);
CREATE INDEX idx_radiology_examination_critical ON radiology_examination_form(has_critical_result);

-- PET CT indexes
CREATE INDEX idx_pet_ct_patient_id ON pet_ct_records(patient_id);
CREATE INDEX idx_pet_ct_exam_date ON pet_ct_records(exam_date);
CREATE INDEX idx_pet_ct_treating_physician ON pet_ct_records(treating_physician);
CREATE INDEX idx_pet_ct_tumor_type ON pet_ct_records(tumor_type);
CREATE INDEX idx_pet_ct_reason_for_study ON pet_ct_records(reason_for_study);
CREATE INDEX idx_pet_ct_status ON pet_ct_records(form_status);
CREATE INDEX idx_pet_ct_created_at ON pet_ct_records(created_at);

-- Document upload indexes
CREATE INDEX idx_visit_documents_visit ON visit_documents(visit_id);
CREATE INDEX idx_visit_documents_patient ON visit_documents(patient_ssn);
CREATE INDEX idx_visit_documents_type ON visit_documents(document_type);
CREATE INDEX idx_visit_documents_uploader ON visit_documents(uploaded_by);
CREATE INDEX idx_visit_documents_date ON visit_documents(upload_date);
CREATE INDEX idx_visit_documents_status ON visit_documents(status);

-- Activity log indexes
CREATE INDEX idx_activity_log_timestamp ON activity_log(timestamp);
CREATE INDEX idx_activity_log_user ON activity_log(user_id);
CREATE INDEX idx_activity_log_action ON activity_log(action_type);

-- Audit indexes
CREATE INDEX idx_audit_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_user_date ON audit_log(changed_by, changed_at);

-- Triggers for automatic updates (SQLite version)
CREATE TRIGGER update_patients_updated_at AFTER UPDATE ON patients
BEGIN
    UPDATE patients SET updated_at = CURRENT_TIMESTAMP WHERE ssn = NEW.ssn;
END;

CREATE TRIGGER update_visits_updated_at AFTER UPDATE ON patient_visits
BEGIN
    UPDATE patient_visits SET updated_at = CURRENT_TIMESTAMP WHERE visit_id = NEW.visit_id;
END;

-- Trigger for radiology examination form updated_at
CREATE TRIGGER update_radiology_examination_updated_at
    AFTER UPDATE ON radiology_examination_form
BEGIN
    UPDATE radiology_examination_form
    SET updated_at = CURRENT_TIMESTAMP,
        version = version + 1
    WHERE id = NEW.id;
END;

-- Trigger for PET CT records updated_at
CREATE TRIGGER update_pet_ct_updated_at
    AFTER UPDATE ON pet_ct_records
BEGIN
    UPDATE pet_ct_records
    SET updated_at = CURRENT_TIMESTAMP,
        version = version + 1
    WHERE record_id = NEW.record_id;
END;

-- Insert form definitions
INSERT INTO form_definitions (form_id, form_code, form_name, form_version, form_description, form_role) VALUES
('form-05-uuid', 'SH.MR.FRM.05', 'Nursing Screening & Assessment', '1.0', 'Comprehensive nursing assessment and screening form', 'nurse'),
('form-03-uuid', 'SH.MR.FRM.03', 'Radiology Examination Form', '1.0', 'Radiology examination request and safety checklist', 'radiologist'),
('form-06-uuid', 'SH.MR.FRM.06', 'PET CT Medical Form', '1.0', 'PET CT examination and medical history form', 'radiologist');

-- Create a view for easier querying with patient information
CREATE VIEW IF NOT EXISTS radiology_examination_form_view AS
SELECT
    ref.*,
    p.medical_number,
    p.full_name AS patient_name,
    p.mobile_number AS patient_phone,
    p.age AS patient_age,
    p.gender AS patient_gender,
    p.date_of_birth AS patient_birth_date,
    u_created.full_name AS created_by_name,
    u_reviewed.full_name AS reviewed_by_name
FROM radiology_examination_form ref
LEFT JOIN patients p ON ref.patient_id = p.ssn
LEFT JOIN users u_created ON ref.created_by = u_created.user_id
LEFT JOIN users u_reviewed ON ref.reviewed_by = u_reviewed.user_id;

-- Create statistics view
CREATE VIEW IF NOT EXISTS radiology_examination_statistics AS
SELECT
    form_type,
    COUNT(*) AS total_forms,
    COUNT(CASE WHEN form_status = 'completed' THEN 1 END) AS completed_forms,
    COUNT(CASE WHEN form_status = 'draft' THEN 1 END) AS draft_forms,
    COUNT(CASE WHEN has_critical_result = 1 THEN 1 END) AS critical_results,
    COUNT(CASE WHEN has_critical_result = 1 AND critical_result_notified = 0 THEN 1 END) AS unnotified_critical,
    COUNT(CASE WHEN is_pregnant = 1 THEN 1 END) AS pregnant_patients,
    COUNT(CASE WHEN has_pacemaker = 1 THEN 1 END) AS pacemaker_patients,
    COUNT(CASE WHEN has_allergy = 1 THEN 1 END) AS allergy_patients,
    AVG(CASE
        WHEN completed_at IS NOT NULL AND created_at IS NOT NULL
        THEN (julianday(completed_at) - julianday(created_at)) * 1440
        ELSE NULL END) AS avg_completion_time_minutes
FROM radiology_examination_form
GROUP BY form_type;

-- Insert sample data for testing (adapted for SQLite)
INSERT OR IGNORE INTO radiology_examination_form (
    id,
    patient_id,
    created_by,
    form_type,
    patient_complaint,
    has_chronic_disease,
    chronic_disease_details,
    current_medications,
    has_allergy,
    allergy_medication,
    allergy_medication_details,
    has_previous_operations,
    operation_details,
    has_fever,
    is_pregnant,
    has_pacemaker,
    has_surgical_implants,
    surgical_implant_details,
    form_status
) VALUES (
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6))),
    (SELECT ssn FROM patients WHERE medical_number = 'MED-2024-001' LIMIT 1),
    (SELECT user_id FROM users WHERE username = 'admin' LIMIT 1),
    'ct',
    'Chest pain and difficulty breathing',
    1,
    'Hypertension, Type 2 Diabetes',
    'Metformin 500mg twice daily, Lisinopril 10mg once daily',
    1,
    1,
    'Penicillin - causes rash',
    0,
    NULL,
    0,
    0,
    0,
    0,
    NULL,
    'completed'
);
