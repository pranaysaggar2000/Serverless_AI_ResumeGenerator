import { generateResumePdf } from './modules/pdf_builder.js';
import { DEFAULT_FORMAT } from './modules/defaults.js';

// Configuration
const ZOOM_STEP = 10;
const ZOOM_MIN = 50;
const ZOOM_MAX = 200;

// State
let currentResume = null;
let currentFormat = null;
let regenerateTimer = null;
let currentBlobUrl = null;
let currentZoom = 100;
let lastPingTime = Date.now();

// Broadcast Channel
const channel = new BroadcastChannel('resume-preview');
console.log("BroadcastChannel 'resume-preview' initialized in preview_live.js");

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadInitialResume();
    setupHeartbeat();

    // Initial status
    updateStatus('disconnected'); // Will switch to connected if heartbeat works
});

function setupEventListeners() {
    // Zoom Controls
    document.getElementById('zoomIn').addEventListener('click', () => setZoom(currentZoom + ZOOM_STEP));
    document.getElementById('zoomOut').addEventListener('click', () => setZoom(currentZoom - ZOOM_STEP));
    document.getElementById('fitWidthBtn').addEventListener('click', fitWidth);

    // Actions
    document.getElementById('downloadBtn').addEventListener('click', downloadPdf);
    document.getElementById('printBtn').addEventListener('click', printPdf);

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Zoom: Ctrl + / Ctrl -
        if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
            e.preventDefault();
            setZoom(currentZoom + ZOOM_STEP);
        }
        if ((e.ctrlKey || e.metaKey) && e.key === '-') {
            e.preventDefault();
            setZoom(currentZoom - ZOOM_STEP);
        }
        // Reset Zoom: Ctrl 0
        if ((e.ctrlKey || e.metaKey) && e.key === '0') {
            e.preventDefault();
            setZoom(100);
        }
        // Download: Ctrl S
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            downloadPdf();
        }
        // Print: Ctrl P
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            printPdf();
        }
    });

    // Resize observer to auto-fit if needed or just handle responsive layout
    window.addEventListener('resize', () => {
        // Optional: auto-fit on resize if currently in fit-width mode?
        // For now, keep user zoom.
    });
}

// --- Broadcast Channel Handling ---

// Hashing to prevent unnecessary re-renders
let lastResumeHash = null;

function computeHash(obj) {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
}

const VALID_MESSAGE_TYPES = ['resume-update', 'format-update', 'editor-resume-update', 'ping', 'pong', 'heartbeat'];

channel.onmessage = (event) => {
    // Validate message structure
    if (!event.data || typeof event.data !== 'object') return;

    // Reset heartbeat timer on any valid message from extension
    lastPingTime = Date.now();

    const { type, payload } = event.data;
    if (!VALID_MESSAGE_TYPES.includes(type)) return;

    if (type === 'resume-update' || type === 'editor-resume-update') {
        if (payload?.resume) {
            // Check hash
            const newHash = computeHash(payload);
            if (newHash === lastResumeHash) return; // Skip duplicate

            lastResumeHash = newHash;
            handleResumeUpdate(payload.resume, payload.format);
        }
    } else if (type === 'format-update') {
        if (payload?.format) {
            handleFormatUpdate(payload.format);
        }
    } else if (type === 'ping') {
        channel.postMessage({ type: 'pong' });
        // If we get a ping, we are connected
        if (currentResume) updateStatus('connected');
    }
};

function setupHeartbeat() {
    // Check connection status every 5 seconds
    setInterval(() => {
        // Send heartbeat to extension
        channel.postMessage({ type: 'heartbeat' });

        // If no message received in 30 seconds, mark disconnected
        if (Date.now() - lastPingTime > 30000) {
            updateStatus('disconnected');
        } else if (currentResume) {
            // If we have data and recent contact, ensure we show connected
            const dot = document.getElementById('statusDot');
            if (dot.style.background === 'rgb(239, 68, 68)') { // red #ef4444
                updateStatus('connected');
            }
        }
    }, 5000);
}

// --- UI Helpers ---

function showEmptyState() {
    const container = document.getElementById('pdfContainer');
    const loading = document.getElementById('loadingState');
    if (loading) loading.style.display = 'none';

    // Clear container
    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.background = '#f8fafc';
    container.style.border = '2px dashed #cbd5e1';

    // Build via DOM API
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;padding:40px 20px;color:#64748b;';

    const icon = document.createElement('div');
    icon.style.cssText = 'font-size:48px;margin-bottom:16px;';
    icon.textContent = '📄';

    const title = document.createElement('h2');
    title.style.cssText = 'font-size:18px;color:#334155;margin-bottom:8px;';
    title.textContent = 'No Resume Data';

    const msg = document.createElement('p');
    msg.style.cssText = 'font-size:14px;margin-bottom:20px;';
    msg.textContent = 'Generate a resume in the extension first.';

    const hint = document.createElement('p');
    hint.style.cssText = 'font-size:12px;color:#94a3b8;';
    hint.textContent = 'This page will automatically update when you edit your resume.';

    empty.appendChild(icon);
    empty.appendChild(title);
    empty.appendChild(msg);
    empty.appendChild(hint);
    container.appendChild(empty);
}

function updatePageInfo(doc) {
    const pageCount = doc.getNumberOfPages();
    const el = document.getElementById('pageCount');
    if (el) {
        el.textContent = pageCount === 1 ? '1 page' : pageCount + ' pages';
        if (pageCount > 1) {
            el.style.color = '#d97706'; // Orange warning
        } else {
            el.style.color = '#64748b'; // Normal
        }
    }
}

// --- Data Handling ---

async function loadInitialResume() {
    try {
        const data = await chrome.storage.local.get([
            'tailored_resume', 'base_resume', 'format_settings'
        ]);

        // Prefer tailored, fall back to base
        const resume = data.tailored_resume || data.base_resume;
        const format = data.format_settings || {};

        if (resume) {
            currentResume = resume;
            currentFormat = format;
            regeneratePdf(true); // immediate, no debounce
        } else {
            document.querySelector('.loading-text').textContent = "No resume found. Open extension to edit.";
        }

        // Notify extension we are open
        channel.postMessage({ type: 'preview-ready' });

    } catch (e) {
        console.error("Failed to load initial resume:", e);
        updateStatus('error', e.message);
    }
}

function handleResumeUpdate(resume, format) {
    currentResume = resume;
    if (format) currentFormat = format; // Optional update
    scheduleRegenerate();
}

function handleFormatUpdate(format) {
    currentFormat = format;
    if (currentResume) scheduleRegenerate();
}

function scheduleRegenerate() {
    updateStatus('updating');
    clearTimeout(regenerateTimer);
    // Debounce to prevent flashing on rapid typing
    regenerateTimer = setTimeout(() => regeneratePdf(), 300);
}

// --- PDF Generation ---

function showErrorState(errorMessage) {
    updateStatus('error', errorMessage);

    // Show toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; z-index: 200;
        background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;
        padding: 12px 16px; border-radius: 8px; font-size: 13px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 320px;
        font-family: system-ui, sans-serif; opacity: 0; transition: opacity 0.3s;
    `;
    toast.textContent = 'PDF Error: ' + errorMessage;
    document.body.appendChild(toast);

    // Fade in
    requestAnimationFrame(() => toast.style.opacity = '1');

    // Auto-remove
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function regeneratePdf(immediate = false) {
    if (!currentResume) return;

    try {
        // console.log("Regenerating PDF...", currentFormat);

        const attemptRegen = () => {
            try {
                const mergedFormat = { ...DEFAULT_FORMAT, ...currentFormat };
                const doc = generateResumePdf(currentResume, mergedFormat);
                const blob = doc.output('blob');
                const url = URL.createObjectURL(blob);

                displayPdf(url, doc);
                updatePageInfo(doc);
                updateStatus('connected');
            } catch (error) {
                console.error('PDF generation failed:', error);
                showErrorState(error.message);
            }
        };

        // If not immediate, debounce
        if (!immediate) {
            clearTimeout(regenerateTimer);
            regenerateTimer = setTimeout(attemptRegen, 300);
        } else {
            attemptRegen();
        }
    } catch (e) {
        console.error("Error in regeneratePdf setup:", e);
        showErrorState(e.message);
    }
}

const MAX_CACHED_URLS = 3;
const blobUrlHistory = [];

function trackBlobUrl(url) {
    blobUrlHistory.push(url);
    // Keep only the last few
    while (blobUrlHistory.length > MAX_CACHED_URLS) {
        const oldUrl = blobUrlHistory.shift();
        URL.revokeObjectURL(oldUrl);
    }
}

// Cleanup on unload to free memory
window.addEventListener('unload', () => {
    blobUrlHistory.forEach(url => URL.revokeObjectURL(url));
});

function displayPdf(blobUrl, doc) {
    // Track URL for cleanup
    trackBlobUrl(blobUrl);
    currentBlobUrl = blobUrl;

    const container = document.getElementById('pdfContainer');

    // Update dimensions based on format settings
    const pageSize = currentFormat?.pageSize || 'letter';
    const widthPt = pageSize === 'a4' ? 595.28 : 612;
    const heightPt = pageSize === 'a4' ? 841.89 : 792;

    container.style.width = `${widthPt}pt`;
    container.style.height = `${heightPt}pt`;

    // Double-buffer: create new embed behind the old one to prevent flashing
    const newEmbed = document.createElement('embed');
    newEmbed.type = 'application/pdf';
    newEmbed.src = blobUrl;
    newEmbed.className = 'pdf-embed';
    newEmbed.style.cssText = 'width:100%;height:100%;position:absolute;top:0;left:0;opacity:0;transition:opacity 0.2s;border:none;';

    container.style.position = 'relative'; // Ensure absolute positioning works
    container.appendChild(newEmbed);

    // Fade in new embed after short delay to allow render
    setTimeout(() => {
        newEmbed.style.opacity = '1';

        // Remove all old embeds
        const embeds = container.querySelectorAll('.pdf-embed');
        embeds.forEach(el => {
            if (el !== newEmbed) {
                el.style.opacity = '0';
                setTimeout(() => el.remove(), 250);
            }
        });
    }, 150);

    // Hide loading
    document.getElementById('loadingState').style.display = 'none';

    // Apply current zoom
    applyZoom();
}

// --- Status UI ---

function updateStatus(status, msg) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');

    dot.className = 'status-dot'; // Reset pulsing

    switch (status) {
        case 'connected':
            dot.style.background = '#22c55e'; // success green
            text.textContent = 'Connected — Live';
            break;
        case 'updating':
            dot.style.background = '#6366f1'; // primary blue
            dot.classList.add('pulsing');
            text.textContent = 'Updating...';
            break;
        case 'disconnected':
            dot.style.background = '#ef4444'; // danger red
            text.textContent = 'Disconnected — Open extension';
            break;
        case 'error':
            dot.style.background = '#ef4444';
            text.textContent = msg || 'Error';
            break;
    }
}

// Shortcuts Help
document.getElementById('helpBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const overlay = document.getElementById('shortcutOverlay');
    overlay.style.display = overlay.style.display === 'block' ? 'none' : 'block';
});

// Close overlay on click outside
document.addEventListener('click', (e) => {
    const overlay = document.getElementById('shortcutOverlay');
    if (overlay && overlay.style.display === 'block' && !overlay.contains(e.target)) {
        overlay.style.display = 'none';
    }
});

// --- Zoom Logic ---

function setZoom(percent) {
    currentZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, percent));
    document.getElementById('zoomLevel').textContent = `${currentZoom}%`;
    applyZoom();
}

function applyZoom() {
    const container = document.getElementById('pdfContainer');
    // Scale the container
    container.style.transform = `scale(${currentZoom / 100})`;
    container.style.transformOrigin = 'top center';

    // Adjust margin/padding to account for scaling?
    // CSS transform visual only, might need to adjust container margin if it overlaps.
    // Since it checks out with transform-origin top center, it usually pushes down fine.
    // But check margin-bottom
    const scale = currentZoom / 100;
    container.style.marginBottom = `${(scale - 1) * 300}px`; // Rough adjustment
}

function fitWidth() {
    const mainContainer = document.getElementById('mainContainer');
    const pdfContainer = document.getElementById('pdfContainer');

    const availableWidth = mainContainer.clientWidth - 60; // 30px padding each side
    const pdfWidthPt = parseFloat(pdfContainer.style.width) || 612;
    // Conversion: 1pt = 1.333px
    const pdfWidthPx = pdfWidthPt * (96 / 72);

    const newZoom = Math.floor((availableWidth / pdfWidthPx) * 100);
    setZoom(Math.max(ZOOM_MIN, newZoom));
}

// --- Actions ---

function downloadPdf() {
    if (!currentBlobUrl) return;

    const link = document.createElement('a');
    link.href = currentBlobUrl;

    // Generate filename
    const name = currentResume?.contact?.name || 'Resume';
    // Clean name
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
    link.download = `${safeName}_Resume.pdf`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function printPdf() {
    // Print logic for Blob URL in iframe/embed is tricky.
    // Best way: Open in new window if possible, or use iframe method
    if (!currentBlobUrl) return;

    // Method 1: focus embed and print
    // const embed = document.querySelector('embed');
    // if (embed) { embed.focus(); window.print(); } 
    // ^ This prints the preview page UI too, which we don't want.

    // Method 2: Create hidden iframe, load blob, print
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = currentBlobUrl;
    document.body.appendChild(iframe);

    iframe.onload = () => {
        iframe.contentWindow.print();
        // Cleanup after print dialog usage?
        // setTimeout(() => document.body.removeChild(iframe), 60000);
    };
}
