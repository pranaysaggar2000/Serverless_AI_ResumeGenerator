import { DEFAULT_FORMAT } from './modules/defaults.js';
import { renderFullResumeEditor } from './modules/editor_full_renderer.js';
import { createPdfPreview } from './modules/pdf_preview_core.js';
import { calculateLiveAtsScore } from './modules/ats_live.js';
import { regenerateResume } from './modules/api.js';
import { updateState, state } from './modules/state.js';
import { getApiKeyForProvider } from './modules/utils.js';

// --- State ---
let currentResume = null;
let currentFormat = null;
let currentJdAnalysis = null;
let saveTimer = null;
let pdfPreview = null;
let isTailored = false;
const channel = new BroadcastChannel('resume-preview');
let currentEditorZoom = 1.0;
let userDeletedItems = {};
let undoSnapshot = null; // Step 36
const EDITOR_ID = 'full-editor-' + Date.now(); // Step 57

// --- Utility Helpers ---
const escapeHtml = (str) => {
    if (!str) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

function trackDeletedItem(sectionName, item, originalIndex) {
    if (!userDeletedItems[sectionName]) userDeletedItems[sectionName] = [];
    const itemId = (item.company || item.name || item.organization || item.title || item.role || '').trim();
    if (!itemId) return;
    const already = userDeletedItems[sectionName].some(d => (d.item.company || d.item.name || d.item.title || '').trim().toLowerCase() === itemId.toLowerCase());
    if (!already) {
        userDeletedItems[sectionName].push({ item: JSON.parse(JSON.stringify(item)), originalIndex, deletedAt: Date.now() });
        updateRestoreButtonVisibility();
    }
}

function updateRestoreButtonVisibility() {
    const btn = document.getElementById('restoreDeletedBtn');
    if (!btn) return;
    const count = Object.values(userDeletedItems).reduce((s, a) => s + a.length, 0);
    if (count > 0) {
        btn.style.display = 'inline-flex';
        btn.textContent = `♻️ Restore Deleted (${count})`;
    } else {
        btn.style.display = 'none';
    }
}

function detectMissingItems() {
    if (!state.baseResume) { setTimeout(detectMissingItems, 500); return; }
    const sections = ['experience', 'projects', 'leadership', 'research', 'education', 'certifications', 'awards', 'volunteering'];
    sections.forEach(sec => {
        const baseItems = state.baseResume[sec] || [];
        const currentItems = currentResume[sec] || [];
        baseItems.forEach((baseItem, baseIdx) => {
            const baseId = (baseItem.company || baseItem.name || baseItem.organization || baseItem.title || '').toLowerCase().trim();
            if (!baseId) return;
            const exists = currentItems.some(curr => {
                const currId = (curr.company || curr.name || curr.organization || curr.title || '').toLowerCase().trim();
                return currId === baseId || currId.includes(baseId) || baseId.includes(currId);
            });
            if (!exists) trackDeletedItem(sec, baseItem, baseIdx);
        });
    });
    updateRestoreButtonVisibility();
}

function showRestoreDeletedDialog() {
    const total = Object.values(userDeletedItems).reduce((s, a) => s + a.length, 0);
    if (total === 0) return;
    let html = `<div style="max-height:400px;overflow-y:auto;padding:10px;"><p style="margin:0 0 12px;color:#6b7280;font-size:13px;">Select items to restore.</p>`;
    const sectionLabels = { experience: 'Work Experience', projects: 'Projects', leadership: 'Leadership', research: 'Research', education: 'Education', certifications: 'Certifications', awards: 'Awards', volunteering: 'Volunteering' };

    Object.entries(userDeletedItems).forEach(([section, items]) => {
        if (items.length === 0) return;
        html += `<div style="margin-bottom:12px;"><h4 style="margin:0 0 6px;font-size:13px;color:#374151;text-transform:uppercase;">${sectionLabels[section] || section}</h4>`;
        items.forEach((entry, i) => {
            const name = entry.item.company || entry.item.name || entry.item.organization || entry.item.title || 'Unknown';
            html += `<label class="restore-item" style="display:flex;gap:10px;padding:8px;border-bottom:1px solid #f3f4f6;cursor:pointer;">
                        <input type="checkbox" data-section="${section}" data-deleted-index="${i}">
                        <div style="font-size:13px;"><strong>${escapeHtml(name)}</strong></div>
                    </label>`;
        });
        html += `</div>`;
    });
    html += `</div>`;

    const overlay = document.createElement('div');
    overlay.id = 'restoreDeletedOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `<div style="background:white;border-radius:12px;width:420px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.3);overflow:hidden;">
            <div style="padding:16px 20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;"><h3>♻️ Restore Deleted Items</h3><button id="closeRestoreBtn">&times;</button></div>
            ${html}
            <div style="padding:12px 20px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:8px;">
                <button id="cancelRestoreBtn">Cancel</button>
                <button id="confirmRestore" style="background:#6366f1;color:white;padding:8px 16px;border-radius:6px;">Restore Selected</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    // Attach listeners
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#closeRestoreBtn').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#cancelRestoreBtn').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#confirmRestore').onclick = async () => {
        const checked = overlay.querySelectorAll('input:checked');
        const toRestore = {};
        checked.forEach(cb => {
            const sec = cb.dataset.section;
            if (!toRestore[sec]) toRestore[sec] = [];
            toRestore[sec].push(parseInt(cb.dataset.deletedIndex));
        });

        Object.entries(toRestore).forEach(([section, indices]) => {
            indices.sort((a, b) => b - a);
            if (!currentResume[section]) currentResume[section] = [];
            indices.forEach(idx => {
                currentResume[section].push(JSON.parse(JSON.stringify(userDeletedItems[section][idx].item)));
                userDeletedItems[section].splice(idx, 1);
            });
            if (userDeletedItems[section].length === 0) delete userDeletedItems[section];
        });

        await applyStructuralChange(false);
        updateRestoreButtonVisibility();
        overlay.remove();
        showSuccessToast("Items restored!");
    };
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadInitialData();
    setupGlobalListeners();
    setupLinkPopup();
    setupToolbar();
    setupFormatPanel();
    setupBroadcast();
    setupResizableLayout();
    setupKeyboardShortcuts();

    window.addEventListener('beforeunload', () => {
        const latest = scrapeResumeFromEditor();
        if (latest && Object.keys(latest).length > 0) currentResume = latest;
        saveToStorage(currentResume);
    });
    channel.postMessage({ type: 'preview-ready' });
});

async function loadInitialData() {
    // Step 70: Hide spinner on error by ensuring empty state or toast clears it
    const loading = document.getElementById('editorLoading');
    try {
        // Step 66: Add safety timeout
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Storage read timed out')), 10000));

        const data = await Promise.race([
            chrome.storage.local.get(['tailored_resume', 'base_resume', 'format_settings', 'jd_analysis']),
            timeoutPromise
        ]);

        if (data.tailored_resume && Object.keys(data.tailored_resume).length > 0) {
            currentResume = data.tailored_resume; isTailored = true;
        } else if (data.base_resume && Object.keys(data.base_resume).length > 0) {
            currentResume = data.base_resume; isTailored = false;
        } else {
            currentResume = {};
        }
        currentFormat = data.format_settings || DEFAULT_FORMAT;
        currentJdAnalysis = data.jd_analysis;
        updateState({ baseResume: data.base_resume });
        detectMissingItems();

        const container = document.getElementById('pdfContainer');
        if (typeof window.jspdf === 'undefined') {
            container.innerHTML = `<div style="color:red;padding:20px;">Library Error: jsPDF not loaded.</div>`;
            return;
        }
        pdfPreview = createPdfPreview(container);

        if (Object.keys(currentResume).length > 0) {
            renderEditor();
            renderSectionNav();
            updateAtsBadge();
            await safelyGeneratePdf(true);
            autoFitEditor();
        } else {
            showEmptyState();
        }
    } catch (e) {
        console.error("Load Error:", e);
        showErrorToast("Failed to load resume data.");
        if (loading) loading.style.display = 'none'; // Step 70
        showEmptyState();
    }
}

function setupResizableLayout() {
    const divider = document.getElementById('panelDivider');
    const leftPanel = document.getElementById('editorPanel');
    const rightPanel = document.getElementById('previewPanel');
    const splitContainer = document.getElementById('splitContainer');
    if (!divider || !leftPanel || !rightPanel) return;

    let isDragging = false;
    divider.addEventListener('mousedown', (e) => {
        isDragging = true;
        divider.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const rect = splitContainer.getBoundingClientRect();
        let newWidth = Math.max(300, Math.min(rect.width - 300, e.clientX - rect.left));
        leftPanel.style.flex = `0 0 ${newWidth}px`;
        rightPanel.style.flex = '1';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            divider.classList.remove('dragging');
            document.body.style.cursor = '';
        }
    });

    // Step 67: Touch support
    divider.addEventListener('touchstart', (e) => {
        isDragging = true;
        divider.classList.add('dragging');
        document.body.classList.add('resizing');
        e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const touch = e.touches[0];
        const rect = splitContainer.getBoundingClientRect();
        let newWidth = Math.max(300, Math.min(rect.width - 300, touch.clientX - rect.left));
        leftPanel.style.flex = `0 0 ${newWidth}px`;
        rightPanel.style.flex = '1';
    }, { passive: false });

    document.addEventListener('touchend', () => {
        if (isDragging) {
            isDragging = false;
            divider.classList.remove('dragging');
            document.body.classList.remove('resizing');
        }
    });
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', async (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); await saveChanges(true); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); pdfPreview?.print(currentResume, currentFormat); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); pdfPreview?.download(currentResume, currentFormat); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            if (!document.activeElement?.isContentEditable && undoSnapshot) {
                e.preventDefault(); currentResume = JSON.parse(JSON.stringify(undoSnapshot)); undoSnapshot = null;
                renderEditor(); broadcastToSidePanel(currentResume, currentFormat); safelyGeneratePdf(); showSuccessToast('Undone!');
            }
        }
    });

    const container = document.getElementById('resumeEditorContainer');

    // Step 62: Paste handler
    container.addEventListener('paste', (e) => {
        e.preventDefault();
        let text = e.clipboardData.getData('text/plain');

        const target = e.target;
        const isBulletList = target.closest('.bullet-list') || target.tagName === 'LI';
        const isSummary = target.closest('.section-content');

        if (!isBulletList && !isSummary) {
            // Single-line field — strip newlines
            text = text.replace(/[\r\n]+/g, ' ').trim();
        }

        document.execCommand('insertText', false, text);
    });

    // Step 64: Backspace handler
    container.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
            const target = e.target;
            const li = target.closest('li');
            const isBulletList = target.closest('.bullet-list');

            if (isBulletList && li) {
                const selection = window.getSelection();
                if (selection.rangeCount) {
                    const range = selection.getRangeAt(0);
                    // Check if cursor is at start of <li>
                    if (range.collapsed && range.startOffset === 0) {
                        const prevLi = li.previousElementSibling;
                        if (prevLi) {
                            e.preventDefault();

                            // Remove bullet-actions from both
                            li.querySelector('.bullet-actions')?.remove();
                            prevLi.querySelector('.bullet-actions')?.remove();

                            const prevLen = prevLi.textContent.length;

                            // Merge content
                            while (li.firstChild) {
                                prevLi.appendChild(li.firstChild);
                            }
                            li.remove();

                            // Re-add actions to merged li (simplified, will be fixed on next render/click)

                            // Restore cursor
                            const newRange = document.createRange();
                            const textNode = prevLi.firstChild; // Might be null if empty

                            // Logic to set cursor at merge point
                            const nodeToSelect = prevLi.lastChild || prevLi;
                            // This part is tricky with multiple nodes. 
                            // Simplified approach: rely on next render or just place at end of prev text.
                            // Actually, let's trigger a re-render or let contenteditable handle it? No, we prevented default.
                            // Best effort: set selection to end of original prev content.
                            // Wait, if we appendChild, prevLi text continues. 

                            // Let's just create a mock text node if needed?
                            // A safer way effectively is usually done by standard execCommand('delete') but Chrome acts weird.

                            // Let's stick closely to the REQUESTED impl which was specific:
                            /*
                               const newRange = document.createRange();
                               const textNode = prevLi.firstChild;
                               if (textNode) {
                                   newRange.setStart(textNode, Math.min(prevLen, textNode.length));
                                   newRange.collapse(true);
                                   selection.removeAllRanges();
                                   selection.addRange(newRange);
                               }
                            */

                            if (prevLi.childNodes.length > 0) {
                                // Find the text node that contains the split point?
                                // Actually, if we just merged, the cursor should be at 'prevLen'.
                                // It might be complicated if there are multiple text nodes.
                                // Let's try to normalize?
                                prevLi.normalize();
                                const tNode = prevLi.firstChild;
                                if (tNode && tNode.nodeType === 3) {
                                    newRange.setStart(tNode, prevLen);
                                    newRange.collapse(true);
                                    selection.removeAllRanges();
                                    selection.addRange(newRange);
                                }
                            }

                            // Trigger update
                            // We need to trigger input event?
                            const evt = new Event('input', { bubbles: true });
                            container.dispatchEvent(evt);
                        }
                    }
                }
            }
        }
    });
}

function setupToolbar() {
    document.getElementById('saveBtn')?.addEventListener('click', () => saveChanges(true));
    document.getElementById('restoreDeletedBtn')?.addEventListener('click', showRestoreDeletedDialog);
    document.getElementById('reforgeBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('reforgeBtn');
        const originalText = btn.innerHTML;
        try {
            await saveChanges(true);
            const data = await chrome.storage.local.get(['base_resume', 'jd_analysis', 'gemini_api_key', 'groq_api_key', 'openrouter_api_key', 'provider_settings', 'auth_mode', 'free_usage', 'access_token']);
            if (!data.jd_analysis) { showErrorToast('No job description found!'); return; }
            if (data.auth_mode === 'free' && data.free_usage?.remaining <= 0) { showErrorToast('Daily limit reached!'); return; }
            if (!confirm("Regenerate resume with AI?")) return;

            btn.innerHTML = '<span class="spinner"></span> Reforging...'; btn.disabled = true;
            updateState({
                baseResume: data.base_resume, currentJdAnalysis: data.jd_analysis,
                currentApiKey: data.gemini_api_key, currentGroqKey: data.groq_api_key, currentOpenRouterKey: data.openrouter_api_key,
                currentProvider: data.provider_settings?.provider || 'gemini', authMode: data.auth_mode, accessToken: data.access_token
            });

            const newResume = await regenerateResume(data.base_resume || currentResume, collectBulletCountsFromFullEditor(), data.jd_analysis, getApiKeyForProvider(), state.currentProvider, 'balanced', '1page', null);
            currentResume = newResume;
            await chrome.storage.local.set({ tailored_resume: newResume });
            renderEditor(); renderSectionNav(); await safelyGeneratePdf(true); showSuccessToast('Reforged!');
        } catch (e) {
            console.error("Reforge Error:", e); showErrorToast(`Reforge Failed: ${e.message}`);
        } finally {
            btn.innerHTML = originalText; btn.disabled = false;
        }
    });

    document.getElementById('closeTabBtn')?.addEventListener('click', () => window.close());
    document.getElementById('reorderToggle')?.addEventListener('click', openReorderModal);
    setupReorderModal();

    document.getElementById('fitToOnePageBtn')?.addEventListener('click', async () => {
        if ((pdfPreview?.getPageCount() || 1) <= 1) { showSuccessToast('Already fits!'); return; }
        const btn = document.getElementById('fitToOnePageBtn');
        const originalText = btn.innerHTML; btn.innerHTML = '📐 Fitting...';

        currentFormat = { ...currentFormat, margins: 'narrow', density: 'compact', bodySize: Math.max(8.5, (currentFormat.bodySize || 10) - 1), headerSize: Math.max(10, (currentFormat.headerSize || 12) - 1), nameSize: Math.max(16, (currentFormat.nameSize || 20) - 2) };
        applyFormatStylesToEditor(currentFormat);
        await safelyGeneratePdf(true);

        while ((pdfPreview?.getPageCount() || 1) > 1 && (currentFormat.bodySize || 10) > 8) {
            currentFormat.bodySize -= 0.5;
            applyFormatStylesToEditor(currentFormat);
            await safelyGeneratePdf(true);
        }
        chrome.storage.local.set({ format_settings: currentFormat });
        showSuccessToast('Fitted to 1 page!'); btn.innerHTML = originalText;
    });

    document.getElementById('copyTextBtn')?.addEventListener('click', () => {
        const text = [currentResume.name, ...Object.values(currentResume.contact || {}), currentResume.summary].filter(Boolean).join('\n') + '\n\n' + sectionsOrder.map(s => currentResume[s] ? `${s.toUpperCase()}\n${JSON.stringify(currentResume[s], null, 2)}` : '').join('\n\n');
        navigator.clipboard.writeText(text);
        showSuccessToast("Text copied!");
    });
}

function setupReorderModal() {
    const modal = document.getElementById('reorderModal');
    const list = document.getElementById('sortableList');
    document.getElementById('saveReorderBtn').onclick = async () => {
        const newOrder = Array.from(list.querySelectorAll('li')).map(li => li.dataset.section);
        currentResume.section_order = newOrder;
        renderEditor(); renderSectionNav(); await safelyGeneratePdf(true); await saveToStorage(currentResume);
        modal.style.display = 'none';
    };
    document.getElementById('closeReorderBtn').onclick = () => modal.style.display = 'none';
    document.getElementById('cancelReorderBtn').onclick = () => modal.style.display = 'none';

    // Basic drag/drop
    let dragged = null;
    list.addEventListener('dragstart', (e) => { dragged = e.target; e.target.style.opacity = 0.5; });
    list.addEventListener('dragend', (e) => { e.target.style.opacity = ""; });
    list.addEventListener('dragover', (e) => { e.preventDefault(); const target = e.target.closest('li'); if (target && target !== dragged) { const rect = target.getBoundingClientRect(); if (e.clientY > rect.top + rect.height / 2) target.after(dragged); else target.before(dragged); } });
}

function openReorderModal() {
    const list = document.getElementById('sortableList'); list.innerHTML = '';
    const def = ['summary', 'education', 'experience', 'projects', 'skills', 'leadership', 'certifications', 'awards', 'volunteering', 'languages', 'interests', 'research'];
    const order = currentResume.section_order || def;
    const all = Array.from(new Set([...order, ...def]));
    all.forEach(s => {
        const li = document.createElement('li'); li.className = 'sortable-item'; li.draggable = true; li.dataset.section = s;
        li.innerHTML = `<span class="handle">☰</span> ${s.charAt(0).toUpperCase() + s.slice(1)}`;
        list.appendChild(li);
    });
    document.getElementById('reorderModal').style.display = 'flex';
}

function renderSectionNav() {
    const nav = document.getElementById('sectionNav'); if (!nav) return; nav.innerHTML = '';
    const order = currentResume.section_order || [];
    const titles = currentResume.section_titles || {};
    const defaultLabels = { summary: "Summary", education: "Education", skills: "Skills", experience: "Experience", projects: "Projects", leadership: "Leadership", research: "Research", certifications: "Certs", awards: "Awards", volunteering: "Volunteering", languages: "Languages", interests: "Interests" };

    order.forEach(s => {
        const data = currentResume[s];
        if (!data) return;
        if (Array.isArray(data) && data.length === 0) return;
        if (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0) return;
        if (typeof data === 'string' && !data.trim()) return;

        const btn = document.createElement('button'); btn.className = 'section-nav-btn';
        btn.textContent = titles[s] || defaultLabels[s] || s;
        btn.onclick = () => {
            const target = document.querySelector(`.resume-section[data-section="${s}"]`);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                nav.querySelectorAll('.section-nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        };
        nav.appendChild(btn);
    });
}

function updateAtsBadge() {
    const badge = document.getElementById('atsBadge'); if (!badge) return;
    const res = calculateLiveAtsScore(currentResume, currentJdAnalysis);
    if (!res) { badge.textContent = "ATS: --"; return; }
    badge.textContent = `ATS Match: ${res.score}%`;
    badge.style.background = res.score >= 80 ? "#d1fae5" : res.score >= 50 ? "#fef3c7" : "#fee2e2";
}

async function applyStructuralChange(forceStorage = false) {
    undoSnapshot = JSON.parse(JSON.stringify(currentResume)); // Step 36
    renderEditor(); broadcastToSidePanel(currentResume, currentFormat); safelyGeneratePdf();
    if (forceStorage) await saveToStorage(currentResume);
    updateAtsBadge?.();
}

function broadcastToSidePanel(resume, format) {
    // Step 57: Send EDITOR_ID
    channel.postMessage({
        type: 'editor-resume-update',
        sender: EDITOR_ID,
        payload: { resume, format }
    });
}

async function saveToStorage(resume) {
    const key = isTailored ? 'tailored_resume' : 'base_resume';
    await chrome.storage.local.set({ [key]: resume });
}

async function saveChanges(forceStorage = false) {
    const latest = scrapeResumeFromEditor();
    currentResume = latest;
    broadcastToSidePanel(latest, currentFormat);
    if (forceStorage) await saveToStorage(latest);
    updateAtsBadge();
    updatePageIndicator(); // Step 51
}

function updatePageIndicator() {
    const indicator = document.getElementById('pageIndicator');
    const warning = document.getElementById('fitWarning');
    const pages = pdfPreview?.getPageCount?.() || 1;

    if (indicator) {
        indicator.textContent = `📄 ${pages} page${pages !== 1 ? 's' : ''}`;
    }

    const page = document.querySelector('.resume-page');
    if (page) {
        // Only add multipage if PDF actually has > 1 page
        // Don't rely on editor scrollHeight (it's affected by the multipage class itself)
        if (pages > 1) {
            page.classList.add('multipage');
            if (warning) warning.style.display = 'inline';
        } else {
            page.classList.remove('multipage');
            if (warning) warning.style.display = 'none';
        }
    }
}

async function safelyGeneratePdf(force = false) {
    if (!pdfPreview) return;
    const container = document.getElementById('pdfContainer');
    container?.classList.add('regenerating'); // Step 37
    try {
        await pdfPreview.regenerate(currentResume, currentFormat, force);
        updatePageIndicator(); // Step 51: Update after regeneration
    } catch (e) {
        console.error("PDF Error:", e);
    } finally {
        container?.classList.remove('regenerating');
    }
}

function showInfoPopup(title, html) {
    const div = document.createElement('div');
    div.id = 'infoPopupOverlay';
    div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:10000;display:flex;align-items:center;justify-content:center;';
    div.innerHTML = `<div style="background:white;padding:24px;border-radius:12px;width:320px;box-shadow:0 10px 30px rgba(0,0,0,0.2);">
        <h3 style="margin-top:0;">${title}</h3><div>${html}</div>
        <button id="closeInfoPopupBtn" style="margin-top:20px;width:100%;padding:8px;cursor:pointer;">Close</button>
    </div>`;
    div.addEventListener('click', (e) => { if (e.target === div) div.remove(); });
    document.body.appendChild(div);

    // Attach listener dynamically for CSP compliance
    const closeBtn = div.querySelector('#closeInfoPopupBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => div.remove());
    }
}

function showErrorToast(msg) { const t = document.getElementById('errorToast'); if (t) { t.textContent = msg; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 3000); } }
function showSuccessToast(msg) { const t = document.getElementById('successToast'); if (t) { t.textContent = msg; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 3000); } }
function showEmptyState() { document.getElementById('resumeEditorContainer').innerHTML = '<div style="padding:100px;text-align:center;">No resume loaded.</div>'; }

function renderEditor() {
    renderFullResumeEditor(document.getElementById('resumeEditorContainer'), currentResume, currentFormat);
    applyZoom(currentEditorZoom);
}

function setupLinkPopup() {
    const popup = document.getElementById('linkEditorPopup');
    const input = document.getElementById('linkEditorInput');
    const save = document.getElementById('linkEditorSave');
    let target = null;
    document.getElementById('resumeEditorContainer').onclick = (e) => {
        const link = e.target.closest('.interactive-link');
        if (link) {
            e.stopPropagation(); target = link; input.value = link.dataset.url || '';
            popup.style.display = 'block';

            const rect = link.getBoundingClientRect();
            const editorContainer = document.getElementById('resumeEditorContainer');
            const containerRect = editorContainer.getBoundingClientRect();

            // Step 50: Use container offset + scrollTop for accurate placement
            popup.style.top = (rect.bottom - containerRect.top + editorContainer.scrollTop + 5) + 'px';
            popup.style.left = Math.max(10, rect.left - containerRect.left) + 'px';

            input.focus();
        } else { popup.style.display = 'none'; }
    };
    save.onclick = () => { if (target) { target.dataset.url = input.value; saveChanges(true); } popup.style.display = 'none'; };
}

function scrapeResumeFromEditor() {
    const container = document.getElementById('resumeEditorContainer');
    // Step 65: Null guard
    if (!container || !currentResume) return currentResume;
    const state = JSON.parse(JSON.stringify(currentResume));
    const getText = el => el ? el.innerText.trim() : '';

    // Core info
    const nameEl = container.querySelector('.resume-name');
    if (nameEl) state.name = getText(nameEl);

    const contact = container.querySelector('.resume-contact');
    if (contact && !state.contact) state.contact = {};
    if (contact) {
        ['email', 'phone', 'location', 'linkedin', 'portfolio'].forEach(k => {
            const el = contact.querySelector(`[data-field="${k}"]`);
            if (el) {
                const txt = getText(el);
                state.contact[k] = txt;
                if (k === 'portfolio') {
                    if (el.dataset.url) state.contact.portfolio_url = el.dataset.url;
                    // Step 41: Preserve 'website' if it was the original source
                    if (currentResume.contact?.website && !currentResume.contact?.portfolio) {
                        state.contact.website = txt;
                    }
                }
            }
        });
    }

    // Sections & Order (Step 25 rebuild)
    const sects = container.querySelectorAll('.resume-section');
    state.section_order = [];
    sects.forEach(sec => {
        const type = sec.dataset.section;
        if (!type || type === 'name' || type === 'contact') return;
        state.section_order.push(type);

        // Title Casing (Step 28)
        const header = sec.querySelector('.section-header');
        if (header) {
            if (!state.section_titles) state.section_titles = {};
            let txt = header.textContent.trim();
            if (window.getComputedStyle(header).textTransform === 'uppercase') {
                const orig = currentResume.section_titles?.[type] || type;
                if (txt.toUpperCase() === orig.toUpperCase()) txt = orig;
                else txt = txt.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
            }
            state.section_titles[type] = txt;
        }

        if (type === 'summary') state.summary = getText(sec.querySelector('.section-content'));
        else if (type === 'skills') {
            state.skills = {};
            sec.querySelectorAll('.section-item').forEach(row => {
                const k = getText(row.querySelector('[data-key="category"]'));
                const v = getText(row.querySelector('[data-key="value"]'));
                if (k) state.skills[k] = v;
            });
        }
        else if (type === 'languages' || type === 'interests') {
            state[type] = getText(sec.querySelector('.section-content')).split(',').map(s => s.trim()).filter(Boolean);
        }
        else {
            state[type] = Array.from(sec.querySelectorAll('.section-item')).map(item => {
                const obj = {};
                const keys = ['company', 'school', 'name', 'title', 'role', 'degree', 'dates', 'location', 'tech', 'issuer', 'organization', 'conference', 'link'];
                keys.forEach(k => { const el = item.querySelector(`[data-key="${k}"]`); if (el) obj[k] = getText(el); });

                // Step 43: Defensively map institution
                if (type === 'education') {
                    const s = obj.school || obj.institution;
                    if (s) { obj.school = s; obj.institution = s; }
                }

                obj.bullets = Array.from(item.querySelectorAll('.bullet-list li')).filter(li => !li.hasAttribute('data-key')).map(li => {
                    const c = li.cloneNode(true); c.querySelectorAll('.bullet-actions').forEach(a => a.remove()); return c.innerText.trim();
                }); // Step 63: Removed filter(b => b.length > 0) to preserve empty bullets for cursor position

                // Step 40: Scrape GPA separately
                if (type === 'education') {
                    const gpaLi = item.querySelector('.bullet-list li[data-key="gpa"]');
                    if (gpaLi) {
                        let g = gpaLi.cloneNode(true); g.querySelectorAll('.bullet-actions').forEach(a => a.remove());
                        let gt = g.innerText.trim();
                        if (gt.toLowerCase().startsWith('gpa:')) gt = gt.substring(4).trim();
                        obj.gpa = gt;
                    }
                }

                const bc = item.querySelector('.bullet-count-input'); if (bc) obj.bullet_count_preference = parseInt(bc.value);
                return obj;
            });
        }
    });

    // Step 42: Normalize date/dates key inconsistency
    ['experience', 'education', 'projects', 'leadership', 'research', 'certifications', 'awards', 'volunteering'].forEach(sec => {
        if (Array.isArray(state[sec])) {
            state[sec].forEach(item => { if (item.date !== undefined && item.dates !== undefined) delete item.date; });
        }
    });

    return state;
}

function setupGlobalListeners() {
    const container = document.getElementById('resumeEditorContainer');
    let inputDebounceTimer = null;
    let pdfDebounceTimer = null; // Step 59: Separate debounce for PDF
    function handleInput() {
        const newState = scrapeResumeFromEditor();
        currentResume = newState;
        broadcastToSidePanel(currentResume, currentFormat);
        updateAtsBadge();

        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => saveToStorage(currentResume), 5000);

        // PDF regeneration on longer debounce
        clearTimeout(pdfDebounceTimer);
        pdfDebounceTimer = setTimeout(() => {
            safelyGeneratePdf();
        }, 1500);
    }
    container.addEventListener('input', () => { clearTimeout(inputDebounceTimer); inputDebounceTimer = setTimeout(handleInput, 400); });

    container.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('add-bullet-btn')) {
            currentResume = scrapeResumeFromEditor();
            const item = target.closest('.section-item');
            const sec = target.closest('.resume-section')?.dataset.section;
            const idx = item ? parseInt(item.dataset.index) : -1;
            if (sec && idx >= 0 && currentResume[sec]?.[idx]) {
                if (!currentResume[sec][idx].bullets) currentResume[sec][idx].bullets = [];
                currentResume[sec][idx].bullets.push(''); await applyStructuralChange(false);
            }
            return;
        }

        const btn = target.closest('button');
        if (!btn) return;
        const action = btn.dataset.action; if (!action) return;
        const item = btn.closest('.section-item');
        const sec = btn.closest('.resume-section')?.dataset.section || btn.dataset.section;
        const idx = item ? parseInt(item.dataset.index) : -1;

        if (['delete-item', 'move-up', 'move-down', 'delete-bullet', 'add-item'].includes(action)) currentResume = scrapeResumeFromEditor();

        if (action === 'add-item') {
            if (!sec) return;
            if (sec === 'skills') {
                if (!currentResume.skills || Array.isArray(currentResume.skills)) currentResume.skills = {};
                let nk = "New Category", fk = nk, c = 1; while (currentResume.skills[fk]) fk = nk + " " + c++;
                currentResume.skills[fk] = "Skill 1, Skill 2";
            } else if (['summary', 'languages', 'interests'].includes(sec)) { // Step 61
                showErrorToast('Edit this section by clicking directly on the text.');
                return;
            } else {
                if (!currentResume[sec]) currentResume[sec] = [];
                // Step 60: Custom templates
                let template = { company: 'New', role: 'Role', dates: 'Dates', bullets: ['New Achievement'] };
                if (sec === 'volunteering') {
                    template = { organization: 'Organization Name', role: 'Volunteer Role', dates: 'Dates', location: 'Location', bullets: ['Describe your contribution'] };
                } else if (sec === 'leadership') {
                    template = { organization: 'Organization Name', role: 'Leadership Role', dates: 'Dates', location: 'Location', bullets: ['Describe your leadership impact'] };
                }
                currentResume[sec].push(template);
            }
            await applyStructuralChange(false);
        }
        else if (action === 'delete-item') {
            if (!sec) return;
            if (sec === 'skills') {
                const sRow = btn.closest('.section-item, .skill-row');
                const cat = sRow?.querySelector('[data-key="category"]')?.innerText.trim();
                if (cat && currentResume.skills?.[cat]) { delete currentResume.skills[cat]; await applyStructuralChange(false); }
                return;
            }
            if (idx >= 0 && currentResume[sec]) { trackDeletedItem(sec, currentResume[sec][idx], idx); currentResume[sec].splice(idx, 1); await applyStructuralChange(false); }
        }
        else if (action === 'move-up' || action === 'move-down') {
            if (idx < 0 || !currentResume[sec]) return;
            const targetIdx = action === 'move-up' ? idx - 1 : idx + 1;
            if (targetIdx >= 0 && targetIdx < currentResume[sec].length) {
                [currentResume[sec][idx], currentResume[sec][targetIdx]] = [currentResume[sec][targetIdx], currentResume[sec][idx]];
                await applyStructuralChange(false);
            }
        }
        else if (action === 'delete-bullet') {
            const li = btn.closest('li');
            if (li && item && currentResume[sec]?.[idx]?.bullets) {
                const bLis = Array.from(li.parentNode.children).filter(c => !c.hasAttribute('data-key'));
                const bIdx = bLis.indexOf(li);
                if (bIdx >= 0) { currentResume[sec][idx].bullets.splice(bIdx, 1); await applyStructuralChange(false); }
            }
        }
        else if (action === 'bullet-count-decrease' || action === 'bullet-count-increase') {
            const row = btn.closest('.bullet-count-row');
            const input = row?.querySelector('.bullet-count-input');
            const display = row?.querySelector('.bullet-count-display');
            if (input && idx >= 0 && currentResume[sec]?.[idx]) {
                let c = parseInt(input.value) || 0;
                if (action === 'bullet-count-decrease' && c > 0) c--;
                else if (action === 'bullet-count-increase' && c < 15) c++;
                input.value = c; if (display) display.textContent = c;
                currentResume[sec][idx].bullet_count_preference = c; await saveChanges(false);
            }
        }
    });

    setupPreviewControls();
}

function setupFormatPanel() {
    const strip = document.getElementById('formatStrip'), toggle = document.getElementById('formatToggle');
    if (!strip || !toggle) return;
    toggle.onclick = (e) => { e.stopPropagation(); const vis = strip.style.display !== 'none'; strip.style.display = vis ? 'none' : 'block'; toggle.classList.toggle('active', !vis); if (!vis) syncFormatUI(); };
    document.getElementById('formatCloseBtn').onclick = () => { strip.style.display = 'none'; toggle.classList.remove('active'); };
    document.addEventListener('click', (e) => { if (strip.style.display !== 'none' && !strip.contains(e.target) && e.target !== toggle) { strip.style.display = 'none'; toggle.classList.remove('active'); } });

    function syncFormatUI() {
        strip.querySelectorAll('.format-chip[data-setting]').forEach(b => b.classList.toggle('active', String(currentFormat[b.dataset.setting]) === String(b.dataset.value)));
        ['nameSize', 'bodySize', 'headerSize', 'subheaderSize'].forEach(k => { const s = document.getElementById(k), v = document.getElementById(k + 'Val'); if (s) { s.value = currentFormat[k]; v.textContent = currentFormat[k] + 'pt'; } });
    }

    function apply(upd) {
        currentFormat = { ...currentFormat, ...upd }; syncFormatUI(); applyFormatStylesToEditor(currentFormat);
        safelyGeneratePdf(); broadcastToSidePanel(currentResume, currentFormat);
        chrome.storage.local.set({ format_settings: currentFormat });
    }

    strip.querySelectorAll('.format-chip[data-setting]').forEach(b => b.onclick = () => apply({ [b.dataset.setting]: b.dataset.value }));
    ['nameSize', 'bodySize', 'headerSize', 'subheaderSize'].forEach(k => {
        const el = document.getElementById(k);
        if (el) el.oninput = (e) => {
            const v = parseFloat(e.target.value); document.getElementById(k + 'Val').textContent = v + 'pt';
            clearTimeout(el._tm); el._tm = setTimeout(() => apply({ [k]: v }), 150);
        };
    });
}

function applyFormatStylesToEditor(fmt) {
    const p = document.querySelector('.resume-page'); if (!p) return;
    const fonts = { times: "'Times New Roman', serif", helvetica: "Helvetica, Arial, sans-serif", courier: "Courier, monospace" };
    p.style.fontFamily = fonts[fmt.font] || fonts.times; p.style.fontSize = (fmt.bodySize || 10) + 'pt';
    const ms = fmt.margins === 'narrow' ? 20 : fmt.margins === 'wide' ? 45 : 30;
    const mt = fmt.margins === 'narrow' ? 15 : fmt.margins === 'wide' ? 25 : 20;
    p.style.padding = `${mt}pt ${ms}pt`;
    const dens = { compact: 1.15, normal: 1.2, spacious: 1.3 };
    p.style.lineHeight = String(dens[fmt.density] || 1.2);
    const n = p.querySelector('.resume-name'); if (n) n.style.fontSize = (fmt.nameSize || 21) + 'pt';
    p.querySelectorAll('.section-header').forEach(h => {
        h.style.fontSize = (fmt.headerSize || 12) + 'pt'; h.style.fontWeight = 'bold';
        h.style.textTransform = (fmt.headerStyle || '').includes('uppercase') ? 'uppercase' : 'none';
        h.style.borderBottom = (fmt.headerStyle || '').includes('_line') ? '0.5pt solid #000' : 'none';
    });

    // Sub-header size (italic rows: role, degree, etc.) - Step 55
    if (fmt.subheaderSize) {
        p.querySelectorAll('.item-row.italic-row [contenteditable]').forEach(el => {
            el.style.fontSize = fmt.subheaderSize + 'pt';
        });
    }
}

function setupBroadcast() {
    channel.onmessage = (e) => {
        const { type, payload, sender } = e.data;
        // Step 57: Ignore own messages
        if (sender === EDITOR_ID) return;

        if (type === 'resume-update' && payload.resume) { currentResume = payload.resume; renderEditor(); safelyGeneratePdf(true); }
        else if (type === 'format-update' && payload.format) { currentFormat = payload.format; renderEditor(); safelyGeneratePdf(true); }
    };
}

const applyZoom = (z) => {
    currentEditorZoom = Math.max(0.4, Math.min(2.0, z));
    const p = document.querySelector('.resume-page');
    if (p) {
        p.style.transform = `scale(${currentEditorZoom})`;
        p.style.transformOrigin = 'top center';
        p.style.marginBottom = `-${(1 - currentEditorZoom) * 100}%`;
    }
    // Step 49: Counter-scale action buttons so they stay clickable
    document.documentElement.style.setProperty('--zoom-inverse', `${1 / currentEditorZoom}`);
    const d = document.getElementById('zoomLevel'); if (d) d.textContent = Math.round(currentEditorZoom * 100) + '%';
};

const autoFitEditor = () => {
    const c = document.getElementById('resumeEditorContainer');
    if (c) applyZoom(Math.min(1.0, (c.clientWidth - 48) / (612 * 96 / 72)));
};

function setupPreviewControls() {
    document.getElementById('shortcutHelpBtn')?.addEventListener('click', () => {
        const list = [['💾 Save', 'Ctrl + S'], ['🖨️ Print', 'Ctrl + P'], ['⏬ Down', 'Ctrl + D'], ['↩️ Undo', 'Ctrl + Z']];
        const h = list.map(s => `<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>${s[0]}</span><kbd>${s[1]}</kbd></div>`).join('');
        showInfoPopup('Shortcuts', h);
    });
    document.getElementById('bottomPrintBtn')?.addEventListener('click', () => pdfPreview?.print(currentResume, currentFormat));
    document.getElementById('zoomIn')?.addEventListener('click', () => applyZoom(currentEditorZoom + 0.1));
    document.getElementById('zoomOut')?.addEventListener('click', () => applyZoom(currentEditorZoom - 0.1));

    // Pinch-to-zoom (Trackpad) & Ctrl+Scroll (Mouse)
    document.getElementById('editorPanel')?.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.05 : 0.05; // Smoother steps for trackpad
            applyZoom(currentEditorZoom + delta);
        }
    }, { passive: false });
}

export function collectBulletCountsFromFullEditor() {
    const res = {};
    ['experience', 'projects', 'leadership', 'research'].forEach(s => {
        if (Array.isArray(currentResume[s])) res[s] = currentResume[s].map(i => i.bullet_count_preference || (i.bullets || []).length);
    });
    return res;
}
