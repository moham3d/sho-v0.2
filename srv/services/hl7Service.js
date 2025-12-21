const net = require('net');
const uuid = require('uuid');
const fs = require('fs');
const hl7 = require('simple-hl7');

/**
 * HL7 Service for Al-Shorouk Radiology System
 * Uses simple-hl7 library for robust message parsing
 */

/**
 * Map HL7 gender codes to database values
 */
function mapGender(hl7Gender) {
    if (!hl7Gender) return null;
    switch (hl7Gender.toUpperCase()) {
        case 'M': return 'male';
        case 'F': return 'female';
        case 'O':
        case 'U':
        default: return 'other';
    }
}

/**
 * Parse patient name from HL7 format (LAST^FIRST^MIDDLE)
 */
function parsePatientName(nameField) {
    if (!nameField) return '';
    // Handle both string and object formats from simple-hl7
    if (typeof nameField === 'object') {
        const lastName = nameField[1] || nameField.familyName || '';
        const firstName = nameField[2] || nameField.givenName || '';
        return `${lastName} ${firstName}`.trim();
    }
    const parts = nameField.split('^');
    return `${parts[0] || ''} ${parts[1] || ''}`.trim();
}

/**
 * Get field value from segment, handling simple-hl7 format
 */
function getField(segment, fieldIndex, componentIndex = 0) {
    if (!segment) return '';
    const field = segment.fields[fieldIndex];
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (Array.isArray(field)) {
        return componentIndex > 0 ? (field[componentIndex - 1] || '') : field[0] || '';
    }
    if (typeof field === 'object') {
        return Object.values(field)[componentIndex] || '';
    }
    return String(field);
}

/**
 * Handle ADT Patient Messages (A01/A08)
 */
function handleADTPatient(message, db) {
    try {
        const pid = message.getSegment('PID');
        if (!pid) {
            console.error('No PID segment found in ADT message');
            return;
        }

        // Extract patient data from PID segment
        const ssn = getField(pid, 3); // PID.3 - Patient ID
        const patientName = getField(pid, 5); // PID.5 - Patient Name
        const dob = getField(pid, 7); // PID.7 - Date of Birth
        const gender = getField(pid, 8); // PID.8 - Gender
        const address = getField(pid, 11); // PID.11 - Address

        // Parse patient name
        const fullName = parsePatientName(pid.fields[5]);
        const dbGender = mapGender(gender);

        // Validate SSN (14-digit Egyptian SSN)
        if (!ssn || ssn.length !== 14) {
            console.error('Invalid SSN format:', ssn, '(expected 14 digits)');
            return;
        }

        console.log(`[HL7] Processing ADT patient: ${fullName} (SSN: ${ssn})`);

        // Insert or update patient
        db.run(`
            INSERT OR REPLACE INTO patients (ssn, mobile_number, full_name, date_of_birth, gender, address)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [ssn, 'N/A', fullName, dob, dbGender, address], (err) => {
            if (err) {
                console.error('[HL7] Error updating patient:', err.message);
            } else {
                console.log('[HL7] Patient updated successfully:', ssn);
            }
        });
    } catch (err) {
        console.error('[HL7] Error handling ADT message:', err.message);
    }
}

/**
 * Handle ORM Order Messages (O01)
 */
function handleORMOrder(message, db) {
    try {
        const pid = message.getSegment('PID');
        const obr = message.getSegment('OBR');

        if (!pid || !obr) {
            console.error('[HL7] Missing PID or OBR segment in ORM message');
            return;
        }

        // Extract data
        const ssn = getField(pid, 3); // PID.3 - Patient ID
        const placerOrderNumber = getField(obr, 2); // OBR.2 - Placer Order Number
        const procedureCode = getField(obr, 4); // OBR.4 - Universal Service ID
        const reasonForExam = getField(obr, 13); // OBR.13 - Relevant Clinical Info

        // Parse procedure description (may be in format CODE^DESCRIPTION)
        let procedureDesc = procedureCode;
        if (typeof obr.fields[4] === 'object' || procedureCode.includes('^')) {
            const parts = procedureCode.split('^');
            procedureDesc = parts[1] || parts[0] || procedureCode;
        }

        // Validate SSN
        if (!ssn || ssn.length !== 14) {
            console.error('[HL7] Invalid SSN format in ORM:', ssn);
            return;
        }

        console.log(`[HL7] Processing ORM order: ${placerOrderNumber} for patient ${ssn}, procedure: ${procedureDesc}`);

        // Check for existing open visit (prevent duplicates)
        db.get(`
            SELECT visit_id FROM patient_visits 
            WHERE patient_ssn = ? AND visit_status IN ('open', 'in_progress') 
            AND primary_diagnosis = ?
        `, [ssn, reasonForExam || procedureDesc], (err, existingVisit) => {
            if (err) {
                console.error('[HL7] Error checking for existing visit:', err.message);
                return;
            }

            if (existingVisit) {
                console.log('[HL7] Open visit already exists for patient:', ssn, '- skipping duplicate');
                return;
            }

            // Generate a UUID for the visit
            const visitId = uuid.v4();

            // Create visit with HL7 data
            db.run(`
                INSERT INTO patient_visits (
                    visit_id, patient_ssn, visit_status, primary_diagnosis,
                    visit_type, department, created_by
                ) VALUES (?, ?, 'open', ?, 'outpatient', 'radiology', 'hl7-system')
            `, [visitId, ssn, reasonForExam || procedureDesc], function (err) {
                if (err) {
                    console.error('[HL7] Error creating visit:', err.message);
                } else {
                    console.log('[HL7] Visit created:', visitId, 'Patient:', ssn, 'Procedure:', procedureDesc);
                }
            });
        });
    } catch (err) {
        console.error('[HL7] Error handling ORM message:', err.message);
    }
}

/**
 * Process HL7 Message using simple-hl7 parser
 */
function processHL7Message(rawMessage, db) {
    console.log('[HL7] Processing message...');

    try {
        // Parse the HL7 message using simple-hl7
        const parser = new hl7.Parser();
        const message = parser.parse(rawMessage);

        // Get message type from MSH segment
        const msh = message.getSegment('MSH');
        if (!msh) {
            console.error('[HL7] No MSH segment found');
            return false;
        }

        const messageType = getField(msh, 9);
        const parts = messageType.split('^');
        const type = parts[0] || '';
        const triggerEvent = parts[1] || '';

        console.log('[HL7] Message type:', type, 'Trigger event:', triggerEvent);

        // Route message to appropriate handler
        if (type === 'ADT' && (triggerEvent === 'A01' || triggerEvent === 'A08')) {
            handleADTPatient(message, db);
            return true;
        } else if (type === 'ORM' && triggerEvent === 'O01') {
            handleORMOrder(message, db);
            return true;
        } else {
            console.log('[HL7] Unhandled message type:', type, '^', triggerEvent);
            return true; // Still acknowledge the message
        }
    } catch (err) {
        console.error('[HL7] Error parsing message:', err.message);
        // Fall back to manual parsing for compatibility
        return processHL7MessageManual(rawMessage, db);
    }
}

/**
 * Fallback manual parsing for non-standard messages
 */
function processHL7MessageManual(message, db) {
    console.log('[HL7] Falling back to manual parsing...');

    const segments = message.split('\r');
    const mshSegment = segments.find(s => s.startsWith('MSH|'));
    const pidSegment = segments.find(s => s.startsWith('PID|'));
    const pv1Segment = segments.find(s => s.startsWith('PV1|'));
    const obrSegment = segments.find(s => s.startsWith('OBR|'));

    if (!mshSegment) {
        console.error('[HL7] No MSH segment found in manual parse');
        return false;
    }

    const mshFields = mshSegment.split('|');
    const messageType = mshFields[8] || '';
    const triggerEvent = messageType.split('^')[1] || '';

    console.log('[HL7] Manual parse - Message type:', messageType, 'Trigger:', triggerEvent);

    if (messageType.startsWith('ADT') && (triggerEvent === 'A01' || triggerEvent === 'A08')) {
        handleADTPatientManual(pidSegment, pv1Segment, db);
        return true;
    } else if (messageType.startsWith('ORM') && triggerEvent === 'O01') {
        handleORMOrderManual(pidSegment, obrSegment, db);
        return true;
    }

    return true;
}

/**
 * Manual ADT handler (fallback)
 */
function handleADTPatientManual(pidSegment, pv1Segment, db) {
    if (!pidSegment) return;

    const pidFields = pidSegment.split('|');
    const ssn = pidFields[3] || '';
    const patientName = pidFields[5] || '';
    const dob = pidFields[7] || '';
    const gender = pidFields[8] || '';
    const address = pidFields[11] || '';

    const nameParts = patientName.split('^');
    const fullName = `${nameParts[0] || ''} ${nameParts[1] || ''}`.trim();
    const dbGender = mapGender(gender);

    if (!ssn || ssn.length !== 14) return;

    db.run(`
        INSERT OR REPLACE INTO patients (ssn, mobile_number, full_name, date_of_birth, gender, address)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [ssn, 'N/A', fullName, dob, dbGender, address]);
}

/**
 * Manual ORM handler (fallback)
 */
function handleORMOrderManual(pidSegment, obrSegment, db) {
    if (!pidSegment || !obrSegment) return;

    const pidFields = pidSegment.split('|');
    const obrFields = obrSegment.split('|');

    const ssn = pidFields[3] || '';
    const procedureCode = obrFields[4] || '';
    const procedureDesc = procedureCode.split('^')[1] || procedureCode;
    const reasonForExam = obrFields[13] || '';

    if (!ssn || ssn.length !== 14) return;

    const visitId = uuid.v4();
    db.run(`
        INSERT INTO patient_visits (
            visit_id, patient_ssn, visit_status, primary_diagnosis,
            visit_type, department, created_by
        ) VALUES (?, ?, 'open', ?, 'outpatient', 'radiology', 'hl7-system')
    `, [visitId, ssn, reasonForExam || procedureDesc]);
}

/**
 * Send HL7 acknowledgment message
 */
function sendAck(socket, success = true, messageId = 'MSG') {
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 10).replace(/-/g, '') +
        now.toTimeString().slice(0, 8).replace(/:/g, '');
    const ackCode = success ? 'AA' : 'AE';
    const ackId = 'ACK' + Date.now();

    const ackMessage = `\x0bMSH|^~\\&|RAD|FACILITY|SENDER|FACILITY|${timestamp}||ACK|${ackId}|P|2.5\rMSA|${ackCode}|${messageId}\x1c\r`;

    socket.write(ackMessage);
    console.log(`[HL7] Sent ${ackCode} ACK`);
}

/**
 * Create and Start the HL7 Server
 */
function startHL7Server(port, db) {
    const hl7Server = net.createServer((socket) => {
        const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;
        console.log('[HL7] Client connected from:', clientAddr);

        // Log connection
        try {
            fs.appendFileSync('hl7.log', `[${new Date().toISOString()}] Client connected: ${clientAddr}\n`);
        } catch (e) { /* ignore logging errors */ }

        let buffer = '';

        socket.on('data', (data) => {
            console.log('[HL7] Data received, length:', data.length);
            buffer += data.toString();

            // Look for complete MLLP messages (start with <VT> and end with <FS><CR>)
            let vtIndex = buffer.indexOf('\x0b');
            let fsIndex = buffer.indexOf('\x1c\r', vtIndex);

            while (vtIndex >= 0 && fsIndex > vtIndex) {
                // Extract the HL7 message
                const hl7Message = buffer.substring(vtIndex + 1, fsIndex);

                console.log('[HL7] Complete message received, length:', hl7Message.length);

                // Log raw message for debugging
                try {
                    fs.appendFileSync('hl7.log', `[${new Date().toISOString()}] Message:\n${hl7Message.replace(/\r/g, '\n')}\n---\n`);
                } catch (e) { /* ignore */ }

                // Process the message
                try {
                    const success = processHL7Message(hl7Message, db);
                    sendAck(socket, success);
                } catch (err) {
                    console.error('[HL7] Error processing message:', err.message);
                    sendAck(socket, false);
                }

                // Remove processed message from buffer
                buffer = buffer.substring(fsIndex + 2);

                // Check for more messages
                vtIndex = buffer.indexOf('\x0b');
                fsIndex = buffer.indexOf('\x1c\r', vtIndex);
            }
        });

        socket.on('error', (err) => {
            console.error('[HL7] Socket error:', err.message);
        });

        socket.on('close', () => {
            console.log('[HL7] Client disconnected:', clientAddr);
        });
    });

    hl7Server.listen(port, () => {
        console.log(`[HL7] Server listening on port ${port}`);
    });

    hl7Server.on('error', (err) => {
        console.error('[HL7] Server error:', err.message);
    });

    return hl7Server;
}

module.exports = {
    startHL7Server,
    processHL7Message // Export for testing
};
