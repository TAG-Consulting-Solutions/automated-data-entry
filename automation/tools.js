const { BASE_URL } = require('./browser');

// Helper: wait for network idle after navigation
async function waitForStable(page, timeout = 5000) {
    try {
        await page.waitForLoadState('networkidle', { timeout });
    } catch {
        // networkidle can timeout on long-polling pages; that's fine
    }
}

// 1. Navigate to home page
async function navigateHome(page) {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    return { success: true, currentUrl: page.url() };
}

// 2. Navigate to customer search page
async function navigateToCustomerSearch(page) {
    await page.goto(`${BASE_URL}/search.html`, { waitUntil: 'networkidle' });
    // Wait for search form to be interactive
    await page.waitForSelector('#searchName', { state: 'visible', timeout: 5000 });
    return { success: true, currentUrl: page.url() };
}

// 3. Search for a patient by name — calls the same API the search UI uses
async function searchPatient(page, { name }) {
    // Call the patients API directly from the page context
    // This is the same API call that the search UI's doSearch() makes
    const results = await page.evaluate(async (searchName) => {
        const resp = await fetch(`/api/patients?q=${encodeURIComponent(searchName)}&status=${encodeURIComponent('Active,On Hold')}`);
        if (!resp.ok) return [];
        const patients = await resp.json();
        return patients.map(p => ({ id: p.id, name: p.name, status: p.status }));
    }, name);

    return { success: true, results };
}

// 4. Select a patient by clicking their row -> navigates to patient detail
async function selectPatient(page, { patientId }) {
    await page.goto(`${BASE_URL}/patient.html?id=${patientId}`, { waitUntil: 'networkidle' });

    // Wait for patient name to load
    await page.waitForFunction(
        () => document.getElementById('patientName')?.textContent !== 'Loading...',
        { timeout: 5000 }
    );

    const patientInfo = await page.evaluate(() => {
        const nameEl = document.getElementById('patientName');
        const metaEl = document.getElementById('patientMeta');
        const meta = metaEl?.textContent || '';
        const statusMatch = meta.match(/Customer - (\w[\w\s]*)/);
        return {
            patientName: nameEl?.textContent?.trim() || '',
            patientStatus: statusMatch ? statusMatch[1].trim() : ''
        };
    });

    return { success: true, ...patientInfo };
}

// 5. Open the Add Shift modal on patient page
async function openAddShiftModal(page) {
    // Click the "+" button
    const addBtn = page.locator('button.add-shift-btn');
    await addBtn.click();

    // Wait for modal to appear
    await page.waitForSelector('#shiftModal.active', { timeout: 3000 });

    return { success: true };
}

// 6. Get all payer options from the modal dropdown
async function getPayerOptions(page) {
    const payers = await page.evaluate(() => {
        const sel = document.getElementById('modalPayer');
        if (!sel) return [];
        return Array.from(sel.options)
            .filter(o => o.value)
            .map(o => ({
                id: o.value,
                name: o.textContent.trim(),
                qualification: o.dataset.qual || '',
                defaultHours: parseFloat(o.dataset.hours) || 1
            }));
    });

    return { success: true, payers };
}

// 7. Select a payer by ID and trigger onPayerChange
async function selectPayer(page, { payerId }) {
    await page.selectOption('#modalPayer', payerId);

    // Trigger change event which calls onPayerChange() → loads employees via API
    await page.evaluate(() => {
        const sel = document.getElementById('modalPayer');
        sel.dispatchEvent(new Event('change'));
    });

    // Wait for employee API call to complete
    try {
        await page.waitForResponse(
            resp => resp.url().includes('/api/employees') && resp.status() === 200,
            { timeout: 5000 }
        );
    } catch {
        // Employee API might not be called if no qualification filter
    }
    await page.waitForTimeout(500);

    const info = await page.evaluate(() => {
        const sel = document.getElementById('modalPayer');
        const opt = sel.options[sel.selectedIndex];
        return {
            payerName: opt?.textContent?.trim() || '',
            qualification: opt?.dataset?.qual || '',
            defaultHours: parseFloat(opt?.dataset?.hours) || 1
        };
    });

    return { success: true, ...info };
}

// 8. Set shift start and end date/times
// Expects: startDate (YYYY-MM-DD), startTime (HH:MM 24h), endDate (YYYY-MM-DD), endTime (HH:MM 24h)
async function setShiftTimes(page, { startDate, startTime, endDate, endTime }) {
    await page.fill('#modalStartDate', startDate);
    await page.fill('#modalStartTime', startTime);
    await page.fill('#modalEndDate', endDate);
    await page.fill('#modalEndTime', endTime);

    return { success: true };
}

// 9. Get available employee options (filtered by payer's qualification after payer selection)
async function getEmployeeOptions(page) {
    const employees = await page.evaluate(() => {
        const sel = document.getElementById('modalEmployee');
        if (!sel) return [];
        return Array.from(sel.options)
            .filter(o => o.value)
            .map(o => ({
                id: o.value,
                name: o.textContent.trim(),
                qualification: o.dataset.qual || ''
            }));
    });

    return { success: true, employees };
}

// 10. Select an employee by ID
async function selectEmployee(page, { employeeId }) {
    await page.selectOption('#modalEmployee', employeeId);

    // Trigger change -> auto-sets position
    await page.evaluate(() => {
        const sel = document.getElementById('modalEmployee');
        sel.dispatchEvent(new Event('change'));
        if (typeof onEmployeeChange === 'function') onEmployeeChange();
    });

    await page.waitForTimeout(300);

    const info = await page.evaluate(() => {
        const sel = document.getElementById('modalEmployee');
        const opt = sel.options[sel.selectedIndex];
        return {
            employeeName: opt?.textContent?.trim() || '',
            employeeId: sel.value
        };
    });

    return { success: true, ...info };
}

// 11. Submit the shift form by clicking Save
async function submitShift(page) {
    // Clear any previous error
    const preError = await page.evaluate(() => {
        const el = document.getElementById('modalError');
        return el?.style?.display !== 'none' ? el?.textContent?.trim() : null;
    });

    // Click Save
    await page.click('.modal-footer .btn-primary');

    // Wait for either toast or error
    await page.waitForTimeout(1500);

    // Check for modal error (validation failure from server)
    const modalError = await page.evaluate(() => {
        const el = document.getElementById('modalError');
        if (el && el.style.display !== 'none' && el.textContent.trim()) {
            return el.textContent.trim();
        }
        return null;
    });

    if (modalError) {
        return { success: false, error: modalError };
    }

    // Check if modal closed (success indicator)
    const modalClosed = await page.evaluate(() => {
        const modal = document.getElementById('shiftModal');
        return !modal?.classList?.contains('active');
    });

    // Check for toast message
    const toastMsg = await page.evaluate(() => {
        const toast = document.getElementById('toast');
        return toast?.textContent?.trim() || '';
    });

    if (modalClosed) {
        return { success: true, message: toastMsg || 'Shift created successfully' };
    }

    return { success: false, error: toastMsg || 'Unknown error during shift submission' };
}

// 12. Close modal and reset for next entry
async function closeAndReset(page) {
    // Close modal if still open
    const isOpen = await page.evaluate(() => {
        const modal = document.getElementById('shiftModal');
        return modal?.classList?.contains('active');
    });

    if (isOpen) {
        await page.click('.modal-close');
        await page.waitForTimeout(300);
    }

    return { success: true };
}

// 13. Get existing shifts displayed on the patient detail page for a given date
// Reads shifts from the week grid on the patient page (what's visible in the homecare system)
async function getPatientShifts(page, { patientId }) {
    const shifts = await page.evaluate(async (pid) => {
        const resp = await fetch(`/api/shifts?patientId=${encodeURIComponent(pid)}`);
        if (!resp.ok) return [];
        return resp.json();
    }, patientId);

    return {
        success: true,
        shifts: shifts.map(s => ({
            id: s.id,
            patientId: s.patientId,
            productPayerId: s.productPayerId,
            productPayerName: s.productPayerName,
            employeeId: s.employeeId,
            employeeName: s.employeeName,
            position: s.position,
            start: s.start,
            end: s.end
        }))
    };
}

// 14. Update an existing shift via the homecare system's API (from browser context)
async function updateShift(page, { shiftId, updates }) {
    const result = await page.evaluate(async ({ shiftId, updates }) => {
        const resp = await fetch(`/api/shifts/${encodeURIComponent(shiftId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        const data = await resp.json();
        if (!resp.ok) return { success: false, error: data.error || 'Update failed' };
        return { success: true, shift: data };
    }, { shiftId, updates });

    return result;
}

// Tool registry
const TOOLS = {
    navigateHome,
    navigateToCustomerSearch,
    searchPatient,
    selectPatient,
    openAddShiftModal,
    getPayerOptions,
    selectPayer,
    setShiftTimes,
    getEmployeeOptions,
    selectEmployee,
    submitShift,
    closeAndReset,
    getPatientShifts,
    updateShift
};

// Execute a tool by name with args
async function executeTool(page, toolName, args) {
    const fn = TOOLS[toolName];
    if (!fn) {
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
    try {
        return await fn(page, args);
    } catch (err) {
        return { success: false, error: `Tool ${toolName} failed: ${err.message}` };
    }
}

module.exports = { TOOLS, executeTool };
