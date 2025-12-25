const net = require('net');
const uuid = require('uuid');
const fs = require('fs');

/**
 * HL7 Configuration
 * Adjust these indices based on Vendor specifications
 * Note: Arrays are 0-indexed, so Field 3 is index 3 in our split array (because index 0 is the segment name)
 */
const HL7_CONFIG = {
    PATIENT_SSN_INDEX: 3,      // PID-3: Patient Identifier List
    PATIENT_NAME_INDEX: 5,     // PID-5: Patient Name
    PATIENT_DOB_INDEX: 7,      // PID-7: Date of Birth
    PATIENT_GENDER_INDEX: 8,   // PID-8: Sex
    PATIENT_ADDRESS_INDEX: 11, // PID-11: Address
    ORDER_PLACER_NUM_INDEX: 2, // OBR-2: Placer Order Number
    PROCEDURE_CODE_INDEX: 4,   // OBR-4: Universal Service ID
    REASON_FOR_EXAM_INDEX: 13  // OBR-13: Relevant Clinical Info
};

/**
 * HL7 Service for Al-Shorouk Radiology System
 * Uses custom robust parsing logic
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
 * Process HL7 Message
 * Uses robust manual parsing to ensure compatibility
 */
function processHL7Message(rawMessage, db) {
    console.log('[HL7] Processing message...');
    return processHL7MessageManual(rawMessage, db);
}

/**
 * Robust HL7 Message Parser
 */
function processHL7MessageManual(message, db) {
    // Normalize newlines to \r
    const normalizedMessage = message.replace(/\n/g, '\r');
    const segments = normalizedMessage.split('\r').filter(s => s.trim().length > 0);

    const mshSegment = segments.find(s => s.startsWith('MSH|'));

    if (!mshSegment) {
        console.error('[HL7] No MSH segment found');
        return false;
    }

    const mshFields = mshSegment.split('|');
    const messageType = mshFields[8] || '';

    // Handle message type (e.g., ADT^A01)
    let type = '';
    let triggerEvent = '';

    if (messageType.includes('^')) {
        const parts = messageType.split('^');
        type = parts[0];
        triggerEvent = parts[1];
    } else {
        type = messageType;
    }

    console.log('[HL7] Message type:', type, 'Trigger:', triggerEvent);

    if (type === 'ADT' && (triggerEvent === 'A01' || triggerEvent === 'A08')) {
        handleADTPatientManual(segments, db);
        return true;
    } else if (type === 'ORM' && triggerEvent === 'O01') {
        handleORMOrderManual(segments, db);
        return true;
    } else {
        console.log('[HL7] Unhandled message type:', type, '^', triggerEvent);
        return true; // Acknowledge receipt even if unhandled
    }
}

/**
 * Handle ADT Patient (Manual Parse)
 */
function handleADTPatientManual(segments, db) {
    const pidSegment = segments.find(s => s.startsWith('PID|'));
    if (!pidSegment) return;

    const pidFields = pidSegment.split('|');
    const ssn = pidFields[HL7_CONFIG.PATIENT_SSN_INDEX] || '';
    const patientName = pidFields[HL7_CONFIG.PATIENT_NAME_INDEX] || '';
    const dob = pidFields[HL7_CONFIG.PATIENT_DOB_INDEX] || '';
    const gender = pidFields[HL7_CONFIG.PATIENT_GENDER_INDEX] || '';
    const address = pidFields[HL7_CONFIG.PATIENT_ADDRESS_INDEX] || '';

    let fullName = patientName;
    if (patientName.includes('^')) {
        const nameParts = patientName.split('^');
        // LAST^FIRST^MIDDLE -> First Last
        fullName = `${nameParts[1] || ''} ${nameParts[0] || ''}`.trim();
    }

    const dbGender = mapGender(gender);

    if (!ssn || ssn.length !== 14) {
        console.error('[HL7] Invalid SSN format:', ssn);
        return;
    }

    console.log(`[HL7] Processing ADT patient: ${fullName} (SSN: ${ssn})`);

    db.run(`
        INSERT OR REPLACE INTO patients (ssn, mobile_number, full_name, date_of_birth, gender, address)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [ssn, 'N/A', fullName, dob, dbGender, address], (err) => {
        if (err) console.error('[HL7] Error updating patient:', err.message);
        else console.log('[HL7] Patient updated:', ssn);
    });
}

/**
 * Handle ORM Order (Manual Parse)
 */
function handleORMOrderManual(segments, db) {
    const pidSegment = segments.find(s => s.startsWith('PID|'));
    const obrSegment = segments.find(s => s.startsWith('OBR|'));

    if (!pidSegment || !obrSegment) return;

    const pidFields = pidSegment.split('|');
    const obrFields = obrSegment.split('|');

    const ssn = pidFields[HL7_CONFIG.PATIENT_SSN_INDEX] || '';
    const procedureCode = obrFields[HL7_CONFIG.PROCEDURE_CODE_INDEX] || '';
    const procedureDesc = procedureCode.split('^')[1] || procedureCode; // CODE^DESC
    const reasonForExam = obrFields[HL7_CONFIG.REASON_FOR_EXAM_INDEX] || '';

    if (!ssn || ssn.length !== 14) return;

    // Check for duplicate open visit
    db.get(`
        SELECT visit_id FROM patient_visits 
        WHERE patient_ssn = ? AND visit_status IN ('open', 'in_progress')
        AND created_by = 'hl7-system'
    `, [ssn], (err, row) => {
        if (!err && row) {
            console.log('[HL7] Open visit already exists for:', ssn);
            return;
        }

        const visitId = uuid.v4();
        db.run(`
            INSERT INTO patient_visits (
                visit_id, patient_ssn, visit_status, primary_diagnosis,
                visit_type, department, created_by
            ) VALUES (?, ?, 'open', ?, 'outpatient', 'radiology', 'hl7-system')
        `, [visitId, ssn, reasonForExam || procedureDesc], (err) => {
            if (err) console.error('[HL7] Error creating visit:', err.message);
            else console.log('[HL7] Visit created:', visitId);
        });
    });
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

            // console.log(`[HL7 DEBUG] Buffer len: ${buffer.length}, VT: ${vtIndex}, FS: ${fsIndex}`);
            // if (buffer.length > 0) {
            //     console.log(`[HL7 DEBUG] Buffer end (hex): ${Buffer.from(buffer.slice(-10)).toString('hex')}`);
            // }

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
