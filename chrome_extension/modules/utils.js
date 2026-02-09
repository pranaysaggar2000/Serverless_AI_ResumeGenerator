import { state } from './state.js';

export function checkCurrentProviderKey() {
    if (state.currentProvider === 'gemini') return !!state.currentApiKey;
    if (state.currentProvider === 'groq') return !!state.currentGroqKey;
    if (state.currentProvider === 'openrouter') return !!state.currentOpenRouterKey;
    return false;
}

export function getApiKeyForProvider() {
    if (state.currentProvider === 'gemini') return state.currentApiKey;
    if (state.currentProvider === 'groq') return state.currentGroqKey;
    if (state.currentProvider === 'openrouter') return state.currentOpenRouterKey;
    return '';
}

export function updateStrategyDescription(value, element) {
    const descriptions = [
        '🛡 Keep It Real - Preserves your original content, minimal keyword forcing',
        '⚖️ Sweet Spot - Integrates JD keywords while keeping it authentic',
        '🎯 ATS Destroyer - Aggressive keyword matching for maximum match score'
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

export function generateDiffSummary(original, tailored) {
    if (!original || !tailored) return null;

    let bulletsChanged = 0;
    let totalBullets = 0;
    const listSections = ["experience", "projects", "leadership", "research", "volunteering"];

    listSections.forEach(sec => {
        const origItems = original[sec] || [];
        const tailItems = tailored[sec] || [];
        const maxLen = Math.max(origItems.length, tailItems.length);

        for (let i = 0; i < maxLen; i++) {
            const origBullets = origItems[i]?.bullets || [];
            const tailBullets = tailItems[i]?.bullets || [];
            totalBullets += Math.max(origBullets.length, tailBullets.length);

            const maxB = Math.max(origBullets.length, tailBullets.length);
            for (let j = 0; j < maxB; j++) {
                if ((origBullets[j] || '').trim() !== (tailBullets[j] || '').trim()) {
                    bulletsChanged++;
                }
            }
        }
    });

    const summaryChanged = (original.summary || '').trim() !== (tailored.summary || '').trim();

    const origSkills = original.skills || {};
    const tailSkills = tailored.skills || {};
    const origSkillSet = new Set(Object.values(origSkills).flat().map(s => s.toLowerCase().trim()));
    const tailSkillSet = new Set(Object.values(tailSkills).flat().map(s => s.toLowerCase().trim()));
    const skillsAdded = [...tailSkillSet].filter(s => !origSkillSet.has(s)).length;
    const skillsRemoved = [...origSkillSet].filter(s => !tailSkillSet.has(s)).length;

    return {
        bulletsChanged,
        totalBullets,
        summaryChanged,
        skillsAdded,
        skillsRemoved
    };
}
