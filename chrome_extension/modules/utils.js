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
