import { state } from './state.js';

export function checkCurrentProviderKey() {
    if (state.currentProvider === 'gemini') return !!state.currentApiKey;
    if (state.currentProvider === 'groq') return !!state.currentGroqKey;
    return false;
}

export function updateStrategyDescription(value, element) {
    const descriptions = [
        '📝 Profile Focus - Preserves original content, minimal keyword forcing',
        '⚖️ Balanced - Integrates JD keywords while maintaining authenticity',
        '🎯 JD Focus - Aggressive keyword matching for maximum ATS score'
    ];
    if (element) {
        element.textContent = descriptions[value];
    }
}

export function formatSectionName(str) {
    // Basic capitalization
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function hasData(data, section) {
    if (!data[section]) return false;

    const val = data[section];

    if (Array.isArray(val)) {
        return val.length > 0;
    } else if (typeof val === 'object') {
        // For skills (dict) or contact
        return Object.keys(val).length > 0;
    } else if (typeof val === 'string') {
        return val.trim().length > 0;
    }
    return false;
}
export function generateFilename(resumeData) {
    let name = "Resume";
    if (resumeData && resumeData.name) {
        name = resumeData.name.trim().replace(/\s+/g, '_');
    }
    return `${name}_Resume.pdf`;
}

export function setButtonLoading(btn, loading, originalText = null) {
    if (!btn) return;
    if (loading) {
        if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="display:inline-block; vertical-align:middle; width:14px;height:14px;border-width:2px;"></span> Working...';
    } else {
        btn.disabled = false;
        btn.textContent = originalText || btn.dataset.originalText || 'Done';
    }
}
