# Automated Data Entry

Browser automation agent for the ABS Scheduling system. Uses Playwright to automate shift entry through the web UI at `http://localhost:3000`.

## Prerequisites

- The ABS Scheduling web server must be running at the configured `BASE_URL` (default: `http://localhost:3000`)
- Node.js 18+

## Setup

```bash
npm install
npm run setup   # installs Playwright Chromium browser
```

## Configuration

Create a `.env` file:

```
BASE_URL=http://localhost:3000
ENVIRONMENT=sandbox
```

## Usage

### Run batch processing (CLI)

```bash
# Process default input files (nurse-entries.json + caregiver-entries.json)
npm start

# Process specific input files
node automation/batch.js nurse-entries.json

# Run headed (visible browser)
node automation/batch.js --headed

# Connect to existing browser via CDP
node automation/batch.js --cdp=http://localhost:9222
```

### Input files

Place entry JSON files in `data/input/`. Each file should have the format:

```json
{
    "type": "nurse|caregiver",
    "entries": [
        {
            "patientName": "Last, First",
            "servicePayer": "Payer Name",
            "employeeName": "Last, First",
            "visitDate": "MM/DD/YYYY",
            "visitStart": "HH:MM AM/PM",
            "visitEnd": "HH:MM AM/PM",
            "visitDuration": 480
        }
    ]
}
```

### Output

Batch results are written to `data/output/batch-response-<timestamp>.json`.

## Testing

Requires the web server to be running:

```bash
npm test
```

## Architecture

- `automation/batch.js` — Batch orchestrator: reads input files, launches browser, processes entries sequentially
- `automation/agent.js` — Entry processor: fuzzy-matches patients/payers/employees, checks for duplicates, creates/updates shifts
- `automation/browser.js` — Playwright browser lifecycle management
- `automation/tools.js` — Browser automation tools (navigate, search, fill forms, submit)
- `automation/validator.js` — Pre-flight input validation
