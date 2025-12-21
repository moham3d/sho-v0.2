-- PET CT Medical Form Table
CREATE TABLE pet_ct_records (
    -- Primary Key
    record_id INTEGER PRIMARY KEY AUTOINCREMENT,
    
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries
CREATE INDEX idx_exam_date ON pet_ct_records(exam_date);
CREATE INDEX idx_treating_physician ON pet_ct_records(treating_physician);
CREATE INDEX idx_tumor_type ON pet_ct_records(tumor_type);
CREATE INDEX idx_reason_for_study ON pet_ct_records(reason_for_study);

-- Trigger to update the updated_at timestamp
CREATE TRIGGER update_pet_ct_timestamp 
AFTER UPDATE ON pet_ct_records
BEGIN
    UPDATE pet_ct_records 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE record_id = NEW.record_id;
END;
