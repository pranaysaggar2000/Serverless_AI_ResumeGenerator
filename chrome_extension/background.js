// ForgeCV Background Service Worker
import { DEBUG } from './modules/state.js';

/**
 * Configure side panel behavior:
 * Opens the side panel instead of a popup when the extension icon is clicked.
 */
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch(err => console.error('Side panel setup failed:', err));

/**
 * Handle extension install/update events
 */
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        if (DEBUG) console.log('✓ ForgeCV installed');
        // Initialize default settings if needed
    } else if (details.reason === 'update') {
        if (DEBUG) console.log('✓ ForgeCV updated to', chrome.runtime.getManifest().version);
    }
});

/**
 * Runtime message listener (future-proofing and inter-context communication)
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FORGECV_AUTH_SUCCESS') {
        // Forward to any open popup/sidepanel or perform backend sync
        if (DEBUG) console.log('✓ Auth success message received in background');
    }

    // Always return false if not sending an async response
    return false;
});
