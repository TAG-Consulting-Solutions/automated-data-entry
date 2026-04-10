/**
 * Playwright-injected UI overlays for CSV upload automation.
 * All HTML/CSS is injected via page.evaluate() — no dependency on ABS styles.
 */

const OVERLAY_STYLES = `
    #automation-overlay {
        position: fixed; z-index: 99999; font-family: 'Segoe UI', Tahoma, sans-serif;
    }
    #automation-overlay .ao-backdrop {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 99998;
    }
    #automation-overlay .ao-toast {
        position: fixed; bottom: 24px; right: 24px; width: 380px;
        background: #fff; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.25);
        padding: 20px; z-index: 99999;
    }
    #automation-overlay .ao-modal {
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: #fff; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.25);
        padding: 24px; z-index: 99999; max-width: 720px; width: 90%;
        max-height: 80vh; overflow-y: auto;
    }
    #automation-overlay h3 { margin: 0 0 12px 0; color: #003366; font-size: 16px; }
    #automation-overlay p { margin: 4px 0; color: #333; font-size: 13px; }
    #automation-overlay .ao-btn {
        display: inline-block; padding: 8px 16px; border: none; border-radius: 4px;
        cursor: pointer; font-size: 13px; font-weight: 600; margin: 4px 4px 4px 0;
    }
    #automation-overlay .ao-btn-primary { background: #003366; color: #fff; }
    #automation-overlay .ao-btn-primary:hover { background: #004488; }
    #automation-overlay .ao-btn-secondary { background: #e0e0e0; color: #333; }
    #automation-overlay .ao-btn-secondary:hover { background: #ccc; }
    #automation-overlay .ao-btn-danger { background: #c0392b; color: #fff; }
    #automation-overlay .ao-btn-danger:hover { background: #e74c3c; }
    #automation-overlay .ao-close {
        position: absolute; top: 8px; right: 12px; background: none; border: none;
        font-size: 20px; cursor: pointer; color: #666; line-height: 1;
    }
    #automation-overlay .ao-close:hover { color: #333; }
    #automation-overlay table {
        width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px;
    }
    #automation-overlay th {
        background: #003366; color: #fff; padding: 6px 8px; text-align: left;
    }
    #automation-overlay td { padding: 6px 8px; border-bottom: 1px solid #eee; }
    #automation-overlay tr:nth-child(even) td { background: #f9f9f9; }
    #automation-overlay .ao-progress-bar {
        width: 100%; height: 8px; background: #e0e0e0; border-radius: 4px;
        overflow: hidden; margin: 8px 0;
    }
    #automation-overlay .ao-progress-fill {
        height: 100%; background: #008080; border-radius: 4px;
        transition: width 0.3s ease;
    }
    #automation-overlay .ao-badge {
        display: inline-block; padding: 2px 8px; border-radius: 3px;
        font-size: 11px; font-weight: 600; color: #fff;
    }
    #automation-overlay .ao-badge-success { background: #27ae60; }
    #automation-overlay .ao-badge-warning { background: #f39c12; }
    #automation-overlay .ao-badge-failure { background: #c0392b; }
    #automation-overlay .ao-badge-skipped { background: #7f8c8d; }
    #automation-overlay .ao-file-input {
        display: block; width: 100%; padding: 12px;
        border: 2px dashed #ccc; border-radius: 6px;
        text-align: center; cursor: pointer; margin: 12px 0;
        color: #666; font-size: 13px;
    }
    #automation-overlay .ao-file-input:hover { border-color: #008080; color: #008080; }
    #automation-overlay .ao-summary {
        display: flex; gap: 12px; margin: 12px 0; flex-wrap: wrap;
    }
    #automation-overlay .ao-summary-item {
        flex: 1; min-width: 80px; text-align: center; padding: 8px;
        border-radius: 4px; background: #f5f5f5;
    }
    #automation-overlay .ao-summary-item .ao-num {
        font-size: 24px; font-weight: 700; display: block;
    }
    #automation-overlay .ao-summary-item .ao-label {
        font-size: 11px; color: #666; text-transform: uppercase;
    }
`;

function removeOverlay() {
    return `
        const existing = document.getElementById('automation-overlay');
        if (existing) existing.remove();
    `;
}

/**
 * Inject a mode chooser overlay after login.
 * Asks the user to either upload a CSV or read from a directory.
 * Directory mode uses a native folder picker (webkitdirectory) so the user can browse
 * their file explorer. Previously processed files are tracked in localStorage and skipped.
 * @returns {{ mode: 'upload' } | { mode: 'directory', csvString: string, fileName: string, fileKey: string } | null}
 */
async function injectModeChooser(page) {
    return page.evaluate((styles) => {
        return new Promise((resolve) => {
            const existing = document.getElementById('automation-overlay');
            if (existing) existing.remove();

            // Load list of previously processed files from localStorage
            let processedFiles = [];
            try {
                processedFiles = JSON.parse(localStorage.getItem('automation-processed-files') || '[]');
            } catch { processedFiles = []; }

            const lastFolder = localStorage.getItem('automation-directory') || '';
            const lastFolderHint = lastFolder
                ? '<p style="font-size: 11px; color: #888; margin: 6px 0 0 0;">Last folder used: <strong>' + lastFolder + '</strong></p>'
                : '';

            const overlay = document.createElement('div');
            overlay.id = 'automation-overlay';
            overlay.innerHTML = `
                <style>${styles}</style>
                <div class="ao-backdrop"></div>
                <div class="ao-modal" style="max-width: 500px;">
                    <button class="ao-close" id="ao-dismiss">&times;</button>
                    <h3>📋 Shift Entry Automation</h3>
                    <p>Choose how to provide your CSV shift data:</p>

                    <div style="margin: 20px 0; display: flex; flex-direction: column; gap: 16px;">
                        <div style="border: 1px solid #e0e0e0; border-radius: 6px; padding: 16px; cursor: pointer;"
                             id="ao-opt-upload"
                             onmouseover="this.style.borderColor='#008080'"
                             onmouseout="this.style.borderColor='#e0e0e0'">
                            <strong style="display: block; margin-bottom: 4px; color: #003366;">📤 Upload CSV File</strong>
                            <span style="font-size: 12px; color: #666;">Select a single CSV file from your computer to upload and process.</span>
                        </div>

                        <div style="border: 1px solid #e0e0e0; border-radius: 6px; padding: 16px;"
                             id="ao-opt-directory-card">
                            <strong style="display: block; margin-bottom: 8px; color: #003366;">📁 Read from Directory</strong>
                            <span style="font-size: 12px; color: #666;">Select a folder from your file explorer. The agent will find the most recent CSV and skip previously processed files.</span>
                            <div style="margin-top: 10px;">
                                <label class="ao-btn ao-btn-primary" style="display: inline-block; cursor: pointer;">
                                    Select Folder
                                    <input type="file" webkitdirectory id="ao-dir-input" style="display: none;">
                                </label>
                            </div>
                            ${lastFolderHint}
                            <p id="ao-dir-status" style="font-size: 12px; color: #008080; font-weight: 600; margin: 8px 0 0 0; display: none;"></p>
                            <p id="ao-dir-error" style="color: #c0392b; font-size: 12px; margin: 6px 0 0 0; display: none;"></p>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            // Upload option
            document.getElementById('ao-opt-upload').addEventListener('click', () => {
                overlay.remove();
                resolve({ mode: 'upload' });
            });

            // Directory option — native folder picker via webkitdirectory
            document.getElementById('ao-dir-input').addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                const statusEl = document.getElementById('ao-dir-status');
                const errorEl = document.getElementById('ao-dir-error');

                // Filter for .csv files only
                const csvFiles = files.filter(f => f.name.toLowerCase().endsWith('.csv'));

                if (csvFiles.length === 0) {
                    errorEl.textContent = 'No .csv files found in the selected folder.';
                    errorEl.style.display = 'block';
                    statusEl.style.display = 'none';
                    return;
                }

                // Exclude previously processed files (matched by name + lastModified)
                const unprocessed = csvFiles.filter(f => {
                    const key = f.name + '|' + f.lastModified;
                    return !processedFiles.includes(key);
                });

                if (unprocessed.length === 0) {
                    errorEl.textContent = 'All CSV files in this folder have already been processed.';
                    errorEl.style.display = 'block';
                    statusEl.style.display = 'none';
                    return;
                }

                // Pick the most recently modified unprocessed file
                unprocessed.sort((a, b) => b.lastModified - a.lastModified);
                const latest = unprocessed[0];

                statusEl.textContent = 'Reading: ' + latest.name + '...';
                statusEl.style.display = 'block';
                errorEl.style.display = 'none';

                const reader = new FileReader();
                reader.onload = () => {
                    // Save folder name for display on next run
                    const folderName = latest.webkitRelativePath
                        ? latest.webkitRelativePath.split('/')[0]
                        : '';
                    if (folderName) {
                        localStorage.setItem('automation-directory', folderName);
                    }

                    overlay.remove();
                    resolve({
                        mode: 'directory',
                        csvString: reader.result,
                        fileName: latest.name,
                        fileKey: latest.name + '|' + latest.lastModified
                    });
                };
                reader.onerror = () => {
                    errorEl.textContent = 'Failed to read ' + latest.name + '.';
                    errorEl.style.display = 'block';
                    statusEl.style.display = 'none';
                };
                reader.readAsText(latest);
            });

            // Dismiss
            document.getElementById('ao-dismiss').addEventListener('click', () => {
                overlay.remove();
                resolve(null);
            });
        });
    }, OVERLAY_STYLES);
}

/**
 * Inject a floating toast for CSV file upload.
 * Returns a Promise that resolves with the raw CSV string, or null if dismissed.
 */
async function injectUploadToast(page) {
    return page.evaluate((styles) => {
        return new Promise((resolve) => {
            // Remove any existing overlay
            const existing = document.getElementById('automation-overlay');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.id = 'automation-overlay';
            overlay.innerHTML = `
                <style>${styles}</style>
                <div class="ao-backdrop"></div>
                <div class="ao-modal" style="max-width: 480px;">
                    <button class="ao-close" id="ao-dismiss">&times;</button>
                    <h3>📋 Upload Shift CSV</h3>
                    <p>Select a CSV file with shift entries to begin automation.</p>
                    <label class="ao-file-input" id="ao-file-label">
                        Click to select a .csv file
                        <input type="file" accept=".csv" id="ao-file-input"
                               style="display:none">
                    </label>
                    <p id="ao-file-name" style="color:#008080; font-weight:600; display:none"></p>
                    <button class="ao-btn ao-btn-primary" id="ao-upload-btn" disabled>Upload & Validate</button>
                </div>
            `;
            document.body.appendChild(overlay);

            let csvContent = null;

            document.getElementById('ao-file-input').addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    csvContent = reader.result;
                    document.getElementById('ao-file-name').textContent = file.name;
                    document.getElementById('ao-file-name').style.display = 'block';
                    document.getElementById('ao-file-label').style.display = 'none';
                    document.getElementById('ao-upload-btn').disabled = false;
                };
                reader.readAsText(file);
            });

            document.getElementById('ao-upload-btn').addEventListener('click', () => {
                if (csvContent) {
                    overlay.remove();
                    resolve(csvContent);
                }
            });

            document.getElementById('ao-dismiss').addEventListener('click', () => {
                overlay.remove();
                resolve(null);
            });
        });
    }, OVERLAY_STYLES);
}

/**
 * Inject a validation results overlay.
 * Shows structural errors and system warnings per entry.
 * Returns a Promise resolving to { proceed: true/false }.
 */
async function injectValidationOverlay(page, validationData) {
    return page.evaluate(({ styles, data }) => {
        return new Promise((resolve) => {
            const existing = document.getElementById('automation-overlay');
            if (existing) existing.remove();

            const { results, summary } = data;
            const issues = results.filter(r => r.structuralErrors.length > 0 || r.systemWarnings.length > 0);

            let issueRows = '';
            if (issues.length > 0) {
                issueRows = issues.map(r => {
                    const allIssues = [
                        ...r.structuralErrors.map(e => `<span style="color:#c0392b">❌ ${e}</span>`),
                        ...r.systemWarnings.map(w => `<span style="color:#f39c12">⚠️ ${w}</span>`)
                    ].join('<br>');
                    return `<tr>
                        <td>${r.index + 1}</td>
                        <td>${r.entry.patientName || '(empty)'}</td>
                        <td>${allIssues}</td>
                    </tr>`;
                }).join('');
            }

            const hasErrors = results.some(r => r.structuralErrors.length > 0);

            const overlay = document.createElement('div');
            overlay.id = 'automation-overlay';
            overlay.innerHTML = `
                <style>${styles}</style>
                <div class="ao-backdrop"></div>
                <div class="ao-modal">
                    <button class="ao-close" id="ao-dismiss">&times;</button>
                    <h3>📋 CSV Validation Results</h3>
                    <div class="ao-summary">
                        <div class="ao-summary-item">
                            <span class="ao-num">${summary.total}</span>
                            <span class="ao-label">Total</span>
                        </div>
                        <div class="ao-summary-item">
                            <span class="ao-num" style="color:#27ae60">${summary.valid}</span>
                            <span class="ao-label">Valid</span>
                        </div>
                        <div class="ao-summary-item">
                            <span class="ao-num" style="color:#c0392b">${summary.withIssues}</span>
                            <span class="ao-label">With Issues</span>
                        </div>
                    </div>
                    ${issues.length > 0 ? `
                        <p style="margin-top:12px"><strong>Issues found:</strong></p>
                        <div style="max-height: 300px; overflow-y: auto;">
                        <table>
                            <thead><tr><th>#</th><th>Patient</th><th>Issues</th></tr></thead>
                            <tbody>${issueRows}</tbody>
                        </table>
                        </div>
                        ${hasErrors
                        ? `<p style="color:#c0392b; font-size:12px">⚠️ Entries with structural errors will fail during automation. You can proceed anyway or cancel to fix the CSV.</p>`
                        : `<p style="color:#f39c12; font-size:12px">⚠️ System warnings found. These may resolve during automation via fuzzy matching.</p>`
                    }
                    ` : `
                        <p style="color:#27ae60; margin-top:12px">✅ All entries passed validation.</p>
                    `}
                    <div style="margin-top: 16px; display: flex; gap: 8px;">
                        <button class="ao-btn ao-btn-primary" id="ao-proceed">Proceed with Automation</button>
                        <button class="ao-btn ao-btn-secondary" id="ao-cancel">Cancel & Re-upload</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            document.getElementById('ao-proceed').addEventListener('click', () => {
                overlay.remove();
                resolve({ proceed: true });
            });
            document.getElementById('ao-cancel').addEventListener('click', () => {
                overlay.remove();
                resolve({ proceed: false });
            });
            document.getElementById('ao-dismiss').addEventListener('click', () => {
                overlay.remove();
                resolve({ proceed: false });
            });
        });
    }, { styles: OVERLAY_STYLES, data: validationData });
}

/**
 * Inject a progress overlay during automation.
 * Returns an object with an update(current, entryName) function and a done() function.
 */
async function injectProgressOverlay(page, total) {
    await page.evaluate(({ styles, total }) => {
        const existing = document.getElementById('automation-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'automation-overlay';
        overlay.innerHTML = `
            <style>${styles}</style>
            <div class="ao-backdrop"></div>
            <div class="ao-modal" style="max-width: 480px;">
                <h3>⚙️ Automation in Progress</h3>
                <p id="ao-progress-text">Preparing to process ${total} entries...</p>
                <div class="ao-progress-bar">
                    <div class="ao-progress-fill" id="ao-progress-fill" style="width: 0%"></div>
                </div>
                <p id="ao-progress-detail" style="font-size: 12px; color: #666;">Starting...</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }, { styles: OVERLAY_STYLES, total });

    return {
        update: async (current, entryName) => {
            await page.evaluate(({ current, total, entryName }) => {
                const pct = Math.round((current / total) * 100);
                const fill = document.getElementById('ao-progress-fill');
                const text = document.getElementById('ao-progress-text');
                const detail = document.getElementById('ao-progress-detail');
                if (fill) fill.style.width = pct + '%';
                if (text) text.textContent = `Processing entry ${current} of ${total}...`;
                if (detail) detail.textContent = entryName || '';
            }, { current, total, entryName });
        },
        done: async () => {
            await page.evaluate(() => {
                const overlay = document.getElementById('automation-overlay');
                if (overlay) overlay.remove();
            });
        }
    };
}

/**
 * Inject a results overlay showing the automation outcome.
 * Includes a "Download Results CSV" button that generates the file client-side.
 * Returns a Promise that resolves when the user clicks Close.
 */
async function injectResultsOverlay(page, response, csvString) {
    return page.evaluate(({ styles, response, csvString }) => {
        return new Promise((resolve) => {
            const existing = document.getElementById('automation-overlay');
            if (existing) existing.remove();

            const s = response.summary;
            const resultRows = response.results.map((r, i) => {
                const badgeClass = {
                    SUCCESS: 'ao-badge-success', WARNING: 'ao-badge-warning',
                    FAILURE: 'ao-badge-failure', SKIPPED: 'ao-badge-skipped'
                }[r.status] || 'ao-badge-failure';

                return `<tr>
                    <td>${i + 1}</td>
                    <td><span class="ao-badge ${badgeClass}">${r.status}</span></td>
                    <td>${r.input?.patientName || ''}</td>
                    <td>${r.input?.employeeName || ''}</td>
                    <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap"
                        title="${(r.message || '').replace(/"/g, '&quot;')}">${r.message || ''}</td>
                </tr>`;
            }).join('');

            const overlay = document.createElement('div');
            overlay.id = 'automation-overlay';
            overlay.innerHTML = `
                <style>${styles}</style>
                <div class="ao-backdrop"></div>
                <div class="ao-modal">
                    <h3>✅ Automation Complete</h3>
                    <div class="ao-summary">
                        <div class="ao-summary-item">
                            <span class="ao-num">${s.totalEntries}</span>
                            <span class="ao-label">Total</span>
                        </div>
                        <div class="ao-summary-item">
                            <span class="ao-num" style="color:#27ae60">${s.success}</span>
                            <span class="ao-label">Success</span>
                        </div>
                        <div class="ao-summary-item">
                            <span class="ao-num" style="color:#f39c12">${s.warnings}</span>
                            <span class="ao-label">Warnings</span>
                        </div>
                        <div class="ao-summary-item">
                            <span class="ao-num" style="color:#7f8c8d">${s.skipped || 0}</span>
                            <span class="ao-label">Skipped</span>
                        </div>
                        <div class="ao-summary-item">
                            <span class="ao-num" style="color:#c0392b">${s.failures}</span>
                            <span class="ao-label">Failures</span>
                        </div>
                    </div>
                    <div style="max-height: 350px; overflow-y: auto; margin: 12px 0;">
                    <table>
                        <thead><tr><th>#</th><th>Status</th><th>Patient</th><th>Employee</th><th>Message</th></tr></thead>
                        <tbody>${resultRows}</tbody>
                    </table>
                    </div>
                    <div style="margin-top: 16px; display: flex; gap: 8px;">
                        <button class="ao-btn ao-btn-primary" id="ao-download-csv">📥 Download Results CSV</button>
                        <button class="ao-btn ao-btn-secondary" id="ao-close-results">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            document.getElementById('ao-download-csv').addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const a = document.createElement('a');
                a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvString);
                const ts = new Date().toISOString().replace(/[:.]/g, '-');
                a.download = `batch-results-${ts}.csv`;
                a.style.display = 'none';
                document.getElementById('automation-overlay').appendChild(a);
                a.click();
                a.remove();
            });

            document.getElementById('ao-close-results').addEventListener('click', () => {
                overlay.remove();
                resolve();
            });
        });
    }, { styles: OVERLAY_STYLES, response, csvString });
}

module.exports = {
    injectModeChooser,
    injectUploadToast,
    injectValidationOverlay,
    injectProgressOverlay,
    injectResultsOverlay
};
