/**
 * Pre-flight validation for batch entries.
 * Catches obvious errors before invoking the LLM (saves API calls).
 */

function parseTime12h(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const mins = parseInt(match[2], 10);
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return { hours, mins, totalMinutes: hours * 60 + mins };
}

function parseDateMMDDYYYY(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    return { month, day, year, isoDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}

function convertTo24h(timeStr) {
    const parsed = parseTime12h(timeStr);
    if (!parsed) return null;
    return `${String(parsed.hours).padStart(2, '0')}:${String(parsed.mins).padStart(2, '0')}`;
}

function validateEntry(entry) {
    const errors = [];

    // Required fields
    if (!entry.patientName || !entry.patientName.trim()) {
        errors.push("Required field 'patientName' is missing or empty");
    }
    if (!entry.visitDate) {
        errors.push("Required field 'visitDate' is missing or null");
    }
    if (!entry.servicePayer || !entry.servicePayer.trim()) {
        errors.push("Required field 'servicePayer' is missing or empty");
    }
    if (!entry.employeeName || !entry.employeeName.trim()) {
        errors.push("Required field 'employeeName' is missing or empty");
    }

    // Visit time validation
    if (!entry.visitStart || !entry.visitEnd) {
        errors.push("Required fields 'visitStart' and 'visitEnd' are missing");
    }

    // Time parsing and validation
    if (entry.visitStart && entry.visitEnd && entry.visitDate) {
        const start = parseTime12h(entry.visitStart);
        const end = parseTime12h(entry.visitEnd);

        if (!start) {
            errors.push(`Invalid visitStart format: '${entry.visitStart}'`);
        }
        if (!end) {
            errors.push(`Invalid visitEnd format: '${entry.visitEnd}'`);
        }

        if (start && end && end.totalMinutes <= start.totalMinutes) {
            errors.push(`Visit end time (${entry.visitEnd}) is before start time (${entry.visitStart})`);
        }
    }

    // Duration validation
    if (entry.visitDuration !== null && entry.visitDuration !== undefined && entry.visitDuration < 0) {
        errors.push(`Visit duration is negative: ${entry.visitDuration} minutes`);
    }

    // Date format validation
    if (entry.visitDate) {
        const parsed = parseDateMMDDYYYY(entry.visitDate);
        if (!parsed) {
            errors.push(`Invalid visitDate format: '${entry.visitDate}' (expected MM/DD/YYYY)`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = { validateEntry, parseTime12h, parseDateMMDDYYYY, convertTo24h };
