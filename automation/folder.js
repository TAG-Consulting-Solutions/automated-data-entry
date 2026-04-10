const fs = require('fs');
const path = require('path');

/**
 * Read the most recent .csv file from a folder (by modification time).
 * Skips the `processed/` subdirectory so already-handled files are not re-read.
 * @param {string} folderPath - Absolute or relative path to the folder.
 * @returns {{ fileName: string, filePath: string, csvString: string }}
 */
function readLatestCSV(folderPath) {
    const resolved = path.resolve(folderPath);

    if (!fs.existsSync(resolved)) {
        throw new Error(`Folder not found: ${resolved}`);
    }

    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
        throw new Error(`Path is not a directory: ${resolved}`);
    }

    const csvFiles = fs.readdirSync(resolved)
        .filter(f => {
            if (!f.toLowerCase().endsWith('.csv')) return false;
            // Skip directories (e.g. the "processed" subfolder)
            const full = path.join(resolved, f);
            return fs.statSync(full).isFile();
        })
        .map(f => {
            const full = path.join(resolved, f);
            return { name: f, path: full, mtime: fs.statSync(full).mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);

    if (csvFiles.length === 0) {
        throw new Error(`No .csv files found in: ${resolved}`);
    }

    const latest = csvFiles[0];
    const csvString = fs.readFileSync(latest.path, 'utf8');
    console.log(`Read CSV: ${latest.name} (${csvString.split('\n').length - 1} lines, modified ${new Date(latest.mtime).toLocaleString()})`);

    return { fileName: latest.name, filePath: latest.path, csvString };
}

/**
 * Move a processed CSV file into a `processed/` subfolder inside the source directory.
 * Creates the subfolder if it does not exist.
 * @param {string} filePath - Absolute path to the CSV file to move.
 */
function moveToProcessed(filePath) {
    const dir = path.dirname(filePath);
    const processedDir = path.join(dir, 'processed');

    if (!fs.existsSync(processedDir)) {
        fs.mkdirSync(processedDir, { recursive: true });
    }

    const dest = path.join(processedDir, path.basename(filePath));
    fs.renameSync(filePath, dest);
    console.log(`Moved processed file: ${path.basename(filePath)} → processed/`);
}

module.exports = { readLatestCSV, moveToProcessed };
