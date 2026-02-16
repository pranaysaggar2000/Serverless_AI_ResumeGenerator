import { state, API_BASE_URL } from './state.js';

const APP_VERSION = `v${chrome.runtime.getManifest().version}`;

let logQueue = [];
let flushTimeout = null;

async function flushLogs() {
    if (logQueue.length === 0) return;
    const batch = logQueue.splice(0, 10);

    for (const log of batch) {
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (state.accessToken) headers['Authorization'] = `Bearer ${state.accessToken}`;

            await fetch(`${API_BASE_URL}/api/log`, {
                method: 'POST',
                headers,
                body: JSON.stringify(log)
            });
        } catch (_) { } // Never break the app for logging
    }
}

/**
 * PRIVACY: Only pass operational metadata, never content.
 * Do NOT pass: resume text, JD text, names, emails, bullets, prompts
 */
export function logError(event, error, metadata = {}) {
    logQueue.push({
        level: 'error',
        event,
        message: error?.message || String(error),
        metadata: {
            provider: state.currentProvider || 'unknown',
            authMode: state.authMode || 'unknown',
            strategy: state.tailoringStrategy || 'unknown',
            pageMode: state.pageMode || '1page',
            ...metadata
            // NEVER add: jdText, resumeData, bullets, name, email, prompt
        },
        appVersion: APP_VERSION
    });

    if (flushTimeout) clearTimeout(flushTimeout);
    flushTimeout = setTimeout(flushLogs, 2000);
}

export function logWarn(event, message, metadata = {}) {
    logQueue.push({
        level: 'warn',
        event,
        message: String(message).substring(0, 200),
        metadata: {
            provider: state.currentProvider || 'unknown',
            authMode: state.authMode || 'unknown',
            ...metadata
        },
        appVersion: APP_VERSION
    });

    if (flushTimeout) clearTimeout(flushTimeout);
    flushTimeout = setTimeout(flushLogs, 2000);
}

export async function sendFeedback(rating, comment = '', metadata = {}) {
    try {
        if (!state.accessToken) return;

        await fetch(`${API_BASE_URL}/api/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.accessToken}`
            },
            body: JSON.stringify({
                rating,
                comment: comment || null,
                metadata: {
                    provider: state.currentProvider,
                    strategy: state.tailoringStrategy,
                    pageMode: state.pageMode,
                    ...metadata
                }
            })
        });
    } catch (_) { }
}
