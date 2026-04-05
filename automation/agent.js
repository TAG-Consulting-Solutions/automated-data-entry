const { executeTool } = require('./tools');
const { parseDateMMDDYYYY, convertTo24h } = require('./validator');

// --- Local edit-distance matching (HIPAA-safe: no data sent externally) ---

function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp[m][n];
}

function normalize(str) {
    return str.toLowerCase().replace(/[-,./]/g, ' ').replace(/\s+/g, ' ').trim();
}

function similarity(a, b) {
    const na = normalize(a), nb = normalize(b);
    if (na === nb) return 1;
    const maxLen = Math.max(na.length, nb.length);
    if (maxLen === 0) return 1;
    return 1 - levenshtein(na, nb) / maxLen;
}

const MATCH_THRESHOLD = 0.6;
const SUBSTRING_SCORE = 0.9;

/**
 * Match inputValue against a list of options using edit distance.
 * No data is sent to any external service.
 * Returns { match: { id, name }, warning: string|null } or { match: null, error: string }
 */
function fuzzyMatch(inputValue, options, fieldLabel) {
    const normInput = normalize(inputValue);

    let bestScore = -1;
    let bestOption = null;
    let exact = false;

    for (const opt of options) {
        const normOpt = normalize(opt.name);

        // Exact normalized match
        if (normInput === normOpt) {
            return { match: { id: opt.id, name: opt.name }, warning: null };
        }

        // Similarity score
        let score = similarity(inputValue, opt.name);

        // Substring containment bonus (handles partial names and version suffixes)
        if (normOpt.includes(normInput) || normInput.includes(normOpt)) {
            score = Math.max(score, SUBSTRING_SCORE);
        }

        if (score > bestScore) {
            bestScore = score;
            bestOption = opt;
        }
    }

    if (bestOption && bestScore >= MATCH_THRESHOLD) {
        const warning = bestScore < 1
            ? `${fieldLabel} fuzzy matched: '${inputValue}' → '${bestOption.name}' (score: ${bestScore.toFixed(2)})`
            : null;
        return { match: { id: bestOption.id, name: bestOption.name }, warning };
    }

    return { match: null, error: `No ${fieldLabel.toLowerCase()} matching '${inputValue}' found (best score: ${bestScore.toFixed(2)} below threshold ${MATCH_THRESHOLD})` };
}

/**
 * Process a single entry through deterministic browser automation + edit-distance matching.
 * Checks the homecare system for existing shifts before creating.
 * - If an identical shift exists → skip (SKIPPED)
 * - If a similar shift exists but differs → update it (SUCCESS/WARNING with note)
 * - If no matching shift exists → create a new one
 * Returns a result object matching the output schema.
 */
async function processEntry(entry, page) {
    const warnings = [];
    let resolved = {
        patientId: null, patientName: null,
        productPayerId: null, productPayerName: null,
        employeeId: null, employeeName: null,
        position: null, start: null, end: null
    };

    try {
        // === Step 1: Navigate to search page ===
        await executeTool(page, 'navigateToCustomerSearch', {});

        // === Step 2: Search for patient by last name ===
        const lastName = entry.patientName.split(',')[0].trim();
        const searchResult = await executeTool(page, 'searchPatient', { name: lastName });

        if (!searchResult.success || !searchResult.results || searchResult.results.length === 0) {
            return failure(entry, `No patient matching '${entry.patientName}' found in the system`);
        }

        // === Step 3: LLM fuzzy match patient ===
        const patientOptions = searchResult.results.map(r => ({ id: String(r.id), name: r.name }));
        const patientMatch = await fuzzyMatch(entry.patientName, patientOptions, 'Patient name');

        if (!patientMatch.match) {
            return failure(entry, patientMatch.error);
        }
        if (patientMatch.warning) warnings.push(patientMatch.warning);
        resolved.patientId = parseInt(patientMatch.match.id);
        resolved.patientName = patientMatch.match.name;

        // Check patient status
        const matchedPatient = searchResult.results.find(r => String(r.id) === patientMatch.match.id);
        if (matchedPatient && matchedPatient.status === 'On Hold') {
            warnings.push(`Patient '${resolved.patientName}' has status 'On Hold'`);
        }

        // === Step 4: Select patient (navigate to detail page) ===
        await executeTool(page, 'selectPatient', { patientId: resolved.patientId });

        // === Step 5: Open Add Shift modal to resolve payer/employee via dropdowns ===
        const modalResult = await executeTool(page, 'openAddShiftModal', {});
        if (!modalResult.success) {
            return failure(entry, `Failed to open shift modal: ${modalResult.error}`);
        }

        // === Step 6: Get payer options ===
        const payerResult = await executeTool(page, 'getPayerOptions', {});
        if (!payerResult.success || !payerResult.payers || payerResult.payers.length === 0) {
            await executeTool(page, 'closeAndReset', {});
            return failure(entry, 'No payer options available');
        }

        // === Step 7: LLM fuzzy match payer ===
        const payerMatch = await fuzzyMatch(entry.servicePayer, payerResult.payers, 'Service payer');

        if (!payerMatch.match) {
            await executeTool(page, 'closeAndReset', {});
            return failure(entry, payerMatch.error);
        }
        if (payerMatch.warning) warnings.push(payerMatch.warning);
        resolved.productPayerId = payerMatch.match.id;
        resolved.productPayerName = payerMatch.match.name;

        // === Step 8: Select payer (to filter employees by qualification) ===
        const selectPayerResult = await executeTool(page, 'selectPayer', { payerId: resolved.productPayerId });
        if (selectPayerResult.qualification) {
            resolved.position = selectPayerResult.qualification;
        }

        // === Step 9: Parse shift times ===
        const dateParsed = parseDateMMDDYYYY(entry.visitDate);
        const startTime24 = convertTo24h(entry.visitStart);
        const endTime24 = convertTo24h(entry.visitEnd);

        if (!dateParsed || !startTime24 || !endTime24) {
            await executeTool(page, 'closeAndReset', {});
            return failure(entry, 'Failed to parse date/time values');
        }

        resolved.start = `${entry.visitDate} ${entry.visitStart}`;
        resolved.end = `${entry.visitDate} ${entry.visitEnd}`;

        // === Step 10: Get employee options ===
        const empResult = await executeTool(page, 'getEmployeeOptions', {});
        if (!empResult.success || !empResult.employees || empResult.employees.length === 0) {
            await executeTool(page, 'closeAndReset', {});
            return failure(entry, `No employees available for qualification '${resolved.position}'. Employee '${entry.employeeName}' may not have the required qualification or may be inactive.`);
        }

        // === Step 11: LLM fuzzy match employee ===
        const empMatch = await fuzzyMatch(entry.employeeName, empResult.employees, 'Employee name');

        if (!empMatch.match) {
            await executeTool(page, 'closeAndReset', {});
            const allEmpNames = empResult.employees.map(e => e.name).join(', ');
            return failure(entry, `Employee '${entry.employeeName}' not found in available ${resolved.position} employees (available: ${allEmpNames})`);
        }
        if (empMatch.warning) warnings.push(empMatch.warning);
        resolved.employeeId = empMatch.match.id;
        resolved.employeeName = empMatch.match.name;

        // === Step 12: Check homecare system for existing shifts ===
        // Close the modal first so we can query from the patient page context
        await executeTool(page, 'closeAndReset', {});

        const entryStartISO = new Date(`${dateParsed.isoDate}T${startTime24}`).toISOString();
        const entryEndISO = new Date(`${dateParsed.isoDate}T${endTime24}`).toISOString();

        const existingResult = await executeTool(page, 'getPatientShifts', { patientId: resolved.patientId });
        if (existingResult.success && existingResult.shifts.length > 0) {
            // Find shifts on the same date for the same employee and payer
            const matchingShift = existingResult.shifts.find(s =>
                s.employeeId === resolved.employeeId &&
                s.productPayerId === resolved.productPayerId &&
                isSameDay(s.start, entryStartISO)
            );

            if (matchingShift) {
                // Check if the shift is identical
                const isIdentical =
                    matchingShift.start === entryStartISO &&
                    matchingShift.end === entryEndISO &&
                    matchingShift.position === resolved.position;

                if (isIdentical) {
                    // Shift already exists with the same details — skip
                    console.log('  [SKIPPED] Identical shift already exists in the system');
                    return {
                        status: 'SKIPPED',
                        message: 'Shift already exists with identical details. No changes needed.',
                        input: entry,
                        resolved,
                        warnings,
                        existingShiftId: matchingShift.id
                    };
                }

                // Shift exists but differs — update it
                console.log('  [UPDATING] Existing shift found with different details, updating...');
                const updates = {
                    productPayerId: resolved.productPayerId,
                    productPayerName: resolved.productPayerName,
                    employeeId: resolved.employeeId,
                    employeeName: resolved.employeeName,
                    position: resolved.position,
                    start: entryStartISO,
                    end: entryEndISO
                };

                const updateResult = await executeTool(page, 'updateShift', {
                    shiftId: matchingShift.id,
                    updates
                });

                if (!updateResult.success) {
                    return failure(entry, `Failed to update existing shift: ${updateResult.error}`);
                }

                // Build a list of what changed
                const changes = [];
                if (matchingShift.start !== entryStartISO) changes.push(`start: ${matchingShift.start} → ${entryStartISO}`);
                if (matchingShift.end !== entryEndISO) changes.push(`end: ${matchingShift.end} → ${entryEndISO}`);
                if (matchingShift.position !== resolved.position) changes.push(`position: ${matchingShift.position} → ${resolved.position}`);
                warnings.push(`Existing shift ${matchingShift.id} updated (${changes.join('; ')})`);

                const status = warnings.length > 0 ? 'WARNING' : 'SUCCESS';
                return {
                    status,
                    message: `Existing shift updated. Changes: ${changes.join('; ')}`,
                    input: entry,
                    resolved,
                    warnings,
                    updatedShiftId: matchingShift.id
                };
            }
        }

        // === Step 13: No existing shift — create new via modal ===
        const modalResult2 = await executeTool(page, 'openAddShiftModal', {});
        if (!modalResult2.success) {
            return failure(entry, `Failed to open shift modal: ${modalResult2.error}`);
        }

        // Re-select payer (modal was re-opened)
        await executeTool(page, 'selectPayer', { payerId: resolved.productPayerId });

        // Set shift times
        await executeTool(page, 'setShiftTimes', {
            startDate: dateParsed.isoDate,
            startTime: startTime24,
            endDate: dateParsed.isoDate,
            endTime: endTime24
        });

        // Select employee
        await executeTool(page, 'selectEmployee', { employeeId: resolved.employeeId });

        // === Step 14: Submit shift ===
        const submitResult = await executeTool(page, 'submitShift', {});

        if (!submitResult.success) {
            await executeTool(page, 'closeAndReset', {});
            return failure(entry, submitResult.error || 'Shift submission failed');
        }

        // === Step 15: Close and reset ===
        await executeTool(page, 'closeAndReset', {});

        // === Return result ===
        const status = warnings.length > 0 ? 'WARNING' : 'SUCCESS';
        const message = status === 'SUCCESS'
            ? 'Shift created successfully. All fields matched exactly.'
            : 'Shift created with caveats. Review warnings below.';

        return { status, message, input: entry, resolved, warnings };

    } catch (err) {
        // Cleanup on error
        try { await executeTool(page, 'closeAndReset', {}); } catch { }
        return failure(entry, `Unexpected error: ${err.message}`);
    }
}

function failure(entry, message) {
    return {
        status: 'FAILURE',
        message,
        input: entry,
        resolved: null,
        errors: [message]
    };
}

function isSameDay(isoA, isoB) {
    return new Date(isoA).toISOString().slice(0, 10) === new Date(isoB).toISOString().slice(0, 10);
}

module.exports = { processEntry, fuzzyMatch };
