# Product Requirements Document (PRD) - Reachout AI

## Document Control
* **Product Name:** Reachout AI
* **Target Version:** 1.0 (MVP)
* **Author:** Solutions Architect / Product Manager
* **Status:** Draft (Pending Review)
* **Target Audience:** Engineering Team, Product Team, Church Leadership Stakeholders

---

## 1. Executive Summary & Goal
Reachout AI is a specialized follow-up automation platform for church evangelism and outreach teams. The goal is to ensure every person invited to church is consistently contacted, qualified via AI response classification, and seamlessly handed off to human volunteers for personal relationship building. 

By automating the repetitive early touches on WhatsApp and handling data normalization, we reduce coordinator workload by 80% and eliminate volunteer follow-up fatigue.

---

## 2. User Personas

### Persona A: Mr. Frank (Outreach Coordinator)
* **Profile:** Busy corporate banking professional; coordinates church evangelism on Saturdays.
* **Goals:** Ensure all contacts collected on Saturday are input into a follow-up stream; verify volunteers are doing their jobs; report progress to senior pastors.
* **Pain Points:** Volunteers lose interest; tracking follow-up via manual spreadsheets is impossible during his busy workweek; low visitor conversion on Sundays.

### Persona B: Sister Blessing (Volunteer Follow-up Worker)
* **Profile:** Active church member; works full-time; wants to help but forgets to call or text contacts.
* **Goals:** Build relationships with people who actually show interest in coming to church.
* **Pain Points:** Dislikes downloading custom management apps; forgets to follow up; finds cold outreach awkward.

### Persona C: Emeka (Outreach Contact / Lead)
* **Profile:** Individual met on the street during Saturday evangelism; gave their contact info.
* **Goals:** Wants a warm, welcoming interaction; values privacy.
* **Pain Points:** Feels harassed by daily cold calls; ignores SMS.

---

## 3. Product Architecture & User Flow

```
┌─────────────────┐       ┌──────────────────┐       ┌───────────────────┐
│  Mr. Frank      │ ────> │  Reachout AI     │ ────> │   Outreach        │
│  Uploads Sheet  │       │  Engine          │       │   Contact (Emeka) │
└─────────────────┘       └──────────────────┘       └───────────────────┘
                                   │                           │
                                   ▼                           │ Replies via
                         ┌───────────────────┐                 │ WhatsApp
                         │ AI Intent Parser  │ <───────────────┘
                         └───────────────────┘
                                   │
                         If Positive / Interested
                                   ▼
                         ┌───────────────────┐
                         │   Volunteer       │
                         │   WhatsApp Alert  │
                         └───────────────────┘
```

---

## 4. Functional Specifications

### Module 1: Contact Import & Normalization
* **Requirement 1.1:** Upload CSV or Excel files, or connect directly to a Google Sheet URL.
* **Requirement 1.2:** Map columns dynamically (First Name, Phone Number, Location, Date, Assigned Volunteer Email).
* **Requirement 1.3: Smart Phone Number Fixer (Nigeria-Specific):**
  * Auto-detect and strip leading zeros (e.g., `08031234567` becomes `+2348031234567`).
  * Add country code if missing (e.g., `8031234567` -> `+2348031234567`).
  * Remove formatting spaces or hyphens.
  * Reject invalid numbers (e.g., digits < 10 or > 15) and highlight them in red for manual correction on the screen before importing.

### Module 2: The 3-Step WhatsApp Sequence Engine
* **Requirement 2.1:** Standardized templates approved by Meta must be used to initiate contact.
* **Requirement 2.2: Scheduled Dispatch:**
  * **Message 1 (Sunday 2:00 PM):** Warm greetings & thank you for connecting. (Includes mandatory `"Reply STOP to unsubscribe"` message footer).
  * **Message 2 (Tuesday 6:00 PM):** Inspiring devotional quote or short testimonial video link.
  * **Message 3 (Friday 9:00 AM):** Formal invitation to Sunday Service with a button to confirm attendance.
* **Requirement 2.3: Immediate Opt-Out Rule:**
  * If a contact replies with any matching keyword (`STOP`, `Unsubscribe`, `Leave me`, `Comot me`, `Don't text me`), the system must immediately mark their status as `Opted-Out` and halt all scheduled cron tasks for that number.

### Module 3: AI Intent Classification
* **Requirement 3.1:** Parse incoming Webhook messages from WhatsApp using LLM (Gemini 1.5 Flash).
* **Requirement 3.2: Classification Buckets:**
  * `Opt-Out` (Negative/Unsubscribe request).
  * `Interested` (e.g., *"I will try to come"*, *"What time does it start?"*, *"Where is the church?"*, *"Amen, thank you"*).
  * `Question/Prayer` (e.g., *"Can I get a ride?"*, *"Please pray for my exams"*).
  * `Neutral/No-Response` (No action needed).
* **Requirement 3.3: Local Dialect Interpretation:**
  * LLM must be prompt-engineered to understand Nigerian Pidgin (e.g., *"I dey come"* = Interested; *"No worry, I get service"* = Negative/Opt-Out; *"I no fit"* = Negative) and localized syntax.

### Module 4: "No-App" Volunteer Routing Handoff
* **Requirement 4.1:** When a contact responds with `Interested` or `Question/Prayer`, the platform automatically looks up the assigned volunteer from the sheet import.
* **Requirement 4.2:** Dispatch an alert to the volunteer's WhatsApp using a standard template:
  > *"Hi [Volunteer Name], [Contact Name] replied to the outreach message: '[Raw Text Reply]'. Tap here to start chatting with them directly: https://wa.me/[NormalizedNumber]"*
* **Requirement 4.3:** If no volunteer was assigned during import, route the lead to a "General Pool" group chat or alert the Coordinator (Mr. Frank).

### Module 5: Analytics Dashboard (For Coordinator & Pastors)
* **Requirement 5.1:** Track core KPIs:
  * Total Imported Contacts.
  * Message Delivery Rate.
  * Active Sequences.
  * Positive Response Rate.
  * Opt-Out Rate.
* **Requirement 5.2:** Simple "Generate PDF Report" button so Frank can print or email weekly stats directly to the Senior Pastor.

---

## 5. Database Schema Design (PostgreSQL)

```sql
-- Churches (Tenants)
CREATE TABLE churches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    country VARCHAR(100) DEFAULT 'Nigeria',
    whatsapp_phone_number VARCHAR(50),
    meta_api_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Volunteers
CREATE TABLE volunteers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone_number VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Outreach Contacts (Leads)
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    phone_number VARCHAR(50) NOT NULL,
    location VARCHAR(255),
    assigned_volunteer_id UUID REFERENCES volunteers(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'Imported', -- 'Imported', 'Active', 'Engaged', 'Opted-Out', 'Completed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sequence Execution Jobs
CREATE TABLE sequence_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    step_number INT NOT NULL, -- 1, 2, or 3
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending', -- 'Pending', 'Sent', 'Failed', 'Cancelled'
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- Raw Inbound / Outbound Chat History
CREATE TABLE chat_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    direction VARCHAR(10) NOT NULL, -- 'Inbound' or 'Outbound'
    message_body TEXT NOT NULL,
    ai_classification VARCHAR(50), -- 'Interested', 'Opt-Out', 'Question', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 6. Non-Functional & Operational Requirements

### 6.1 WhatsApp Spam Guardrails
* **Opt-Out Compliance:** Every initial outbound template must have a clear exit button or text prompt.
* **Rate-limiting:** Stagger campaign dispatches so that the system does not send 500 messages simultaneously, which signals spam patterns to Meta.

### 6.2 Data Security
* **Tenant Isolation:** Ensure Postgres Row-Level Security (RLS) is enabled on all tables so that `Church A` can never query or modify `Church B`'s records.

### 6.3 Local Connectivity
* **Offline First for Coordinators:** Nigeria internet can be unreliable. The contact sheet importer must handle network retries gracefully and save progress locally before syncing to the database.

---

## 7. MVP Release Criteria

Before we can launch the MVP to our first beta parish, the software must satisfy these metrics:

| Metric | Target | Verification Method |
|---|---|---|
| **Delivery Reliability** | > 98% of queue runs execute successfully | Test suite simulating 500 queued messages |
| **Phone Format Handling** | 100% correct parsing of common Nigerian number inputs | Unit tests with 50 mock phone formats |
| **AI Intent Accuracy** | > 90% classification accuracy | Evaluated against a validation dataset of 100 sample replies (including Pidgin expressions) |
| **Opt-Out Safety** | 0 messages sent after STOP received | Manual testing & database trigger assertion |
| **Volunteer Link Execution** | Click to chat leads to correct contact chat window | Direct testing on Android/iOS WhatsApp clients |
