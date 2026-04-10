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
    #automation-overlay .ao-logo {
        display: flex; justify-content: center; margin-bottom: 12px;
    }
    #automation-overlay .ao-logo svg {
        width: 140px; height: auto; color: #003366;
    }
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

const NUVITA_LOGO = `<div class="ao-logo"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" fill="currentColor"><g><path d="M429.8,592.7h28.7c2.4,0,4.3-1.9,4.3-4.3v-220c0-1.2,1.5-1.8,2.4-1l218.8,226.4c1.7,1.8,4.1,2.8,6.6,2.8h50.1c2,0,3.7-1.7,3.7-3.7v-249.3c0-1.9-1.6-3.5-3.5-3.5h-39.8c-7.5,0-13.6,6.1-13.6,13.6v155.4c0,1.8-2.2,2.7-3.5,1.4l-222.4-232.8c-1.5-1.6-3.6-2.5-5.8-2.5h-43.7c-1.9,0-3.5,1.6-3.5,3.5v292.7c0,11.7,9.5,21.2,21.2,21.2Z"/><path d="M285.5,242.1c4.4,0,8.6-1.3,12-3.7l24.4,25.2c-.6.7-1.1,1.4-1.6,2.2,0,0,0,0,0,0-.5.7-.9,1.4-1.4,2.2,0,0,0,.2-.1.2-.4.7-.8,1.5-1.2,2.2,0,0,0,.2-.1.3-.4.8-.7,1.6-1,2.4,0,0,0,0,0,0-.3.8-.5,1.6-.8,2.5,0,0,0,.2,0,.3-.2.8-.4,1.6-.5,2.4,0,.1,0,.3,0,.4-.1.8-.3,1.6-.3,2.5,0,.1,0,.3,0,.4,0,.9-.1,1.8-.1,2.7s0,1.2,0,1.7c0,.2,0,.4,0,.6,0,.4,0,.8,0,1.2,0,.2,0,.4,0,.6,0,.3,0,.7.1,1,0,.2,0,.5.1.7,0,.3.1.7.2,1,0,.2.1.4.2.7,0,.3.2.6.2,1,0,.2.1.4.2.7,0,.3.2.6.3.9,0,.2.1.4.2.6.1.3.2.6.3.9,0,.2.2.4.2.6.1.3.3.6.4.9,0,.2.2.4.3.6.1.3.3.6.4.9,0,.2.2.4.3.5.2.3.3.6.5.9,0,.2.2.3.3.5.2.3.4.6.6.9,0,.2.2.3.3.5.2.3.4.6.6.9,0,.1.2.3.3.4.2.3.5.6.7.9,0,.1.2.2.3.3.3.3.5.7.8,1,0,0,.2.2.2.3.3.3.6.7,1,1,0,0,.1.1.2.2.4.4.8.8,1.2,1.1h0s-27.3,32.3-27.3,32.3c-1.6-.5-3.3-.7-5-.7-10.2,0-18.4,8.3-18.4,18.4s8.3,18.4,18.4,18.4,18.4-8.3,18.4-18.4-2-9.5-5.2-12.8l26.9-31.9c1.1.5,2.1,1,3.3,1.4.1,0,.3,0,.4.1.4.1.8.3,1.2.4.2,0,.4.1.5.2.4.1.8.2,1.1.3.2,0,.4,0,.6.1.4,0,.7.2,1.1.2.2,0,.4,0,.7.1.4,0,.7.1,1.1.2.2,0,.4,0,.6,0,.4,0,.8,0,1.2.1.2,0,.4,0,.6,0,.6,0,1.2,0,1.8,0,18.1,0,32.8-14.7,32.8-32.8s0-1.6,0-2.3c0-.2,0-.4,0-.5,0-.8-.2-1.5-.3-2.2,0,0,0-.2,0-.3-.1-.7-.2-1.3-.4-2,0-.2,0-.3-.1-.5-.2-.7-.4-1.4-.6-2.1,0-.1,0-.2-.1-.4-.2-.6-.4-1.3-.7-1.9,0-.1,0-.2-.1-.3-.3-.7-.6-1.3-.9-2,0-.1-.1-.2-.2-.4-.3-.6-.6-1.2-1-1.8,0,0,0-.1,0-.1-.4-.6-.8-1.3-1.2-1.9,0-.1-.2-.2-.2-.3-.9-1.2-1.8-2.4-2.9-3.5,0,0-.2-.2-.3-.3-.5-.5-1.1-1.1-1.6-1.6,0,0,0,0,0,0-.6-.5-1.1-1-1.7-1.4,0,0-.2-.1-.2-.2-.6-.5-1.2-.9-1.9-1.3,0,0-.1,0-.2-.1-.6-.4-1.2-.8-1.9-1.1,0,0-.1,0-.2,0-.7-.4-1.4-.7-2.1-1,0,0-.2,0-.2-.1-.7-.3-1.4-.6-2.1-.9l6.6-58.5c.7,0,1.4.1,2.2.1,14.7,0,26.7-11.9,26.7-26.7s-11.9-26.7-26.7-26.7-26.7,11.9-26.7,26.7,6.2,19.8,15.3,24.1l-6.7,59c-.7,0-1.4,0-2.2,0s-1.8,0-2.7.1c-.1,0-.3,0-.4,0-.8,0-1.7.2-2.5.3-.1,0-.3,0-.4,0-.8.2-1.6.3-2.4.5-.1,0-.2,0-.3,0-.8.2-1.7.5-2.5.8,0,0,0,0,0,0-.8.3-1.6.6-2.4,1,0,0-.2,0-.3.1-.8.4-1.5.7-2.2,1.1,0,0-.2.1-.3.2-.7.4-1.4.9-2.1,1.3,0,0,0,0-.1,0-.7.5-1.4,1-2.1,1.6,0,0,0,0,0,0l-24.2-25c2.9-3.7,4.7-8.3,4.7-13.4,0-11.9-9.6-21.5-21.5-21.5s-21.5,9.6-21.5,21.5,9.6,21.5,21.5,21.5Z"/><path d="M247.9,522.9c5.5,6.4,9.9,13.6,13,21.4-4.2,4.3-6.8,10.1-6.8,16.6,0,13.1,10.6,23.8,23.8,23.8s23.8-10.6,23.8-23.8-10.6-23.8-23.8-23.8-6.2.6-9,1.8c-3.5-8.1-8.1-15.5-13.9-22.2,0-.1-.2-.2-.3-.3l19.1-47.3c2.1.6,4.4,1,6.7,1,13.6,0,24.7-11,24.7-24.7s-11-24.7-24.7-24.7-16.6,4.7-21,11.7l-26.9-18.5c1.6-3.2,2.5-6.9,2.5-10.8s-.9-7.6-2.6-10.9h.3s10.3-60.3,10.3-60.3c10.6-3.4,18.3-13.3,18.3-25s-11.8-26.3-26.3-26.3-26.3,11.8-26.3,26.3,10.8,25.3,24.5,26.2l-8.6,50.1c-4-2.8-8.8-4.5-14-4.5-13.4,0-24.3,10.9-24.3,24.3s10.9,24.3,24.3,24.3,11.8-2.3,16.1-6.1l29.3,20.2c-.2,1.2-.3,2.5-.3,3.8,0,7.9,3.7,14.9,9.5,19.4l-17.9,44.3c-5.6-5-11.9-9.4-18.7-12.8.2-1,.3-2,.3-3.1,0-11.2-9-20.2-20.2-20.2s-20.2,9-20.2,20.2,9,20.2,20.2,20.2,12.7-3.3,16.4-8.4c8.6,4.4,16.4,10.5,22.6,17.8Z"/><path d="M386.3,597.9c0-12.4-9.8-22.5-22.1-23.1l-13-52.3-.9.2c6.9-4.4,11.5-12.1,11.5-20.8s-7.1-20.2-17-23.4v-62.1c2,.7,4.2,1.1,6.4,1.1,11.2,0,20.2-9,20.2-20.2s-9-20.2-20.2-20.2-20.2,9-20.2,20.2,1.6,9,4.3,12.5v67.6c-12.8.9-23,11.5-23,24.6s11,24.7,24.7,24.7,3.6-.2,5.3-.6l12.5,50.3c-8.7,3.3-14.9,11.7-14.9,21.6s3.5,14.1,9,18.3l-9.7,23.8c-4.6-2.8-10-4.3-15.7-4.3s-14.7,2.8-20.1,7.5l-37.5-26.2c.9-2.4,1.5-5,1.5-7.7,0-11.9-9.6-21.5-21.5-21.5s-21.5,9.6-21.5,21.5,9.6,21.5,21.5,21.5,10.9-2.3,14.8-5.9l36.6,25.6c-2.8,4.7-4.5,10.1-4.5,16,0,17,13.8,30.7,30.7,30.7s30.7-13.8,30.7-30.7-2.8-14.6-7.4-20l10.6-26c1.8.5,3.7.7,5.6.7,12.8,0,23.1-10.4,23.1-23.1Z"/><path d="M550.7,745.4c-7.4,0-14,3.7-18,9.3l-19.9-14c3.1-4.5,4.8-10,4.8-15.8,0-11.6-7-21.5-16.9-25.9v-38.2c11.7-2.7,20.5-13.2,20.5-25.8s-11.9-26.5-26.5-26.5-26.5,11.9-26.5,26.5.1,2.6.3,3.9l-31.3,8.7c-4.2-6.1-11.2-10.1-19.1-10.1-12.8,0-23.1,10.4-23.1,23.1s8.5,21.2,19.6,22.9l-10.7,25.5c-2.6-1-5.4-1.6-8.4-1.6-13,0-23.6,10.6-23.6,23.6s10.6,23.6,23.6,23.6,23.6-10.6,23.6-23.6-3-13.2-7.8-17.5l12.8-30.5c9.9-2.6,17.2-11.6,17.2-22.4s-.2-2.9-.4-4.3l30.7-8.6c4,7.2,11.3,12.3,19.8,13.4v35.4c-.7,0-1.3,0-2,0-15.6,0-28.3,12.7-28.3,28.3s12.7,28.3,28.3,28.3,12.1-2.1,16.8-5.6l22.9,16c-.2,1.2-.3,2.4-.3,3.7,0,12.1,9.8,22,22,22s22-9.8,22-22-9.8-22-22-22Z"/><circle cx="802.4" cy="543.9" r="19.8" transform="translate(-76.8 135.5) rotate(-9.2)"/><path d="M783,617.7c-14.5,0-26.3,11.8-26.3,26.3s.2,3.1.4,4.6l-29.4,8.3c-4.3-4.6-10.4-7.5-17.2-7.5-13,0-23.5,10.5-23.5,23.5s1.8,10.2,4.8,14.2l-.6-.7-33.6,28.9c-4.6-7.4-12.9-12.4-22.3-12.4s-15.1,3.6-19.9,9.2l-35.2-14.8c.2-1.1.3-2.2.3-3.4,0-10.3-6.6-19.1-15.9-22.2l11.6-46.7c1.4.2,2.8.4,4.2.4,5.8,0,11.1-1.9,15.4-5l37.3,20.9c-.3,1.3-.4,2.6-.4,3.9,0,11,8.9,19.8,19.8,19.8s19.8-8.9,19.8-19.8-8.9-19.8-19.8-19.8-11.8,2.9-15.4,7.3l-34.7-19.4c2.7-4.1,4.2-9,4.2-14.2,0-14.5-11.8-26.3-26.3-26.3s-10.1,1.6-14.2,4.2l-38.6-36.2c3.5-3.6,5.7-8.5,5.7-13.9,0-11-8.9-19.8-19.8-19.8s-19.8,8.9-19.8,19.8,8.9,19.8,19.8,19.8,3.9-.3,5.7-.8l40.1,37.6c-3.2,4.4-5.2,9.8-5.2,15.6,0,10.1,5.7,18.8,14,23.2l-12,48.1c-12.6.4-22.7,10.8-22.7,23.5s10.5,23.5,23.5,23.5,16.5-4.9,20.5-12.1l33.4,14.1c-1.2,3-1.9,6.3-1.9,9.8,0,14.5,11.8,26.3,26.3,26.3s26.3-11.8,26.3-26.3-.2-3.8-.6-5.6l35.7-30.8-2.8-3.2c4.3,4.2,10.1,6.8,16.6,6.8,13,0,23.5-10.5,23.5-23.5s-.6-5.9-1.6-8.5l27.5-7.7c4.5,8.2,13.1,13.7,23.1,13.7,14.5,0,26.3-11.8,26.3-26.3s-11.8-26.3-26.3-26.3Z"/><circle cx="867.8" cy="400.2" r="22.5"/><path d="M870.1,466.4c-8,0-15.1,4.1-19.3,10.2l-27.5-12.9c.2-1.1.3-2.3.3-3.5,0-10.8-7.6-19.9-17.8-22v-38c9.9-.4,17.8-8.5,17.8-18.5s-8.3-18.5-18.5-18.5-18.5,8.3-18.5,18.5,4,13.2,9.8,16.3v40.2c-10.2,2.2-17.8,11.2-17.8,22s10.1,22.5,22.5,22.5,14.8-4.1,18.8-10.2l27.3,12.8c-.3,1.4-.4,2.9-.4,4.4,0,7.5,3.5,14.1,8.9,18.4l-23.9,50.3c-9.1,2.6-15.8,10.9-15.8,20.8s9.7,21.6,21.6,21.6,21.6-9.7,21.6-21.6-7.2-18.9-16.9-21.1l21.8-45.8c1.9.5,3.9.8,6,.8,12.9,0,23.4-10.5,23.4-23.4s-10.5-23.4-23.4-23.4Z"/><path d="M724.5,263.9c-12.3,0-22.3,10-22.3,22.3s10,22.3,22.3,22.3,10.4-1.9,14.2-5.1l71,7.5c1.8,13.6,13.4,24.1,27.5,24.1s27.8-12.4,27.8-27.8-12.4-27.8-27.8-27.8-24.5,9.4-27.2,22l-64.9-6.9c1-2.6,1.6-5.4,1.6-8.4,0-5.8-2.2-11.1-5.9-15.1l23.5-29.2c3.2,1.6,6.7,2.5,10.5,2.5,13,0,23.5-10.5,23.5-23.5s-10.5-23.5-23.5-23.5-23.5,10.5-23.5,23.5,2.1,11.1,5.6,15.2l-23.8,29.5c-2.7-1.1-5.6-1.8-8.7-1.8Z"/><path d="M656.5,253.2l-1.5,26.3c-1.5-.3-3-.5-4.6-.5-7.4,0-13.9,3.4-18.2,8.7l-36.8-13.7c.2-1.1.3-2.2.3-3.3,0-11-8.9-19.9-19.9-19.9s-19.9,8.9-19.9,19.9,8.9,19.9,19.9,19.9,13.5-3.8,17-9.5l35.7,13.3c-1,2.6-1.5,5.3-1.5,8.2,0,13,10.5,23.5,23.5,23.5s23.5-10.5,23.5-23.5-3.8-14.7-9.7-19l1.7-28.5c.3,0,.5,0,.8,0,15.4,0,27.8-12.5,27.8-27.8s-4.4-17.2-11.2-22.3l14.9-22.6c2.5.9,5.3,1.5,8.1,1.5,13,0,23.5-10.5,23.5-23.5s-10.5-23.5-23.5-23.5-23.5,10.5-23.5,23.5,2.8,12.8,7.4,17.1l-15.3,23.2c-2.6-.8-5.3-1.2-8.2-1.2-15.4,0-27.8,12.5-27.8,27.8s7.4,21.9,17.7,25.9Z"/><circle cx="539.8" cy="107.7" r="23.9"/><path d="M520.8,195.7c6.5,0,12.2-3.2,15.6-8.2l26,.9c.6,15.9,13.7,28.6,29.7,28.6s29.7-13.3,29.7-29.7-4-17.1-10.3-22.5l3.7-19.4c1.2.2,2.4.3,3.7.3,13.2,0,23.9-10.7,23.9-23.9s-10.7-23.9-23.9-23.9-23.9,10.7-23.9,23.9,4.9,16.6,12,20.7l-3.3,17.4c-3.6-1.5-7.5-2.4-11.7-2.4-13.5,0-25,9.1-28.6,21.4l-23.8-.8c0-.5,0-1,0-1.5,0-10.5-8.5-19-19-19s-19,8.5-19,19,8.5,19,19,19Z"/><path d="M424.1,224.7c0,12,9.7,21.7,21.7,21.7s17.4-6,20.4-14.4l17.8,2c0,.2,0,.4,0,.6,0,10.2,8.3,18.5,18.5,18.5s18.5-8.3,18.5-18.5-8.3-18.5-18.5-18.5-13.7,4.3-16.7,10.6l-18.3-2c0-11-8.3-20.1-19-21.4v-46.2c.6,0,1.3,0,1.9,0,12.6,0,22.9-10.2,22.9-22.9s-10.2-22.9-22.9-22.9-22.9,10.2-22.9,22.9,4.6,15.9,11.5,19.8v50c-8.7,2.8-15,11-15,20.6Z"/></g><g><path d="M265.3,863.8h-19.3c-1.4,0-2.5,1.1-2.5,2.4v56.2c0,2.3-3,3.3-4.5,1.5l-47.2-59.2c-.5-.6-1.2-.9-2-.9h-19c-1.4,0-2.5,1.1-2.5,2.4v96.7c0,4.2,3.5,7.7,7.9,7.7h13.9c1.4,0,2.5-1.1,2.5-2.4v-58.4c0-2.3,3-3.3,4.5-1.5l48.9,61.4c.5.6,1.2.9,2,.9h17.2c1.4,0,2.5-1.1,2.5-2.4v-102c0-1.3-1.1-2.4-2.5-2.4Z"/><path d="M377.9,863.8h-19.1c-1.4,0-2.5,1-2.5,2.3v58c0,16.7-8.9,25.2-23.6,25.2s-23.6-8.9-23.6-26v-57.3c0-1.2-1.1-2.3-2.5-2.3h-19.1c-1.4,0-2.5,1-2.5,2.3v57.9c0,31,18,46.7,47.3,46.7s48-15.6,48-47.5v-57.1c0-1.2-1.1-2.3-2.5-2.3Z"/><path d="M496.6,863.8h-21.4c-1,0-2,.6-2.3,1.6l-26.7,67.3c-.8,2.1-3.8,2.1-4.7,0l-26.7-67.3c-.4-.9-1.3-1.6-2.3-1.6h-22.1c-1.8,0-3,1.8-2.3,3.4l43.8,102c.4.9,1.3,1.5,2.3,1.5h18.7c1,0,1.9-.6,2.3-1.5l43.8-102c.7-1.6-.5-3.4-2.3-3.4Z"/><path d="M530.7,863.8h-19.1c-1.4,0-2.5,1.1-2.5,2.4v102c0,1.3,1.1,2.4,2.5,2.4h19.1c1.4,0,2.5-1.1,2.5-2.4v-102c0-1.3-1.1-2.4-2.5-2.4Z"/><path d="M633.4,883.1v-16.9c0-1.3-1.1-2.4-2.5-2.4h-85.6c-1.4,0-2.5,1.1-2.5,2.4v16.9c0,1.3,1.1,2.4,2.5,2.4h28.3c1.4,0,2.5,1.1,2.5,2.4v80.4c0,1.3,1.1,2.4,2.5,2.4h19.1c1.4,0,2.5-1.1,2.5-2.4v-80.4c0-1.3,1.1-2.4,2.5-2.4h28.3c1.4,0,2.5-1.1,2.5-2.4Z"/><path d="M683,865.2c-.4-.9-1.3-1.5-2.3-1.5h-18.9c-1,0-1.9.6-2.3,1.5l-44.7,102c-.7,1.6.5,3.4,2.3,3.4h19.1c1,0,1.9-.6,2.3-1.5l8.7-20.8c.4-.9,1.3-1.5,2.3-1.5h42.9c1,0,1.9.6,2.3,1.5l8.7,20.8c.4.9,1.3,1.5,2.3,1.5h19.7c1.8,0,3-1.8,2.3-3.4l-44.7-102ZM681.8,926.2h-21.6c-1.8,0-3-1.7-2.3-3.3l10.8-25.6c.8-2,3.8-2,4.6,0l10.8,25.6c.7,1.6-.5,3.3-2.3,3.3Z"/><path d="M833.3,865.2c-.4-.9-1.3-1.5-2.3-1.5h-18.9c-1,0-1.9.6-2.3,1.5l-44.7,102c-.7,1.6.5,3.4,2.3,3.4h19.1c1,0,1.9-.6,2.3-1.5l8.7-20.8c.4-.9,1.3-1.5,2.3-1.5h42.9c1,0,1.9.6,2.3,1.5l8.7,20.8c.4.9,1.3,1.5,2.3,1.5h19.7c1.8,0,3-1.8,2.3-3.4l-44.7-102ZM832.1,926.2h-21.6c-1.8,0-3-1.7-2.3-3.3l10.8-25.6c.8-2,3.8-2,4.6,0l10.8,25.6c.7,1.6-.5,3.3-2.3,3.3Z"/><path d="M909,863.8h-19.1c-1.4,0-2.5,1.1-2.5,2.4v102c0,1.3,1.1,2.4,2.5,2.4h19.1c1.4,0,2.5-1.1,2.5-2.4v-102c0-1.3-1.1-2.4-2.5-2.4Z"/></g></svg></div>`;

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
    return page.evaluate(({ styles, logo }) => {
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
                    ${logo}
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
    }, { styles: OVERLAY_STYLES, logo: NUVITA_LOGO });
}

/**
 * Inject a floating toast for CSV file upload.
 * Returns a Promise that resolves with the raw CSV string, or null if dismissed.
 */
async function injectUploadToast(page) {
    return page.evaluate(({ styles, logo }) => {
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
                    ${logo}
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
    }, { styles: OVERLAY_STYLES, logo: NUVITA_LOGO });
}

/**
 * Inject a validation results overlay.
 * Shows structural errors and system warnings per entry.
 * Returns a Promise resolving to { proceed: true/false }.
 */
async function injectValidationOverlay(page, validationData) {
    return page.evaluate(({ styles, data, logo }) => {
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
                    ${logo}
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
    }, { styles: OVERLAY_STYLES, data: validationData, logo: NUVITA_LOGO });
}

/**
 * Inject a progress overlay during automation.
 * Returns an object with an update(current, entryName) function and a done() function.
 */
async function injectProgressOverlay(page, total) {
    await page.evaluate(({ styles, total, logo }) => {
        const existing = document.getElementById('automation-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'automation-overlay';
        overlay.innerHTML = `
            <style>${styles}</style>
            <div class="ao-backdrop"></div>
            <div class="ao-modal" style="max-width: 480px;">
                ${logo}
                <h3>⚙️ Automation in Progress</h3>
                <p id="ao-progress-text">Preparing to process ${total} entries...</p>
                <div class="ao-progress-bar">
                    <div class="ao-progress-fill" id="ao-progress-fill" style="width: 0%"></div>
                </div>
                <p id="ao-progress-detail" style="font-size: 12px; color: #666;">Starting...</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }, { styles: OVERLAY_STYLES, total, logo: NUVITA_LOGO });

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
    return page.evaluate(({ styles, response, csvString, logo }) => {
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
                    ${logo}
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
    }, { styles: OVERLAY_STYLES, response, csvString, logo: NUVITA_LOGO });
}

module.exports = {
    injectModeChooser,
    injectUploadToast,
    injectValidationOverlay,
    injectProgressOverlay,
    injectResultsOverlay
};
