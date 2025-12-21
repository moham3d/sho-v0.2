const net = require('net');

// HL7 Test Script for Al-Shorouk Radiology Management System
// This script sends sample HL7 messages to test the system's HL7 capabilities

const HL7_HOST = 'http://localhost';
const HL7_PORT = 2576;

// Sample ADT^A01 Patient Registration Message
const adtMessage = `MSH|^~\\&|SENDING_APP|SENDING_FACILITY|RAD|FACILITY|20251005120000||ADT^A01|MSG001|P|2.5
EVN|A01|20251005120000
PID|1||26409301400274||AHMED5^MOHAMED||19900101|M|||15 Nile Street^Cairo^Egypt^12345||+20123456789||ARABIC|MUSLIM
PV1|1|I|RAD^101^1||||123456^ALI^HASSAN^S^MD|||||||ADM|||20251005120000`;

// Sample ORM^O01 Order Message
const ormMessage = `MSH|^~\\&|SENDING_APP|SENDING_FACILITY|RAD|FACILITY|20251005120100||ORM^O01|MSG002|P|2.5
PID|1||26409301400275||AHMED^MOHAMED||19900101|M
PV1|1|O|RAD^101^1||||123456^ALI^HASSAN^S^MD
ORC|NW|ORDER001|||||^^^20251005120100
OBR|1|ORDER001||RAD001^CHEST X-RAY^C4|||20251005120100|||||||||CHEST PAIN`;

// Function to send HL7 message with MLLP wrapping
function sendHL7Message(message, description) {
    return new Promise((resolve, reject) => {
        console.log(`\n📤 Sending ${description}...`);

        // Wrap message in MLLP (Minimal Lower Layer Protocol)
        // <VT> message <FS><CR>
        const mllpMessage = '\x0b' + message.replace(/\n/g, '\r') + '\x1c\r';

        const client = net.createConnection({ host: HL7_HOST, port: HL7_PORT }, () => {
            console.log('Connected to HL7 server');
            client.write(mllpMessage);
        });

        let responseBuffer = '';

        client.on('data', (data) => {
            responseBuffer += data.toString();
            console.log('📥 Received response:', data.toString().replace(/\r/g, '\\r'));

            // Check for complete MLLP response
            if (responseBuffer.includes('\x1c\r')) {
                client.end();
                resolve(responseBuffer);
            }
        });

        client.on('end', () => {
            console.log(`✅ ${description} sent successfully`);
            resolve(responseBuffer);
        });

        client.on('error', (err) => {
            console.error(`❌ Error sending ${description}:`, err.message);
            reject(err);
        });

        // Timeout after 10 seconds
        setTimeout(() => {
            client.destroy();
            reject(new Error('Timeout waiting for response'));
        }, 10000);
    });
}

// Main test function
async function runHL7Tests() {
    console.log('🏥 Starting HL7 Capability Tests for Al-Shorouk Radiology System');
    console.log('='.repeat(60));

    try {
        // Test 1: Send ADT Patient Registration
        console.log('\n🧪 Test 1: ADT^A01 Patient Registration');
        const adtResponse = await sendHL7Message(adtMessage, 'ADT Patient Registration');
        if (adtResponse.includes('MSA|AA|')) {
            console.log('✅ ADT message accepted', adtResponse);
        } else {
            console.log('⚠️  ADT message response:', adtResponse);
        }

        // Wait a moment before sending next message
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test 2: Send ORM Order Message
        console.log('\n🧪 Test 2: ORM^O01 Radiology Order');
        const ormResponse = await sendHL7Message(ormMessage, 'ORM Radiology Order');
        if (ormResponse.includes('MSA|AA|')) {
            console.log('✅ ORM message accepted');
        } else {
            console.log('⚠️  ORM message response:', ormResponse);
        }

        console.log('\n🎉 HL7 Tests completed!');
        console.log('Check the database and hl7.log for results.');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run tests if called directly
if (require.main === module) {
    runHL7Tests();
}

module.exports = { sendHL7Message, runHL7Tests };