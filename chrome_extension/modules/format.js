import { state, updateState } from './state.js';
import { generatePdf } from './api.js';
import { showStatus, showMainUI, showSetupUI, showSettings } from './ui.js';
import { checkCurrentProviderKey } from './utils.js';
import { sendFormatUpdate } from './live_preview.js';
import { getCurrentEditingResume } from './editor.js';


import { DEFAULT_FORMAT } from './defaults.js';
export { DEFAULT_FORMAT };

let formatSaveTimer = null;
export function debouncedSaveFormat(settings) {
    // Optimistic UI updates are handled by the sliders
    updateState({ formatSettings: settings });
    clearTimeout(formatSaveTimer);
    formatSaveTimer = setTimeout(() => saveFormatSettings(settings), 300);

    // Broadcast format change to live preview
    try { sendFormatUpdate(); } catch (_) { /* preview not available */ }
}

export async function loadFormatSettings() {
    const data = await chrome.storage.local.get('format_settings');
    const settings = { ...DEFAULT_FORMAT, ...(data.format_settings || {}) };
    updateState({ formatSettings: settings });
    refreshFormatUI(settings);
    return settings;
}

export async function saveFormatSettings(settings) {
    updateState({ formatSettings: settings });
    await chrome.storage.local.set({ format_settings: settings });
    updateState({ latestPdfBlob: null });
}

export function refreshFormatUI(settings) {
    // Highlight active toggle buttons
    document.querySelectorAll('.format-option').forEach(btn => {
        const setting = btn.dataset.setting;
        const value = btn.dataset.value;
        btn.classList.toggle('active', settings[setting] === value);
    });

    // Sliders
    const nameSlider = document.getElementById('nameSizeSlider');
    const bodySlider = document.getElementById('bodySizeSlider');
    const headerSizeSlider = document.getElementById('headerSizeSlider');
    const subheaderSizeSlider = document.getElementById('subheaderSizeSlider');

    if (nameSlider) { nameSlider.value = settings.nameSize; document.getElementById('nameSizeValue').textContent = settings.nameSize + 'pt'; }
    if (bodySlider) { bodySlider.value = settings.bodySize; document.getElementById('bodySizeValue').textContent = settings.bodySize + 'pt'; }
    if (headerSizeSlider) { headerSizeSlider.value = settings.headerSize; document.getElementById('headerSizeValue').textContent = settings.headerSize + 'pt'; }
    if (subheaderSizeSlider) { subheaderSizeSlider.value = settings.subheaderSize; document.getElementById('subheaderSizeValue').textContent = settings.subheaderSize + 'pt'; }

    // Dropdown
    const headerSelect = document.getElementById('headerStyleSelect');
    if (headerSelect) headerSelect.value = settings.headerStyle;

    // Checkbox
    const linksCheck = document.getElementById('showLinksCheck');
    if (linksCheck) linksCheck.checked = settings.showLinks;

    // Update preset active state
    const presetMap = {
        presetCompact: { density: 'compact', margins: 'narrow' },
        presetStandard: { density: 'normal', margins: 'normal' },
        presetSpacious: { density: 'spacious', margins: 'wide' }
    };

    document.querySelectorAll('.preset-btn').forEach(btn => {
        const expected = presetMap[btn.id];
        if (expected) {
            const matches = Object.entries(expected).every(([k, v]) => settings[k] === v);
            btn.classList.toggle('preset-active', matches);
        }
    });
}

export function setupFormatUI() {
    const formatBtn = document.getElementById('formatBtn');
    const formatUI = document.getElementById('formatUI');
    const closeFormatBtn = document.getElementById('closeFormatBtn');

    if (formatBtn) {
        formatBtn.addEventListener('click', async () => {
            await loadFormatSettings();
            formatUI.style.display = 'block';
            document.getElementById('actions').style.display = 'none';

            // Show page mode info in format panel
            let pageModeNote = document.getElementById('formatPageModeNote');
            if (!pageModeNote) {
                pageModeNote = document.createElement('div');
                pageModeNote.id = 'formatPageModeNote';
                pageModeNote.style.cssText = 'font-size:10px; color: #6b7280; margin-bottom:10px; padding:6px 8px; background:#f0f4ff; border-radius:6px;';
                formatUI.insertBefore(pageModeNote, formatUI.firstChild.nextSibling); // Insert after close button or header
            }
            pageModeNote.textContent = state.pageMode === '1page'
                ? '📄 1-Page mode active — PDF will target single page. Switch to 2-Page in main view for more content.'
                : '📄 2-Page mode — resume may span two pages.';
        });
    }

    if (closeFormatBtn) {
        closeFormatBtn.addEventListener('click', () => {
            formatUI.style.display = 'none';
            document.getElementById('actions').style.display = 'block';
        });
    }

    // Toggle buttons
    document.querySelectorAll('.format-option').forEach(btn => {
        btn.addEventListener('click', async () => {
            const setting = btn.dataset.setting;
            const value = btn.dataset.value;
            const settings = { ...state.formatSettings, [setting]: value };
            await saveFormatSettings(settings);
            refreshFormatUI(settings);
        });
    });

    // Sliders
    const nameSlider = document.getElementById('nameSizeSlider');
    if (nameSlider) {
        nameSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            document.getElementById('nameSizeValue').textContent = val + 'pt';
            debouncedSaveFormat({ ...state.formatSettings, nameSize: val });
        });
    }

    const bodySlider = document.getElementById('bodySizeSlider');
    if (bodySlider) {
        bodySlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            document.getElementById('bodySizeValue').textContent = val + 'pt';
            debouncedSaveFormat({ ...state.formatSettings, bodySize: val });
        });
    }

    const headerSizeSlider = document.getElementById('headerSizeSlider');
    if (headerSizeSlider) {
        headerSizeSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            document.getElementById('headerSizeValue').textContent = val + 'pt';
            debouncedSaveFormat({ ...state.formatSettings, headerSize: val });
        });
    }

    const subheaderSizeSlider = document.getElementById('subheaderSizeSlider');
    if (subheaderSizeSlider) {
        subheaderSizeSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            document.getElementById('subheaderSizeValue').textContent = val + 'pt';
            debouncedSaveFormat({ ...state.formatSettings, subheaderSize: val });
        });
    }

    // Header style dropdown
    const headerSelect = document.getElementById('headerStyleSelect');
    if (headerSelect) {
        headerSelect.addEventListener('change', async (e) => {
            await saveFormatSettings({ ...state.formatSettings, headerStyle: e.target.value });
        });
    }

    // Show links checkbox
    const linksCheck = document.getElementById('showLinksCheck');
    if (linksCheck) {
        linksCheck.addEventListener('change', async (e) => {
            await saveFormatSettings({ ...state.formatSettings, showLinks: e.target.checked });
        });
    }

    // Preview button
    const previewFormatBtn = document.getElementById('previewFormatBtn');
    if (previewFormatBtn) {
        previewFormatBtn.addEventListener('click', async () => {
            chrome.tabs.create({ url: 'preview_live.html' });
        });
    }

    // Reset button
    const resetFormatBtn = document.getElementById('resetFormatBtn');
    if (resetFormatBtn) {
        resetFormatBtn.addEventListener('click', async () => {
            await saveFormatSettings({ ...DEFAULT_FORMAT });
            refreshFormatUI(DEFAULT_FORMAT);
            showStatus("Format reset to defaults", "info");
        });
    }

    // Quick Preset Buttons
    const presets = {
        presetCompact: {
            font: 'times', density: 'compact', margins: 'narrow',
            nameSize: 18, bodySize: 9.5, headerSize: 11, subheaderSize: 10,
            headerStyle: 'uppercase_line', bulletChar: '•', pageSize: 'letter', showLinks: true
        },
        presetStandard: {
            font: 'times', density: 'normal', margins: 'normal',
            nameSize: 21, bodySize: 10, headerSize: 12, subheaderSize: 11,
            headerStyle: 'uppercase_line', bulletChar: '•', pageSize: 'letter', showLinks: true
        },
        presetSpacious: {
            font: 'helvetica', density: 'spacious', margins: 'wide',
            nameSize: 24, bodySize: 11, headerSize: 14, subheaderSize: 12,
            headerStyle: 'bold_line', bulletChar: '–', pageSize: 'letter', showLinks: true
        }
    };

    Object.entries(presets).forEach(([id, settings]) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', async () => {
                // Apply preset
                await saveFormatSettings({ ...state.formatSettings, ...settings });
                refreshFormatUI({ ...state.formatSettings, ...settings });

                // Update active state on preset buttons
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('preset-active'));
                btn.classList.add('preset-active');

                showStatus('Preset applied!', 'success');
            });
        }
    });
}
