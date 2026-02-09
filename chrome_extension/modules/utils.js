import { state, DEBUG } from './state.js';

export function debugLog(...args) {
    if (DEBUG) console.log(...args);
}

export function checkCurrentProviderKey() {
    // If using free tier and logged in, no key needed
    if (state.authMode === 'free' && state.isLoggedIn) return true;

    // Original BYOK logic
    if (state.currentProvider === 'gemini') return !!state.currentApiKey;
    if (state.currentProvider === 'groq') return !!state.currentGroqKey;
    if (state.currentProvider === 'openrouter') return !!state.currentOpenRouterKey;
    return false;
}

export function getApiKeyForProvider() {
    // If using free tier, return empty string (not used)
    if (state.authMode === 'free' && state.isLoggedIn) return '';

    // Original BYOK logic
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

/**
 * Custom styled confirmation dialog
 */
export function showConfirmDialog(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.id = 'customConfirmOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);';

        const box = document.createElement('div');
        box.style.cssText = 'background:white;border-radius:12px;padding:24px;width:80%;max-width:300px;text-align:center;box-shadow:0 12px 48px rgba(0,0,0,0.3);animation: slideIn 0.3s ease;';
        box.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 12px;">⚠️</div>
            <p style="margin:0 0 20px;font-size:14px;color:#374151;font-weight:500;line-height:1.5;">${message}</p>
            <div style="display:flex;gap:10px;justify-content:center;">
                <button id="confirmNo" style="flex:1;padding:10px;background:#f3f4f6;color:#4b5563;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;">Cancel</button>
                <button id="confirmYes" style="flex:1;padding:10px;background:#ef4444;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;">Confirm</button>
            </div>
        `;
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // Style overrides for Confirm button if it's not a destructive action (optional)
        if (!message.toLowerCase().includes('delete') && !message.toLowerCase().includes('remove')) {
            const yesBtn = box.querySelector('#confirmYes');
            yesBtn.style.background = '#6366f1';
        }

        const cleanup = (val) => {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.2s ease';
            setTimeout(() => {
                if (document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                }
            }, 200);
            resolve(val);
        };

        box.querySelector('#confirmYes').onclick = () => cleanup(true);
        box.querySelector('#confirmNo').onclick = () => cleanup(false);
        overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
    });
}
