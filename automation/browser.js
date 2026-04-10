const { chromium } = require('playwright');
const http = require('http');

let browser = null;
let page = null;
let isRemote = false;

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DEFAULT_CDP_PORT = process.env.CDP_PORT || 9223;

/**
 * Probe a CDP endpoint to see if a browser is listening.
 * Returns the working endpoint URL or null.
 */
function probeCDP(endpoint) {
    return new Promise((resolve) => {
        const url = new URL('/json/version', endpoint);
        const req = http.get(url, { timeout: 2000 }, (res) => {
            res.resume(); // drain
            resolve(res.statusCode === 200 ? endpoint : null);
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

/**
 * Try to find a reachable CDP endpoint on the default port.
 */
async function findCDPEndpoint(port) {
    return probeCDP(`http://localhost:${port}`);
}

/**
 * Connect to an already-running browser via CDP.
 * Reuses the first existing page (tab) if one exists, otherwise creates a new page.
 */
async function connectBrowser(cdpEndpoint) {
    if (browser) return page;
    browser = await chromium.connectOverCDP(cdpEndpoint);
    isRemote = true;

    // Reuse the first existing page if available
    const contexts = browser.contexts();
    if (contexts.length > 0) {
        const pages = contexts[0].pages();
        if (pages.length > 0) {
            page = pages[0];
            return page;
        }
    }

    // No existing pages — create one
    const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
    page = await context.newPage();
    return page;
}

/**
 * Launch a new browser or connect to an existing one via CDP.
 * Accepts either a boolean (backward compat) or an options object.
 *   launchBrowser(true)
 *   launchBrowser({ headless: true })
 *   launchBrowser({ cdpEndpoint: 'http://localhost:9222' })
 *
 * When no cdpEndpoint is specified, automatically probes localhost on the
 * default CDP port (9222 or CDP_PORT env var). If a browser is found it
 * connects via CDP and reuses the existing tab; otherwise it falls back to
 * launching a new browser.
 */
async function launchBrowser(opts = true) {
    if (browser) return page;

    // Normalize: bare boolean → options object
    const options = typeof opts === 'boolean' ? { headless: opts } : opts;
    const { headless = true, cdpEndpoint } = options;

    if (cdpEndpoint) {
        return connectBrowser(cdpEndpoint);
    }

    // Auto-detect an existing browser on the default CDP port
    const foundEndpoint = await findCDPEndpoint(DEFAULT_CDP_PORT);
    if (foundEndpoint) {
        console.log(`Auto-detected existing browser on ${foundEndpoint} — connecting via CDP`);
        return connectBrowser(foundEndpoint);
    }

    browser = await chromium.launch({ headless });
    isRemote = false;
    const context = await browser.newContext();
    page = await context.newPage();
    return page;
}

async function getPage() {
    if (!page) throw new Error('Browser not launched. Call launchBrowser() first.');
    return page;
}

/**
 * Wait for the user to log in via the web UI.
 * Navigates to BASE_URL and blocks until `header.header` is present on the page.
 */
async function waitForLogin(page) {
    await page.goto(BASE_URL);
    console.log('Waiting for login... Please log in to the web UI.');
    await page.waitForSelector('header.header', { timeout: 0 });
    console.log('Login detected. Starting automation.');
}

async function closeBrowser() {
    if (browser) {
        if (isRemote) {
            // Detach without killing the external browser
            await browser.close();
        } else {
            await browser.close();
        }
        browser = null;
        page = null;
        isRemote = false;
    }
}

module.exports = { launchBrowser, connectBrowser, getPage, closeBrowser, waitForLogin, BASE_URL };
