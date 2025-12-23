# Vendor Integration Guide & Meeting Checklist

This document helps prepare for the integration meeting with the Hospital Information System (HIS) or Radiology Information System (RIS) vendor.

## 1. Choosing the Integration Method

They offered three options. Here is how to decide:

| Method | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **HL7 (v2.x)** | Standard healthcare protocol. Real-time. Event-driven (push). | Can be complex to parse. Requires stable network (VPN). | **Preferred** (We already built the receiver). |
| **API (REST/JSON)** | Modern, easy to debug. Flexible. | Requires them to push data (Webhooks) or us to pull (polling). | Good alternative if HL7 is too expensive/complex for them. |
| **DB View** | Direct access to data. Good for bulk import. | Security risk. Polling required (not real-time). Schema changes break integration. | **Avoid** unless necessary for initial data migration. |

---

## 2. HL7 Integration Checklist (If choosing HL7)

### ❓ Questions to Ask the Vendor

**1. Message Specifications:**
*   **Version:** "Which HL7 version do you send? (e.g., 2.3, 2.5, 2.7)"
    *   *Note: Our parser handles standard 2.x formats.*
*   **Message Types:** "Which trigger events will you send?"
    *   **ADT^A01** (Admit/Visit Notification) - *We need this for Patient Registration.*
    *   **ADT^A08** (Update Patient Info) - *We need this for updates.*
    *   **ORM^O01** (Order Message) - *We need this if you are sending Exam Orders.*

**2. Data Mapping (Crucial):**
*   **Patient Identifier (SSN):** "Which segment and field contains the National ID/SSN?"
    *   *Standard:* `PID-3` (Patient Identifier List) or `PID-19` (SSN).
    *   *Our System:* Currently expects SSN in `PID-3`.
*   **Patient Name:** "What format is the name in `PID-5`?"
    *   *Expected:* `Family^Given^Middle` or just `Full Name`.
*   **Visit/Encounter ID:** "Where is the Visit ID?"
    *   *Standard:* `PV1-19` (Visit Number).

**3. Connectivity:**
*   **Protocol:** "Do you send via MLLP (Minimal Lower Layer Protocol) over TCP/IP?" (This is standard).
*   **Network:** "Do we need a specific VPN tunnel or static IP whitelisting?"
*   **Turnaround:** "Do you expect synchronous ACKs (Allow/Reject)?"

### 📝 Information to Give the Vendor (Your "Specs")

They will ask you for your "Interface Specifications". You can tell them:

*   **Listener Type:** TCP/IP Server (MLLP).
*   **IP Address:** [Your System's Public/VPN IP] (or `localhost` if testing on same machine).
*   **Port:** `2576` (Default) or whatever you configure.
*   **Encoding:** UTF-8 / ASCII.
*   **ACK Protocol:** We return standard HL7 `ACK` messages (`MSA|AA` for success, `MSA|AE` for error).
*   **Required Fields for us:**
    1.  `PID-3` (SSN/National ID) - **Mandatory**
    2.  `PID-5` (Patient Name)
    3.  `PID-7` (Date of Birth)
    4.  `PID-8` (Gender)

---

## 3. API Integration Checklist (Fallback Option)

If HL7 is not possible, ask for **REST API** access.

**Questions:**
1.  **Documentation:** "Do you have Swagger/OpenAPI documentation?"
2.  **Authentication:** "How do we authenticate? (API Key, OAuth2, Bearer Token?)"
3.  **Webhooks:** "Can you **push** data to us (Webhooks) when a patient registers, or do we have to **poll** your API every X minutes?"
    *   *Push is better for real-time.*

---

## 4. Next Steps

1.  **Request a Sample Message:** Ask them to email you a *real* example of an ADT^A01 and ORM^O01 message from their system.
2.  **Validate Sample:** We will run this sample through our `tests/test_hl7_client.js` to see if it parses correctly.
3.  **Adjust Mapping:** If they put SSN in `PID-19` instead of `PID-3`, we simply change one line in `srv/services/hl7Service.js`.
