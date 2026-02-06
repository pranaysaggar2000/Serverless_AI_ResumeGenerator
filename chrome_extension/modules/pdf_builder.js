
// Import jsPDF from global window object because it's loaded via script tag
const { jsPDF } = window.jspdf;

export function generateResumePdf(data, fmt = {}) {
    // --- CONFIGURATION ---
    // Merge with defaults
    const settings = {
        font: fmt.font || 'times',
        density: fmt.density || 'normal',
        margins: fmt.margins || 'normal',
        nameSize: fmt.nameSize || 21,
        bodySize: fmt.bodySize || 10,
        headerSize: fmt.headerSize || 12,
        subheaderSize: fmt.subheaderSize || 11,
        headerStyle: fmt.headerStyle || 'uppercase_line',
        bulletChar: fmt.bulletChar || '•',
        showLinks: fmt.showLinks !== false,
        pageSize: fmt.pageSize || 'letter'
    };

    // Derived values
    const PAGE_WIDTH = settings.pageSize === 'a4' ? 595.28 : 612;
    const PAGE_HEIGHT = settings.pageSize === 'a4' ? 841.89 : 792;

    const MARGIN_SIDE = settings.margins === 'narrow' ? 20 : settings.margins === 'wide' ? 45 : 30;
    const MARGIN_TOP = settings.margins === 'narrow' ? 15 : settings.margins === 'wide' ? 25 : 20;
    const MARGIN_BOTTOM = MARGIN_TOP;
    const CONTENT_WIDTH = PAGE_WIDTH - (2 * MARGIN_SIDE);

    // Density affects spacing
    const DENSITY = {
        compact: { sectionGap: 3, itemGap: 4, bulletGap: 1, lineHeight: 1.15 },
        normal: { sectionGap: 5, itemGap: 6, bulletGap: 2, lineHeight: 1.2 },
        spacious: { sectionGap: 8, itemGap: 10, bulletGap: 3, lineHeight: 1.3 }
    }[settings.density];

    const BODY = settings.bodySize;
    const BOLD_SIZE = settings.subheaderSize; // Use customized subheader size
    const LEADING = BODY * DENSITY.lineHeight;

    const doc = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: settings.pageSize
    });

    // Helper: Cursor management
    let cursorY = MARGIN_TOP;

    function checkPageBreak(heightNeeded) {
        if (cursorY + heightNeeded > PAGE_HEIGHT - MARGIN_BOTTOM) {
            doc.addPage();
            cursorY = MARGIN_TOP;
            return true;
        }
        return false;
    }

    function addText(text, x, y, options = {}) {
        doc.setFont(settings.font, options.style || 'normal');
        doc.setFontSize(options.size || BODY);

        if (options.align === 'center') {
            doc.text(text, PAGE_WIDTH / 2, y, { align: 'center' });
        } else if (options.align === 'right') {
            doc.text(text, x, y, { align: 'right' });
        } else {
            doc.text(text, x, y);
        }
    }

    // --- 1. HEADER ---

    // Name
    doc.setFont(settings.font, 'bold');
    doc.setFontSize(settings.nameSize);
    const name = data.name || "Name";
    addText(name, 0, cursorY, { align: 'center', size: settings.nameSize, style: 'bold' });
    cursorY += settings.nameSize + 4; // Leading based on name size

    // Contact
    doc.setFont(settings.font, 'normal');
    doc.setFontSize(BODY);

    let contactStr = "";
    if (typeof data.contact === 'string') {
        contactStr = data.contact;
    } else if (data.contact) {
        const c = data.contact;
        const parts = [];
        if (c.location) parts.push(c.location);
        if (c.phone) parts.push(c.phone);
        if (c.email) parts.push(c.email);

        // Only add LinkedIn/Portfolio text if links are enabled or just as text? 
        // Original code added them as text. We will stick to that but respect checks if we were strictly removing them.
        // But the setting says "Show clickable links". For now just showing the text part.
        if (c.linkedin_url) parts.push("LinkedIn");
        if (c.portfolio_url) parts.push("Portfolio");
        contactStr = parts.join(" | ");
    }

    addText(contactStr, 0, cursorY, { align: 'center', size: BODY });
    cursorY += LEADING + 2;

    // We skip actual clickable link annotations to keep it matching the original robust visual implementation.
    // If we wanted to add links we'd need to calculate X positions for each part of the string which is complex in PDF.

    cursorY += DENSITY.sectionGap;

    // --- SECTIONS ---

    const defaultTitles = {
        summary: "Summary",
        education: "Education",
        skills: "Technical Knowledge",
        experience: "Work Experience",
        projects: "Research and Projects",
        research: "Research & Publications",
        leadership: "Leadership Experience",
        certifications: "Certifications",
        awards: "Awards & Honors",
        volunteering: "Volunteering",
        languages: "Languages"
    };

    const titles = { ...defaultTitles, ...(data.section_titles || {}) };
    const sectionOrder = data.section_order || [
        "summary", "education", "skills", "experience", "projects",
        "research", "leadership", "certifications", "awards", "volunteering", "languages"
    ];

    // Helper for aligned row (Left | Right)
    function addAlignedRow(leftText, rightText, isBold = false, isItalic = false) {
        const style = isBold ? 'bold' : (isItalic ? 'italic' : 'normal');
        const size = isBold ? BOLD_SIZE : BODY;

        checkPageBreak(LEADING);

        doc.setFont(settings.font, style);
        doc.setFontSize(size);

        // Left text
        doc.text(String(leftText), MARGIN_SIDE, cursorY);

        // Right text
        if (rightText) {
            doc.text(String(rightText), PAGE_WIDTH - MARGIN_SIDE, cursorY, { align: 'right' });
        }

        cursorY += LEADING;
    }

    // Helper for bullets
    function addBullet(text) {
        // Strip HTML tags for clean text
        const cleanText = text.replace(/<[^>]+>/g, '');
        const bulletIndent = 14;
        const maxWidth = CONTENT_WIDTH - bulletIndent;

        doc.setFont(settings.font, 'normal');
        doc.setFontSize(BODY);

        const lines = doc.splitTextToSize(cleanText, maxWidth);

        checkPageBreak(lines.length * LEADING + 3);

        // Draw bullet
        doc.text(settings.bulletChar, MARGIN_SIDE + 5, cursorY);

        // Draw indent text
        doc.text(lines, MARGIN_SIDE + bulletIndent, cursorY);

        cursorY += (lines.length * LEADING) + DENSITY.bulletGap;
    }

    // Helper for Section Header
    function addSectionHeader(title) {
        checkPageBreak(30);
        cursorY += DENSITY.sectionGap;

        doc.setFont(settings.font, 'bold');
        doc.setFontSize(settings.headerSize);

        const displayTitle = settings.headerStyle.startsWith('uppercase')
            ? title.toUpperCase()
            : title;

        doc.text(displayTitle, MARGIN_SIDE, cursorY);
        cursorY += 4;

        if (settings.headerStyle.endsWith('_line')) {
            doc.setLineWidth(0.5);
            doc.line(MARGIN_SIDE, cursorY, PAGE_WIDTH - MARGIN_SIDE, cursorY);
        }

        cursorY += LEADING + 2;
    }

    // Helper for Summary/Text Block
    function addTextBlock(text) {
        const cleanText = text.replace(/<[^>]+>/g, '');
        doc.setFont(settings.font, 'normal');
        doc.setFontSize(BODY);
        const lines = doc.splitTextToSize(cleanText, CONTENT_WIDTH);
        checkPageBreak(lines.length * LEADING);
        doc.text(lines, MARGIN_SIDE, cursorY);
        cursorY += (lines.length * LEADING) + DENSITY.itemGap;
    }

    // --- RENDER LOOP ---

    sectionOrder.forEach(section => {
        if (!data[section] || (Array.isArray(data[section]) && data[section].length === 0)) return;
        if (section === 'skills' && Object.keys(data.skills).length === 0) return;

        addSectionHeader(titles[section] || section);

        if (section === 'summary') {
            addTextBlock(data.summary);
        }

        else if (section === 'education') {
            data.education.forEach(edu => {
                const school = edu.school || edu.institution || '';
                addAlignedRow(school, edu.dates || '', true);
                addAlignedRow(edu.degree || '', edu.location || '', false, true);

                if (edu.gpa) addBullet(`GPA: ${edu.gpa}`);
                if (edu.bullets) edu.bullets.forEach(b => addBullet(b));
                cursorY += DENSITY.itemGap;
            });
        }

        else if (section === 'skills') {
            if (Array.isArray(data.skills)) {
                addBullet(data.skills.join(", "));
            } else {
                for (const [cat, val] of Object.entries(data.skills)) {
                    // Bold category simulation: "Category: Value"
                    const bulletIndent = 14;
                    const catText = cat + ": ";

                    checkPageBreak(LEADING + 3);

                    // Bullet
                    doc.setFont(settings.font, 'normal');
                    doc.setFontSize(BODY);
                    doc.text(settings.bulletChar, MARGIN_SIDE + 5, cursorY);

                    // Bold Category
                    doc.setFont(settings.font, 'bold');
                    doc.text(catText, MARGIN_SIDE + bulletIndent, cursorY);

                    const catWidth = doc.getTextWidth(catText);

                    // Normal Value
                    doc.setFont(settings.font, 'normal');
                    const valStr = Array.isArray(val) ? val.join(', ') : String(val);
                    const maxWidth = CONTENT_WIDTH - bulletIndent - catWidth;
                    const lines = doc.splitTextToSize(valStr, maxWidth);

                    if (lines.length > 0) {
                        doc.text(lines[0], MARGIN_SIDE + bulletIndent + catWidth, cursorY);
                        if (lines.length > 1) {
                            cursorY += LEADING;
                            const remainLines = doc.splitTextToSize(lines.slice(1).join(' '), CONTENT_WIDTH - bulletIndent);
                            doc.text(remainLines, MARGIN_SIDE + bulletIndent, cursorY);
                            cursorY += (remainLines.length * LEADING);
                        } else {
                            cursorY += LEADING;
                        }
                    } else {
                        cursorY += LEADING;
                    }
                    cursorY += DENSITY.bulletGap;
                }
            }
            cursorY += DENSITY.itemGap;
        }

        else if (['experience', 'projects', 'leadership', 'volunteering'].includes(section)) {
            data[section].forEach(item => {
                let title = item.company || item.organization || item.name || '';
                let subtitle = item.role || item.title || '';

                addAlignedRow(title, item.dates || '', true);
                if (subtitle || item.location) {
                    addAlignedRow(subtitle, item.location || '', false, true);
                }

                if (item.bullets) {
                    item.bullets.forEach(b => addBullet(b));
                }
                cursorY += DENSITY.itemGap;
            });
        }

        else if (section === 'research') {
            data.research.forEach(res => {
                addAlignedRow(res.title || 'Paper', res.dates || '', true);
                if (res.conference) {
                    // Italic conference
                    checkPageBreak(LEADING);
                    doc.setFont(settings.font, 'italic');
                    doc.setFontSize(BODY);
                    doc.text(res.conference, MARGIN_SIDE, cursorY);
                    cursorY += LEADING;
                }
                if (res.link) {
                    checkPageBreak(LEADING);
                    doc.setFont(settings.font, 'normal');
                    doc.text(`Link: ${res.link}`, MARGIN_SIDE, cursorY);
                    cursorY += LEADING;
                }
                if (res.bullets) res.bullets.forEach(b => addBullet(b));
                cursorY += DENSITY.itemGap;
            });
        }

        else if (section === 'certifications' || section === 'awards') {
            data[section].forEach(item => {
                let main = item.name || '';
                let sub = item.issuer || item.organization || '';
                let text = sub ? `${main} (${sub})` : main;

                addAlignedRow(text, item.dates || '', true);
                cursorY += DENSITY.itemGap;
            });
        }

        else if (section === 'languages') {
            let val = data.languages;
            if (Array.isArray(val)) val = val.join(", ");
            addTextBlock(val);
        }
    });

    return doc.output('blob');
}
