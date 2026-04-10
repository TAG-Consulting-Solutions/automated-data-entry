const { validateEntry } = require('./validator');

/**
 * Validate an array of parsed entries: structural checks only.
 * Structural: required fields, date/time formats, duration (via validateEntry).
 * Patient/payer/employee system checks happen during automation via fuzzy matching in agent.js.
 *
 * @param {Array} entries - Parsed entry objects from parseCSV.
 * @returns {{ entries: Array, results: Array, summary: Object }}
 */
function validateCSVEntries(entries) {
    const results = [];
    let validCount = 0;
    let issueCount = 0;

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const structuralErrors = [];

        // --- Structural validation ---
        const validation = validateEntry(entry);
        if (!validation.valid) {
            structuralErrors.push(...validation.errors);
        }

        const hasIssues = structuralErrors.length > 0;
        if (hasIssues) issueCount++;
        else validCount++;

        results.push({
            index: i,
            entry,
            structuralErrors,
            systemWarnings: []
        });
    }

    return {
        entries,
        results,
        summary: {
            total: entries.length,
            valid: validCount,
            withIssues: issueCount
        }
    };
}

module.exports = { validateCSVEntries };
