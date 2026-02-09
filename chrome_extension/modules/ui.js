import { state } from './state.js';
import { checkCurrentProviderKey } from './utils.js';

// Elements helper - lazily get elements or pass them in?
// Let's assume we can get them by ID since they are static.
const getEl = (id) => document.getElementById(id);

export function showStatus(message, type = 'info', elementId = 'status') {
    if (elementId === 'status') {
        const container = getEl('toastContainer');
        if (!container) return;

        // Skip empty messages
        if (!message) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icon = {
            'success': '✅',
            'error': '❌',
            'info': 'ℹ️',
            'warning': '⚠️'
        }[type] || 'ℹ️';

        toast.innerHTML = `<span style="flex-shrink:0;">${icon}</span> <span style="line-height:1.4;">${message}</span>`;
        container.appendChild(toast);

        const duration = type === 'error' ? 5000 : 3000;

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
        }, duration);
        return;
    }

    const statusEl = getEl(elementId);
    if (!statusEl) return;

    if (!message) {
        statusEl.innerHTML = '';
        statusEl.style.display = 'none';
        return;
    }

    statusEl.innerHTML = message;
    statusEl.className = type;
    statusEl.style.display = 'block';
}

export function toggleProviderUI(provider) {
    const geminiEl = getEl('geminiKeyData');
    const groqEl = getEl('groqKeyData');
    const openrouterEl = getEl('openrouterKeyData');

    if (provider === 'gemini') {
        if (geminiEl) geminiEl.style.display = 'block';
        if (groqEl) groqEl.style.display = 'none';
        if (openrouterEl) openrouterEl.style.display = 'none';
    } else if (provider === 'groq') {
        if (geminiEl) geminiEl.style.display = 'none';
        if (groqEl) groqEl.style.display = 'block';
        if (openrouterEl) openrouterEl.style.display = 'none';
    } else if (provider === 'openrouter') {
        if (geminiEl) geminiEl.style.display = 'none';
        if (groqEl) groqEl.style.display = 'none';
        if (openrouterEl) openrouterEl.style.display = 'block';
    }
}

export function showMainUI() {
    getEl('setupUI').style.display = 'none';
    getEl('settingsUI').style.display = 'none';
    getEl('profileUI').style.display = 'none';
    getEl('mainUI').style.display = 'block';

    if (getEl('editorUI')) getEl('editorUI').style.display = 'none';
    if (getEl('copyUI')) getEl('copyUI').style.display = 'none';
    if (getEl('formatUI')) getEl('formatUI').style.display = 'none';
    if (getEl('historyUI')) getEl('historyUI').style.display = 'none';

    if (state.tailoredResume) {
        getEl('actions').style.display = 'block';
    } else {
        getEl('actions').style.display = 'none';
        if (getEl('analysisResults')) getEl('analysisResults').classList.add('hidden');
        if (getEl('atsScoreBadge')) getEl('atsScoreBadge').style.display = 'none';
    }

    renderQuickStatus();
    updateUsageDisplay(); // Ensure usage limits are reflected
}

export function showSetupUI() {
    getEl('setupUI').style.display = 'block';
    getEl('settingsUI').style.display = 'none';
    getEl('mainUI').style.display = 'none';
    getEl('profileUI').style.display = 'none';

    // Only show back button if user has a resume to go back to
    const backBtn = getEl('backFromSetup');
    if (backBtn) {
        backBtn.style.display = state.baseResume ? 'inline-block' : 'none';
    }
}

export function showSettings() {
    getEl('settingsUI').style.display = 'block';
    getEl('setupUI').style.display = 'none';
    getEl('mainUI').style.display = 'none';
    getEl('profileUI').style.display = 'none';

    // Refresh auth UI when showing settings
    renderAuthSection();
    renderQuickStatus();
}

/**
 * Render small status line below header
 */
export function renderQuickStatus() {
    const el = getEl('quickStatus');
    if (!el) return;

    if (state.authMode === 'free') {
        const { used, limit, remaining } = state.freeUsage;
        el.innerHTML = `⚡ Free Tier · ${remaining}/${limit} left`;
        el.style.color = remaining === 0 ? 'var(--error)' : remaining <= 3 ? 'var(--warning)' : 'var(--text-secondary)';
    } else {
        const providerName = state.currentProvider.charAt(0).toUpperCase() + state.currentProvider.slice(1);
        el.innerHTML = `🔑 ${providerName} Mode (BYOK)`;
        el.style.color = 'var(--text-secondary)';
    }

    // Clicking quick status opens settings
    el.onclick = () => showSettings();
}

/**
 * Render the authentication section in Settings
 */
export function renderAuthSection() {
    const container = getEl('authSection');
    if (!container) return;

    const hasKeys = !!(state.currentApiKey || state.currentGroqKey || state.currentOpenRouterKey);

    if (state.isLoggedIn && state.user) {
        container.innerHTML = `
            <div class="user-profile">
                <img src="${state.user.user_metadata?.avatar_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'}" class="user-avatar" alt="User">
                <div class="user-details">
                    <div class="user-email">${state.user.email}</div>
                    <button id="logoutBtn" class="logout-link">Sign out</button>
                </div>
            </div>
        `;

        // Hide login prompt
        const loginPrompt = getEl('freeLoginPrompt');
        if (loginPrompt) loginPrompt.classList.add('hidden');
    } else if (!hasKeys) {
        // Welcoming "Two Paths" for new users
        container.innerHTML = `
            <div style="text-align: center; background: var(--primary-gradient); color: white; padding: 20px; border-radius: var(--radius-lg); margin-bottom: 12px; box-shadow: var(--shadow-md);">
                <h3 style="margin: 0; color: white;">Welcome to ForgeCV!</h3>
                <p style="font-size: 11px; opacity: 0.9; margin: 8px 0;">Choose how you'd like to power your AI features:</p>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px;">
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);">
                        <div style="font-size: 14px;">⚡</div>
                        <div style="font-weight: bold; font-size: 11px;">Path A</div>
                        <div style="font-size: 10px; opacity: 0.8;">Free tier (15/day)</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);">
                        <div style="font-size: 14px;">🔑</div>
                        <div style="font-weight: bold; font-size: 11px;">Path B</div>
                        <div style="font-size: 10px; opacity: 0.8;">Unlimited (BYOK)</div>
                    </div>
                </div>
            </div>
        `;

        // Show login prompt if in free mode
        const loginPrompt = getEl('freeLoginPrompt');
        if (loginPrompt && state.authMode === 'free') {
            loginPrompt.classList.remove('hidden');
            loginPrompt.style.textAlign = 'center';
            loginPrompt.innerHTML = `
                <p class="text-sm" style="font-weight: bold; margin-bottom: 8px;">Path A: Quick Start (Free)</p>
                <button id="googleLoginBtn" class="google-btn">
                    <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" alt="G">
                    Sign in with Google
                </button>
                <p class="text-xs text-muted" style="margin-top: 8px;">Get 15 free AI resumes/day instantly</p>
            `;
        }
    } else {
        // Standard signed out state with keys already present
        container.innerHTML = `
            <div style="text-align: center; padding: 10px;">
                <p class="text-sm" style="margin-bottom: 4px; font-weight: 600;">Standard Tier</p>
                <p class="text-xs text-muted">Using your own API keys. Sign in to use our Free Tier instead.</p>
            </div>
        `;

        const loginPrompt = getEl('freeLoginPrompt');
        if (loginPrompt && state.authMode === 'free') {
            loginPrompt.classList.remove('hidden');
        }
    }

    // Refresh usage if in free mode
    if (state.authMode === 'free') {
        updateUsageDisplay();
    }
}

/**
 * Update the usage bar and text
 */
export function updateUsageDisplay() {
    const container = getEl('freeUsageDisplay');
    const banner = getEl('usageLimitBanner');
    if (!container) return;

    if (!state.isLoggedIn || state.authMode !== 'free') {
        container.innerHTML = '';
        if (banner) banner.classList.add('hidden');
        enableAiButtons(true);
        return;
    }

    const { used, limit, remaining } = state.freeUsage;
    const progress = Math.min((used / limit) * 100, 100);

    // Color coding
    let barColor = 'var(--primary-gradient)';
    if (remaining === 0) barColor = 'var(--error)';
    else if (remaining <= 3) barColor = 'orange';

    container.innerHTML = `
        <div class="usage-container">
            <div class="usage-header">
                <span>Daily Usage</span>
                <span style="color: ${remaining === 0 ? 'var(--error)' : 'inherit'}; font-weight: bold;">${used} / ${limit}</span>
            </div>
            <div class="usage-bar-bg">
                <div class="usage-fill" style="width: ${progress}%; background: ${barColor}"></div>
            </div>
            <p class="text-xs text-muted" style="margin-top: 6px; text-align: center;">
                ${remaining} actions left today · Resets at midnight UTC
            </p>
        </div>
    `;

    // Handle Limit Banner & Button State
    if (remaining === 0) {
        if (banner) {
            banner.innerHTML = `<div class="usage-banner">
                You've used all 15 free actions today! 🔄 Resets at midnight UTC.<br>
                <a href="#" id="bannerSwitchMode">Switch to Your Own Key →</a>
            </div>`;
            banner.classList.remove('hidden');
            getEl('bannerSwitchMode').onclick = (e) => {
                e.preventDefault();
                showSettings();
            };
        }
        enableAiButtons(false);
    } else {
        if (banner) banner.classList.add('hidden');
        enableAiButtons(true);
    }

    renderQuickStatus();
}

function enableAiButtons(enabled) {
    const aiButtons = ['generateBtn', 'analyzeBtn', 'askBtn', 'saveRegenBtn'];
    aiButtons.forEach(id => {
        const btn = getEl(id);
        if (btn) {
            btn.disabled = !enabled;
            btn.title = enabled ? '' : "Daily free limit reached. Switch to your own API key in Settings.";
            if (!enabled) btn.style.opacity = '0.7';
            else btn.style.opacity = '1';
        }
    });
}

export function showProfileUI() {
    getEl('profileUI').style.display = 'block';
    getEl('settingsUI').style.display = 'none';
    getEl('mainUI').style.display = 'none';
    getEl('setupUI').style.display = 'none';
}

export function refreshProfileName() {
    const profileNameDisplay = getEl('profileName');
    if (profileNameDisplay && state.baseResume) {
        profileNameDisplay.textContent = state.baseResume.name || "User";
    }
}

export function renderAnalysis(analysis) {
    const analysisResults = getEl('analysisResults');
    const atsScoreDisplay = getEl('atsScore');
    const analysisDetails = getEl('analysisDetails');

    if (!analysis || !analysisResults) return;

    // Remove hidden class and clear any inline display override
    analysisResults.classList.remove('hidden');
    analysisResults.style.display = '';

    const score = parseInt(analysis.score) || 0;

    // Persistent Badge next to Profile Name
    const badge = getEl('atsScoreBadge');
    if (badge) {
        badge.textContent = `ATS: ${score}%`;
        badge.style.display = 'inline-block';
        // Match color based on score
        if (score >= 80) badge.style.background = 'var(--success)';
        else if (score >= 60) badge.style.background = 'var(--warning)';
        else badge.style.background = 'var(--error)';
    }

    // Score
    if (atsScoreDisplay) {
        atsScoreDisplay.textContent = analysis.score || "N/A";
        // Color code
        atsScoreDisplay.style.color = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--error)';
    }

    // Details - simplified rendering
    if (analysisDetails) {
        let html = '';
        if (analysis.matching_areas && analysis.matching_areas.length) {
            html += `<div style="margin-bottom: 10px;">
                <strong>✅ Strong Matches:</strong>
                <ul style="margin: 5px 0; padding-left: 20px;">`;
            analysis.matching_areas.forEach(area => html += `<li style="color: #28a745;">${area}</li>`);
            html += `</ul></div>`;
        }

        if (analysis.missing_keywords && analysis.missing_keywords.length) {
            html += `<div style="margin-bottom: 10px;">
                <strong>⚠️ Missing Keywords:</strong> 
                <span style="color: #d63384;">${analysis.missing_keywords.join(', ')}</span>
            </div>`;
        }

        if (analysis.weak_keywords && analysis.weak_keywords.length) {
            html += `<div style="margin-bottom: 10px;">
                <strong>⚡ Weak Matches (in skills only, needs context):</strong>
                <span style="color: #d97706;">${analysis.weak_keywords.join(', ')}</span>
            </div>`;
        }

        if (analysis.recommendations && analysis.recommendations.length) {
            html += `<div style="margin-bottom: 8px;">
                <strong>💡 Recommendations:</strong>
                <ul style="margin: 5px 0; padding-left: 20px;">`;
            analysis.recommendations.forEach(rec => html += `<li>${rec}</li>`);
            html += `</ul></div>`;
        }

        // After score display, add a verdict
        let verdict = '';
        if (score >= 90) verdict = '🏆 Excellent! Basically a cheat code for this job.';
        else if (score >= 80) verdict = '💪 Strong match. You\'re in the top tier for this role.';
        else if (score >= 70) verdict = '👍 Good foundation. A few tweaks and you\'re golden.';
        else if (score >= 60) verdict = '⚡ Decent start. Edit some bullets to boost keywords.';
        else verdict = '🔧 Needs work. Try JD Focus mode and regenerate.';

        // Add verdict to the UI
        html += `<div style="font-size:12px; font-weight:600; margin-bottom:10px; padding:8px; background:#f9fafb; border-radius:6px;">${verdict}</div>`;

        // Summary Feedback
        if (analysis.summary_feedback) {
            html += `<div style="margin-bottom: 12px; padding: 8px; background: #f8f9fa; border-left: 3px solid #4A00E0; border-radius: 4px;">
                <strong>📋 Summary:</strong> ${analysis.summary_feedback}
            </div>`;
        }

        analysisDetails.innerHTML = html;

        // Auto-scroll
        setTimeout(() => {
            analysisResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
}

export function renderCopyList(data) {
    const copyList = document.getElementById('copyList');
    if (!copyList) return;

    copyList.innerHTML = "";
    if (!data) return;

    // Use dynamic section order or fallback to default
    const sections = data.section_order || [
        "summary", "education", "experience", "projects", "leadership",
        "research", "certifications", "awards", "volunteering", "languages", "skills"
    ];

    // Titles mapping
    const defaultTitles = {
        summary: "Summary",
        education: "Education",
        experience: "Work Experience",
        projects: "Research and Projects",
        leadership: "Leadership Experience",
        research: "Research & Publications",
        certifications: "Certifications",
        awards: "Awards & Honors",
        volunteering: "Volunteering",
        languages: "Languages",
        skills: "Technical Knowledge"
    };
    const activeTitles = data.section_titles || {};

    sections.forEach(section => {
        if (!data[section] || (Array.isArray(data[section]) && data[section].length === 0)) return;
        if (section === 'skills' && (!data.skills || Object.keys(data.skills).length === 0)) return;

        // Section Header
        const header = document.createElement('h4');
        header.style.cssText = "margin: 10px 0 5px 0; color: #555; text-transform: uppercase; font-size: 11px; border-bottom: 1px solid #eee; padding-bottom: 2px;";
        header.textContent = activeTitles[section] || defaultTitles[section] || section;
        copyList.appendChild(header);

        // Handle Summary
        if (section === 'summary') {
            const div = createCopyItemDiv("Professional Summary", "", "summary", 0);
            div.querySelector('.copy-content-preview').innerText = data.summary;
            copyList.appendChild(div);
            return;
        }

        // Handle Languages (String or Array)
        if (section === 'languages') {
            const langText = Array.isArray(data.languages) ? data.languages.join(', ') : data.languages;
            const div = createCopyItemDiv("Languages", "", "languages", 0);
            div.querySelector('.copy-content-preview').innerText = langText;
            copyList.appendChild(div);
            return;
        }

        // Handle Skills (Dict or List)
        if (section === 'skills') {
            const div = createCopyItemDiv("All Skills", "Formatted List", "skills", 0);
            let skillText = "";
            if (Array.isArray(data.skills)) {
                skillText = data.skills.join(', ');
            } else {
                skillText = Object.entries(data.skills).map(([cat, val]) => `${cat}: ${val}`).join('\n');
            }
            div.querySelector('.copy-content-preview').innerText = skillText;
            copyList.appendChild(div);
            return;
        }

        // Handle List Sections
        data[section].forEach((item, index) => {
            let title = item.name || item.institution || item.company || item.organization || item.title || "Item";
            let subtitle = item.role || item.degree || item.conference || item.issuer || "";

            const div = createCopyItemDiv(title, subtitle, section, index);

            // Preview text (bullets or dates)
            let preview = "";
            if (item.bullets && item.bullets.length > 0) preview = item.bullets.join(' ');
            else if (item.dates) preview = item.dates;

            div.querySelector('.copy-content-preview').innerText = preview;
            copyList.appendChild(div);
        });
    });

    // Helper to create the item UI
    function createCopyItemDiv(title, subtitle, type, index) {
        const div = document.createElement('div');
        div.style.cssText = "background: #fff; border: 1px solid #eee; border-radius: 4px; padding: 8px; margin-bottom: 8px;";
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 5px;">
                <div>
                    <div style="font-weight: bold; font-size: 12px;">${title}</div>
                    <div style="font-size: 11px; color: #666;">${subtitle}</div>
                </div>
                <button class="copy-btn" data-type="${type}" data-index="${index}" 
                    style="width: auto; padding: 4px 8px; font-size: 11px; background: #e9ecef; color: #333; border: 1px solid #ccc; cursor: pointer;">
                    📋 Copy
                </button>
            </div>
            <div class="copy-content-preview" style="font-size: 10px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
        `;
        return div;
    }

    // Add Event Listeners
    const btns = copyList.querySelectorAll('.copy-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            const index = parseInt(btn.dataset.index);
            let textToCopy = "";

            if (type === 'summary') textToCopy = data.summary;
            else if (type === 'languages') textToCopy = Array.isArray(data.languages) ? data.languages.join(', ') : data.languages;
            else if (type === 'skills') {
                if (Array.isArray(data.skills)) textToCopy = data.skills.join(', ');
                else textToCopy = Object.entries(data.skills).map(([cat, val]) => `${cat}: ${val}`).join('\n');
            }
            else {
                // List Item
                const item = data[type][index];

                // Smart Copy Format based on Section
                const parts = [];

                // Header Line
                const title = item.name || item.institution || item.company || item.organization || item.title;
                const sub = item.role || item.degree || item.conference || item.issuer;
                const date = item.dates;
                const loc = item.location;
                const gpa = item.gpa;

                let headerLine = "";
                if (title) headerLine += title;
                if (sub) headerLine += ` - ${sub}`;
                if (loc) headerLine += ` (${loc})`;
                if (date) headerLine += ` | ${date}`;
                if (headerLine) parts.push(headerLine);

                if (gpa) parts.push(`GPA: ${gpa}`);

                if (item.bullets && item.bullets.length > 0) {
                    item.bullets.forEach(b => parts.push(`• ${b}`));
                }

                textToCopy = parts.join('\n');
            }

            if (textToCopy) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const originalText = btn.innerHTML;
                    btn.innerHTML = "✅ Copied!";
                    btn.style.background = "#d4edda";
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.style.background = "#e9ecef";
                    }, 1500);
                });
            }
        });
    });
}
