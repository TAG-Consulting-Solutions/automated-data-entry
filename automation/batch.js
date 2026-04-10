require('dotenv').config();
const fs = require('fs');
const path = require('path');
const os = require('os');
const { launchBrowser, closeBrowser, waitForLogin } = require('./browser');
const { validateEntry } = require('./validator');
const { processEntry } = require('./agent');
const { parseCSV, resultsToCSV } = require('./csv');
const { readLatestCSV, moveToProcessed } = require('./folder');
const { injectModeChooser, injectUploadToast, injectValidationOverlay, injectProgressOverlay, injectResultsOverlay } = require('./overlay');
const { validateCSVEntries } = require('./validate-csv');

const DATA_DIR = path.join(__dirname, '..', 'data');
const INPUT_DIR = path.join(DATA_DIR, 'input');
const OUTPUT_DIR = path.join(DATA_DIR, 'output');

/**
 * Load entries from a file on disk (JSON or CSV).
 * Used by CLI and tests — runBatch itself only accepts data.
 */
function loadEntriesFromFile(filePath) {
    const resolved = path.isAbsolute(filePath) ? filePath : path.join(INPUT_DIR, filePath);
    if (!fs.existsSync(resolved)) {
        throw new Error(`Input file not found: ${resolved}`);
    }
    const raw = fs.readFileSync(resolved, 'utf8');

    if (resolved.endsWith('.csv')) {
        const entries = parseCSV(raw);
        console.log(`Loaded ${entries.length} entries from ${path.basename(resolved)} (CSV)`);
        return entries;
    }

    // JSON format
    const data = JSON.parse(raw);
    const entries = data.entries || [];
    console.log(`Loaded ${entries.length} entries from ${path.basename(resolved)} (type: ${data.type || 'unknown'})`);
    return entries;
}

/**
 * Load and merge entries from multiple files on disk.
 */
function loadEntriesFromFiles(inputFiles = ['nurse-entries.json', 'caregiver-entries.json']) {
    const allEntries = [];
    for (const file of inputFiles) {
        allEntries.push(...loadEntriesFromFile(file));
    }
    return allEntries;
}

/**
 * Process a batch of entries through the automation pipeline.
 * @param {Array} entries - Array of entry objects to process (not file paths).
 * @param {Object} options - { headless, cdpEndpoint, page, skipBrowserLifecycle, onProgress }
 */
async function runBatch(entries, options = {}) {
    if (!Array.isArray(entries) || entries.length === 0) {
        throw new Error('runBatch requires a non-empty array of entries');
    }

    const allEntries = entries;
    const headless = options.headless !== false;
    const cdpEndpoint = options.cdpEndpoint || null;
    const onProgress = options.onProgress || null;
    console.log(`\n=== Batch Processing Started ===`);
    console.log(`Headless: ${headless}${cdpEndpoint ? ` | CDP: ${cdpEndpoint}` : ''}`);
    console.log(`Total entries to process: ${allEntries.length}\n`);

    // Initialize results
    const results = [];
    let successCount = 0;
    let warningCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    // Use provided page or launch browser
    let page = options.page || null;
    const manageBrowser = !page;
    if (manageBrowser) {
        page = await launchBrowser(cdpEndpoint ? { cdpEndpoint } : { headless });
        console.log(cdpEndpoint ? 'Connected to existing browser via CDP\n' : 'Browser launched\n');

        // Wait for user to log in when running with a visible browser
        if (!headless || cdpEndpoint) {
            await waitForLogin(page);
        }
    }

    // Process each entry sequentially
    for (let i = 0; i < allEntries.length; i++) {
        const entry = allEntries[i];
        console.log(`--- Entry ${i + 1}/${allEntries.length}: ${entry.patientName || '(empty)'} | ${entry.servicePayer || '(empty)'} ---`);

        // Notify progress callback
        if (onProgress) {
            try { await onProgress(i + 1, entry.patientName || '(unknown)'); } catch { }
        }

        // Pre-flight validation
        const validation = validateEntry(entry);
        if (!validation.valid) {
            console.log(`  [PREFLIGHT FAIL] ${validation.errors.join('; ')}`);
            const result = {
                status: 'FAILURE',
                message: validation.errors.length === 1 ? validation.errors[0] : 'Multiple validation errors.',
                input: entry,
                resolved: null,
                errors: validation.errors
            };
            results.push(result);
            failureCount++;
            continue;
        }

        // Process through LLM agent
        try {
            const result = await processEntry(entry, page);
            results.push(result);

            if (result.status === 'SUCCESS') successCount++;
            else if (result.status === 'WARNING') warningCount++;
            else if (result.status === 'SKIPPED') skippedCount++;
            else failureCount++;

            console.log(`  [${result.status}] ${result.message}`);
        } catch (err) {
            console.error(`  [ERROR] ${err.message}`);
            results.push({
                status: 'FAILURE',
                message: `Agent error: ${err.message}`,
                input: entry,
                resolved: null,
                errors: [`Unhandled error: ${err.message}`]
            });
            failureCount++;
        }
    }

    // Close browser only if we launched it
    if (manageBrowser) {
        await closeBrowser();
        console.log('\nBrowser closed');
    }

    // Build response (returned to caller, not written to disk)
    const response = {
        processedAt: new Date().toISOString(),
        processedBy: 'LLM Scheduling Agent',
        summary: {
            totalEntries: allEntries.length,
            success: successCount,
            warnings: warningCount,
            skipped: skippedCount,
            failures: failureCount
        },
        results
    };

    // Summary
    console.log(`\n=== Batch Processing Complete ===`);
    console.log(`Total: ${allEntries.length} | Success: ${successCount} | Warnings: ${warningCount} | Skipped: ${skippedCount} | Failures: ${failureCount}`);

    return response;
}

/**
 * Copy a file to the user's Downloads folder.
 */
function copyToDownloads(srcPath) {
    const downloadsDir = path.join(os.homedir(), 'Downloads');
    const fileName = path.basename(srcPath);
    const destPath = path.join(downloadsDir, fileName);
    fs.copyFileSync(srcPath, destPath);
    console.log(`CSV copied to: ${destPath}`);
    return destPath;
}

/**
 * Write output CSV to disk and return the file path.
 */
function writeOutputCSV(response, outputDir) {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(outputDir, `batch-results-${ts}.csv`);
    fs.writeFileSync(outputPath, resultsToCSV(response), 'utf8');
    return outputPath;
}

/**
 * Interactive CSV automation mode using Playwright-injected overlays (toast).
 * After login: show upload toast → validate → confirm → automate with progress → show results.
 */
async function runToastMode(page, cdpEndpoint) {
    while (true) {
        // Step 1: Show upload toast — wait for user to pick a CSV file
        console.log('Showing CSV upload toast...');
        const csvString = await injectUploadToast(page);

        if (!csvString) {
            console.log('Upload dismissed by user.');
            return null;
        }

        // Step 2: Parse CSV
        let entries;
        try {
            entries = parseCSV(csvString);
            console.log(`Parsed ${entries.length} entries from uploaded CSV`);
        } catch (err) {
            console.error(`CSV parse error: ${err.message}`);
            // Show error in validation overlay and let user re-upload
            await injectValidationOverlay(page, {
                results: [{ index: 0, entry: {}, structuralErrors: [err.message], systemWarnings: [] }],
                summary: { total: 0, valid: 0, withIssues: 1 }
            });
            continue; // Loop back to upload toast
        }

        // Step 3: Validate (structural only — system checks happen during automation)
        console.log('Validating entries...');
        const validationData = validateCSVEntries(entries);
        console.log(`Validation: ${validationData.summary.valid} valid, ${validationData.summary.withIssues} with issues`);

        // Step 4: Show validation results, wait for proceed/cancel
        const { proceed } = await injectValidationOverlay(page, validationData);
        if (!proceed) {
            console.log('User cancelled. Returning to upload...');
            continue; // Loop back to upload toast
        }

        // Step 5: Run automation with progress overlay
        console.log('Starting automation...');
        const progress = await injectProgressOverlay(page, entries.length);

        const response = await runBatch(entries, {
            page,
            headless: false,
            cdpEndpoint,
            onProgress: async (current, entryName) => {
                await progress.update(current, entryName);
            }
        });

        await progress.done();

        // Step 6: Write results CSV to data/output
        const outputPath = writeOutputCSV(response, path.join(DATA_DIR, 'output'));
        console.log(`Results CSV written to: ${outputPath}`);

        // Step 7: Show results overlay — wait for user action
        const { action } = await injectResultsOverlay(page, response);
        if (action === 'download') {
            copyToDownloads(outputPath);
        }

        return response;
    }
}

/**
 * Folder-based CSV automation mode.
 * Reads the most recent CSV from the specified folder, validates, runs automation,
 * writes results CSV back to the same folder.
 */
async function runFolderMode(page, folderPath, cdpEndpoint) {
    // Step 1: Read latest CSV from folder
    const { fileName, filePath, csvString } = readLatestCSV(folderPath);
    console.log(`\nLoaded CSV from folder: ${fileName}`);

    // Step 2: Parse CSV
    const entries = parseCSV(csvString);
    console.log(`Parsed ${entries.length} entries`);

    // Step 3: Validate (structural only — system checks happen during automation)
    console.log('Validating entries...');
    const validationData = validateCSVEntries(entries);
    const { summary } = validationData;
    console.log(`Validation: ${summary.valid} valid, ${summary.withIssues} with issues out of ${summary.total}`);

    if (summary.withIssues > 0) {
        for (const r of validationData.results) {
            if (r.structuralErrors.length > 0 || r.systemWarnings.length > 0) {
                const issues = [...r.structuralErrors, ...r.systemWarnings];
                console.log(`  Row ${r.index + 1} (${r.entry.patientName || '?'}): ${issues.join('; ')}`);
            }
        }
        console.log('Proceeding with automation despite issues...');
    }

    // Step 4: Run automation
    console.log('Starting automation...');
    const response = await runBatch(entries, {
        page,
        headless: false,
        cdpEndpoint
    });

    // Step 5: Write output CSV to the input folder
    const resolvedFolder = path.resolve(folderPath);
    const outputPath = writeOutputCSV(response, resolvedFolder);
    console.log(`\nResults CSV written to: ${outputPath}`);

    // Step 6: Move the processed input CSV to processed/ subfolder
    moveToProcessed(filePath);

    return response;
}

/**
 * Interactive mode: after login, ask the user to upload a CSV or read from a directory.
 * Directory mode uses a native folder picker in the browser — the user selects a folder
 * from their file explorer. Previously processed files are tracked in localStorage and
 * skipped on future scans. Loops back to the mode chooser after each batch.
 */
async function runInteractiveMode(page, cdpEndpoint) {
    while (true) {
        // Show mode chooser overlay
        const choice = await injectModeChooser(page);

        if (!choice) {
            console.log('Mode chooser dismissed by user.');
            return null;
        }

        let response;
        if (choice.mode === 'upload') {
            response = await runToastMode(page, cdpEndpoint);
        } else if (choice.mode === 'directory') {
            // CSV content was read in-browser via the native folder picker
            console.log(`Read CSV from folder: ${choice.fileName}`);

            let entries;
            try {
                entries = parseCSV(choice.csvString);
                console.log(`Parsed ${entries.length} entries from ${choice.fileName}`);
            } catch (err) {
                console.error(`CSV parse error: ${err.message}`);
                await injectValidationOverlay(page, {
                    results: [{ index: 0, entry: {}, structuralErrors: [err.message], systemWarnings: [] }],
                    summary: { total: 0, valid: 0, withIssues: 1 }
                });
                continue;
            }

            // Validate
            console.log('Validating entries...');
            const validationData = validateCSVEntries(entries);
            console.log(`Validation: ${validationData.summary.valid} valid, ${validationData.summary.withIssues} with issues`);

            const { proceed } = await injectValidationOverlay(page, validationData);
            if (!proceed) {
                console.log('User cancelled. Returning to mode chooser...');
                continue;
            }

            // Run automation with progress overlay
            console.log('Starting automation...');
            const progress = await injectProgressOverlay(page, entries.length);

            response = await runBatch(entries, {
                page,
                headless: false,
                cdpEndpoint,
                onProgress: async (current, entryName) => {
                    await progress.update(current, entryName);
                }
            });

            await progress.done();

            // Mark this file as processed in localStorage so it is skipped next time
            if (choice.fileKey) {
                await page.evaluate((fileKey) => {
                    let processed = [];
                    try { processed = JSON.parse(localStorage.getItem('automation-processed-files') || '[]'); } catch { }
                    if (!processed.includes(fileKey)) {
                        processed.push(fileKey);
                        localStorage.setItem('automation-processed-files', JSON.stringify(processed));
                    }
                }, choice.fileKey);
            }

            // Write results CSV to data/output
            const outputPath = writeOutputCSV(response, path.join(DATA_DIR, 'output'));
            console.log(`Results CSV written to: ${outputPath}`);

            // Show results with download button
            const { action } = await injectResultsOverlay(page, response);
            if (action === 'download') {
                copyToDownloads(outputPath);
            }
        }

        if (!response) {
            // User cancelled inside toast mode — loop back
            continue;
        }

        // Automation completed successfully — return so the user stays on the page
        return response;
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const folderArg = args.find(a => a.startsWith('--folder='));
    const folderPath = folderArg ? folderArg.split('=').slice(1).join('=') : null;
    const useToast = args.includes('--toast');
    const useInteractive = !folderPath && !useToast && !args.some(a => !a.startsWith('--'));
    const cdpArg = args.find(a => a.startsWith('--cdp='));
    const cdpEndpoint = cdpArg ? cdpArg.split('=').slice(1).join('=') : null;
    const headless = !args.includes('--headed') && !useToast && !folderPath;
    const outputCSV = args.includes('--csv');

    // Interactive, Toast, or Folder mode: headed browser with login
    if (useInteractive || useToast || folderPath) {
        (async () => {
            const page = await launchBrowser(cdpEndpoint ? { cdpEndpoint } : { headless: false });
            console.log(cdpEndpoint ? 'Connected to existing browser via CDP' : 'Browser launched (headed)');
            await waitForLogin(page);

            let response;
            if (folderPath) {
                response = await runFolderMode(page, folderPath, cdpEndpoint);
            } else if (useToast) {
                response = await runToastMode(page, cdpEndpoint);
            } else {
                response = await runInteractiveMode(page, cdpEndpoint);
            }

            await closeBrowser();
            console.log('Browser closed');

            if (response) {
                process.exit(0);
            } else {
                console.log('No automation was performed.');
                process.exit(0);
            }
        })().catch(err => {
            console.error('Batch failed:', err);
            process.exit(1);
        });
    } else {
        // Legacy file-based mode
        const inputFiles = args.filter(a => !a.startsWith('--'));
        const files = inputFiles.length > 0 ? inputFiles : ['nurse-entries.json', 'caregiver-entries.json'];

        const entries = loadEntriesFromFiles(files);
        runBatch(entries, { headless, cdpEndpoint })
            .then(response => {
                if (outputCSV) {
                    process.stdout.write(resultsToCSV(response) + '\n');
                } else {
                    process.stdout.write(JSON.stringify(response, null, 4) + '\n');
                }
                process.exit(0);
            })
            .catch(err => {
                console.error('Batch failed:', err);
                process.exit(1);
            });
    }
}

module.exports = { runBatch, runInteractiveMode, runToastMode, runFolderMode, loadEntriesFromFile, loadEntriesFromFiles, resultsToCSV, writeOutputCSV };
