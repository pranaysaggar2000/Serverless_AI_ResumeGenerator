from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
import re

# --- CONFIGURATION ---
PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN_SIDE = 30  # Left/right margin (approx 0.4 inch)
CONTENT_WIDTH = PAGE_WIDTH - (2 * MARGIN_SIDE)

# Height constants
USABLE_HEIGHT = PAGE_HEIGHT - 20  # 772pt (792 - 10pt top - 10pt bottom)


def get_real_paragraph_height(text, style, width):
    """Calculates exact height of a paragraph based on font and width using ReportLab's renderer."""
    if not text:
        return 0
    p = Paragraph(str(text), style)
    # The wrap function returns (actual_width, actual_height)
    w, h = p.wrap(width, PAGE_HEIGHT)
    return h


def calculate_exact_resume_height(data: dict, styles: dict = None) -> float:
    """
    Calculates the EXACT height in points for the entire resume using ReportLab's rendering engine.
    This is pixel-perfect because it uses actual font metrics and text wrapping.
    
    USABLE_HEIGHT = 772pt (Single Page)
    """
    if styles is None:
        styles = get_styles()
    
    total_height = 0
    
    # Header: Name (leading=25, spaceAfter=2)
    total_height += get_real_paragraph_height(data.get('name', ''), styles['NameHeader'], CONTENT_WIDTH)
    total_height += 2  # NameHeader spaceAfter
    
    # Contact line (leading=12, spaceAfter=10)
    contact = data.get('contact', '')
    if isinstance(contact, dict):
        c = contact
        components = [c.get('location'), c.get('phone'), c.get('email'), 'LinkedIn', 'Portfolio']
        contact = " | ".join([comp for comp in components if comp])
    total_height += get_real_paragraph_height(contact, styles['ContactLine'], CONTENT_WIDTH)
    total_height += 10  # ContactLine spaceAfter
    
    # Summary section
    # SectionHeader: spaceBefore=2, leading=14, spaceAfter=2
    total_height += 2 + 14 + 2  # Section header
    total_height += 2   # HR line table
    total_height += 3   # Spacer(1, 3)
    total_height += get_real_paragraph_height(data.get('summary', ''), styles['SummaryStyle'], CONTENT_WIDTH)
    total_height += 2   # Spacer(1, 2)
    
    # Education section
    if 'education' in data and data['education']:
        total_height += 2 + 14 + 2 + 2 + 3  # Section header + HR + Spacer
        for edu in data['education']:
            # create_aligned_row for school/dates (BoldEntry)
            h_school = get_real_paragraph_height(edu['school'], styles['BoldEntry'], CONTENT_WIDTH * 0.75)
            h_dates = get_real_paragraph_height(edu.get('dates', ''), styles['BoldEntry'], CONTENT_WIDTH * 0.25)
            total_height += max(h_school, h_dates)
            
            # create_aligned_row for degree/location (ItalicEntry)
            h_degree = get_real_paragraph_height(edu['degree'], styles['ItalicEntry'], CONTENT_WIDTH * 0.75)
            h_loc = get_real_paragraph_height(edu['location'], styles['ItalicEntry'], CONTENT_WIDTH * 0.25)
            total_height += max(h_degree, h_loc)
            
            # GPA bullet (BulletPoint: spaceBefore=1.5, leading=12)
            gpa = edu.get('gpa', '')
            if gpa and not str(gpa).startswith('GPA'):
                gpa = f"GPA: {gpa}"
            total_height += 1.5  # BulletPoint spaceBefore
            total_height += get_real_paragraph_height(f"• {gpa}", styles['BulletPoint'], CONTENT_WIDTH)
            total_height += 2  # Spacer(1, 2)
    
    # Technical Knowledge (Skills)
    if 'skills' in data and data['skills']:
        total_height += 2 + 14 + 2 + 2 + 3  # Section header + HR + Spacer
        for category, skills_str in data['skills'].items():
            total_height += 1.5  # BulletPoint spaceBefore
            total_height += get_real_paragraph_height(f"• <b>{category}:</b> {skills_str}", styles['BulletPoint'], CONTENT_WIDTH)
        total_height += 2  # Spacer(1, 2)
    
    # Work Experience
    if 'experience' in data and data['experience']:
        total_height += 2 + 14 + 2 + 2 + 1  # Section header + HR + Spacer(1, 1)
        for exp in data['experience']:
            # BoldEntry (company)
            h_comp = get_real_paragraph_height(exp['company'], styles['BoldEntry'], CONTENT_WIDTH * 0.75)
            h_dates = get_real_paragraph_height(exp.get('dates', ''), styles['BoldEntry'], CONTENT_WIDTH * 0.25)
            total_height += max(h_comp, h_dates)
            
            # ItalicEntry (role)
            h_role = get_real_paragraph_height(exp['role'], styles['ItalicEntry'], CONTENT_WIDTH * 0.75)
            h_loc = get_real_paragraph_height(exp['location'], styles['ItalicEntry'], CONTENT_WIDTH * 0.25)
            total_height += max(h_role, h_loc)
            
            for bullet in exp.get('bullets', []):
                total_height += 1.5  # BulletPoint spaceBefore
                total_height += get_real_paragraph_height(f"• {bullet}", styles['BulletPoint'], CONTENT_WIDTH)
            total_height += 2  # Spacer(1, 2)
    
    # Projects
    if 'projects' in data and data['projects']:
        total_height += 2 + 14 + 2 + 2 + 1  # Section header + HR + Spacer
        for proj in data['projects']:
            # create_aligned_row for project name/dates
            h_name = get_real_paragraph_height(proj.get('name', ''), styles['BoldEntry'], CONTENT_WIDTH * 0.75)
            h_dates = get_real_paragraph_height(proj.get('dates', ''), styles['BoldEntry'], CONTENT_WIDTH * 0.25)
            total_height += max(h_name, h_dates)
            
            for bullet in proj.get('bullets', []):
                total_height += 1.5  # BulletPoint spaceBefore
                total_height += get_real_paragraph_height(f"• {bullet}", styles['BulletPoint'], CONTENT_WIDTH)
            total_height += 2  # Spacer(1, 2)
    
    # Leadership
    if 'leadership' in data and data['leadership']:
        total_height += 2 + 14 + 2 + 2 + 1  # Section header + HR + Spacer
        for lead in data['leadership']:
            h_role = get_real_paragraph_height(lead.get('role', ''), styles['BoldEntry'], CONTENT_WIDTH * 0.75)
            h_dates = get_real_paragraph_height(lead.get('dates', ''), styles['BoldEntry'], CONTENT_WIDTH * 0.25)
            total_height += max(h_role, h_dates)
            
            h_org = get_real_paragraph_height(lead.get('organization', ''), styles['ItalicEntry'], CONTENT_WIDTH * 0.75)
            h_loc = get_real_paragraph_height(lead.get('location', ''), styles['ItalicEntry'], CONTENT_WIDTH * 0.25)
            total_height += max(h_org, h_loc)
            
            for bullet in lead.get('bullets', []):
                total_height += 1.5  # BulletPoint spaceBefore
                total_height += get_real_paragraph_height(f"• {bullet}", styles['BulletPoint'], CONTENT_WIDTH)
            total_height += 2  # Spacer(1, 2)
    
    # Add 5% buffer for any remaining discrepancies
    return total_height * 1.05


# Legacy function for backward compatibility
def estimate_resume_height(data: dict) -> float:
    """Wrapper for calculate_exact_resume_height for backward compatibility."""
    return calculate_exact_resume_height(data)

def get_styles():
    styles = getSampleStyleSheet()
    
    # Header: Name
    styles.add(ParagraphStyle(
        name='NameHeader',
        fontName='Times-Bold',
        fontSize=21,
        alignment=TA_CENTER,
        leading=25,       # Adjusted leading
        spaceAfter=2
    ))
    
    # Header: Contact Info
    styles.add(ParagraphStyle(
        name='ContactLine',
        fontName='Times-Roman',
        fontSize=10,      # Body text size equivalent
        alignment=TA_CENTER,
        leading=12,
        spaceAfter=10
    ))
    
    # Section Header (Uppercase with a tight leading to the line)
    styles.add(ParagraphStyle(
        name='SectionHeader',
        fontName='Times-Bold',
        fontSize=12,
        alignment=TA_LEFT,
        spaceBefore=2,
        spaceAfter=2,
        textTransform='uppercase',
        leading=14        # Adjusted leading
    ))
    
    # Bold Entry (Company, University, or Project Name) - Sub-Headers
    styles.add(ParagraphStyle(
        name='BoldEntry',
        fontName='Times-Bold',
        fontSize=11,
        leading=13        # Adjusted leading
    ))

    # Italic Entry (Role or Location) - Body Text equivalent
    styles.add(ParagraphStyle(
        name='ItalicEntry',
        fontName='Times-Italic',
        fontSize=10,
        leading=12
    ))
    
    """Generates the crisp 0.5pt line used in templates."""
    styles.add(ParagraphStyle(
        name='BulletPoint',
        fontName='Times-Roman',
        fontSize=10,
        leftIndent=14,       # Text block indentation (moved left by 1pt)
        firstLineIndent=-9,   # Bullet position (14 + (-9) = 5, same as before)
        spaceBefore=1.5,
        leading=12,          # Professional tight line spacing
        alignment=TA_LEFT
    ))

    # Summary Text Style (Normal paragraph, no hanging indent)
    styles.add(ParagraphStyle(
        name='SummaryStyle',
        fontName='Times-Roman',
        fontSize=10,
        leading=12,
        alignment=TA_JUSTIFY,
        firstLineIndent=0,
        leftIndent=0,
        spaceAfter=1
    ))
    
    # New Style for Skill Entries to align with Company Names (Flush Left)
    # This ensures "Technical Knowledge" sub-items align with "Experience" sub-items
    styles.add(ParagraphStyle(
        name='SkillEntry',
        fontName='Times-Roman',
        fontSize=10,
        leading=12,
        alignment=TA_JUSTIFY,
        firstLineIndent=0,
        leftIndent=0,
        spaceAfter=1
    ))

    return styles

def remove_html_tags(text):
    """Remove HTML tags like <b> from text."""
    return re.sub(r'<[^>]+>', '', str(text))

def create_hr_line():
    """Generates the crisp 0.5pt line used in templates."""
    # Horizontal line using a table - no extra spacing
    # Set rowHeights to 2 to minimize vertical space
    line_table = Table([['']], colWidths=[CONTENT_WIDTH], rowHeights=[2])
    line_table.setStyle(TableStyle([
        ('LINEABOVE', (0, 0), (-1, 0), 0.5, colors.black),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    line_table.hAlign = 'LEFT'
    return line_table

def create_aligned_row(left_text, right_text, style_obj):
    """Aligns left and right content perfectly on the same baseline."""
    left_para = Paragraph(left_text, style_obj)
    right_para = Paragraph(f'<para align="right">{right_text}</para>', style_obj)
    
    t = Table([[left_para, right_para]], colWidths=[CONTENT_WIDTH * 0.75, CONTENT_WIDTH * 0.25])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    t.hAlign = 'LEFT'
    return t

def generate_resume(data, filename_or_buffer):
    # Use BaseDocTemplate for precise frame control (zero padding)
    doc = BaseDocTemplate(
        filename_or_buffer,
        pagesize=letter,
        leftMargin=MARGIN_SIDE,
        rightMargin=MARGIN_SIDE,
        topMargin=10, 
        bottomMargin=10
    )
    
    # Create a Frame with ZERO padding to ensure content touches the margins exactly
    frame_w = PAGE_WIDTH - 2 * MARGIN_SIDE
    frame_h = PAGE_HEIGHT - 20  # 792 - 10 - 10 = 772
    
    frame = Frame(
        x1=MARGIN_SIDE, 
        y1=10, 
        width=frame_w, 
        height=frame_h, 
        id='normal',
        showBoundary=0,
        leftPadding=0, 
        rightPadding=0, 
        topPadding=0, 
        bottomPadding=0
    )
    
    template = PageTemplate(id='resume', frames=[frame])
    doc.addPageTemplates([template])
    
    styles = get_styles()
    story = []

    # Default Titles
    titles = {
        "summary": "Summary",
        "education": "Education",
        "skills": "Technical Knowledge",
        "experience": "Work Experience",
        "projects": "Research and Projects",
        "research": "Research & Publications",
        "leadership": "Leadership Experience",
        "certifications": "Certifications",
        "awards": "Awards & Honors",
        "volunteering": "Volunteering",
        "languages": "Languages"
    }
    
    # Override with user preferences
    if 'section_titles' in data:
        titles.update(data['section_titles'])

    # 1. Header (Always first)
    story.append(Paragraph(data.get('name', 'Name'), styles['NameHeader']))
    story.append(Paragraph(data.get('contact', ''), styles['ContactLine']))

    # Default Section Order
    default_order = [
        "summary", 
        "education", 
        "skills", 
        "experience", 
        "projects", 
        "research", 
        "leadership",
        "certifications",
        "awards",
        "volunteering",
        "languages"
    ]
    
    section_order = data.get('section_order', default_order)

    # Render Sections
    for section in section_order:
        if section not in data or not data[section]:
            continue

        # Common Header for all sections
        story.append(Paragraph(titles.get(section, section.title()), styles['SectionHeader']))
        story.append(create_hr_line())
        
        # Section Specific Logic
        if section == "summary":
            story.append(Spacer(1, 3))
            story.append(Paragraph(data['summary'], styles['SummaryStyle']))
            story.append(Spacer(1, 2))

        elif section == "education":
            story.append(Spacer(1, 3))
            for edu in data['education']:
                school = edu.get('school', edu.get('institution', ''))
                story.append(create_aligned_row(school, edu.get('dates', ''), styles['BoldEntry']))
                story.append(create_aligned_row(edu.get('degree', ''), edu.get('location', ''), styles['ItalicEntry']))
                if edu.get('gpa'):
                     story.append(Paragraph(f"• {edu['gpa']}", styles['BulletPoint']))
                for bullet in edu.get('bullets', []):
                    story.append(Paragraph(f"• {bullet}", styles['BulletPoint']))
                story.append(Spacer(1, 2))

        elif section == "skills":
            story.append(Spacer(1, 3))
            if isinstance(data['skills'], dict):
                for category, skills in data['skills'].items():
                    clean_skills = remove_html_tags(skills)
                    story.append(Paragraph(f"• <b>{category}:</b> {clean_skills}", styles['BulletPoint']))
            elif isinstance(data['skills'], list):
                 # Fallback for flat list of skills
                 skills_str = ", ".join(data['skills'])
                 story.append(Paragraph(f"• {skills_str}", styles['BulletPoint']))
            story.append(Spacer(1, 2))

        elif section == "experience":
            story.append(Spacer(1, 1))
            for exp in data['experience']:
                story.append(create_aligned_row(exp.get('company', ''), exp.get('dates', ''), styles['BoldEntry']))
                story.append(create_aligned_row(exp.get('role', ''), exp.get('location', ''), styles['ItalicEntry']))
                for bullet in exp.get('bullets', []):
                    story.append(Paragraph(f"• {bullet}", styles['BulletPoint']))
                story.append(Spacer(1, 2))

        elif section == "projects":
            story.append(Spacer(1, 1))
            for proj in data['projects']:
                proj_name = proj.get('name', 'Project')
                proj_dates = proj.get('dates', '')
                story.append(create_aligned_row(proj_name, proj_dates, styles['BoldEntry']))
                for bullet in proj.get('bullets', []):
                    story.append(Paragraph(f"• {bullet}", styles['BulletPoint']))
                story.append(Spacer(1, 2))

        elif section == "research":
            story.append(Spacer(1, 1))
            for res in data['research']:
                story.append(create_aligned_row(res.get('title', 'Paper'), res.get('dates', ''), styles['BoldEntry']))
                conf = res.get('conference', '')
                if conf:
                    story.append(Paragraph(f"<i>{conf}</i>", styles['ItalicEntry']))
                if res.get('link'):
                    story.append(Paragraph(f"Link: {res['link']}", styles['ItalicEntry']))
                for bullet in res.get('bullets', []):
                    story.append(Paragraph(f"• {bullet}", styles['BulletPoint']))
                story.append(Spacer(1, 2))

        elif section == "leadership":
            story.append(Spacer(1, 1))
            for lead in data['leadership']:
                story.append(create_aligned_row(lead.get('organization', ''), lead.get('dates', ''), styles['BoldEntry']))
                lead_role = lead.get('role', lead.get('title', ''))
                story.append(create_aligned_row(lead_role, lead.get('location', ''), styles['ItalicEntry']))
                for bullet in lead.get('bullets', []):
                    story.append(Paragraph(f"• {bullet}", styles['BulletPoint']))
                story.append(Spacer(1, 2))

        elif section == "certifications":
            story.append(Spacer(1, 1))
            for cert in data['certifications']:
                # Name (Issuer) | Dates
                name = cert.get('name', 'Certification')
                issuer = cert.get('issuer', '')
                text = f"{name} ({issuer})" if issuer else name
                story.append(create_aligned_row(text, cert.get('dates', ''), styles['BoldEntry']))
                story.append(Spacer(1, 2))

        elif section == "awards":
            story.append(Spacer(1, 1))
            for award in data['awards']:
                name = award.get('name', 'Award')
                org = award.get('organization', '')
                text = f"{name} - {org}" if org else name
                story.append(create_aligned_row(text, award.get('dates', ''), styles['BoldEntry']))
                story.append(Spacer(1, 2))

        elif section == "volunteering":
             story.append(Spacer(1, 1))
             for vol in data['volunteering']:
                story.append(create_aligned_row(vol.get('organization', ''), vol.get('dates', ''), styles['BoldEntry']))
                story.append(create_aligned_row(vol.get('role', ''), vol.get('location', ''), styles['ItalicEntry']))
                for bullet in vol.get('bullets', []):
                    story.append(Paragraph(f"• {bullet}", styles['BulletPoint']))
                story.append(Spacer(1, 2))

        elif section == "languages":
            story.append(Spacer(1, 1))
            val = data['languages']
            if isinstance(val, list):
                val = ", ".join(val)
            story.append(Paragraph(str(val), styles['SummaryStyle']))
            story.append(Spacer(1, 2))

    doc.build(story)



# Adapter for compatibility with main.py
def create_resume_pdf(data, output_path_or_buffer):
    """
    Adapter to convert main.py's data structure to the new generate_resume format.
    
    NOTE: Automatic trimming has been disabled. Resume is generated with data as provided.
    Users control bullet counts manually through the editor.
    """
    new_data = data.copy()
    
    # 1. Adapt Contact (Dict -> String)
    if isinstance(data.get('contact'), dict):
        c = data['contact']
        
        # Create clickable links
        linkedin = c.get('linkedin_url')
        portfolio = c.get('portfolio_url')
        
        linkedin_str = f'<link href="{linkedin}">LinkedIn</link>' if linkedin else None
        portfolio_str = f'<link href="{portfolio}">Portfolio</link>' if portfolio else None
        
        components = [
            c.get('location'),
            c.get('phone'),
            c.get('email'),
            linkedin_str,
            portfolio_str
        ]
        new_data['contact'] = " | ".join([comp for comp in components if comp])
        
    # 2. Adapt Education (institution -> school)
    if 'education' in data:
        new_edu = []
        for item in data['education']:
            new_item = item.copy()
            if 'institution' in item:
                new_item['school'] = item['institution']
            new_edu.append(new_item)
        new_data['education'] = new_edu
        
    # 3. Adapt Experience (ensure role field exists)
    if 'experience' in data:
        new_exp = []
        for item in data['experience']:
            new_item = item.copy()
            # Ensure 'role' field exists with robust fallback
            if 'role' not in new_item:
                for key in ['title', 'position', 'job_title', 'designation']:
                    if key in item:
                        new_item['role'] = item[key]
                        break
            
            if 'role' not in new_item:
                new_item['role'] = ''  # Fallback to empty string if absolutely nothing found
            new_exp.append(new_item)
        new_data['experience'] = new_exp

    # Generate PDF with data as-is (no automatic trimming)
    generate_resume(new_data, output_path_or_buffer)
    return output_path_or_buffer
