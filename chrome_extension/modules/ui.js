import { state } from './state.js';
import { checkCurrentProviderKey } from './utils.js';

// Elements helper - lazily get elements or pass them in?
// Let's assume we can get them by ID since they are static.
const getEl = (id) => document.getElementById(id);

export function showStatus(message, type = 'info', elementId = 'status') {
    const statusEl = getEl(elementId);
    if (!statusEl) return;

    if (!message) {
        statusEl.innerHTML = '';
        statusEl.style.display = 'none';
        return;
    }

    statusEl.innerHTML = message;
    statusEl.className = type;
    statusEl.style.color = type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#666';
    statusEl.style.display = 'block';

    // Auto-clear success/info after delay? Original code didn't always do this, 
    // but some parts did. Let's keep it simple for now and match original behavior mostly.
}

export function toggleProviderUI(provider) {
    if (provider === 'gemini') {
        getEl('geminiKeyData').style.display = 'block';
        getEl('groqKeyData').style.display = 'none';
    } else {
        getEl('geminiKeyData').style.display = 'none';
        getEl('groqKeyData').style.display = 'block';
    }
}

export function showMainUI() {
    getEl('setupUI').style.display = 'none';
    getEl('settingsUI').style.display = 'none';
    getEl('profileUI').style.display = 'none';
    getEl('mainUI').style.display = 'block';

    // Ensure editor is hidden if it exists
    if (getEl('editorUI')) getEl('editorUI').style.display = 'none';

    // Show actions if resume exists
    if (state.tailoredResume) {
        getEl('actions').style.display = 'block';
    } else {
        getEl('actions').style.display = 'none';
        // Also ensure analysis results are hidden if not explicitly shown/rendered later
        if (getEl('analysisResults')) getEl('analysisResults').classList.add('hidden');
    }
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

    analysisResults.style.display = 'block';

    // Score
    if (atsScoreDisplay) {
        atsScoreDisplay.textContent = analysis.score || "N/A";
        // Color code
        const score = parseInt(analysis.score) || 0;
        atsScoreDisplay.style.color = score >= 80 ? '#28a745' : score >= 60 ? '#ffc107' : '#dc3545';
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

        if (analysis.recommendations && analysis.recommendations.length) {
            html += `<div style="margin-bottom: 8px;">
                <strong>💡 Recommendations:</strong>
                <ul style="margin: 5px 0; padding-left: 20px;">`;
            analysis.recommendations.forEach(rec => html += `<li>${rec}</li>`);
            html += `</ul></div>`;
        }

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
