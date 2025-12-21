**App objectives:**
- Digitalize radiology workflow by replacing paper forms (radiologist_form.pdf and nurse_form.pdf) with web forms.
- Integrate with HL7 messaging system for automatic patient and visit creation from ADT and ORM messages.

**Admin scenarios:**
- User management: create, update, delete users.
- Patient management: update, view patient records.
- Patient records: view patient history, allergies, medications.
- Visit oversight: manage patient visits, track status.
- Reports: generate user activity and patient visit reports.

**Nurse scenarios:**
- View HL7-created visits: see new patient visits automatically created from HL7 messages.
- Patient assessments: conduct initial patient evaluations on HL7-received visits.
- Form submissions: submit patient information and assessments.
- Form calculates age from SSN and auto-fills current date and decides the Morse Fall Scale if child, age < 18, adult >= 18 or elderly >= 65.


**Radiologist scenarios:**
- Dashboard: view waiting patients (Nursing assessment complete) from HL7-initiated visits.
- Start radiology assessment: perform radiology assessment for patients after nursing assessment is complete.
- Form selection per case: radiologists may choose which assessment form to use per patient case — either the standard Radiology Examination Form (SH.MR.FRM.03) or the new PET CT Medical Form (SH.MR.FRM.06). The dashboard includes an intelligent recommendation ("Recommended: PET CT") for oncology-related visits and a form-selection modal so the radiologist can pick the appropriate form.
- Fill radiology form or PET CT form: complete and submit radiology assessments (SH.MR.FRM.03) or PET CT assessments (SH.MR.FRM.06).

**Visit workflow:**
1. HL7 ADT and ORM messages received → Patient and visit automatically created with all received data.
2. Nurse sees new HL7-created visit and starts nursing assessment (SH.MR.FRM.05).
3. Nurse completes initial patient assessment.
4. Radiologist sees completed nursing assessment and starts the assessment. The dashboard will display a recommended form (e.g., PET CT for oncology/tumor flags) and a modal lets the radiologist choose which form to start for the visit.
5. Radiologist fills out and submits the chosen form:
   - Radiology Examination Form (SH.MR.FRM.03) submitted via POST /submit-radiology-form — submission stores the radiology_examination_form record and (by default) marks the visit as completed.
   - PET CT Medical Form (SH.MR.FRM.06) submitted via POST /submit-pet-scan-form — submission stores a pet_ct_records entry and creates a form_submissions entry (form-06-uuid); visit status is updated to 'in_progress' or 'completed' depending on the submitted form_status.
6. Visit marked as complete once the radiology assessment (or PET CT) is finalized and submitted with a completed status.

**Notes:**

- HL7 ADT and ORM messages automatically create patients and visits with all received data.
- Users signatures saved in svg format and can be applied to forms; both radiologist and patient signatures are required for submission flows.
- Radiologist sees only current visits that have nursing assessment complete to start radiology or PET CT assessments.
- The dashboard includes an intelligent recommendation for PET CT when oncology indicators are present (e.g., nursing notes with "tumor"/"cancer", patient diagnosis codes beginning with 'C', or explicit tumor history).
- A form-selection modal on the radiologist dashboard lets the radiologist pick the correct form for each visit (routes: /radiologist/start-assessment/:visitId → radiology form, /radiologist/start-pet-scan/:visitId → PET CT form).
- Compact visit reports are available (template: `srv/views/visit-print-compact.ejs`) and render concise printable summaries for both Radiology (SH.MR.FRM.03) and PET CT (SH.MR.FRM.06) records. The admin print route will prefer radiology_examination_form records and fall back to pet_ct_records when a PET CT record exists; the template adapts based on a `form_source` indicator.
- Submission handlers:
  - /submit-radiology-form — inserts into `radiology_examination_form`, saves signatures, and updates `patient_visits.visit_status` to 'completed' on successful submission.
  - /submit-pet-scan-form — inserts into `pet_ct_records`, creates a `form_submissions` entry (form-06-uuid), saves signatures, and updates `patient_visits.visit_status` according to the form_status ('completed' or 'in_progress').
- The radiologist dashboard includes UI affordances (badges and a modal) to recommend and select the appropriate form; developers should keep the recommendation SQL logic and the modal selection in sync if the recommendation rules change.