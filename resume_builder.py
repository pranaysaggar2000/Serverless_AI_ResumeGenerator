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
            h_dates = get_real_paragraph_height(edu['dates'], styles['BoldEntry'], CONTENT_WIDTH * 0.25)
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
            h_dates = get_real_paragraph_height(exp['dates'], styles['BoldEntry'], CONTENT_WIDTH * 0.25)
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
    
    # The "JobRight" Bullet: Proper Hanging Indents
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
    """Generates the crisp 0.5pt line used in JobRight templates."""
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

    # 1. Header
    story.append(Paragraph(data['name'], styles['NameHeader']))
    story.append(Paragraph(data['contact'], styles['ContactLine']))

    # 2. Summary
    story.append(Paragraph("Summary", styles['SectionHeader']))
    story.append(create_hr_line())
    story.append(Spacer(1, 3))
    # Use SummaryStyle instead of BulletPoint to fix indentation issue
    story.append(Paragraph(data['summary'], styles['SummaryStyle']))
    story.append(Spacer(1, 2))

    # 3. Education
    story.append(Paragraph("Education", styles['SectionHeader']))
    story.append(create_hr_line())
    story.append(Spacer(1, 3))
    for edu in data['education']:
        story.append(create_aligned_row(edu['school'], edu['dates'], styles['BoldEntry']))
        story.append(create_aligned_row(edu['degree'], edu['location'], styles['ItalicEntry']))
        story.append(Paragraph(f"• {edu['gpa']}", styles['BulletPoint']))
        story.append(Spacer(1, 2))

    # 4. Technical Knowledge
    # Moved above Work Experience as requested
    story.append(Paragraph("Technical Knowledge", styles['SectionHeader']))
    story.append(create_hr_line())
    story.append(Spacer(1, 3))
    for category, skills in data['skills'].items():
        # Strip all HTML tags from skills to ensure they are NOT bold
        # Only the category should be bold
        clean_skills = remove_html_tags(skills)
        story.append(Paragraph(f"• <b>{category}:</b> {clean_skills}", styles['BulletPoint']))
    story.append(Spacer(1, 2))
    
    # 5. Work Experience
    story.append(Paragraph("Work Experience", styles['SectionHeader']))
    story.append(create_hr_line())
    story.append(Spacer(1, 1))
    for exp in data['experience']:
        story.append(create_aligned_row(exp['company'], exp['dates'], styles['BoldEntry']))
        story.append(create_aligned_row(exp['role'], exp['location'], styles['ItalicEntry']))
        for bullet in exp['bullets']:
            story.append(Paragraph(f"• {bullet}", styles['BulletPoint']))
        story.append(Spacer(1, 2))

    # 6. Research and Projects
    if 'projects' in data and data['projects']:
        story.append(Paragraph("Research and Projects", styles['SectionHeader']))
        story.append(create_hr_line())
        story.append(Spacer(1, 1))
        for proj in data['projects']:
            # Use create_aligned_row to show Name and Duration (if available)
            proj_name = proj.get('name', 'Project')
            proj_dates = proj.get('dates', '') # User requested dates on right
            
            story.append(create_aligned_row(proj_name, proj_dates, styles['BoldEntry']))
            
            for bullet in proj.get('bullets', []):
                story.append(Paragraph(f"• {bullet}", styles['BulletPoint']))
            story.append(Spacer(1, 2))

    # 7. Leadership Experience
    if 'leadership' in data and data['leadership']:
        story.append(Paragraph("Leadership Experience", styles['SectionHeader']))
        story.append(create_hr_line())
        story.append(Spacer(1, 1))
        for lead in data['leadership']:
            story.append(create_aligned_row(lead['organization'], lead['dates'], styles['BoldEntry']))
            story.append(create_aligned_row(lead['title'], lead['location'], styles['ItalicEntry']))
            for bullet in lead.get('bullets', []):
                story.append(Paragraph(f"• {bullet}", styles['BulletPoint']))
            story.append(Spacer(1, 2))

    doc.build(story)



# Adapter for compatibility with main.py
def create_resume_pdf(data, output_path_or_buffer):
    """
    Adapter to convert main.py's data structure to the new generate_resume format.
    Includes automatic height estimation and trimming to ensure single-page output.
    """
    # Import trimming functions from main
    from main import trim_projects_to_fit, trim_projects_further, trim_skills_to_fit
    
    new_data = data.copy()
    
    # 1. Adapt Contact (Dict -> String)
    if isinstance(data.get('contact'), dict):
        c = data['contact']
        
        # Create clickable links
        linkedin = c.get('linkedin_url')
        portfolio = c.get('portfolio_url')
        
        linkedin_str = f'<link href="{linkedin}" color="blue">LinkedIn</link>' if linkedin else None
        portfolio_str = f'<link href="{portfolio}" color="blue">Portfolio</link>' if portfolio else None
        
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
            if 'gpa' in item and not str(item['gpa']).startswith('GPA'):
                new_item['gpa'] = f"GPA: {item['gpa']}"
            new_edu.append(new_item)
        new_data['education'] = new_edu
        
    # 3. Adapt Experience (title -> role)
    if 'experience' in data:
        new_exp = []
        for item in data['experience']:
            new_item = item.copy()
            if 'title' in item:
                new_item['role'] = item['title']
            new_exp.append(new_item)
        new_data['experience'] = new_exp

    # 4. Initial trimming - start with 3 bullets per project (will trim further if needed)
    new_data = trim_projects_to_fit(new_data, max_bullets_initial=3)
    
    # 5. Trim skills to max 5 lines
    new_data = trim_skills_to_fit(new_data, max_lines=5)
    
    # 6. Iteratively trim until the resume fits on one page
    estimated_height = estimate_resume_height(new_data)
    print(f"   📏 Estimated height: {estimated_height:.0f}pt / {USABLE_HEIGHT:.0f}pt max")
    
    # Keep trimming until it fits (max 10 iterations to prevent infinite loop)
    iterations = 0
    while estimated_height > USABLE_HEIGHT and iterations < 10:
        overflow = estimated_height - USABLE_HEIGHT
        print(f"   ⚠️ Overflow by {overflow:.0f}pt - trimming projects (iteration {iterations + 1})...")
        
        # Trim at least 1 bullet per iteration
        new_data = trim_projects_further(new_data, max(int(overflow), 14))
        
        # Re-estimate after trimming
        estimated_height = estimate_resume_height(new_data)
        iterations += 1
    
    print(f"   📏 Final height: {estimated_height:.0f}pt")

    generate_resume(new_data, output_path_or_buffer)
    return output_path_or_buffer

