
import { state } from './state.js';

let channel = null;
let isPreviewOpen = false;
let sendTimer = null;
let stateUpdateListener = null;

/**
 * Register a callback for when the editor sends a resume update back
 */
export function onLiveStateUpdate(callback) {
    stateUpdateListener = callback;
}

/**
 * Initialize the BroadcastChannel for live preview communication
 */
export function initLivePreview() {
    if (channel) return; // Already initialized

    channel = new BroadcastChannel('resume-preview');
    console.log("Live Preview channel initialized");

    channel.onmessage = (event) => {
        if (!event.data || typeof event.data !== 'object') return;

        const { type, payload } = event.data;

        if (type === 'preview-ready' || type === 'pong' || type === 'ping') {
            // Preview tab is open and listening
            if (!isPreviewOpen) {
                console.log("Preview Connected");
                isPreviewOpen = true;
                updatePreviewButtonState(true);
                // If they just connected, send them current state
                sendPreviewUpdate();
            }
        }

        if (type === 'heartbeat') {
            // Preview tab checking if we're alive
            // Respond with current data
            channel.postMessage({ type: 'pong' });
        }

        // Handle incoming updates FROM the full-tab editor
        if (type === 'editor-resume-update') {
            // Full-tab editor sent updated resume back
            // Update state and persist
            if (payload && payload.resume) {
                const newResume = payload.resume;
                // Update global state - assuming state.tailoredResume is what we edit
                // If we were editing base, we might need logic, but editor usually works on tailored
                if (state.tailoredResume) {
                    state.tailoredResume = newResume;
                } else {
                    state.baseResume = newResume; // Fallback
                }

                chrome.storage.local.set({ tailored_resume: newResume });

                // Refresh side panel if listener registered
                if (stateUpdateListener) {
                    stateUpdateListener(newResume);
                }
            }

            // Also sync format if provided (Step 34)
            if (payload && payload.format) {
                state.formatSettings = payload.format;
                chrome.storage.local.set({ format_settings: payload.format });
            }
        }
    };
}

/**
 * Send resume update to the preview tab (debounced)
 * Call this after ANY change to the resume or format settings
 */
export function sendPreviewUpdate(resumeOverride) {
    if (!channel) initLivePreview();

    clearTimeout(sendTimer);
    sendTimer = setTimeout(() => {
        const resume = resumeOverride || state.tailoredResume || state.baseResume;
        if (!resume) return;

        channel.postMessage({
            type: 'resume-update',
            payload: {
                resume: resume,
                format: state.formatSettings || {}
            }
        });
    }, 200); // 200ms debounce — fast enough to feel live
}

/**
 * Alias for sendPreviewUpdate to match editor.js calls
 */
export function broadcastResumePreview(resume, format) {
    if (format) state.formatSettings = format;
    sendPreviewUpdate(resume);
}

/**
 * Send format-only update (lighter payload)
 * Call this when only format settings changed, not resume content
 */
export function sendFormatUpdate() {
    if (!channel) initLivePreview();

    channel.postMessage({
        type: 'format-update',
        payload: {
            format: state.formatSettings || {}
        }
    });
}

/**
 * Open the live preview tab (Now Full Editor)
 */
export function openLivePreview() {
    initLivePreview();

    const editorUrl = chrome.runtime.getURL('editor_full.html');

    // Query for existing tab by URL (robust across popup closes)
    chrome.tabs.query({ url: editorUrl }, (tabs) => {
        if (tabs && tabs.length > 0) {
            // Tab exists - focus the first one
            const tab = tabs[0];
            chrome.tabs.update(tab.id, { active: true });
            if (tab.windowId) {
                chrome.windows.update(tab.windowId, { focused: true });
            }

            // Send update to ensure it's fresh
            setTimeout(() => sendPreviewUpdate(), 500);
        } else {
            // Create new
            chrome.tabs.create({ url: editorUrl }, (tab) => {
                // Tab opened
            });
        }
    });
}

/**
 * Check if preview tab is currently open
 */
export function isPreviewTabOpen() {
    return isPreviewOpen;
}

/**
 * Update the "Live Preview" button appearance based on connection status
 */
function updatePreviewButtonState(isConnected) {
    const btn = document.getElementById('livePreviewBtn');
    if (!btn) return;

    if (isConnected) btn.classList.add('connected');
    else btn.classList.remove('connected');

    const dot = btn.querySelector('.live-dot');
    if (dot) {
        dot.style.background = isConnected ? '#22c55e' : '#94a3b8';
    }
}

/**
 * Cleanup — call when extension popup closes
 */
export function closeLivePreview() {
    if (channel) {
        channel.close();
        channel = null;
    }
    isPreviewOpen = false;
}
