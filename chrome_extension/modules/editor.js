import { state, updateState } from './state.js';
import { showStatus, showMainUI, refreshProfileName } from './ui.js';
import { showConfirmDialog, debugLog } from './utils.js';
import * as Prompts from './ai_prompts.js';
import { renderLiveAtsBadge } from './ats_live.js';

let currentEditingResume = null;
let currentEditingResumeSource = null; // Track which state object we cloned from
let inputTimeout = null;

function getExcludedItemsForSection(section) {
    if (!state.excludedItems || !state.excludedItems[section]) return [];
    if (!state.baseResume || !state.baseResume[section]) return [];

    const baseItems = state.baseResume[section];
    const tailoredItems = state.tailoredResume?.[section] || [];

    // Find items in baseResume that are NOT in tailoredResume (by content matching)
    // This is more robust than numeric indices which can shift during regeneration
    return baseItems
        .map((item, idx) => ({ index: idx, item }))
        .filter(({ item }) => {
            // Check if this base item exists in the current tailored resume
            const identifier = (item.company || item.name || item.organization || item.title || '').toLowerCase();
            const role = (item.role || item.tech || item.conference || '').toLowerCase();

            return !tailoredItems.some(t => {
                const tId = (t.company || t.name || t.organization || t.title || '').toLowerCase();
                const tRole = (t.role || t.tech || t.conference || '').toLowerCase();
                return tId === identifier && tRole === role;
            });
        });
}

function getMustIncludeItems() {
    return state.mustIncludeItems || {};
}

function checkKeywordLoss(text) {
    if (!state.currentJdAnalysis || !text) return;

    const allKeywords = [
        ...(state.currentJdAnalysis.mandatory_keywords || []),
        ...(state.currentJdAnalysis.preferred_keywords || [])
    ].map(k => k.toLowerCase());

    const lowerText = text.toLowerCase();
    const lostKeywords = allKeywords.filter(k => {
        const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        return regex.test(lowerText);
    });

    if (lostKeywords.length > 0) {
        showStatus(
            `⚠️ Removing this may reduce ATS score — contains keywords: ${lostKeywords.slice(0, 3).join(', ')}${lostKeywords.length > 3 ? '...' : ''}`,
            'warning'
        );
    }
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function resetEditorState() {
    currentEditingResume = null;
    currentEditingResumeSource = null;
}

export function getCurrentEditingResume() {
    return currentEditingResume;
}

function escapeHtml(unsafe) {
    return (unsafe || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function renderHighlightedPreview(text, container) {
    if (!container) return;
    if (!state.jdKeywords || state.jdKeywords.length === 0) {
        container.style.display = 'none';
        return;
    }

    // Only show if text exists
    if (!text || !text.trim()) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    container.style.display = 'block';
    let html = escapeHtml(text);

    // Sort keywords by length desc to avoid partial matches inside longer words messing up? 
    // Actually regex word boundary \b handles most, but overlapping keywords might be tricky.
    // Simple iteration is usually fine for display.
    state.jdKeywords.forEach(keyword => {
        if (!keyword) return;
        // Escape regex special chars
        const esc = escapeRegex(keyword);
        // Case insensitive, global
        const regex = new RegExp(`\\b(${esc})\\b`, 'gi');
        html = html.replace(regex, '<mark style="background: #d1fae5; padding: 0 2px; border-radius: 2px; color: #065f46;">$1</mark>');
    });

    container.innerHTML = html;
}

function updateKeywordCoverage(containerId) {
    const list = document.getElementById('missingKeywordsList');
    const countSpan = document.getElementById('coveredCount');
    const totalSpan = document.getElementById('totalKeywords');

    if (!list || !state.jdKeywords || state.jdKeywords.length === 0) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    // Collect all text from inputs/textareas in the editor
    let content = "";
    container.querySelectorAll('input, textarea').forEach(el => content += " " + el.value);
    content = content.toLowerCase();

    const covered = state.jdKeywords.filter(k => {
        const regex = new RegExp(`\\b${escapeRegex(k)}\\b`, 'i');
        return regex.test(content);
    });

    const missing = state.jdKeywords.filter(k => !covered.includes(k));

    if (countSpan) countSpan.textContent = covered.length;
    if (totalSpan) totalSpan.textContent = state.jdKeywords.length;

    // Show top 5 missing
    if (list) {
        list.textContent = missing.length > 0 ? " Missing: " + missing.slice(0, 5).join(', ') + (missing.length > 5 ? '...' : '') : " All keywords covered in this section!";
        list.style.color = missing.length > 0 ? '#ef4444' : '#10b981';
    }
}


// Helper to find data across possible key variations
function getSectionData(data, section) {
    if (!data) return null;

    // 1. Direct match
    if (data[section]) return data[section];

    // 2. Case-insensitive match (e.g. "Summary" vs "summary")
    const lowerSection = section.toLowerCase();
    const keys = Object.keys(data);
    const caseMatch = keys.find(k => k.toLowerCase() === lowerSection);
    if (caseMatch) return data[caseMatch];

    // 3. Common variations map
    const map = {
        'contact': ['contact_info', 'personal_info', 'personal'],
        'summary': ['professional_summary', 'profile_summary', 'objective', 'profile'],
        'experience': ['work_experience', 'employment_history', 'work', 'employment'],
        'education': ['education_history', 'academics', 'academic_background'],
        'skills': ['technical_skills', 'core_skills', 'skills_and_competencies'],
        'projects': ['academic_projects', 'personal_projects', 'key_projects'],
        'leadership': ['leadership_experience', 'activities'],
        'certifications': ['certs', 'certificates'],
        'awards': ['honors', 'achievements', 'honors_and_awards'],
        'volunteering': ['volunteer_experience', 'community_service'],
        'languages': ['language_skills'],
        'research': ['publications', 'research_experience']
    };

    const mappedKeys = map[lowerSection];
    if (mappedKeys) {
        for (const key of mappedKeys) {
            // Check direct map key
            if (data[key]) return data[key];
            // Check case-insensitive map key
            const keyMatch = keys.find(k => k.toLowerCase() === key.toLowerCase());
            if (keyMatch) return data[keyMatch];
        }
    }
    return null;
}

export function renderProfileEditor(section, resumeToEdit = null, containerId = 'profileFormContainer') {
    if (resumeToEdit) {
        // Deep clone ONLY if we're starting a new edit session or switching resumes
        // To avoid re-cloning on every section switch which would lose unsaved edits from previous tabs
        if (currentEditingResume === null || resumeToEdit !== currentEditingResumeSource) {
            currentEditingResume = JSON.parse(JSON.stringify(resumeToEdit));
            currentEditingResumeSource = resumeToEdit; // Track source to prevent re-cloning
        }
    } else if (!currentEditingResume) {
        // Fallback clone
        const source = state.tailoredResume || state.baseResume;
        currentEditingResume = source ? JSON.parse(JSON.stringify(source)) : null;
        currentEditingResumeSource = source;
    }

    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`renderProfileEditor: Container '${containerId}' not found.`);
        return;
    }

    // Store containerId on the container for save operations to find later if needed
    container.dataset.editorMode = containerId;

    if (!currentEditingResume) {
        console.warn("renderProfileEditor: No currentEditingResume found.");
        container.innerHTML = '<p style="font-size: 11px; color: #999;">No profile data loaded.</p>';
        return;
    }

    debugLog(`renderProfileEditor: Rendering '${section}'`);
    debugLog("Current Editing Resume keys:", Object.keys(currentEditingResume));

    let html = '';
    const data = currentEditingResume;
    let sectionData = getSectionData(data, section);
    debugLog("Found Section Data:", sectionData);

    container.innerHTML = ''; // Clear existing

    // 0. Keyword Coverage
    if (state.jdKeywords && state.jdKeywords.length > 0) {
        const statsDiv = document.createElement('div');
        statsDiv.id = 'keywordCoverage';
        statsDiv.style.cssText = "font-size: 11px; margin-bottom: 15px; padding: 8px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; color: #374151;";
        statsDiv.innerHTML = `
            <div style="font-weight:600; margin-bottom:4px;">🎯 JD Keyword Match</div>
            <div>
                Covered: <span id="coveredCount" style="font-weight:bold;">0</span>/<span id="totalKeywords">${state.jdKeywords.length}</span>
            </div>
            <div id="missingKeywordsList" style="font-size: 10px; margin-top:4px;"></div>
        `;
        container.appendChild(statsDiv);

        // Initial Update
        setTimeout(() => updateKeywordCoverage(containerId), 100);
    }

    // 1. Custom Section Title Input (except for Contact)
    if (section !== 'contact') {
        const titleDiv = document.createElement('div');
        titleDiv.className = 'edit-field';
        titleDiv.style.marginBottom = "15px";
        titleDiv.style.paddingBottom = "10px";
        titleDiv.style.borderBottom = "1px solid #eee";

        const currentTitle = (data.section_titles && data.section_titles[section]) || formatDefaultSectionTitle(section);

        titleDiv.innerHTML = `<label>Section Title (vs "${formatDefaultSectionTitle(section)}")</label>
                              <input type="text" id="sectionTitleInput" value="${currentTitle}" placeholder="${formatDefaultSectionTitle(section)}">`;
        container.appendChild(titleDiv);
    }

    // 2. Render Section Content
    if (section === 'contact') {
        const contact = sectionData || {};

        const nameDiv = document.createElement('div');
        nameDiv.className = 'edit-field';
        nameDiv.innerHTML = `<label>Full Name</label>
                              <input type="text" id="edit_name_field" value="${data.name || ''}" placeholder="Your Name">`;
        container.appendChild(nameDiv);

        const fields = [
            { key: 'location', label: 'Location' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
            { key: 'linkedin_url', label: 'LinkedIn URL' },
            { key: 'portfolio_url', label: 'Portfolio URL' }
        ];

        fields.forEach(f => {
            let val = contact[f.key] || contact[f.label.toLowerCase()] || "";
            const div = document.createElement('div');
            div.className = 'edit-field';
            div.innerHTML = `<label>${f.label}</label>
                              <input type="text" data-key="${f.key}" class="contact-input" value="${val}" placeholder="${f.label}">`;
            container.appendChild(div);
        });

    } else if (section === 'summary') {
        let summaryText = "";
        if (typeof sectionData === 'string') summaryText = sectionData;
        else if (sectionData && sectionData.text) summaryText = sectionData.text;

        const div = document.createElement('div');
        div.className = 'edit-field';
        div.innerHTML = `<label>Summary Text</label>
                         <textarea id="edit_summary_text" style="height: 100px;">${summaryText}</textarea>`;
        container.appendChild(div);

        const removeSummaryBtn = document.createElement('button');
        removeSummaryBtn.textContent = '🗑️ Remove Summary';
        removeSummaryBtn.style.cssText = "width: 100%; padding: 8px; background: #ffebee; border: 1px dashed #ffcdd2; color: #c62828; cursor: pointer; margin-top: 8px; border-radius: 6px; font-size: 11px;";
        removeSummaryBtn.onclick = async () => {
            if (await showConfirmDialog("Remove the summary section?")) {
                const textarea = document.getElementById('edit_summary_text');
                if (textarea) textarea.value = '';
            }
        };
        container.appendChild(removeSummaryBtn);

    } else if (section === 'languages') {
        let langText = "";
        if (Array.isArray(sectionData)) langText = sectionData.join(", ");
        else if (typeof sectionData === 'string') langText = sectionData;

        const div = document.createElement('div');
        div.className = 'edit-field';
        div.innerHTML = `<label>Languages (Comma separated)</label>
                         <textarea id="edit_languages_text" style="height: 60px;">${langText}</textarea>`;
        container.appendChild(div);

        const removeLangBtn = document.createElement('button');
        removeLangBtn.textContent = '🗑️ Remove Languages';
        removeLangBtn.style.cssText = "width: 100%; padding: 8px; background: #ffebee; border: 1px dashed #ffcdd2; color: #c62828; cursor: pointer; margin-top: 8px; border-radius: 6px; font-size: 11px;";
        removeLangBtn.onclick = async () => {
            if (await showConfirmDialog("Remove languages section?")) {
                const textarea = document.getElementById('edit_languages_text');
                if (textarea) textarea.value = '';
            }
        };
        container.appendChild(removeLangBtn);

    } else if (section === 'skills') {
        const skillsData = sectionData || {};
        const listDiv = document.createElement('div');
        listDiv.id = 'skillsList';

        // Check if skills is array (list) or object (categories)
        if (Array.isArray(skillsData)) {
            // Convert list to a single category "Skills"
            renderSkillBlock(listDiv, "Skills", skillsData.join(", "));
        } else {
            for (const [category, skills] of Object.entries(skillsData)) {
                let skillsStr = Array.isArray(skills) ? skills.join(", ") : String(skills);
                renderSkillBlock(listDiv, category, skillsStr);
            }
        }
        container.appendChild(listDiv);

        const addBtn = document.createElement('button');
        addBtn.textContent = "➕ Add Skill Category";
        addBtn.className = "secondary-btn";
        addBtn.style.width = "100%";
        addBtn.style.marginTop = "10px";
        addBtn.onclick = () => {
            renderSkillBlock(listDiv, "New Category", "");
        };
        container.appendChild(addBtn);

        const removeSkillsSectionBtn = document.createElement('button');
        removeSkillsSectionBtn.textContent = '🗑️ Remove Entire Skills Section';
        removeSkillsSectionBtn.style.cssText = "width: 100%; padding: 8px; background: #ffebee; border: 1px dashed #ffcdd2; color: #c62828; cursor: pointer; margin-top: 5px; border-radius: 6px; font-size: 11px;";
        removeSkillsSectionBtn.onclick = async () => {
            if (await showConfirmDialog("Remove the entire Skills section?")) {
                listDiv.innerHTML = '';
            }
        };
        container.appendChild(removeSkillsSectionBtn);

    } else if (['experience', 'projects', 'leadership', 'research', 'certifications', 'awards', 'volunteering', 'education'].includes(section)) {
        if (!Array.isArray(sectionData)) sectionData = [];

        const listDiv = document.createElement('div');
        listDiv.id = 'itemsList';

        sectionData.forEach(item => renderItemBlock(listDiv, item, section));
        container.appendChild(listDiv);

        const btnLabel = formatDefaultSectionTitle(section, true); // singular

        const addBtn = document.createElement('button');
        addBtn.textContent = `➕ Add ${btnLabel}`;
        addBtn.className = "secondary-btn";
        addBtn.style.width = "100%";
        addBtn.style.marginTop = "10px";

        addBtn.onclick = () => {
            const newItem = createEmptyItem(section);
            renderItemBlock(listDiv, newItem, section);
        };
        container.appendChild(addBtn);

        // Optional: Remove Section Button
        const removeSectionBtn = document.createElement('button');
        removeSectionBtn.textContent = `🗑️ Remove Entire ${section} Section`;
        removeSectionBtn.style.cssText = "width: 100%; padding: 8px; background: #ffebee; border: 1px dashed #ffcdd2; color: #c62828; cursor: pointer; margin-top: 5px;";
        removeSectionBtn.onclick = async () => {
            if (await showConfirmDialog(`Are you sure you want to remove the entire '${section}' section?`)) {
                listDiv.innerHTML = '';
            }
        };
        container.appendChild(removeSectionBtn);

        // Special case for Research -> Projects move
        if (section === 'research' && sectionData.length > 0) {
            const moveBtn = document.createElement('button');
            moveBtn.id = 'moveResearchToProjectsBtn'; // keeping ID for possible css reference
            moveBtn.className = "secondary-btn";
            moveBtn.style.width = "100%";
            moveBtn.style.marginTop = "5px";
            moveBtn.style.backgroundColor = "#eef";
            moveBtn.style.border = "1px solid #cce";
            moveBtn.textContent = "Move All Research to Projects Section";

            moveBtn.onclick = async () => {
                const confirmed = await showConfirmDialog("This will move all Research items to the Projects section and clear the Research section. Continue?");
                if (!confirmed) return;

                if (!data.projects) data.projects = [];
                const researchItems = await saveProfileChanges('research'); // Get current state from DOM

                researchItems.forEach(item => {
                    const newBullets = [...(item.bullets || [])];
                    if (item.conference) newBullets.unshift(`Published in: ${item.conference}`);
                    if (item.link) newBullets.push(`Link: ${item.link}`);

                    data.projects.push({
                        name: item.title || "Research Project",
                        dates: item.dates || "",
                        bullets: newBullets
                    });
                });

                // Clear research in current data
                data.research = [];
                // Force save and re-render projects
                updateState({ tailoredResume: data }); // Update global state wrapper
                currentEditingResume = data;

                // Trigger UI update
                // Clean up list
                listDiv.innerHTML = '';
                showStatus("Moved to Projects. Switch to Projects tab to view.", "success");
            };
        }

        // --- Excluded Items Section ---
        const excludedSections = ['experience', 'projects', 'leadership', 'research', 'certifications', 'awards', 'volunteering'];
        if (excludedSections.includes(section)) {
            const excludedForSection = getExcludedItemsForSection(section);

            if (excludedForSection.length > 0) {
                const excludedDiv = document.createElement('div');
                excludedDiv.className = 'excluded-items-section';
                excludedDiv.style.cssText = 'margin-top:16px; padding:12px; background:#fef3c7; border:1px dashed #f59e0b; border-radius:8px;';

                const excludedHeader = document.createElement('div');
                excludedHeader.style.cssText = 'font-size:12px; font-weight:bold; color:#92400e; margin-bottom:10px; display:flex; align-items:center; gap:6px;';
                excludedHeader.innerHTML = `⚠️ Not Included (removed by AI to fit ${state.pageMode === '1page' ? '1 page' : 'page limit'})`;
                excludedDiv.appendChild(excludedHeader);

                const mustInclude = getMustIncludeItems();
                const currentMustIncludeForSection = mustInclude[section] || [];

                excludedForSection.forEach(({ index, item }) => {
                    const isMarkedForInclusion = currentMustIncludeForSection.includes(index);
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'excluded-item';
                    itemDiv.style.cssText = `padding:10px; margin-bottom:8px; background:${isMarkedForInclusion ? '#d1fae5' : '#fff'}; border:1px solid ${isMarkedForInclusion ? '#10b981' : '#e5e7eb'}; border-radius:6px; opacity:${isMarkedForInclusion ? '1' : '0.7'}; transition:all 0.2s;`;

                    // Determine display title
                    let title = item.company || item.name || item.organization || item.title || 'Item';
                    let subtitle = item.role || item.tech || item.conference || item.issuer || '';
                    let bulletPreview = (item.bullets && item.bullets.length > 0) ? item.bullets[0].substring(0, 80) + '...' : '';

                    itemDiv.innerHTML = `
                        <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer; font-size:12px;">
                            <input type="checkbox" class="include-toggle" data-section="${section}" data-index="${index}" 
                                ${isMarkedForInclusion ? 'checked' : ''} 
                                style="margin-top:2px; accent-color:#10b981; width:16px; height:16px;">
                            <div>
                                <div style="font-weight:bold; color:#1f2937;">${escapeHtml(title)}${subtitle ? ' — ' + escapeHtml(subtitle) : ''}</div>
                                ${bulletPreview ? `<div style="font-size:10px; color:#6b7280; margin-top:2px;">${escapeHtml(bulletPreview)}</div>` : ''}
                                <div style="font-size:10px; color:${isMarkedForInclusion ? '#059669' : '#9ca3af'}; margin-top:4px;">
                                    ${isMarkedForInclusion ? '✅ Will be included on next Forge' : '☐ Check to include on next Forge'}
                                </div>
                            </div>
                        </label>
                    `;
                    excludedDiv.appendChild(itemDiv);
                });

                // Event delegation for checkboxes
                excludedDiv.addEventListener('change', async (e) => {
                    if (!e.target.classList.contains('include-toggle')) return;

                    const sec = e.target.dataset.section;
                    const idx = parseInt(e.target.dataset.index);
                    const checked = e.target.checked;

                    // Update mustIncludeItems in state
                    const current = { ...(state.mustIncludeItems || {}) };
                    if (!current[sec]) current[sec] = [];

                    if (checked) {
                        if (!current[sec].includes(idx)) current[sec].push(idx);
                    } else {
                        current[sec] = current[sec].filter(i => i !== idx);
                    }

                    updateState({ mustIncludeItems: current });
                    await chrome.storage.local.set({ must_include_items: current });

                    // Show page overflow warning in 1-page mode
                    const totalMustInclude = Object.values(current).reduce((s, a) => s + a.length, 0);
                    if (state.pageMode === '1page' && totalMustInclude > 0) {
                        showStatus(`⚠️ Including ${totalMustInclude} extra item(s) may exceed 1 page. AI will try to fit, or you may need to manually trim after forging.`, 'warning');
                    }

                    // Re-render this excluded section to update visual state
                    renderProfileEditor(section, null, containerId);
                });

                // Warning note
                const noteDiv = document.createElement('div');
                noteDiv.style.cssText = 'font-size:10px; color:#92400e; margin-top:8px; font-style:italic;';
                noteDiv.textContent = '💡 Check items to include them in your next "Save & Regenerate". The AI will re-tailor the full resume with these items included.';
                excludedDiv.appendChild(noteDiv);

                container.appendChild(excludedDiv);
            }
        }
    }

    // Render live ATS keyword badge
    setTimeout(() => renderLiveAtsBadge(containerId, currentEditingResume), 150);
}

function formatDefaultSectionTitle(section, singular = false) {
    const map = {
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
    if (singular) {
        // Simple heuristic for singular
        if (section === 'experience') return "Job";
        if (section === 'projects') return "Project";
        if (section === 'research') return "Paper";
        if (section === 'education') return "School";
        if (section === 'certifications') return "Certification";
        if (section === 'awards') return "Award";
        if (section === 'volunteering') return "Role";
        return "Item";
    }
    return map[section] || section.charAt(0).toUpperCase() + section.slice(1);
}

function createEmptyItem(section) {
    if (section === 'experience') return { company: "New Company", role: "Role", location: "", dates: "Dates", bullets: ["New bullet"] };
    if (section === 'education') return { institution: "University Name", degree: "Degree", gpa: "", dates: "Dates", location: "", bullets: [] };
    if (section === 'projects') return { name: "New Project", tech: "", dates: "Dates", bullets: ["New bullet"] };
    if (section === 'leadership') return { organization: "New Org", role: "Role", dates: "Dates", bullets: ["Description"] };
    if (section === 'research') return { title: "New Paper Title", conference: "Conference/Journal", dates: "Date", link: "", bullets: [] };
    if (section === 'certifications') return { name: "New Certification", issuer: "Issuer", dates: "Date" };
    if (section === 'awards') return { name: "New Award", organization: "Issuer", dates: "Date" };
    if (section === 'volunteering') return { organization: "Organization", role: "Role", dates: "Dates", bullets: ["Description"] };
    return { name: "New Item", bullets: ["New bullet"] };
}

function renderItemBlock(container, item, section) {
    const div = document.createElement('div');
    div.className = 'item-block';

    // Header Inputs based on section type
    let headerHtml = '';
    const val = (k) => String(item[k] || '').replace(/"/g, '&quot;');

    if (section === 'experience') {
        headerHtml = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 5px;">
                <input type="text" class="item-company" value="${val('company')}" placeholder="Company">
                <input type="text" class="item-role" value="${val('role')}" placeholder="Role">
                <input type="text" class="item-location" value="${val('location')}" placeholder="Location">
                <input type="text" class="item-dates" value="${val('dates')}" placeholder="Dates">
            </div>`;
    } else if (section === 'projects') {
        headerHtml = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 5px;">
                <input type="text" class="item-name" value="${val('name')}" placeholder="Project Name">
                <input type="text" class="item-tech" value="${val('tech')}" placeholder="Technologies">
                <input type="text" class="item-dates" value="${val('dates')}" placeholder="Dates" style="grid-column: span 2;">
            </div>`;
    } else if (section === 'leadership' || section === 'volunteering') {
        headerHtml = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 5px;">
                <input type="text" class="item-org" value="${val('organization')}" placeholder="Organization">
                <input type="text" class="item-role" value="${val('role')}" placeholder="Role">
                <input type="text" class="item-location" value="${val('location')}" placeholder="Location">
                <input type="text" class="item-dates" value="${val('dates')}" placeholder="Dates">
            </div>`;
    } else if (section === 'research') {
        headerHtml = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 5px;">
                <input type="text" class="item-title" value="${val('title')}" placeholder="Paper Title" style="font-weight:bold;">
                <input type="text" class="item-conference" value="${val('conference')}" placeholder="Conference/Journal">
                <input type="text" class="item-link" value="${val('link')}" placeholder="Link (URL)">
                <input type="text" class="item-dates" value="${val('dates')}" placeholder="Dates">
            </div>`;
    } else if (section === 'certifications') {
        headerHtml = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 5px;">
                <input type="text" class="item-name" value="${val('name') || val('title')}" placeholder="Certification Name" style="font-weight:bold;">
                <input type="text" class="item-issuer" value="${val('issuer') || val('organization')}" placeholder="Issuer">
                <input type="text" class="item-dates" value="${val('dates') || val('date')}" placeholder="Date" style="grid-column: span 2;">
            </div>`;
    } else if (section === 'awards') {
        headerHtml = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 5px;">
                <input type="text" class="item-name" value="${val('name') || val('title')}" placeholder="Award Name" style="font-weight:bold;">
                <input type="text" class="item-org" value="${val('organization') || val('issuer')}" placeholder="Organization">
                <input type="text" class="item-dates" value="${val('dates') || val('date')}" placeholder="Date" style="grid-column: span 2;">
            </div>`;
    } else if (section === 'education') {
        headerHtml = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 5px;">
                <input type="text" class="item-institution" value="${val('institution')}" placeholder="Institution" style="font-weight:bold;">
                <input type="text" class="item-degree" value="${val('degree')}" placeholder="Degree/Major">
                <input type="text" class="item-gpa" value="${val('gpa')}" placeholder="GPA">
                <input type="text" class="item-location" value="${val('location')}" placeholder="Location">
                <input type="text" class="item-dates" value="${val('dates')}" placeholder="Dates" style="grid-column: span 2;">
            </div>`;
    }

    let bulletsHtml = '';
    const hasBullets = !['certifications', 'awards', 'education'].includes(section);

    if (hasBullets) {
        (item.bullets || []).forEach(b => bulletsHtml += createBulletRow(b));
    }

    const currentBulletCount = item.bullet_count_preference !== undefined
        ? item.bullet_count_preference
        : (item.bullets || []).length;

    const bulletControls = hasBullets ? `
         <div style="display: flex; gap: 10px; align-items: center;">
            <label style="font-size: 11px; display: flex; align-items: center; gap: 5px;">
                📊 Bullets:
                <button class="bullet-count-decrease" style="width: 24px; height: 24px; padding: 0; font-size: 16px; cursor: pointer; border: 1px solid #ccc; background: #f5f5f5; border-radius: 3px;" title="Decrease bullets">−</button>
                <span class="bullet-count-display" style="min-width: 20px; text-align: center; font-weight: bold;">${currentBulletCount}</span>
                <button class="bullet-count-increase" style="width: 24px; height: 24px; padding: 0; font-size: 16px; cursor: pointer; border: 1px solid #ccc; background: #f5f5f5; border-radius: 3px;" title="Increase bullets">+</button>
                <input type="hidden" class="bullet-count-input" value="${currentBulletCount}">
            </label>
            <div style="display:flex; gap:2px;">
                <button class="move-up-btn" title="Move Up" style="cursor:pointer; padding:2px 6px;">⬆️</button>
                <button class="move-down-btn" title="Move Down" style="cursor:pointer; padding:2px 6px;">⬇️</button>
            </div>
            <button class="remove-btn remove-item-btn">🗑️ Remove</button>
        </div>
    ` : `
        <div style="display:flex; gap:10px; align-items:center;">
             <div style="display:flex; gap:2px;">
                <button class="move-up-btn" title="Move Up" style="cursor:pointer; padding:2px 6px;">⬆️</button>
                <button class="move-down-btn" title="Move Down" style="cursor:pointer; padding:2px 6px;">⬇️</button>
            </div>
            <button class="remove-btn remove-item-btn">🗑️ Remove</button>
        </div>
    `;

    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight: bold; color: #555;">Item</span>
            </div>
            ${bulletControls}
        </div>
        ${headerHtml}
        ${hasBullets ? `
        <div class="edit-field">
            <label>Bullets</label>
            <div class="bullet-list-container">${bulletsHtml}</div>
            <button class="add-bullet-btn" style="font-size: 10px; padding: 2px 5px; margin-top: 5px;">+ Add Bullet</button>
        </div>` : ''}
    `;

    // Event Listeners
    div.querySelector('.remove-item-btn').onclick = () => {
        // Keyword Loss Check
        let itemText = "";
        div.querySelectorAll('input, textarea').forEach(el => itemText += " " + el.value);
        checkKeywordLoss(itemText);

        div.remove();
        updateArrowVisibility(container);

        // Refresh live score
        const formContainer = container.closest('[data-editor-mode]') || container;
        setTimeout(() => renderLiveAtsBadge(formContainer.id, currentEditingResume), 100);
    };

    const upBtn = div.querySelector('.move-up-btn');
    const downBtn = div.querySelector('.move-down-btn');
    if (upBtn) upBtn.onclick = () => {
        if (div.previousElementSibling) {
            div.parentNode.insertBefore(div, div.previousElementSibling);
            updateArrowVisibility(container);
        }
    };
    if (downBtn) downBtn.onclick = () => {
        if (div.nextElementSibling) {
            div.parentNode.insertBefore(div.nextElementSibling, div);
            updateArrowVisibility(container);
        }
    };

    if (hasBullets) {
        const bContainer = div.querySelector('.bullet-list-container');
        div.querySelector('.add-bullet-btn').onclick = () => {
            bContainer.insertAdjacentHTML('beforeend', createBulletRow(""));
            // Bind new input
            const newTa = bContainer.lastElementChild.querySelector('textarea');
            handleInput(newTa); // Initial
            newTa.addEventListener('input', () => handleInput(newTa));
        };
        bContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-bullet-btn')) {
                const bulletItem = e.target.closest('.bullet-item');
                const bulletText = bulletItem.querySelector('textarea').value;
                checkKeywordLoss(bulletText);

                bulletItem.remove();

                // Refresh live score
                const formContainer = container.closest('[data-editor-mode]') || container;
                setTimeout(() => renderLiveAtsBadge(formContainer.id, currentEditingResume), 100);
            }
        });

        // Initial binding for existing bullets
        bContainer.querySelectorAll('textarea').forEach(ta => {
            ta.addEventListener('input', () => handleInput(ta));
        });

        // Bullet Count Logic
        const countInput = div.querySelector('.bullet-count-input');
        const countDisplay = div.querySelector('.bullet-count-display');
        const decreaseBtn = div.querySelector('.bullet-count-decrease');
        const increaseBtn = div.querySelector('.bullet-count-increase');

        if (decreaseBtn) decreaseBtn.onclick = () => {
            let c = parseInt(countInput.value) || 0;
            if (c > 0) { countInput.value = --c; countDisplay.textContent = c; }
        };
        if (increaseBtn) increaseBtn.onclick = () => {
            let c = parseInt(countInput.value) || 0;
            if (c < 10) { countInput.value = ++c; countDisplay.textContent = c; }
        };
    }

    container.appendChild(div);
    updateArrowVisibility(container);

    // Initial expansion for textareas
    div.querySelectorAll('textarea').forEach(handleInput);
}

function autoExpand(field) {
    if (!field) return;
    field.style.height = 'inherit';
    const computed = window.getComputedStyle(field);
    const height = parseInt(computed.getPropertyValue('border-top-width'), 10)
        + parseInt(computed.getPropertyValue('padding-top'), 10)
        + field.scrollHeight
        + parseInt(computed.getPropertyValue('padding-bottom'), 10)
        + parseInt(computed.getPropertyValue('border-bottom-width'), 10);

    // Better simple reset for typical box-sizing: border-box
    field.style.height = 'auto';
    field.style.height = field.scrollHeight + 'px';
}


function handleInput(field) {
    autoExpand(field);
    if (field.classList.contains('bullet-input')) {
        updateCharCount(field);

        // Highlight & Stats Logic
        const parent = field.closest('.bullet-item');
        const preview = parent ? parent.querySelector('.keyword-preview') : null;

        if (inputTimeout) clearTimeout(inputTimeout);
        inputTimeout = setTimeout(() => {
            if (preview) renderHighlightedPreview(field.value, preview);

            // Update global coverage for this container
            const formContainer = field.closest('[data-editor-mode]');
            if (formContainer && formContainer.id) updateKeywordCoverage(formContainer.id);
        }, 200);
    }
}

function updateCharCount(field) {
    const parent = field.closest('.bullet-item');
    if (!parent) return;
    const counter = parent.querySelector('.char-count');
    if (!counter) return;

    const len = field.value.length;
    counter.textContent = `${len} / 200`; // Suggested limit
    if (len > 200) counter.classList.add('warning');
    else counter.classList.remove('warning');
}

function renderSkillBlock(container, category, skills) {
    const div = document.createElement('div');
    div.className = 'item-block';
    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <input type="text" class="skill-category-input" value="${category}" style="font-weight: bold; width: 50%;" placeholder="Category Name">
            
            <div style="display:flex; gap:10px; align-items:center;">
                <div style="display:flex; gap:2px;">
                    <button class="move-up-btn" title="Move Up" style="cursor:pointer; padding:2px 6px;">⬆️</button>
                    <button class="move-down-btn" title="Move Down" style="cursor:pointer; padding:2px 6px;">⬇️</button>
                </div>
                <button class="remove-btn remove-category-btn">🗑️ Remove</button>
            </div>
        </div>
        <textarea class="skill-values-input" style="height: 60px;">${skills}</textarea>
    `;

    div.querySelector('.remove-category-btn').onclick = () => {
        const skillsText = div.querySelector('textarea').value;
        checkKeywordLoss(skillsText);

        div.remove();
        updateArrowVisibility(container);

        // Refresh live score
        const formContainer = container.closest('[data-editor-mode]') || container;
        setTimeout(() => renderLiveAtsBadge(formContainer.id, currentEditingResume), 100);
    };

    // Auto expand skills
    const ta = div.querySelector('textarea');
    ta.addEventListener('input', () => autoExpand(ta));
    // Initial
    setTimeout(() => autoExpand(ta), 0);

    const upBtn = div.querySelector('.move-up-btn');
    const downBtn = div.querySelector('.move-down-btn');
    if (upBtn) upBtn.onclick = () => {
        if (div.previousElementSibling) { div.parentNode.insertBefore(div, div.previousElementSibling); updateArrowVisibility(container); }
    };
    if (downBtn) downBtn.onclick = () => {
        if (div.nextElementSibling) { div.parentNode.insertBefore(div.nextElementSibling, div); updateArrowVisibility(container); }
    };

    container.appendChild(div);
    updateArrowVisibility(container);
}

function createBulletRow(text) {
    // Escape quotes for value attribute
    const safeText = text ? text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;') : '';
    // Use textarea value property instead of innerHTML to avoid XSS issues
    return `<div class="bullet-item" style="display: grid; grid-template-columns: 1fr auto; gap: 5px; margin-bottom: 5px; width: 100%;">
                <div style="width:100%">
                    <textarea class="bullet-input" style="width: 100%; height: 50px; resize: vertical; padding: 5px;">${safeText}</textarea>
                    <div class="keyword-preview" style="font-size: 10px; color: #666; margin-top: 2px; line-height: 1.4; display:none; padding:2px;"></div>
                    <div class="char-count">0 / 200</div>
                </div>
                <button class="remove-btn remove-bullet-btn" style="height:fit-content; margin-top:5px;">❌</button>
            </div>`;
}

function updateArrowVisibility(container) {
    const items = container.querySelectorAll('.item-block');
    items.forEach((item, index) => {
        const upBtn = item.querySelector('.move-up-btn');
        const downBtn = item.querySelector('.move-down-btn');
        if (upBtn) upBtn.style.visibility = index === 0 ? 'hidden' : 'visible';
        if (downBtn) downBtn.style.visibility = index === items.length - 1 ? 'hidden' : 'visible';
    });
}

export async function saveProfileChanges(section, containerId = 'profileFormContainer') {
    const container = document.getElementById(containerId);
    if (!container) return null;

    if (!currentEditingResume) {
        currentEditingResume = state.tailoredResume || state.baseResume;
    }

    // Safety check: prevent profile edits from leaking into tailored resume if currentEditingResume was mis-assigned
    if (containerId === 'profileFormContainer' && currentEditingResumeSource === state.tailoredResume) {
        debugLog("saveProfileChanges: Rectifying source mismatch. Cloning from baseResume.");
        currentEditingResume = JSON.parse(JSON.stringify(state.baseResume));
        currentEditingResumeSource = state.baseResume;
    }

    if (!currentEditingResume.section_titles) currentEditingResume.section_titles = {};
    const titleInput = document.getElementById('sectionTitleInput');
    if (titleInput) {
        currentEditingResume.section_titles[section] = titleInput.value;
    }

    if (section === 'summary') {
        const el = document.getElementById('edit_summary_text');
        if (el) currentEditingResume.summary = el.value;
    } else if (section === 'languages') {
        const el = document.getElementById('edit_languages_text');
        // Return string, can split if needed by consumer
        if (el) currentEditingResume.languages = el.value.split(',').map(s => s.trim());
    } else if (section === 'contact') {
        // Save name (stored on root)
        const nameField = document.getElementById('edit_name_field');
        if (nameField) currentEditingResume.name = nameField.value;

        const inputs = container.querySelectorAll('.contact-input');
        const data = {};
        inputs.forEach(i => { if (i.value) data[i.dataset.key] = i.value; });
        // Merge with existing
        currentEditingResume.contact = { ...currentEditingResume.contact, ...data };
    } else if (section === 'skills') {
        const blocks = container.querySelectorAll('.item-block');
        const skills = {};
        blocks.forEach(b => {
            const k = b.querySelector('.skill-category-input').value;
            const v = b.querySelector('.skill-values-input').value;
            if (k) skills[k] = v;
        });
        currentEditingResume.skills = skills;
    } else {
        // List Sections
        const blocks = container.querySelectorAll('.item-block');
        const list = [];

        blocks.forEach(b => {
            const getVal = (c) => (b.querySelector(c) || {}).value || "";
            let item = {};

            if (section === 'experience') {
                item.company = getVal('.item-company');
                item.role = getVal('.item-role');
                item.location = getVal('.item-location');
                item.dates = getVal('.item-dates');
            } else if (section === 'leadership' || section === 'volunteering') {
                item.organization = getVal('.item-org');
                item.role = getVal('.item-role');
                item.location = getVal('.item-location');
                item.dates = getVal('.item-dates');
            } else if (section === 'research') {
                item.title = getVal('.item-title');
                item.conference = getVal('.item-conference');
                item.link = getVal('.item-link');
                item.dates = getVal('.item-dates');
            } else if (section === 'certifications') {
                item.name = getVal('.item-name');
                item.issuer = getVal('.item-issuer');
                item.dates = getVal('.item-dates');
            } else if (section === 'awards') {
                item.name = getVal('.item-name');
                item.organization = getVal('.item-org');
                item.dates = getVal('.item-dates');
            } else if (section === 'education') {
                item.institution = getVal('.item-institution');
                item.degree = getVal('.item-degree');
                item.gpa = getVal('.item-gpa');
                item.location = getVal('.item-location');
                item.dates = getVal('.item-dates');
            } else {
                item.name = getVal('.item-name');
                item.tech = getVal('.item-tech');
                item.dates = getVal('.item-dates');
            }

            // Bullets
            if (!['certifications', 'awards', 'education'].includes(section)) {
                const bInputs = b.querySelectorAll('.bullet-input');
                item.bullets = Array.from(bInputs).map(i => i.value).filter(t => t.trim().length > 0);

                const countInput = b.querySelector('.bullet-count-input');
                if (countInput) {
                    item.bullet_count_preference = parseInt(countInput.value) || item.bullets.length;
                }
            }
            list.push(item);
        });
        currentEditingResume[section] = list;
    }

    // Persist
    if (containerId === 'profileFormContainer') {
        // Base resume
        await chrome.storage.local.set({ base_resume: currentEditingResume });
        updateState({ baseResume: currentEditingResume });
        refreshProfileName();
        // Also persist the display name
        if (currentEditingResume.name) {
            await chrome.storage.local.set({ user_profile_name: currentEditingResume.name });
        }
    } else {
        // Tailored resume
        await chrome.storage.local.set({ tailored_resume: currentEditingResume });
        updateState({ tailoredResume: currentEditingResume });
    }

    const statusTarget = containerId === 'profileFormContainer' ? 'profileStatus' : 'status';
    showStatus('✅ Profile saved!', 'success', statusTarget);

    // Update live ATS badge after saving changes  
    setTimeout(() => renderLiveAtsBadge(containerId, currentEditingResume), 100);

    return currentEditingResume[section]; // Return data for immediate use if needed
}

export function collectBulletCounts(section, containerId = 'profileFormContainer') {
    const bulletCounts = {
        experience: [],
        projects: [],
        leadership: [],
        research: []
    };

    const trackedSections = ['experience', 'projects', 'leadership', 'research'];

    // Scrape active section
    if (trackedSections.includes(section)) {
        const container = document.getElementById(containerId);
        // Safety check if container exists
        if (container) {
            const itemBlocks = container.querySelectorAll('.item-block');
            itemBlocks.forEach(block => {
                const countInput = block.querySelector('.bullet-count-input');
                if (countInput) {
                    bulletCounts[section].push(parseInt(countInput.value) || 0);
                }
            });
        }
    }

    // Fill others from state
    trackedSections.forEach(sec => {
        if (sec !== section) {
            const data = currentEditingResume ? currentEditingResume[sec] : [];
            if (data) {
                bulletCounts[sec] = data.map(item =>
                    item.bullet_count_preference !== undefined ? item.bullet_count_preference : (item.bullets || []).length
                );
            }
        }
    });

    return bulletCounts;
}
