/**
 * CSV parsing and generation for batch entry automation.
 * Handles CSV ↔ entry object conversion with no disk storage.
 */

const ENTRY_COLUMNS = [
    'patientName',
    'servicePayer',
    'employeeName',
    'employeeQualification',
    'visitDate',
    'visitStart',
    'visitEnd',
    'visitDuration',
    'medicalOrder'
];

const RESULT_COLUMNS = [
    'status',
    'message',
    'patientName',
    'servicePayer',
    'employeeName',
    'employeeQualification',
    'visitDate',
    'visitStart',
    'visitEnd',
    'visitDuration',
    'medicalOrder',
    'resolvedPatientName',
    'resolvedEmployeeName',
    'resolvedPayerName',
    'resolvedPosition',
    'warnings'
];

/**
 * Parse a CSV field value, handling quoted fields with embedded commas/newlines.
 */
function parseCSVRow(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];

        if (inQuotes) {
            if (ch === '"') {
                // Escaped quote ("") or end of quoted field
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++; // skip next quote
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                fields.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
    }
    fields.push(current.trim());
    return fields;
}

/**
 * Parse CSV string into an array of entry objects.
 * First row must be a header row with column names matching entry fields.
 * @param {string} csvString - Raw CSV content.
 * @returns {Array} Array of entry objects.
 */
function parseCSV(csvString) {
    const lines = csvString.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    // Filter out empty lines
    const nonEmpty = lines.filter(l => l.trim().length > 0);
    if (nonEmpty.length < 2) {
        throw new Error('CSV must have a header row and at least one data row');
    }

    const headers = parseCSVRow(nonEmpty[0]);

    // Validate that required columns are present
    const required = ['patientName', 'servicePayer', 'employeeName', 'visitDate', 'visitStart', 'visitEnd'];
    const missing = required.filter(col => !headers.includes(col));
    if (missing.length > 0) {
        throw new Error(`CSV missing required columns: ${missing.join(', ')}`);
    }

    const entries = [];
    for (let i = 1; i < nonEmpty.length; i++) {
        const values = parseCSVRow(nonEmpty[i]);
        const entry = {};

        for (let j = 0; j < headers.length; j++) {
            const key = headers[j];
            let val = j < values.length ? values[j] : '';

            // Convert numeric fields
            if (key === 'visitDuration') {
                val = val === '' ? null : Number(val);
            }
            // Convert empty strings to null for nullable fields
            else if (val === '') {
                val = null;
            }

            entry[key] = val;
        }

        entries.push(entry);
    }

    return entries;
}

/**
 * Escape a value for CSV output.
 */
function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

/**
 * Convert batch response results into a CSV string.
 * @param {Object} response - The response object from runBatch.
 * @returns {string} CSV string with headers and one row per result.
 */
function resultsToCSV(response) {
    const rows = [RESULT_COLUMNS.join(',')];

    for (const r of response.results) {
        const input = r.input || {};
        const resolved = r.resolved || {};
        const row = [
            escapeCSV(r.status),
            escapeCSV(r.message),
            escapeCSV(input.patientName),
            escapeCSV(input.servicePayer),
            escapeCSV(input.employeeName),
            escapeCSV(input.employeeQualification),
            escapeCSV(input.visitDate),
            escapeCSV(input.visitStart),
            escapeCSV(input.visitEnd),
            escapeCSV(input.visitDuration),
            escapeCSV(input.medicalOrder),
            escapeCSV(resolved.patientName),
            escapeCSV(resolved.employeeName),
            escapeCSV(resolved.productPayerName),
            escapeCSV(resolved.position),
            escapeCSV((r.warnings || []).join('; '))
        ];
        rows.push(row.join(','));
    }

    return rows.join('\n');
}

module.exports = { parseCSV, resultsToCSV, ENTRY_COLUMNS, RESULT_COLUMNS };
