# HIPAA-Compliant LLM Scheduling Prototype Plan

## Overview
This document outlines a plan to build a **HIPAA-conscious automated data entry prototype** for a homecare scheduling system using an LLM-assisted browser automation approach.

The system will:
- Accept structured JSON input from a client-side browser
- Use an LLM (Gemini) for orchestration (NOT normalization)
- Automate scheduling actions via browser automation
- Mirror the existing manual workflow exactly

---

## Key Constraints
- No software installation required on client machines
- Must be callable from a browser
- Input data is already normalized (but may contain inconsistencies)
- Must not store or persist PHI
- Must operate against an existing web-based scheduling system

---

## Environment Configuration

- BASE_URL=http://localhost:3000/
- ENVIRONMENT=sandbox

### Sandbox Details
- URL: http://localhost:3000/
- Type: Mock scheduling system (Node.js)
- Purpose: Safe testing and demo execution

---

## High-Level Architecture

```
Client Browser
    ↓
Backend API (Node.js / Python)
    ↓
Automation Layer (Playwright)
    ↓
Scheduling Web Application
```

---

## Input Data Contract

Each entry contains:

```json
{
  "patientName": "Last, First",
  "servicePayer": "Exact Match Required",
  "employeeName": "Last, First",
  "visitDate": "YYYY-MM-DD",
  "visitStart": "HH:MM" | null,
  "visitEnd": "HH:MM" | null,
  "visitDuration": number | null
}
```

### Important Note
Even though input is considered "normalized", real-world inconsistencies exist:
- Slight name mismatches
- Service payer formatting differences
- Missing time fields

System should NOT auto-correct silently — must surface errors.

---

## UI Selectors (Authoritative Mapping)

### Home Page

#### Customer Search Navigation
- Preferred: getByText("Customer Search")
- CSS Fallback: a.quick-link-item:has-text("Customer Search")
- Recommended Improvement: [data-testid="customer-search-btn"]

#### Navigation Outcome
- Redirect URL: /search.html

---

## Core Workflow (Deterministic Functions)

```
runBatch()
 ├── login()
 ├── goToCustomerSearch()
 ├── processEntry(entry)
       ├── validateEntry(entry)
       ├── searchPatient()
       ├── selectPatient()
       ├── openSchedulingTab()
       ├── selectDate()
       ├── fillForm()
       ├── submit()
       ├── captureResult()
```

---

## Detailed Step Implementation

### 1. login()
- Navigate to BASE_URL
- Enter credentials (if required)
- Verify successful login

### 2. goToCustomerSearch()
- Click "Customer Search" quick link
- Wait for navigation to /search.html

### 3. searchPatient()
- Input patient name
- Handle partial vs exact match
- FAIL if not found

### 4. selectPatient()
- Select correct patient profile

### 5. openSchedulingTab()
- Navigate to scheduling tab

### 6. selectDate()
- Select correct visit date

### 7. fillForm(entry)

#### Product Payer
- MUST exactly match system value
- Use dropdown selection
- FAIL if not found

#### Time Logic
- If start + end provided → use directly
- If duration only → compute end time
- If insufficient data → FAIL

#### Employee
- Select employee
- Validate exists and active

---

## Validation Rules

### FAIL Conditions
- Patient not found
- Employee not found
- Employee inactive
- Qualification mismatch
- End time < Start time
- Missing required fields
- Invalid service payer
- Double booking

### WARNING Conditions
- Minor name mismatch
- Service payer formatting differences

---

## Output Format

```json
{
  "results": [
    {
      "entryId": number,
      "status": "SUCCESS | FAILURE | WARNING",
      "message": "description"
    }
  ]
}
```

---

## Browser Control Strategy

### Recommended Approach: Controlled Browser Instance
- Use Playwright to launch browser
- Navigate to BASE_URL
- Execute workflow

---

## Execution Rules

- Process entries sequentially
- Retry failed steps up to 2 times
- Capture screenshots on failure (optional)

---

## HIPAA-Conscious Design

### Prototype Rules
- Use mock/test data only
- Do NOT persist data
- Do NOT log PHI
- Process data in memory only

### Future Considerations
- Encrypted transport (HTTPS)
- Role-based access
- Audit logging
- BAA-compliant vendors

---

## Minimal Tech Stack

- Backend: Node.js (Express) or Python (FastAPI)
- Automation: Playwright
- LLM: Gemini (client-integrated)

---

## 1–2 Day Build Plan

### Day 1
- Setup Playwright
- Implement login()
- Implement goToCustomerSearch()
- Implement patient search

### Day 2
- Implement scheduling workflow
- Implement validation rules
- Process batch JSON
- Return structured results

---

## Future Migration to LangGraph

Each function maps directly to a future node:
- login → node
- goToCustomerSearch → node
- searchPatient → node
- fillForm → node

Enables:
- Stateful retries
- Conditional branching
- Multi-step workflows

---

## Open Questions

1. What are selectors for search page and scheduling form?
2. How are validation errors displayed in UI?
3. Are dropdowns searchable or static?
4. Is there session timeout handling?

---

## Final Notes

Focus on:
- Deterministic execution
- Reliability over intelligence
- Clear success/failure reporting

Goal:
"Demonstrate that an AI-assisted system can reliably automate manual scheduling workflows in a safe, controlled environment."

