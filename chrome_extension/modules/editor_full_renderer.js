// Editor Renderer - Pixel-perfect match for PDF Builder

import { escapeHtml } from './security.js';

export function renderFullResumeEditor(container, data, fmt = {}) {
    if (!data || !container) return;
    container.innerHTML = '';

    const f = { ...fmt };
    // ... (rest of the file content remains the same until the end)

    /* Helper for placeholders (Bug 41) */
    function val(text, placeholder) {
        return (text && text.trim()) ? escapeHtml(text) : `<span class="empty-placeholder">[${placeholder}]</span>`;
    }

    // Font map (matches CSS and PDF Builder)
    const fontMap = {
        times: "'Times New Roman', Times, serif",
        helvetica: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        courier: "'Courier New', Courier, monospace"
    };

    // Margin map
    const marginSide = f.margins === 'narrow' ? 20 : f.margins === 'wide' ? 45 : 30;
    const marginTop = f.margins === 'narrow' ? 15 : f.margins === 'wide' ? 25 : 20;

    // Density map
    const density = {
        compact: { sectionGap: 3, itemGap: 4, bulletGap: 1, lineHeight: 1.15 },
        normal: { sectionGap: 5, itemGap: 6, bulletGap: 2, lineHeight: 1.2 },
        spacious: { sectionGap: 8, itemGap: 10, bulletGap: 3, lineHeight: 1.3 }
    }[f.density] || { sectionGap: 5, itemGap: 6, bulletGap: 2, lineHeight: 1.2 };

    // Page wrapper
    const page = document.createElement('div');
    page.className = 'resume-page';
    page.style.cssText = `
        /* width: 612pt; -- Let CSS handle width */
        /* min-height: 792pt; -- Let CSS handle height */
        margin: 0 auto;
        padding: ${marginTop}pt ${marginSide}pt;
        font-family: ${fontMap[f.font] || fontMap.times};
        font-size: ${f.bodySize || 10}pt;
        line-height: ${density.lineHeight};
        background: white;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        position: relative;
        --bullet-char: "${f.bulletChar || '•'}";
        --section-gap: ${density.sectionGap}pt;
        --item-gap: ${density.itemGap}pt;
        --bullet-gap: ${density.bulletGap}pt;
    `;

    // --- RENDER NAME (centered, bold) ---
    if (data.name || (data.contact && Object.keys(data.contact).length > 0)) {
        const nameDiv = document.createElement('div');
        nameDiv.className = 'resume-name';
        nameDiv.contentEditable = true;
        nameDiv.textContent = data.name || 'Your Name'; // Fallback
        nameDiv.style.cssText = `
            text-align: center;
            font-size: ${f.nameSize || 21}pt;
            font-weight: bold;
            margin-bottom: 2pt;
        `;
        page.appendChild(nameDiv);

        // Contact line
        if (data.contact) {
            const c = data.contact;
            const contactDiv = document.createElement('div');
            contactDiv.className = 'resume-contact';
            contactDiv.style.cssText = `
                text-align: center;
                font-size: ${f.bodySize || 10}pt;
                margin-bottom: ${density.sectionGap}pt;
            `;

            if (typeof data.contact === 'string') {
                // Handle raw string contact
                contactDiv.contentEditable = true;
                contactDiv.dataset.type = 'raw';
                contactDiv.innerText = data.contact;
            } else {
                const c = data.contact;
                const orderedKeys = ['email', 'phone', 'location', 'linkedin', 'portfolio'];
                const valMap = {
                    email: c.email || '',
                    phone: c.phone || '',
                    location: c.location || '',
                    linkedin: c.linkedin || c.linkedin_url || '',
                    portfolio: c.portfolio || c.website || c.portfolio_url || ''
                };


                let first = true;
                orderedKeys.forEach(key => {
                    const val = valMap[key];

                    // ISSUE: If val is just the placeholder text itself, treat it as empty
                    // Valid URL-like content?
                    let displayVal = val;
                    const placeholder = `[${key.charAt(0).toUpperCase() + key.slice(1)}]`;


                    if (!val || val.trim().length === 0 || val === placeholder) {
                        displayVal = placeholder;
                    } else {
                        // Revert: Use static labels if it's a URL-based field
                        if (key === 'linkedin' || key === 'portfolio') {
                            displayVal = key.charAt(0).toUpperCase() + key.slice(1);
                        } else {
                            // Still clean email/phone if needed (though usually we show them as is)
                            displayVal = val.replace(/^https?:\/\/(www\.)?/, '');
                            if (displayVal.endsWith('/')) displayVal = displayVal.slice(0, -1);
                        }
                    }

                    if (!first) contactDiv.appendChild(document.createTextNode(' | '));
                    const span = document.createElement('span');
                    span.contentEditable = true;
                    span.dataset.field = key;
                    span.textContent = displayVal;

                    // Add class for empty state styling if needed
                    if (displayVal === placeholder) span.classList.add('empty-field');

                    // Interactive Links
                    if (['linkedin', 'portfolio', 'website', 'email'].includes(key)) {
                        span.classList.add('interactive-link');
                        // Store the full original value as the URL, if it differs from display
                        // If it was empty/placeholder, don't set data-url? Or set it to empty?
                        if (val && val !== placeholder) {
                            span.dataset.url = val;
                        }
                    }

                    contactDiv.appendChild(span);
                    first = false;
                });
            }
            page.appendChild(contactDiv);
        }
    }

    // --- RENDER SECTIONS ---
    const sectionOrder = data.section_order || [
        'summary', 'education', 'skills', 'experience', 'projects',
        'research', 'leadership', 'certifications', 'awards', 'volunteering', 'languages', 'interests'
    ];

    const defaultTitles = {
        summary: "Summary", education: "Education", skills: "Technical Knowledge",
        experience: "Work Experience", projects: "Research and Projects",
        research: "Research & Publications", leadership: "Leadership Experience",
        certifications: "Certifications", awards: "Awards & Honors",
        volunteering: "Volunteering", languages: "Languages", interests: "Interests"
    };
    const titles = { ...defaultTitles, ...(data.section_titles || {}) };

    sectionOrder.forEach(section => {
        const sectionData = data[section];
        if (!sectionData) return;
        if (Array.isArray(sectionData) && sectionData.length === 0) return;
        if (section === 'skills' && typeof sectionData === 'object' && !Array.isArray(sectionData) && Object.keys(sectionData).length === 0) return;

        const secDiv = document.createElement('div');
        secDiv.className = 'resume-section';
        secDiv.dataset.section = section;
        secDiv.style.marginTop = density.sectionGap + 'pt';

        // Header Row & Add Button
        const headerRow = document.createElement('div');
        headerRow.className = 'section-header-row';
        headerRow.style.marginBottom = (density.lineHeight * (f.bodySize || 10) / 2) + 2 + 'pt'; // Adjusted spacing

        const header = document.createElement('div');
        header.className = 'section-header';
        header.contentEditable = true;

        const headerStyle = f.headerStyle || 'uppercase_line';
        const displayTitle = headerStyle.startsWith('uppercase')
            ? (titles[section] || section).toUpperCase()
            : (titles[section] || section);
        header.textContent = displayTitle;

        // Header styling (Underline)
        header.style.cssText = `
            font-weight: bold;
            font-size: ${f.headerSize || 12}pt;
            text-transform: ${headerStyle.startsWith('uppercase') ? 'uppercase' : 'none'};
            border-bottom: ${headerStyle.endsWith('_line') ? '0.5pt solid #000' : 'none'};
            padding-bottom: ${headerStyle.endsWith('_line') ? '2pt' : '0'};
            margin-bottom: 4pt;
            flex: 1;
        `;

        const addBtn = document.createElement('button');
        addBtn.className = 'section-add-btn';
        addBtn.dataset.action = 'add-item';
        addBtn.dataset.section = section;
        addBtn.title = "Add Item";
        addBtn.textContent = "+";

        headerRow.appendChild(header);
        headerRow.appendChild(addBtn);
        secDiv.appendChild(headerRow);

        renderSectionContent(secDiv, section, sectionData, f, density);
        page.appendChild(secDiv);
    });

    container.appendChild(page);

    /*
    requestAnimationFrame(() => {
        // ... (removed)
    });
    */
}

function renderSectionContent(container, section, content, f, density) {
    if (section === 'summary') {
        const div = document.createElement('div');
        div.className = 'section-content';
        div.contentEditable = true;
        div.innerText = content || '';
        container.appendChild(div);
    }
    else if (section === 'skills') {
        renderSkills(container, content, f, density);
    }
    else if (section === 'languages' || section === 'interests') {
        const div = document.createElement('div');
        div.className = 'section-content';
        div.contentEditable = true;
        if (Array.isArray(content)) div.innerText = content.join(', ');
        else div.innerText = content || '';
        container.appendChild(div);
    }
    else {
        renderListItems(container, section, content, f, density);
    }
}

function renderListItems(container, section, items, f, density) {
    if (!Array.isArray(items)) return;

    items.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'section-item';
        itemDiv.dataset.index = index;
        itemDiv.dataset.section = section;
        itemDiv.style.marginBottom = density.itemGap + 'pt';

        // Data keys mapping
        let k1, k2, k3, k4;
        let v1, v2, v3, v4;

        if (section === 'education') {
            k1 = 'school'; v1 = item.school || item.institution;
            k2 = 'dates'; v2 = item.date || item.year || item.dates;
            k3 = 'degree'; v3 = item.degree || item.study;
            k4 = 'location'; v4 = item.location;
        } else if (section === 'projects') {
            k1 = 'name'; v1 = item.name || item.title;
            k2 = 'dates'; v2 = item.date || item.dates;
            k3 = 'tech'; v3 = item.tech || item.technologies;
            k4 = ''; v4 = ''; // No location for projects usually
        } else if (section === 'research') {
            // Research
            k1 = 'title'; v1 = item.title || item.name;
            k2 = 'dates'; v2 = item.date || item.dates;
            k3 = 'conference'; v3 = item.conference;
            k4 = 'link'; v4 = item.link || '';
        } else if (section === 'certifications') {
            // Certifications
            k1 = 'name'; v1 = item.name;
            k2 = 'dates'; v2 = item.date || item.dates;
            k3 = 'issuer'; v3 = item.issuer;
            k4 = ''; v4 = '';
        } else if (section === 'awards') {
            // Awards
            k1 = 'name'; v1 = item.name;
            k2 = 'dates'; v2 = item.date || item.dates;
            k3 = 'organization'; v3 = item.organization;
            k4 = ''; v4 = '';
        } else {
            // Experience etc
            k1 = 'company'; v1 = item.company || item.organization;
            k2 = 'dates'; v2 = item.date || item.dates;
            k3 = 'role'; v3 = item.role || item.position;
            k4 = 'location'; v4 = item.location;
        }

        // Correct Action Button Structure
        let html = `
            <div class="item-actions">
                <button class="ia-btn" data-action="ai-rewrite" title="AI Rewrite">✨</button>
                <button class="ia-btn" data-action="move-up" title="Move Up">↑</button>
                <button class="ia-btn" data-action="move-down" title="Move Down">↓</button>
                <button class="ia-btn ia-danger" data-action="delete-item" title="Delete">×</button>
            </div>
        `;

        // Date Alignment (HTML Structure)
        // Verified: The .item-row class has display:flex from previous CSS fix, 
        // using span item-left and span item-right is correct.
        html += `
            <div class="item-row bold-row">
                <span class="item-left" contenteditable="true" data-key="${k1}">${escapeHtml(v1)}</span>
                <span class="item-right" contenteditable="true" data-key="${k2}">${escapeHtml(v2)}</span>
            </div>
        `;

        if (v3 || v4 || ['projects', 'education', 'experience', 'leadership', 'volunteering'].includes(section)) {
            html += `
            <div class="item-row italic-row">
                <span class="item-left" contenteditable="true" data-key="${k3}" ${!v3 ? 'data-placeholder="' + (k3 == 'role' ? 'Role' : 'Degree') + '"' : ''}>${escapeHtml(v3)}</span>
                <span class="item-right" contenteditable="true" data-key="${k4}" ${!v4 && k4 ? 'data-placeholder="Location"' : ''}>${escapeHtml(v4)}</span>
            </div>`;
        }

        // Bullet Count Controls
        const hasBullets = !['certifications', 'awards', 'education'].includes(section);
        const currentBulletCount = item.bullet_count_preference !== undefined
            ? item.bullet_count_preference
            : (item.bullets || []).length;

        if (hasBullets) {
            html += `
            <div class="bullet-count-row">
                <span>Bullets:</span>
                <button class="bc-btn" data-action="bullet-count-decrease">−</button>
                <span class="bullet-count-display">${currentBulletCount}</span>
                <button class="bc-btn" data-action="bullet-count-increase">+</button>
                <input type="hidden" class="bullet-count-input" value="${currentBulletCount}">
            </div>`;
        }

        // GPA
        if (section === 'education' && item.gpa) {
            html += `<ul class="bullet-list"><li contenteditable="true" data-key="gpa">GPA: ${escapeHtml(item.gpa)}</li></ul>`;
        }

        // Bullets
        if (item.bullets && item.bullets.length > 0) {
            html += `<ul class="bullet-list">`;
            item.bullets.forEach((b, bIndex) => {
                html += `
                <li contenteditable="true" data-bindex="${bIndex}">
                    ${escapeHtml(b.replace(/✨|×/g, '').trim())}
                    <!-- Bullet Actions Structure -->
                    <div class="bullet-actions" contenteditable="false">
                        <button class="ba-btn" data-action="rewrite-bullet" title="Rewrite">✨</button>
                        <button class="ba-btn ba-danger" data-action="delete-bullet" title="Delete">×</button>
                    </div>
                </li>`;
            });
            html += `</ul>`;
        } else {
            html += `<ul class="bullet-list"></ul>`;
        }

        // Add bullet button
        html += `<button class="add-bullet-btn" title="Add Bullet point">+ Bullet</button>`;

        itemDiv.innerHTML = html;
        container.appendChild(itemDiv);
    });
}

function renderSkills(container, skills, f, density) {
    let list = [];
    if (Array.isArray(skills)) {
        list = skills;
    } else if (typeof skills === 'object') {
        Object.entries(skills).forEach(([k, v]) => {
            list.push({ category: k, value: v });
        });
    }

    list.forEach(skill => {
        const row = document.createElement('div');
        row.className = 'section-item skill-row';
        // Bug 40: Logic for deletion needs to identify the KEY if it's an object
        // Add data-skill-key if it came from object
        if (skill.category) {
            row.dataset.skillKey = skill.category;
            // also set data-index for safety? 
        }

        const cat = skill.category || skill.name || '';
        const val = skill.value || skill.keywords || (Array.isArray(skill) ? skill.join(', ') : skill);

        // Placeholders
        const displayCat = cat || '[Category]';
        const displayVal = val || '[Skills]';

        const contentWrapper = document.createElement('div');
        contentWrapper.style.flex = "1";
        contentWrapper.innerHTML = `
            <span class="skill-category" contenteditable="true" data-key="category">${escapeHtml(displayCat)}</span>: 
            <span contenteditable="true" data-key="value">${escapeHtml(displayVal)}</span>
        `;

        // Add Delete Button specifically for skills
        const delBtn = document.createElement('button');
        delBtn.className = 'skill-del-btn ia-danger'; // Step 39: Use class instead of inline styles
        delBtn.dataset.action = 'delete-item';
        delBtn.dataset.section = 'skills';
        delBtn.title = "Delete Skill Category";
        delBtn.textContent = "×";
        delBtn.contentEditable = false;

        row.appendChild(contentWrapper);
        row.appendChild(delBtn);

        container.appendChild(row);
    });
}

/* Helper for placeholders (Bug 41) */
function val(text, placeholder) {
    return (text && text.trim()) ? escapeHtml(text) : `<span class="empty-placeholder">[${placeholder}]</span>`;
}
