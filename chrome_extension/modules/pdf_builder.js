
// Import jsPDF from global window object because it's loaded via script tag
const { jsPDF } = window.jspdf;

// --- CONFIGURATION ---
// Letter size: 8.5 x 11 inches. 1 inch = 72 points.
const PAGE_WIDTH = 612;  // 8.5 * 72
const PAGE_HEIGHT = 792; // 11 * 72
const MARGIN_SIDE = 30;
const CONTENT_WIDTH = PAGE_WIDTH - (2 * MARGIN_SIDE);
const MARGIN_TOP = 20;   // Reduced top margin to match python (10pt + buffer)
const MARGIN_BOTTOM = 20;

// Font configs (using built-in font "Times")
// NameHeader: 21pt, Bold, Centered
// ContactLine: 10pt, Normal, Centered
// SectionHeader: 12pt, Bold, Uppercase
// BoldEntry: 11pt, Bold
// ItalicEntry: 10pt, Italic
// BulletPoint: 10pt, Normal
// SummaryStyle: 10pt, Normal (Justified in python, Left here for simplicity/reliability)

export function generateResumePdf(data) {
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'letter'
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
        doc.setFont(options.font || 'times', options.style || 'normal');
        doc.setFontSize(options.size || 10);

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
    doc.setFont('times', 'bold');
    doc.setFontSize(21);
    const name = data.name || "Name";
    addText(name, 0, cursorY, { align: 'center', size: 21, font: 'times', style: 'bold' });
    cursorY += 25; // Leading

    // Contact
    doc.setFont('times', 'normal');
    doc.setFontSize(10);

    let contactStr = "";
    if (typeof data.contact === 'string') {
        contactStr = data.contact;
    } else if (data.contact) {
        const c = data.contact;
        const parts = [];
        if (c.location) parts.push(c.location);
        if (c.phone) parts.push(c.phone);
        if (c.email) parts.push(c.email);
        if (c.linkedin_url) parts.push("LinkedIn");
        if (c.portfolio_url) parts.push("Portfolio");
        contactStr = parts.join(" | ");
    }

    // Handle links explicitly? Ideally yes, but for now simple text matching python visual
    addText(contactStr, 0, cursorY, { align: 'center', size: 10 });
    cursorY += 14;

    // Links handling (simple overlay for now if needed, or advanced textWithLink)
    // We will skip actual clickable links logic for simplicity unless requested, 
    // python code had explicit link logic. jsPDF link implementation is coordinate based.
    // For now, text only to match visual.

    cursorY += 10; // Space after contact

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
        const size = isBold ? 11 : 10;
        const leading = isBold ? 13 : 12;

        checkPageBreak(leading);

        doc.setFont('times', style);
        doc.setFontSize(size);

        // Left text
        doc.text(String(leftText), MARGIN_SIDE, cursorY);

        // Right text
        if (rightText) {
            doc.text(String(rightText), PAGE_WIDTH - MARGIN_SIDE, cursorY, { align: 'right' });
        }

        cursorY += leading;
    }

    // Helper for bullets
    function addBullet(text) {
        // Strip HTML tags for clean text
        const cleanText = text.replace(/<[^>]+>/g, '');
        const bulletIndent = 14;
        const maxWidth = CONTENT_WIDTH - bulletIndent;

        doc.setFont('times', 'normal');
        doc.setFontSize(10);

        const lines = doc.splitTextToSize(cleanText, maxWidth);

        checkPageBreak(lines.length * 12 + 3);

        // Draw bullet
        doc.text("•", MARGIN_SIDE + 5, cursorY);

        // Draw indent text
        doc.text(lines, MARGIN_SIDE + bulletIndent, cursorY);

        cursorY += (lines.length * 12) + 2; // spacing
    }

    // Helper for Section Header
    function addSectionHeader(title) {
        checkPageBreak(30);
        cursorY += 5;
        doc.setFont('times', 'bold');
        doc.setFontSize(12);
        doc.text(title.toUpperCase(), MARGIN_SIDE, cursorY);
        cursorY += 4;
        doc.setLineWidth(0.5);
        doc.line(MARGIN_SIDE, cursorY, PAGE_WIDTH - MARGIN_SIDE, cursorY);
        cursorY += 14;
    }

    // Helper for Summary/Text Block
    function addTextBlock(text) {
        const cleanText = text.replace(/<[^>]+>/g, '');
        doc.setFont('times', 'normal');
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(cleanText, CONTENT_WIDTH);
        checkPageBreak(lines.length * 12);
        doc.text(lines, MARGIN_SIDE, cursorY);
        cursorY += (lines.length * 12) + 5;
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
                cursorY += 6;
            });
        }

        else if (section === 'skills') {
            if (Array.isArray(data.skills)) {
                addBullet(data.skills.join(", "));
            } else {
                for (const [cat, val] of Object.entries(data.skills)) {
                    // Bold category simulation: "Category: Value"
                    // jsPDF doesn't support mixed styles in one text call easily.
                    // We will just render "Category: Value" in normal for now to match simplicity
                    addBullet(`${cat}: ${val}`);
                }
            }
            cursorY += 6;
        }

        else if (['experience', 'projects', 'leadership', 'volunteering'].includes(section)) {
            data[section].forEach(item => {
                let title = item.company || item.organization || item.name || '';
                let subtitle = item.role || item.title || '';

                // For projects, name is main title
                // For experience, company is main title

                addAlignedRow(title, item.dates || '', true);
                if (subtitle || item.location) {
                    addAlignedRow(subtitle, item.location || '', false, true);
                }

                if (item.bullets) {
                    item.bullets.forEach(b => addBullet(b));
                }
                cursorY += 6;
            });
        }

        else if (section === 'research') {
            data.research.forEach(res => {
                addAlignedRow(res.title || 'Paper', res.dates || '', true);
                if (res.conference) {
                    // Italic conference
                    checkPageBreak(12);
                    doc.setFont('times', 'italic');
                    doc.setFontSize(10);
                    doc.text(res.conference, MARGIN_SIDE, cursorY);
                    cursorY += 12;
                }
                if (res.link) {
                    checkPageBreak(12);
                    doc.setFont('times', 'normal'); // Reset
                    doc.text(`Link: ${res.link}`, MARGIN_SIDE, cursorY);
                    cursorY += 12;
                }
                if (res.bullets) res.bullets.forEach(b => addBullet(b));
                cursorY += 6;
            });
        }

        else if (section === 'certifications' || section === 'awards') {
            data[section].forEach(item => {
                let main = item.name || '';
                let sub = item.issuer || item.organization || '';
                let text = sub ? `${main} (${sub})` : main;

                addAlignedRow(text, item.dates || '', true);
                cursorY += 6;
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
