const { chromium } = require('playwright');

let browser = null;
let page = null;
let isRemote = false;

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

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
 */
async function launchBrowser(opts = true) {
    if (browser) return page;

    // Normalize: bare boolean → options object
    const options = typeof opts === 'boolean' ? { headless: opts } : opts;
    const { headless = true, cdpEndpoint } = options;

    if (cdpEndpoint) {
        return connectBrowser(cdpEndpoint);
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

module.exports = { launchBrowser, connectBrowser, getPage, closeBrowser, BASE_URL };
