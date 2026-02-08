import { state, updateState } from './state.js';
import { generatePdf } from './api.js';
import { showStatus, showMainUI, showSetupUI, showSettings } from './ui.js';
import { checkCurrentProviderKey } from './utils.js';

// Local helper to invalidate PDF cache (drag and drop removed)
function invalidatePdfCache() {
    updateState({ latestPdfBlob: null });
}

export const DEFAULT_FORMAT = {
    font: "times",
    density: "normal",
    margins: "normal",
    nameSize: 21,
    bodySize: 10,
    headerSize: 12,
    subheaderSize: 11,
    headerStyle: "uppercase_line",
    bulletChar: "•",
    showLinks: true,
    dateAlign: "right",
    pageSize: "letter"
};

let formatSaveTimer = null;
export function debouncedSaveFormat(settings) {
    // Update state immediately so subsequent slider moves see newest values
    updateState({ formatSettings: settings });
    clearTimeout(formatSaveTimer);
    formatSaveTimer = setTimeout(() => saveFormatSettings(settings), 300);
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
    invalidatePdfCache();
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
            if (!state.tailoredResume && !state.baseResume) {
                showStatus("No resume to preview", "error");
                return;
            }
            const resume = state.tailoredResume || state.baseResume;
            // Show loading
            previewFormatBtn.textContent = "Generating...";
            try {
                const result = await generatePdf(resume);
                if (result instanceof Blob) {
                    const url = URL.createObjectURL(result);
                    chrome.tabs.create({ url });
                    setTimeout(() => URL.revokeObjectURL(url), 120000);
                }
            } catch (e) {
                showStatus(e.message, "error");
            } finally {
                previewFormatBtn.textContent = "👁 Preview";
            }
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
}
