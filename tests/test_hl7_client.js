const net = require('net');

const HOST = '127.0.0.1';
const PORT = 2576;
const SSN = '30000000000123'; // Known test SSN

function getTimestamp() {
    const now = new Date();
    return now.toISOString().slice(0, 10).replace(/-/g, '') +
        now.toTimeString().slice(0, 8).replace(/:/g, '');
}

const messageControlId = 'MSG' + Date.now();
const timestamp = getTimestamp();

// Construct ADT^A01
const hl7Message = `MSH|^~\\&|TEST_SENDER|TEST_FACILITY|SHO_RAD|SHO_FACILITY|${timestamp}||ADT^A01|${messageControlId}|P|2.5\r` +
    `EVN|A01|${timestamp}\r` +
    `PID|1||${SSN}||TestPatient^CreatedByHL7Check||19800101|M|||123 Test St^^Cairo\r` +
    `PV1|1|O`;

const mllpMessage = '\x0b' + hl7Message + '\x1c\r';

console.log('Sending HL7 Message for SSN:', SSN);

const client = new net.Socket();

client.connect(PORT, HOST, () => {
    console.log('Connected to HL7 Server');
    client.write(mllpMessage);
});

client.on('data', (data) => {
    console.log('Received ACK:', JSON.stringify(data.toString())); // Use JSON.stringify to see control chars

    if (data.toString().includes('|AA|')) {
        console.log('SUCCESS: Message Accepted');
    } else {
        console.log('FAILURE: Message Rejected');
    }
    client.destroy();
});

client.on('close', () => {
    console.log('Connection closed');
});

client.on('error', (err) => {
    console.error('Connection error:', err.message);
});
