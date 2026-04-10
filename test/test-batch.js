/**
 * End-to-end test for batch entry automation.
 * Requires the ABS Scheduling web server to be running at BASE_URL.
 * Calls runBatch() directly to test the automation pipeline.
 */
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { runBatch, loadEntriesFromFiles } = require('../automation/batch');
const { parseCSV, resultsToCSV } = require('../automation/csv');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function request(method, urlPath, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlPath, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method,
            headers: { 'Content-Type': 'application/json' }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function resetShifts() {
    // Delete all existing shifts via the web server API
    const resp = await request('GET', '/api/shifts');
    if (resp.status === 200 && Array.isArray(resp.body)) {
        for (const shift of resp.body) {
            await request('DELETE', `/api/shifts/${shift.id}`);
        }
    }
    console.log('Shifts reset via API');
}

async function runTests() {
    console.log('\n=== Test Suite: Batch Entry Automation ===\n');
    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  ✓ ${message}`);
            passed++;
        } else {
            console.log(`  ✗ ${message}`);
            failed++;
        }
    }

    // 1. Verify server is running
    try {
        const healthCheck = await request('GET', '/api/patients');
        assert(healthCheck.status === 200, 'Web server is running');
    } catch {
        console.error('Web server is not running. Start abs-scheduling-web first.');
        process.exit(1);
    }

    // 2. Reset shifts
    await resetShifts();

    // 3. Run batch entry directly
    console.log('\nRunning batch entry (this may take several minutes)...\n');

    const startTime = Date.now();
    const entries = loadEntriesFromFiles(['nurse-entries.json', 'caregiver-entries.json']);
    const response = await runBatch(entries, { headless: true });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`Batch completed in ${elapsed}s\n`);

    // 4. Validate response structure
    assert(response.processedAt, 'Response has processedAt timestamp');
    assert(response.processedBy === 'LLM Scheduling Agent', 'Response has correct processedBy');
    assert(response.summary, 'Response has summary');
    assert(Array.isArray(response.results), 'Response has results array');

    const { summary, results } = response;
    console.log(`\nSummary: Total=${summary.totalEntries} Success=${summary.success} Warnings=${summary.warnings} Failures=${summary.failures}\n`);

    // 5. Validate total count (17 nurse + 13 caregiver = 30)
    assert(summary.totalEntries === 30, `Total entries is 30 (got ${summary.totalEntries})`);
    assert(results.length === 30, `Results array has 30 items (got ${results.length})`);

    // 6. Validate each result has required fields
    let structureValid = true;
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (!r.status || !r.message || !r.input) {
            console.log(`  ✗ Result ${i + 1} missing required fields`);
            structureValid = false;
            break;
        }
        if (!['SUCCESS', 'WARNING', 'FAILURE'].includes(r.status)) {
            console.log(`  ✗ Result ${i + 1} has invalid status: ${r.status}`);
            structureValid = false;
            break;
        }
    }
    if (structureValid) {
        assert(true, 'All results have valid structure (status, message, input)');
    }

    // 7. Check that known-FAILURE entries actually failed
    const failureEntries = results.filter(r => r.status === 'FAILURE');
    const successEntries = results.filter(r => r.status === 'SUCCESS' || r.status === 'WARNING');

    assert(failureEntries.length >= 8, `At least 8 failures detected (got ${failureEntries.length})`);
    assert(successEntries.length >= 10, `At least 10 successes/warnings (got ${successEntries.length})`);

    // 8. Specific failure cases
    const baxterResult = results.find(r => r.input?.patientName === 'Baxter, Jonathan');
    assert(baxterResult?.status === 'FAILURE', 'Baxter, Jonathan → FAILURE (patient not found)');

    const rodriguezResult = results.find(r => r.input?.employeeName === 'Rodriguez, Carmen');
    assert(rodriguezResult?.status === 'FAILURE', 'Rodriguez, Carmen → FAILURE (employee not found)');

    const washingtonResult = results.find(r => r.input?.employeeName === 'Washington, Kevin');
    assert(washingtonResult?.status === 'FAILURE', 'Washington, Kevin → FAILURE (inactive employee)');

    const qualMismatchResult = results.find(r =>
        r.input?.patientName === 'Gonzalez, Maria' &&
        r.input?.employeeName === 'Guerra, Brendalee' &&
        r.input?.servicePayer === 'Aetna - Skilled Nursing RN - Standard'
    );
    assert(qualMismatchResult?.status === 'FAILURE', 'Guerra as Caregiver for RN payer → FAILURE (qual mismatch)');

    const bluecrossResult = results.find(r => r.input?.servicePayer === 'BlueCross BlueShield PPO Gold Plan');
    assert(bluecrossResult?.status === 'FAILURE', 'BlueCross payer → FAILURE (unrecognizable)');

    const nullDateResult = results.find(r => r.input?.visitDate === null);
    assert(nullDateResult?.status === 'FAILURE', 'Null visitDate → FAILURE (pre-flight validation)');

    const negativeDuration = results.find(r => r.input?.visitDuration === -360);
    assert(negativeDuration?.status === 'FAILURE', 'Negative duration → FAILURE (pre-flight validation)');

    const morganResult = results.find(r => r.input?.patientName === 'Morgan, Diane');
    assert(morganResult?.status === 'FAILURE', 'Morgan, Diane → FAILURE (patient not found)');

    const santosResult = results.find(r => r.input?.employeeName === 'Santos, Miguel');
    assert(santosResult?.status === 'FAILURE', 'Santos, Miguel → FAILURE (employee not found)');

    const unitedResult = results.find(r => r.input?.servicePayer === 'UnitedHealth Group Premium Select');
    assert(unitedResult?.status === 'FAILURE', 'UnitedHealth payer → FAILURE (unrecognizable)');

    // 9. Check shifts were created
    const shiftsResp = await request('GET', '/api/shifts');
    const createdShifts = shiftsResp.body;
    assert(Array.isArray(createdShifts) && createdShifts.length > 0, `Shifts were created in DB (count: ${createdShifts.length})`);
    assert(createdShifts.length === successEntries.length,
        `Shift count (${createdShifts.length}) matches success+warning count (${successEntries.length})`);

    // 10. Verify CSV round-trip (no files written to disk)
    const csv = resultsToCSV(response);
    assert(typeof csv === 'string' && csv.length > 0, 'resultsToCSV produces non-empty string');
    const csvLines = csv.split('\n');
    assert(csvLines.length === results.length + 1, `CSV has header + ${results.length} data rows (got ${csvLines.length} lines)`);
    assert(csvLines[0].startsWith('status,message,'), 'CSV header starts with expected columns');

    // Summary
    console.log(`\n=== Test Results: ${passed} passed, ${failed} failed ===\n`);

    // Print detailed results table
    console.log('Detailed Results:');
    console.log('-'.repeat(100));
    results.forEach((r, i) => {
        const status = r.status.padEnd(8);
        const patient = (r.input?.patientName || '').padEnd(25);
        const employee = (r.input?.employeeName || '').padEnd(22);
        const msg = r.message?.substring(0, 40) || '';
        console.log(`  ${String(i + 1).padStart(2)}. [${status}] ${patient} ${employee} ${msg}`);
    });

    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Test suite error:', err);
    process.exit(1);
});
