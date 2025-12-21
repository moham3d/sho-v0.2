const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'database.db');
const schemaPath = path.join(__dirname, 'docs', 'schema.sql');

if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('Existing database removed.');
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Failed to open database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
    }
});

const schemaSql = fs.readFileSync(schemaPath, 'utf8');

const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) {
            reject(err);
        } else {
            resolve(this);
        }
    });
});

const closeDb = () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('SQLite connection closed.');
        }
    });
};

db.exec(schemaSql, async (err) => {
    if (err) {
        console.error('Error applying schema:', err.message);
        closeDb();
        return;
    }

    console.log('Database schema ensured. Seeding data...');

    const users = [
        { id: 'admin-uuid', username: 'admin', email: 'admin@example.com', fullName: 'Administrator', role: 'admin', password: 'admin' },
        { id: 'nurse-uuid', username: 'nurse', email: 'nurse@example.com', fullName: 'Maisa Ibrahim', role: 'nurse', password: 'nurse' },
        { id: 'radiologist-uuid', username: 'radiologist', email: 'radiologist@example.com', fullName: 'Mahmoud Hassan', role: 'radiologist', password: 'radiologist' }
    ];

    const userSignatures = [
        {
            signature_id: 'sig-admin-uuid',
            user_id: 'admin-uuid',
            signature_data: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgODAwIDIwMCI+CiAgICAgICAgICAgICAgICAgICAgPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0id2hpdGUiLz4KICAgICAgICAgICAgICAgICAgICA8ZyBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsPSJub25lIj4KICAgICAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTSA2MC43NDQ3Njg1OTgyMjk4NCAxNDguNjAyNzUyNTc5MDI0MDcgTCA2MC43NDQ3Njg1OTgyMjk4NCAxNDkuODA0Njc1NTg5ODE3NzIgTCA2Mi44MTA5MTc2MTg5NDQyMiAxNDcuNDAwODI5NTY4MjMwNCBMIDY5LjAwOTM2NDY4MTA4NzM1IDEzNS4zODE1OTk0NjAyOTM3MyBMIDcyLjEwODU4ODIxMjE1ODkyIDEyNS43NjYyMTUzNzM5NDQzOSBMIDc4LjMwNzAzNTI3NDMwMjA0IDEwNS4zMzM1MjQxOTA0NTIwNSBMIDgyLjQzOTMzMzMxNTczMDc5IDg0LjkwMDgzMzAwNjk1OTcyIEwgODQuNTA1NDgyMzM2NDQ1MTcgNzYuNDg3MzcxOTMxNDA0MDQgTCA4NS41Mzg1NTY4NDY4MDIzNiA3MC40Nzc3NTY4Nzc0MzU3MSBMIDg1LjUzODU1Njg0NjgwMjM2IDY5LjI3NTgzMzg2NjY0MjA1IEwgODcuNjA0NzA1ODY3NTE2NzQgNzYuNDg3MzcxOTMxNDA0MDQgTCA4OS42NzA4NTQ4ODgyMzExMiAxMDAuNTI1ODMyMTQ3Mjc3MzggTCA4OS42NzA4NTQ4ODgyMzExMiAxMTIuNTQ1MDYyMjU1MjE0MDUgTCA4OS42NzA4NTQ4ODgyMzExMiAxMTQuOTQ4OTA4Mjc2ODAxMzggTCA4OS42NzA4NTQ4ODgyMzExMiAxMTQuOTQ4OTA4Mjc2ODAxMzggTCA5MC43MDM5MjkzOTg1ODgzIDEwOC45MzkyOTMyMjI4MzMwNCBMIDkxLjczNzAwMzkwODk0NTUgMTAxLjcyNzc1NTE1ODA3MTA1IEwgOTQuODM2MjI3NDQwMDE3MDUgOTUuNzE4MTQwMTA0MTAyNzIgTCA5NS44NjkzMDE5NTAzNzQyNSA5NC41MTYyMTcwOTMzMDkwNCBMIDk3LjkzNTQ1MDk3MTA4ODYzIDk2LjkyMDA2MzExNDg5NjM4IEwgMTAyLjA2Nzc0OTAxMjUxNzM4IDEwNi41MzU0NDcyMDEyNDU3MiBMIDEwMi4wNjc3NDkwMTI1MTczOCAxMTAuMTQxMjE2MjMzNjI2NzIgTCAxMDQuMTMzODk4MDMzMjMxNzYgMTEyLjU0NTA2MjI1NTIxNDA1IEwgMTA0LjEzMzg5ODAzMzIzMTc2IDExMS4zNDMxMzkyNDQ0MjAzOSBMIDEwNS4xNjY5NzI1NDM1ODg5NCAxMTAuMTQxMjE2MjMzNjI2NzIgTCAxMDYuMjAwMDQ3MDUzOTQ2MTQgMTA1LjMzMzUyNDE5MDQ1MjA1IEwgMTA3LjIzMzEyMTU2NDMwMzMyIDEwNC4xMzE2MDExNzk2NTgzOCBMIDEwNy4yMzMxMjE1NjQzMDMzMiAxMDIuOTI5Njc4MTY4ODY0NzEgTCAxMDguMjY2MTk2MDc0NjYwNSAxMDIuOTI5Njc4MTY4ODY0NzEgTCAxMTAuMzMyMzQ1MDk1Mzc0ODggMTA2LjUzNTQ0NzIwMTI0NTcyIEwgMTEyLjMzk4NDk0MTExNjA4OTI1IDExMC4xNDEyMTYyMzM2MjY3MiBMIDExMy40MzE1Njg2MjY0NDY0NSAxMTAuMTQxMjE2MjMzLjY3MiBMIDExNS40OTc3MTc2NDcxNjA4MyAxMTIuNTQ1MDYyMjU1MjE0MDUgTCAxMjAuNjYzMDkwMTk4OTQ0Njc2IDExMi41NDUwNjIyNTUyMTQwNSBMIDEyNi44NjE1MzcyNjEwODk5IDExMy43NDY5ODUyNjYwMDc3MSBMIDE0y4zNTc2NTQ5MTY0NDc3MyAxMTMuNzQ2OTg1MjY2MDA3NzEgTCAxNDguNTU2MTAxOTc4NTkwODUgMTEyLjU0NTA2MjI1NTIxNDA1IEwgMTU4Ljg4Njg0NzA4MjE2Mjc1IDExMS4zNDMxMzkyNDQ0MjAzOSBMIDE2OS4yMTc1OTIxODU3MzQ2MiAxMDguOTM5MjkzMjIyODMzMDQgTCAxNzguNTE1MjYyNzc4OTQ5MyAxMDUuMzMzNTI0MTkwNDUyMDUgTCAxOTIuOTc4MzA1OTIzOTQ5OTYgOTkuMzIzOTA5MTM2NDgzNyBMIDIwMS4yNDI5MDIwMDY4MDc0NyA5Ni45MjAwNjMxMTQ4OTYzOCBMIDIxMi42MDY3MjE2MjA3MzY1MiA5NS43MTgxNDAxMDQxMDI3MiBMIDIzOS40NjY2NTg4OTAwMjM0NCA5NS43MTgxNDAxMDQxMDI3MiBMIDI4My44ODg4NjI4MzUzODI1IDk1LjcxODE0MDEwNDEwMjcyIEwgNDQ0LjAxNTQxMTk0MDc0NjczIDk1LjcxODE0MDEwNDEwMjcyIEwgNjYzLjAyNzIwODEzNjQ3MDcgODguNTA2NjAyMDM5MzQwNyBMIDc3OS43NjQ2Mjc4MDY4MzI5IDY5LjI3NTgzMzg2NjY0MjA1Ii8+CiAgICAgICAgICAgICAgICAgICAgPC9nPgogICAgICAgICAgICAgICAgPC9zdmc+'
        },
        {
            signature_id: 'sig-nurse-uuid',
            user_id: 'nurse-uuid',
            signature_data: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgODAwIDIwMCI+CiAgICAgICAgICAgICAgICAgICAgPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0id2hpdGUiLz4KICAgICAgICAgICAgICAgICAgICA8ZyBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsPSJub25lIj4KICAgICAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTSA2MC43NDQ3Njg1OTgyMjk4NCAxNDguNjAyNzUyNTc5MDI0MDcgTCA2MC43NDQ3Njg1OTgyMjk4NCAxNDkuODA0Njc1NTg5ODE3NzIgTCA2Mi44MTA5MTc2MTg5NDQyMiAxNDcuNDAwODI5NTY4MjMwNCBMIDY5LjAwOTM2NDY4MTA4NzM1IDEzNS4zODE1OTk0NjAyOTM3MyBMIDcyLjEwODU4ODIxMjE1ODkyIDEyNS43NjYyMTUzNzM5NDQzOSBMIDc4LjMwNzAzNTI3NDMwMjA0IDEwNS4zMzM1MjQxOTA0NTIwNSBMIDgyLjQzOTMzMzMxNTczMDc5IDg0LjkwMDgzMzAwNjk1OTcyIEwgODQuNTA1NDgyMzM2NDQ1MTcgNzYuNDg3MzcxOTMxNDA0MDQgTCA4NS41Mzg1NTY4NDY4MDIzNiA3MC40Nzc3NTY4Nzc0MzU3MSBMIDg1LjUzODU1Njg0NjgwMjM2IDY5LjI3NTgzMzg2NjY0MjA1IEwgODcuNjA0NzA1ODY3NTE2NzQgNzYuNDg3MzcxOTMxNDA0MDQgTCA4OS42NzA4NTQ4ODgyMzExMiAxMDAuNTI1ODMyMTQ3Mjc3MzggTCA4OS42NzA4NTQ4ODgyMzExMiAxMTIuNTQ1MDYyMjU1MjE0MDUgTCA4OS42NzA4NTQ4ODgyMzExMiAxMTQuOTQ4OTA4Mjc2ODAxMzggTCA4OS42NzA4NTQ4ODgyMzExMiAxMTQuOTQ4OTA4Mjc2ODAxMzggTCA5MC43MDM5MjkzOTg1ODgzIDEwOC45MzkyOTMyMjI4MzMwNCBMIDkxLjczNzAwMzkwODk0NTUgMTAxLjcyNzc1NTE1ODA3MTA1IEwgOTQuODM2MjI3NDQwMDE3MDUgOTUuNzE4MTQwMTA0MTAyNzIgTCA5NS44NjkzMDE5NTAzNzQyNSA5NC41MTYyMTcwOTMzMDkwNCBMIDk3LjkzNTQ1MDk3MTA4ODYzIDk2LjkyMDA2MzExNDg5NjM4IEwgMTAyLjA2Nzc0OTAxMjUxNzM4IDEwNi41MzU0NDcyMDEyNDU3MiBMIDEwMi4wNjc3NDkwMTI1MTczOCAxMTAuMTQxMjE2MjMzNjI2NzIgTCAxMDQuMTMzODk4MDMzMjMxNzYgMTEyLjU0NTA2MjI1NTIxNDA1IEwgMTA0LjEzMzg5ODAzMzIzMTc2IDExMS4zNDMxMzkyNDQ0MjAzOSBMIDEwNS4xNjY5NzI1NDM1ODg5NCAxMTAuMTQxMjE2MjMzNjI2NzIgTCAxMDYuMjAwMDQ3MDUzOTQ2MTQgMTA1LjMzMzUyNDE5MDQ1MjA1IEwgMTA3LjIzMzEyMTU2NDMwMzMyIDEwNC4xMzE2MDExNzk2NTgzOCBMIDEwNy4yMzMxMjE1NjQzMDMzMiAxMDIuOTI5Njc4MTY4ODY0NzEgTCAxMDguMjY2MTk2MDc0NjYwNSAxMDIuOTI5Njc4MTY4ODY0NzEgTCAxMTAuMzMyMzQ1MDk1Mzc0ODggMTA2LjUzNTQ0NzIwMTI0NTcyIEwgMTEyLjMzk4NDk0MTExNjA4OTI1IDExMC4xNDEyMTYyMzM2MjY3MiBMIDExMy40MzE1Njg2MjY0NDY0NSAxMTAuMTQxMjE2MjMzLjY3MiBMIDExNS40OTc3MTc2NDcxNjA4MyAxMTIuNTQ1MDYyMjU1MjE0MDUgTCAxMjAuNjYzMDkwMTk4OTQ0Njc2IDExMi41NDUwNjIyNTUyMTQwNSBMIDEyNi44NjE1MzcyNjEwODk5IDExMy43NDY5ODUyNjYwMDc3MSBMIDE0y4zNTc2NTQ5MTY0NDc3MyAxMTMuNzQ2OTg1MjY2MDA3NzEgTCAxNDguNTU2MTAxOTc4NTkwODUgMTEyLjU0NTA2MjI1NTIxNDA1IEwgMTU4Ljg4Njg0NzA4MjE2Mjc1IDExMS4zNDMxMzkyNDQ0MjAzOSBMIDE2OS4yMTc1OTIxODU3MzQ2MiAxMDguOTM5MjkzMjIyODMzMDQgTCAxNzguNTE1MjYyNzc4OTQ5MyAxMDUuMzMzNTI0MTkwNDUyMDUgTCAxOTIuOTc4MzA1OTIzOTQ5OTYgOTkuMzIzOTA5MTM2NDgzNyBMIDIwMS4yNDI5MDIwMDY4MDc0NyA5Ni45MjAwNjMxMTQ4OTYzOCBMIDIxMi42MDY3MjE2MjA3MzY1MiA5NS43MTgxNDAxMDQxMDI3MiBMIDIzOS40NjY2NTg4OTAwMjM0NCA5NS43MTgxNDAxMDQxMDI3MiBMIDI4My44ODg4NjI4MzUzODI1IDk1LjcxODE0MDEwNDEwMjcyIEwgNDQ0LjAxNTQxMTk0MDc0NjczIDk1LjcxODE0MDEwNDEwMjcyIEwgNjYzLjAyNzIwODEzNjQ3MDcgODguNTA2NjAyMDM5MzQwNyBMIDc3OS43NjQ2Mjc4MDY4MzI5IDY5LjI3NTgzMzg2NjY0MjA1Ii8+CiAgICAgICAgICAgICAgICAgICAgPC9nPgogICAgICAgICAgICAgICAgPC9zdmc+'
        },
        {
            signature_id: 'sig-radiologist-uuid',
            user_id: 'radiologist-uuid',
            signature_data: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgODAwIDIwMCI+CiAgICAgICAgICAgICAgICAgICAgPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0id2hpdGUiLz4KICAgICAgICAgICAgICAgICAgICA8ZyBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsPSJub25lIj4KICAgICAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTSA2MC43NDQ3Njg1OTgyMjk4NCAxNDguNjAyNzUyNTc5MDI0MDcgTCA2MC43NDQ3Njg1OTgyMjk4NCAxNDkuODA0Njc1NTg5ODE3NzIgTCA2Mi44MTA5MTc2MTg5NDQyMiAxNDcuNDAwODI5NTY4MjMwNCBMIDY5LjAwOTM2NDY4MTA4NzM1IDEzNS4zODE1OTk0NjAyOTM3MyBMIDcyLjEwODU4ODIxMjE1ODkyIDEyNS43NjYyMTUzNzM5NDQzOSBMIDc4LjMwNzAzNTI3NDMwMjA0IDEwNS4zMzM1MjQxOTA0NTIwNSBMIDgyLjQzOTMzMzMxNTczMDc5IDg0LjkwMDgzMzAwNjk1OTcyIEwgODQuNTA1NDgyMzM2NDQ1MTcgNzYuNDg3MzcxOTMxNDA0MDQgTCA4NS41Mzg1NTY4NDY4MDIzNiA3MC40Nzc3NTY4Nzc0MzU3MSBMIDg1LjUzODU1Njg0NjgwMjM2IDY5LjI3NTgzMzg2NjY0MjA1IEwgODcuNjA0NzA1ODY3NTE2NzQgNzYuNDg3MzcxOTMxNDA0MDQgTCA4OS42NzA4NTQ4ODgyMzExMiAxMDAuNTI1ODMyMTQ3Mjc3MzggTCA4OS42NzA4NTQ4ODgyMzExMiAxMTIuNTQ1MDYyMjU1MjE0MDUgTCA4OS42NzA4NTQ4ODgyMzExMiAxMTQuOTQ4OTA4Mjc2ODAxMzggTCA4OS42NzA4NTQ4ODgyMzExMiAxMTQuOTQ4OTA4Mjc2ODAxMzggTCA5MC43MDM5MjkzOTg1ODgzIDEwOC45MzkyOTMyMjI4MzMwNCBMIDkxLjczNzAwMzkwODk0NTUgMTAxLjcyNzc1NTE1ODA3MTA1IEwgOTQuODM2MjI3NDQwMDE3MDUgOTUuNzE4MTQwMTA0MTAyNzIgTCA5NS44NjkzMDE5NTAzNzQyNSA5NC41MTYyMTcwOTMzMDkwNCBMIDk3LjkzNTQ1MDk3MTA4ODYzIDk2LjkyMDA2MzExNDg5NjM4IEwgMTAyLjA2Nzc0OTAxMjUxNzM4IDEwNi41MzU0NDcyMDEyNDU3MiBMIDEwMi4wNjc3NDkwMTI1MTczOCAxMTAuMTQxMjE2MjMzNjI2NzIgTCAxMDQuMTMzODk4MDMzMjMxNzYgMTEyLjU0NTA2MjI1NTIxNDA1IEwgMTA0LjEzMzg5ODAzMzIzMTc2IDExMS4zNDMxMzkyNDQ0MjAzOSBMIDEwNS4xNjY5NzI1NDM1ODg5NCAxMTAuMTQxMjE2MjMzNjI2NzIgTCAxMDYuMjAwMDQ3MDUzOTQ2MTQgMTA1LjMzMzUyNDE5MDQ1MjA1IEwgMTA3LjIzMzEyMTU2NDMwMzMyIDEwNC4xMzE2MDExNzk2NTgzOCBMIDEwNy4yMzMxMjE1NjQzMDMzMiAxMDIuOTI5Njc4MTY4ODY0NzEgTCAxMDguMjY2MTk2MDc0NjYwNSAxMDIuOTI5Njc4MTY4ODY0NzEgTCAxMTAuMzMyMzQ1MDk1Mzc0ODggMTA2LjUzNTQ0NzIwMTI0NTcyIEwgMTEyLjMzk4NDk0MTExNjA4OTI1IDExMC4xNDEyMTYyMzM2MjY3MiBMIDExMy40MzE1Njg2MjY0NDY0NSAxMTAuMTQxMjE2MjMzLjY3MiBMIDExNS40OTc3MTc2NDcxNjA4MyAxMTIuNTQ1MDYyMjU1MjE0MDUgTCAxMjAuNjYzMDkwMTk4OTQ0Njc2IDExMi41NDUwNjIyNTUyMTQwNSBMIDEyNi44NjE1MzcyNjEwODk5IDExMy43NDY5ODUyNjYwMDc3MSBMIDE0y4zNTc2NTQ5MTY0NDc3MyAxMTMuNzQ2OTg1MjY2MDA3NzEgTCAxNDguNTU2MTAxOTc4NTkwODUgMTEyLjU0NTA2MjI1NTIxNDA1IEwgMTU4Ljg4Njg0NzA4MjE2Mjc1IDExMS4zNDMxMzkyNDQ0MjAzOSBMIDE2OS4yMTc1OTIxODU3MzQ2MiAxMDguOTM5MjkzMjIyODMzMDQgTCAxNzguNTE1MjYyNzc4OTQ5MyAxMDUuMzMzNTI0MTkwNDUyMDUgTCAxOTIuOTc4MzA1OTIzOTQ5OTYgOTkuMzIzOTA5MTM2NDgzNyBMIDIwMS4yNDI5MDIwMDY4MDc0NyA5Ni45MjAwNjMxMTQ4OTYzOCBMIDIxMi42MDY3MjE2MjA3MzY1MiA5NS43MTgxNDAxMDQxMDI3MiBMIDIzOS40NjY2NTg4OTAwMjM0NCA5NS43MTgxNDAxMDQxMDI3MiBMIDI4My44ODg4NjI4MzUzODI1IDk1LjcxODE0MDEwNDEwMjcyIEwgNDQ0LjAxNTQxMTk0MDc0NjczIDk1LjcxODE0MDEwNDEwMjcyIEwgNjYzLjAyNzIwODEzNjQ3MDcgODguNTA2NjAyMDM5MzQwNyBMIDc3OS43NjQ2Mjc4MDY4MzI5IDY5LjI3NTgzMzg2NjY0MjA1Ii8+CiAgICAgICAgICAgICAgICAgICAgPC9nPgogICAgICAgICAgICAgICAgPC9zdmc+'
        }
    ];

    const formDefinitions = [
        {
            form_id: 'form-06-uuid',
            form_code: 'SH.MR.FRM.06',
            form_name: 'PET CT Medical Form',
            form_version: '1.0',
            form_description: 'PET CT examination and medical history form',
            form_role: 'radiologist'
        }
    ];

    const patientSignatureSample = `<svg width="250" height="80" xmlns="http://www.w3.org/2000/svg">
  <path d="M10 50 Q25 35 40 45 Q55 30 70 42 Q85 25 100 38 Q115 20 130 35 Q145 18 160 32 Q175 15 190 28 Q205 12 220 25 Q235 10 250 22"
        stroke="#000" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M10 60 Q30 45 50 55 Q70 40 90 52 Q110 35 130 48 Q150 32 170 45 Q190 28 210 42 Q230 25 250 38"
        stroke="#000" stroke-width="2" fill="none" stroke-linecap="round"/>
  <text x="10" y="75" font-family="cursive" font-size="12" fill="#666">Sara Abdullah Al-Zahrani</text>
</svg>`;
    const radiologistSignatureSample = userSignatures.find(sig => sig.user_id === 'radiologist-uuid')?.signature_id || '';

    const patients = [
        {
            ssn: '28503151234567', // 2 (20th century) + 850315 (1985-03-15) + 1234567 (national ID)
            mobile_number: '+201012345678',
            phone_number: '+20212345678',
            medical_number: 'MRN001',
            full_name: 'Ahmed Mohammed Al-Saud',
            date_of_birth: '1985-03-15',
            gender: 'male',
            address: 'Cairo, Egypt',
            emergency_contact_name: 'Fatima Al-Saud',
            emergency_contact_phone: '+201076543210',
            emergency_contact_relation: 'wife'
        },
        {
            ssn: '29207227890123', // 2 (20th century) + 920722 (1992-07-22) + 7890123 (national ID)
            mobile_number: '+201098765432',
            phone_number: '+20287654321',
            medical_number: 'MRN002',
            full_name: 'Sara Abdullah Al-Zahrani',
            date_of_birth: '1992-07-22',
            gender: 'female',
            address: 'Alexandria, Egypt',
            emergency_contact_name: 'Abdullah Al-Zahrani',
            emergency_contact_phone: '+201012345678',
            emergency_contact_relation: 'husband'
        },
        {
            ssn: '27811085678901', // 2 (20th century) + 781108 (1978-11-08) + 5678901 (national ID)
            mobile_number: '+201045678901',
            phone_number: '+20345678901',
            medical_number: 'MRN003',
            full_name: 'Mohammed Ali Al-Fahad',
            date_of_birth: '1978-11-08',
            gender: 'male',
            address: 'Giza, Egypt',
            emergency_contact_name: 'Aisha Al-Fahad',
            emergency_contact_phone: '+201034567890',
            emergency_contact_relation: 'daughter'
        },
        {
            ssn: '30501303456789', // 3 (21st century) + 050130 (2005-01-30) + 3456789 (national ID)
            mobile_number: '+201067890123',
            phone_number: '+20678901234',
            medical_number: 'MRN004',
            full_name: 'Fatima Hassan Al-Qasimi',
            date_of_birth: '2005-01-30',
            gender: 'female',
            address: 'Port Said, Egypt',
            emergency_contact_name: 'Hassan Al-Qasimi',
            emergency_contact_phone: '+201023456789',
            emergency_contact_relation: 'father'
        },
        {
            ssn: '26509121234567', // 2 (20th century) + 650912 (1965-09-12) + 1234567 (national ID)
            mobile_number: '+201089012345',
            phone_number: '+20890123456',
            medical_number: 'MRN005',
            full_name: 'Omar Saleh Al-Mansouri',
            date_of_birth: '1965-09-12',
            gender: 'male',
            address: 'Luxor, Egypt',
            emergency_contact_name: 'Saleh Al-Mansouri',
            emergency_contact_phone: '+201090123456',
            emergency_contact_relation: 'son'
        }
    ];

    const patientVisits = [
        {
            visit_id: 'visit-002',
            patient_ssn: '29207227890123', // Sara Abdullah Al-Zahrani
            visit_date: '2025-09-26T11:30:00Z',
            visit_status: 'completed', // Completed: Both assessments done
            primary_diagnosis: 'Acute Respiratory Infection',
            secondary_diagnosis: null,
            diagnosis_code: 'J06.9',
            visit_type: 'outpatient',
            department: 'Family Medicine',
            created_by: 'nurse-uuid',
            assigned_radiologist: 'radiologist-uuid',
            completed_at: '2025-09-26T12:30:00Z',
            notes: 'Patient presents with cough and fever.'
        },
        {
            visit_id: 'visit-003',
            patient_ssn: '27811085678901', // Mohammed Ali Al-Fahad
            visit_date: '2025-09-26T14:00:00Z',
            visit_status: 'open', // Incomplete: No assessments done yet
            primary_diagnosis: null,
            secondary_diagnosis: null,
            diagnosis_code: null,
            visit_type: 'outpatient',
            department: 'Cardiology',
            created_by: 'nurse-uuid',
            assigned_radiologist: 'radiologist-uuid',
            completed_at: null,
            notes: 'Initial cardiology consultation.'
        },
        {
            visit_id: 'visit-004',
            patient_ssn: '30501303456789', // Fatima Hassan Al-Qasimi
            visit_date: '2025-09-26T09:00:00Z',
            visit_status: 'open', // Incomplete: No assessments done yet
            primary_diagnosis: 'Pediatric Asthma',
            secondary_diagnosis: null,
            diagnosis_code: 'J45.909',
            visit_type: 'outpatient',
            department: 'Pediatrics',
            created_by: 'nurse-uuid',
            assigned_radiologist: 'radiologist-uuid',
            completed_at: null,
            notes: 'Regular asthma management and education.'
        }
    ];

    const formSubmissions = [
        {
            submission_id: 'sub-nurse-002',
            visit_id: 'visit-002',
            form_id: 'form-05-uuid',
            submitted_by: 'nurse-uuid',
            submission_status: 'submitted',
            submitted_at: '2025-09-26T12:00:00Z'
        },
        {
            submission_id: 'sub-radiologist-001',
            visit_id: 'visit-002',
            form_id: 'form-03-uuid',
            submitted_by: 'radiologist-uuid',
            submission_status: 'submitted',
            submitted_at: '2025-09-26T12:30:00Z'
        }
    ];

    const nursingAssessments = [
        {
            assessment_id: 'nurse-assess-002',
            submission_id: 'sub-nurse-002', // For visit-002 (Completed)
            age: 33,
            chief_complaint: 'Cough and fever for 3 days',
            accompanied_by: 'husband',
            language_spoken: 'arabic',
            temperature_celsius: 38.5,
            pulse_bpm: 85,
            blood_pressure_systolic: 120,
            blood_pressure_diastolic: 80,
            respiratory_rate_per_min: 18,
            oxygen_saturation_percent: 97,
            weight_kg: 65,
            height_cm: 165,
            psychological_problem: 'none',
            is_smoker: 0,
            has_allergies: 0,
            diet_type: 'regular',
            appetite: 'good',
            pain_intensity: 3,
            pain_location: 'chest',
            morse_total_score: 15,
            morse_risk_level: 'Low Risk',
            morse_scale: JSON.stringify({
                history_falling: 'no',
                secondary_diagnosis: 'yes',
                ambulatory_aid: 'none',
                iv_therapy: 'no',
                gait: 'normal',
                mental_status: 'oriented'
            }),
            needs_medication_education: 1,
            needs_pain_symptom_education: 1,
            nurse_signature_id: 'sig-nurse-uuid',
            assessed_by: 'nurse-uuid',
            assessed_at: '2025-09-26T12:00:00Z'
        }
    ];

    const radiologyExaminationForms = [
        {
            id: 'rad-001',
            patient_id: '29207227890123', // Sara Abdullah Al-Zahrani
            visit_id: 'visit-002',
            created_by: 'radiologist-uuid',
            form_type: 'xray',
            ctd1vol: '3.2',
            dlp: '120.5',
            kv: '110',
            mas: '220',
            patient_complaint: 'Persistent cough with abnormal chest X-ray',
            has_gypsum_splint: 0,
            gypsum_splint_details: null,
            has_chronic_disease: 1,
            chronic_disease_details: 'Hypertension',
            current_medications: 'Lisinopril 10mg daily',
            has_allergy: 0,
            allergy_medication: 0,
            allergy_medication_details: null,
            allergy_food: 0,
            allergy_food_details: null,
            allergy_others: 0,
            allergy_others_details: null,
            has_previous_operations: 0,
            operation_details: null,
            operation_date: null,
            operation_reason: null,
            has_tumor_history: 0,
            tumor_location: null,
            tumor_type: null,
            has_swelling: 1,
            swelling_location: 'Left ankle',
            has_previous_investigations: 1,
            previous_investigation_type: 'Chest X-ray',
            previous_investigation_date: '2025-09-20',
            has_fall_risk_medications: 1,
            fall_risk_medication_details: 'Lisinopril',
            has_fever: 1,
            is_pregnant: 0,
            is_lactating: 0,
            has_pacemaker: 0,
            has_cochlear_implant: 0,
            has_aneurysmal_clips: 0,
            has_intraocular_foreign_body: 0,
            implant_details: null,
            has_surgical_implants: 0,
            surgical_implant_details: null,
            has_critical_result: 0,
            critical_result_details: null,
            patient_signature: patientSignatureSample,
            radiologist_signature_id: 'sig-radiologist-uuid',
            form_status: 'completed',
            additional_notes: 'Patient to follow up in 2 weeks',
            radiologist_notes: 'Recommend chest CT if symptoms persist'
        }
    ];

    const petCtRecords = [
        {
            record_id: 'pet-001',
            patient_id: '29207227890123',
            visit_id: 'visit-002',
            created_by: 'radiologist-uuid',
            facility: 'Al-Shorouk Imaging Center',
            treating_physician: 'Dr. Karim Ali',
            fasting_hours: 6,
            diabetic_patient: 'No',
            blood_sugar_level: 98.5,
            weight_kg: 72.3,
            height_cm: 170.0,
            dose: '5 mCi',
            injection_site: 'Right arm',
            exam_date: '2025-09-26'
        }
    ];

    try {
        await runAsync('PRAGMA foreign_keys = OFF');

        const tablesToClear = [
            'radiology_examination_form',
            'nursing_assessments',
            'form_submissions',
            'patient_visits',
            'patients',
            'user_signatures',
            'users'
        ];

        for (const table of tablesToClear) {
            await runAsync(`DELETE FROM ${table}`);
        }

        await runAsync('PRAGMA foreign_keys = ON');

        for (const user of users) {
            const hash = bcrypt.hashSync(user.password, 10);
            await runAsync(
                'INSERT INTO users (user_id, username, email, full_name, role, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
                [user.id, user.username, user.email, user.fullName, user.role, hash]
            );
            console.log(`Seeded user ${user.username}.`);
        }

        for (const signature of userSignatures) {
            await runAsync(
                'INSERT INTO user_signatures (signature_id, user_id, signature_data) VALUES (?, ?, ?)',
                [signature.signature_id, signature.user_id, signature.signature_data]
            );
            console.log(`Seeded signature for ${signature.user_id}.`);
        }

        for (const patient of patients) {
            await runAsync(
                `INSERT INTO patients (
                    ssn, mobile_number, phone_number, medical_number, full_name,
                    date_of_birth, gender, address, emergency_contact_name,
                    emergency_contact_phone, emergency_contact_relation
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    patient.ssn,
                    patient.mobile_number,
                    patient.phone_number,
                    patient.medical_number,
                    patient.full_name,
                    patient.date_of_birth,
                    patient.gender,
                    patient.address,
                    patient.emergency_contact_name,
                    patient.emergency_contact_phone,
                    patient.emergency_contact_relation
                ]
            );
            console.log(`Seeded patient ${patient.full_name}.`);
        }

        for (const visit of patientVisits) {
            await runAsync(
                `INSERT INTO patient_visits (
                    visit_id, patient_ssn, visit_date, visit_status, primary_diagnosis,
                    secondary_diagnosis, diagnosis_code, visit_type, department,
                    created_by, assigned_radiologist, completed_at, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    visit.visit_id,
                    visit.patient_ssn,
                    visit.visit_date,
                    visit.visit_status,
                    visit.primary_diagnosis,
                    visit.secondary_diagnosis,
                    visit.diagnosis_code,
                    visit.visit_type,
                    visit.department,
                    visit.created_by,
                    visit.assigned_radiologist,
                    visit.completed_at,
                    visit.notes
                ]
            );
            console.log(`Seeded visit ${visit.visit_id}.`);
        }

        for (const submission of formSubmissions) {
            await runAsync(
                `INSERT INTO form_submissions (
                    submission_id, visit_id, form_id, submitted_by, submission_status, submitted_at
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    submission.submission_id,
                    submission.visit_id,
                    submission.form_id,
                    submission.submitted_by,
                    submission.submission_status,
                    submission.submitted_at
                ]
            );
            console.log(`Seeded submission ${submission.submission_id}.`);
        }

        // Ensure form definitions exist (PET CT)
        for (const def of formDefinitions) {
            await runAsync(`INSERT OR IGNORE INTO form_definitions (form_id, form_code, form_name, form_version, form_description, form_role) VALUES (?, ?, ?, ?, ?, ?)`,
                [def.form_id, def.form_code, def.form_name, def.form_version, def.form_description, def.form_role]);
            console.log(`Ensured form definition ${def.form_code}.`);
        }

        // Seed a sample PET CT record
        for (const pet of petCtRecords) {
            await runAsync(
                `INSERT OR IGNORE INTO pet_ct_records (record_id, patient_id, visit_id, created_by, facility, treating_physician, fasting_hours, diabetic_patient, blood_sugar_level, weight_kg, height_cm, dose, injection_site, exam_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [pet.record_id, pet.patient_id, pet.visit_id, pet.created_by, pet.facility, pet.treating_physician, pet.fasting_hours, pet.diabetic_patient, pet.blood_sugar_level, pet.weight_kg, pet.height_cm, pet.dose, pet.injection_site, pet.exam_date]
            );
            console.log(`Seeded PET CT record ${pet.record_id}.`);
        }

        for (const assessment of nursingAssessments) {
            await runAsync(
                `INSERT INTO nursing_assessments (
                    assessment_id, submission_id, age, chief_complaint, accompanied_by, language_spoken,
                    temperature_celsius, pulse_bpm, blood_pressure_systolic, blood_pressure_diastolic,
                    respiratory_rate_per_min, oxygen_saturation_percent, weight_kg, height_cm,
                    psychological_problem, is_smoker, has_allergies, diet_type, appetite,
                    pain_intensity, pain_location, morse_total_score, morse_risk_level, morse_scale,
                    needs_medication_education, needs_pain_symptom_education,
                    nurse_signature_id, assessed_by, assessed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    assessment.assessment_id,
                    assessment.submission_id,
                    assessment.age,
                    assessment.chief_complaint,
                    assessment.accompanied_by,
                    assessment.language_spoken,
                    assessment.temperature_celsius,
                    assessment.pulse_bpm,
                    assessment.blood_pressure_systolic,
                    assessment.blood_pressure_diastolic,
                    assessment.respiratory_rate_per_min,
                    assessment.oxygen_saturation_percent,
                    assessment.weight_kg,
                    assessment.height_cm,
                    assessment.psychological_problem,
                    assessment.is_smoker,
                    assessment.has_allergies,
                    assessment.diet_type,
                    assessment.appetite,
                    assessment.pain_intensity,
                    assessment.pain_location,
                    assessment.morse_total_score,
                    assessment.morse_risk_level,
                    assessment.morse_scale,
                    assessment.needs_medication_education,
                    assessment.needs_pain_symptom_education,
                    assessment.nurse_signature_id,
                    assessment.assessed_by,
                    assessment.assessed_at
                ]
            );
            console.log(`Seeded nursing assessment ${assessment.assessment_id}.`);
        }

        for (const exam of radiologyExaminationForms) {
            const radiologyValues = [
                exam.id,
                exam.patient_id,
                exam.visit_id,
                exam.created_by,
                exam.form_type,
                exam.ctd1vol,
                exam.dlp,
                exam.kv,
                exam.mas,
                exam.patient_complaint,
                exam.has_gypsum_splint,
                exam.gypsum_splint_details,
                exam.has_chronic_disease,
                exam.chronic_disease_details,
                exam.current_medications,
                exam.has_allergy,
                exam.allergy_medication,
                exam.allergy_medication_details,
                exam.allergy_food,
                exam.allergy_food_details,
                exam.allergy_others,
                exam.allergy_others_details,
                exam.has_previous_operations,
                exam.operation_details,
                exam.operation_date,
                exam.operation_reason,
                exam.has_tumor_history,
                exam.tumor_location,
                exam.tumor_type,
                exam.has_swelling,
                exam.swelling_location,
                exam.has_previous_investigations,
                exam.previous_investigation_type,
                exam.previous_investigation_date,
                exam.has_fall_risk_medications,
                exam.fall_risk_medication_details,
                exam.has_fever,
                exam.is_pregnant,
                exam.is_lactating,
                exam.has_pacemaker,
                exam.has_cochlear_implant,
                exam.has_aneurysmal_clips,
                exam.has_intraocular_foreign_body,
                exam.implant_details,
                exam.has_surgical_implants,
                exam.surgical_implant_details,
                exam.has_critical_result,
                exam.critical_result_details,
                exam.patient_signature,
                exam.radiologist_signature_id,
                exam.form_status,
                exam.additional_notes,
                exam.radiologist_notes
            ];

            if (radiologyValues.length !== 53) {
                throw new Error(`Radiology examination value mismatch: expected 53, received ${radiologyValues.length}`);
            }

            const placeholders = new Array(radiologyValues.length).fill('?').join(', ');

            await runAsync(
                `INSERT INTO radiology_examination_form (
                    id, patient_id, visit_id, created_by, form_type,
                    ctd1vol, dlp, kv, mas, patient_complaint,
                    has_gypsum_splint, gypsum_splint_details,
                    has_chronic_disease, chronic_disease_details, current_medications,
                    has_allergy, allergy_medication, allergy_medication_details,
                    allergy_food, allergy_food_details, allergy_others, allergy_others_details,
                    has_previous_operations, operation_details, operation_date, operation_reason,
                    has_tumor_history, tumor_location, tumor_type,
                    has_swelling, swelling_location,
                    has_previous_investigations, previous_investigation_type, previous_investigation_date,
                    has_fall_risk_medications, fall_risk_medication_details, has_fever,
                    is_pregnant, is_lactating,
                    has_pacemaker, has_cochlear_implant, has_aneurysmal_clips, has_intraocular_foreign_body,
                    implant_details, has_surgical_implants, surgical_implant_details,
                    has_critical_result, critical_result_details,
                    patient_signature, radiologist_signature_id,
                    form_status, additional_notes, radiologist_notes
                ) VALUES (${placeholders})`,
                radiologyValues
            );
            console.log(`Seeded radiology examination ${exam.id}.`);
        }

        console.log('Database seeded successfully.');
    } catch (seedErr) {
        console.error('Error seeding database:', seedErr.message);
    } finally {
        closeDb();
    }
});