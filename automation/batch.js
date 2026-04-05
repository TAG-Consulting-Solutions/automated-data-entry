require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { launchBrowser, closeBrowser } = require('./browser');
const { validateEntry } = require('./validator');
const { processEntry } = require('./agent');

const DATA_DIR = path.join(__dirname, '..', 'data');
const INPUT_DIR = path.join(DATA_DIR, 'input');
const OUTPUT_DIR = path.join(DATA_DIR, 'output');

async function runBatch(inputFiles = ['nurse-entries.json', 'caregiver-entries.json'], options = {}) {
    const headless = options.headless !== false;
    const cdpEndpoint = options.cdpEndpoint || null;
    console.log(`\n=== Batch Processing Started ===`);
    console.log(`Headless: ${headless}${cdpEndpoint ? ` | CDP: ${cdpEndpoint}` : ''}`);
    console.log(`Input files: ${inputFiles.join(', ')}`);

    // Read and merge entries from all input files
    const allEntries = [];
    for (const file of inputFiles) {
        const filePath = path.join(INPUT_DIR, file);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Input file not found: ${filePath}`);
        }
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const entries = data.entries || [];
        console.log(`Loaded ${entries.length} entries from ${file} (type: ${data.type || 'unknown'})`);
        allEntries.push(...entries);
    }

    console.log(`Total entries to process: ${allEntries.length}\n`);

    // Initialize results
    const results = [];
    let successCount = 0;
    let warningCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    // Launch browser (or connect to existing via CDP)
    const page = await launchBrowser(cdpEndpoint ? { cdpEndpoint } : { headless });
    console.log(cdpEndpoint ? 'Connected to existing browser via CDP\n' : 'Browser launched\n');

    // Process each entry sequentially
    for (let i = 0; i < allEntries.length; i++) {
        const entry = allEntries[i];
        console.log(`--- Entry ${i + 1}/${allEntries.length}: ${entry.patientName || '(empty)'} | ${entry.servicePayer || '(empty)'} ---`);

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

    // Close browser
    await closeBrowser();
    console.log('\nBrowser closed');

    // Build response
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

    // Write output file
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(OUTPUT_DIR, `batch-response-${timestamp}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(response, null, 4));
    console.log(`\nResponse written to: ${outputPath}`);

    // Summary
    console.log(`\n=== Batch Processing Complete ===`);
    console.log(`Total: ${allEntries.length} | Success: ${successCount} | Warnings: ${warningCount} | Skipped: ${skippedCount} | Failures: ${failureCount}`);

    return response;
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const inputFiles = args.length > 0 ? args : ['nurse-entries.json', 'caregiver-entries.json'];
    const headless = !args.includes('--headed');
    const cdpArg = args.find(a => a.startsWith('--cdp='));
    const cdpEndpoint = cdpArg ? cdpArg.split('=').slice(1).join('=') : null;

    runBatch(inputFiles.filter(a => !a.startsWith('--')), { headless, cdpEndpoint })
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Batch failed:', err);
            process.exit(1);
        });
}

module.exports = { runBatch };
