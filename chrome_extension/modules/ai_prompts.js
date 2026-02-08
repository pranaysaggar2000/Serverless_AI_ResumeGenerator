
export function buildExtractJDFromPagePrompt(rawPageText) {
    // Truncate to avoid token limits — first 12000 chars is usually enough
    const truncated = rawPageText.substring(0, 12000);

    return `
You are extracting a job description from raw webpage text. The text contains navigation menus, headers, footers, ads, and other noise mixed with the actual job posting.

RAW PAGE TEXT:
${truncated}

TASK: Extract ONLY the job description content. Return a JSON object with:

{
    "job_title": "Exact job title",
    "company_name": "Company name",
    "location": "Job location(s)",
    "job_description": "The full job description text — include responsibilities, requirements, qualifications, and any other relevant content. Exclude navigation, cookie notices, footer links, and unrelated content.",
    "company_description": "2-3 sentences about the company if mentioned on the page (what they do, their industry, size, mission). If not found, use empty string.",
    "salary_range": "Salary range if mentioned, otherwise empty string",
    "job_type": "Full-time/Part-time/Contract/Remote if mentioned"
}

RULES:
- Extract the COMPLETE job description — don't summarize or shorten it
- Include ALL bullet points for responsibilities, requirements, qualifications
- Preserve the original wording exactly
- company_description should capture what the company DOES, not just the name
- If you can't find a job description in the text, return {"error": "No job description found on this page"}
- Return ONLY valid JSON. No markdown, no explanation.
`;
}

export function buildParseJobDescriptionPrompt(jdText) {
    return `
Analyze this job description and extract structured information. Return ONLY valid JSON.

JOB DESCRIPTION:
${jdText}

EXTRACTION RULES:
1. MANDATORY vs PREFERRED: If the JD says "required", "must have", "X+ years", those are mandatory. If it says "nice to have", "preferred", "bonus", "ideally", those are preferred.
2. KEYWORDS: Extract the EXACT terms used in the JD, not synonyms. If they say "React", don't write "React.js". If they say "AWS", don't write "Amazon Web Services".
3. Be EXHAUSTIVE with keywords — missing even one could cost the candidate an ATS pass.
4. ACTION VERBS: Extract verbs from the responsibilities section that indicate what the person will DO in this role.
5. TECH STACK: Be specific — "PostgreSQL" not "databases", "Kubernetes" not "container orchestration", "pandas" not "Python libraries".
6. METRICS EMPHASIS: What scale/impact does this role involve? (millions of users, billions of records, $XM revenue)
7. COMPANY CONTEXT: Extract what the company actually does — industry, products, scale, mission. This helps tailor the resume's summary to show domain fit.

RETURN THIS JSON:
{
    "company_name": "Exact company name from the posting",
    "job_title": "Exact job title",
    "job_identifier": "Job ID if found (e.g. R12345), otherwise role_name_in_snake_case",
    "location": "Primary location (City, State) or Remote",
    "seniority": "junior/mid/senior/staff/principal/lead/manager — infer from title and requirements",
    "years_experience": "number or range, or 'not specified'",
    "mandatory_keywords": ["ONLY skills explicitly marked as required — be thorough"],
    "preferred_keywords": ["Skills marked nice-to-have or preferred"],
    "soft_skills": ["communication", "leadership", "etc — only if explicitly mentioned"],
    "action_verbs": ["design", "build", "lead", "optimize", "etc — from responsibilities"],
    "industry_terms": ["domain-specific business language used in the JD"],
    "tech_stack_nuances": ["specific versions, sub-tools, libraries — be granular"],
    "key_metrics_emphasis": ["scale indicators: millions of users, low latency, revenue growth, etc"],
    "domain_context": "Industry/sector (e.g. Fintech, Healthcare, AdTech)",
    "team_context": "What team/org this role is in, who they report to, team size if mentioned",
    "company_description": "2-3 sentences about what the company does, their industry, mission, and scale if mentioned in the JD",
    "role_summary": "2-3 sentence summary of what this person will actually DO day-to-day"
}

CRITICAL: Return ONLY valid JSON. No markdown blocks, no explanation text.
`;
}

export function buildTailorPrompt(baseResume, jdAnalysis, tailoringStrategy, bulletCounts) {
    let strategyNote = "";
    if (tailoringStrategy === "profile_focus") {
        strategyNote = `
=== STRATEGY: PROFILE FOCUS (Target ATS: 75-85%) ===
- PRESERVE original bullet wording unless grammatically incorrect
- KEEP all original metrics and phrasing exactly
- DO NOT add keywords that weren't in the original
- Skills: Reorder by JD relevance only, do not add new skills
- Summary: Lightly adjust to mention the target role title
- Experience bullets: Change NOTHING except typos
`;
    } else if (tailoringStrategy === "jd_focus") {
        strategyNote = `
=== STRATEGY: JD FOCUS (Target ATS: 90-95%) ===
GOAL: Every mandatory keyword must appear in CONTEXT (not just listed) across multiple sections.

KEYWORD PLACEMENT RULES — YOU MUST FOLLOW ALL OF THESE:

1. SUMMARY (must contain at least 5 mandatory keywords):
   - Rewrite summary to naturally include: the job title, top technical skills, domain terms
   - Example: "AI Engineer with 2+ years designing Agentic AI agents using Langchain, CrewAi, and MCP on AWS and Azure cloud infrastructure"

2. SKILLS SECTION:
   - Include EVERY mandatory and preferred keyword
   - Rename categories to match JD language (e.g., JD says "Agentic AI frameworks" → use that as category name)
   - Put JD keywords first within each category

3. EXPERIENCE BULLETS — THIS IS THE MOST IMPORTANT:
   - Each bullet must contain at least 1-2 JD keywords used in CONTEXT
   - "Deployed containerized apps on Kubernetes" → "Deployed containerized AI agents on Kubernetes clusters on AWS, ensuring high availability and cross-domain scalability"
   - "Conducted CI/CD automation using Jenkins" → "Led CI/CD pipeline automation using Jenkins and Docker for AI model deployment, reducing integration time by 30%"
   - If a keyword exists in skills but NOT in any bullet, you MUST add it to the most relevant bullet
   - Specifically integrate these JD terms into bullets where relevant:
     * Cloud platforms: AWS, Azure, Google Cloud — mention by name in deployment bullets
     * Frameworks: Langchain, CrewAi, MCP, A2A — mention in AI development bullets
     * Languages: Python, Java, C++ — mention in technical implementation bullets
     * Concepts: "AI agents", "cross-domain", "scalable", "actionable insights", "observability"
     * Action verbs from JD: "prototyping", "iterating", "deploy", "monitor", "optimize", "collaborate"

4. PROJECTS SECTION:
   - Rewrite project descriptions to use JD terminology
   - "Designed an Agentic AI system" → "Prototyped and iterated on a domain-specific Agentic AI agent system using Langchain and CrewAi that performs intelligent information gathering and insight generation"

5. VERIFICATION BEFORE OUTPUT:
   Before returning the JSON, mentally verify:
   □ Every mandatory keyword appears in at least 2 sections (skills + bullet OR summary + bullet)
   □ The summary contains at least 5 JD keywords
   □ At least 60% of experience bullets contain a JD keyword
   □ Cloud platform names (AWS/Azure/GCP) appear in at least 2 bullets
   □ Framework names (Langchain/CrewAi/MCP) appear in at least 2 bullets
   □ Action verbs from the JD are used as bullet starters
   If any check fails, revise the output before returning.
`;
    } else {
        strategyNote = `
=== STRATEGY: BALANCED (Target ATS: 85-90%) ===
KEYWORD PLACEMENT RULES:
1. Summary: Include 3-4 top mandatory keywords naturally
2. Skills: Add missing JD keywords to appropriate categories
3. Experience bullets: Integrate JD terminology where it fits naturally — aim for at least 1 JD keyword per bullet
4. Don't force keywords where they sound unnatural
5. Preserve all original metrics and core meaning
`;
    }

    let bulletInstructions = "";
    if (bulletCounts) {
        bulletInstructions = `
BULLET COUNT LIMITS (MANDATORY):
${JSON.stringify(bulletCounts, null, 2)}
If a count is 0, REMOVE that item entirely. Select the most JD-relevant bullets when cutting.
`;
    }

    // Build explicit keyword checklist for the AI
    const mandatoryList = (jdAnalysis.mandatory_keywords || []);
    const preferredList = (jdAnalysis.preferred_keywords || []);
    const actionVerbs = (jdAnalysis.action_verbs || []);

    const keywordChecklist = `
=== KEYWORD CHECKLIST ===
You MUST place each of these mandatory keywords in at least ONE bullet point (not just skills):
${mandatoryList.map((k, i) => `  ${i + 1}. "${k}" → find a bullet where this fits naturally and ADD it`).join('\n')}

Preferred keywords to include where possible:
${preferredList.map(k => `  - "${k}"`).join('\n')}

Use these action verbs from the JD to START bullets:
${actionVerbs.map(v => `  - "${v}"`).join('\n')}
`;

    return `
You are an expert ATS Resume Optimizer. Rewrite this resume to maximize keyword matching for the target job.

=== TARGET JOB ===
Company: ${jdAnalysis.company_name || 'Unknown'}
Role: ${jdAnalysis.job_title || 'Unknown'}
Seniority: ${jdAnalysis.seniority || 'Unknown'}
Domain: ${jdAnalysis.domain_context || 'Unknown'}

${jdAnalysis.company_description ? `
Company Context: ${jdAnalysis.company_description}
` : ''}

Must-have keywords: ${mandatoryList.join(', ')}
Nice-to-have keywords: ${preferredList.join(', ')}
Action verbs: ${actionVerbs.join(', ')}
Tech specifics: ${(jdAnalysis.tech_stack_nuances || []).join(', ')}
Industry terms: ${(jdAnalysis.industry_terms || []).join(', ')}

=== CANDIDATE RESUME ===
${JSON.stringify(baseResume, null, 2)}

${strategyNote}

${keywordChecklist}

${bulletInstructions}

=== REWRITING RULES ===

SUMMARY:
- 2-3 sentences positioning candidate for THIS role
- Must include: job title, years of experience, top 5 keywords, best metric
- Example structure: "[Role] with [X]+ years of experience [doing what] using [keyword1], [keyword2], and [keyword3]. Proven track record of [achievement with metric] while [keyword4] on [keyword5]."

BULLET POINTS:
- Start with a STRONG ACTION VERB (prefer JD's action_verbs)
- XYZ formula: "Accomplished [X] measured by [Y], by doing [Z]"
- PRESERVE all original metrics exactly (don't inflate)
- Each bullet MUST be under 200 characters
- Replace generic terms with JD-specific terms:
  * "cloud" → the specific cloud from JD (AWS/Azure/GCP)
  * "framework" → the specific framework (Langchain/CrewAi)
  * "built" → JD verb ("prototyped", "designed", "deployed")

SKILLS:
- Rename categories to match JD language where possible
- Put JD keywords first within each category
- Add missing JD keywords to the appropriate category

=== WHAT NOT TO DO ===
- Do NOT hallucinate new companies, roles, or metrics
- Do NOT change dates, company names, school names, or locations
- Do NOT inflate metrics (10% stays 10%)
- Do NOT use em dashes, "spearheaded initiatives", "drove innovation", "leveraged synergies"

=== OUTPUT ===
Return ONLY valid JSON:
{
    "name": "...",
    "contact": { "location": "...", "phone": "...", "email": "...", "linkedin_url": "...", "portfolio_url": "..." },
    "summary": "...",
    "education": [{ "institution": "...", "degree": "...", "gpa": "...", "dates": "...", "location": "...", "bullets": [] }],
    "skills": { "Category": "skill1, skill2" },
    "experience": [{ "company": "...", "role": "...", "dates": "...", "location": "...", "bullets": ["..."] }],
    "projects": [{ "name": "...", "tech": "...", "dates": "...", "bullets": ["..."] }],
    "leadership": [{ "organization": "...", "role": "...", "dates": "...", "location": "...", "bullets": ["..."] }],
    "research": [{ "title": "...", "conference": "...", "dates": "...", "link": "...", "bullets": ["..."] }],
    "certifications": [{ "name": "...", "issuer": "...", "dates": "..." }],
    "awards": [{ "name": "...", "organization": "...", "dates": "..." }],
    "volunteering": [{ "organization": "...", "role": "...", "dates": "...", "location": "...", "bullets": [] }],
    "languages": "...",
    "section_order": [${(baseResume.section_order || ["summary", "skills", "experience", "projects", "education"]).map(s => `"${s}"`).join(', ')}]
}

No markdown code blocks. No text before or after. Verify all brackets match.
`;
}

export function buildAnalysisPrompt(resumeData, jdText) {
    // Flatten resume into readable text for better keyword matching
    const flatResume = flattenResumeForAnalysis(resumeData);

    return `
You are an ATS (Applicant Tracking System) scoring engine. Analyze this resume against the job description.

JOB DESCRIPTION:
${jdText}

RESUME CONTENT (flattened text):
${flatResume}

SCORING METHODOLOGY (follow this exactly):
1. Extract ALL technical keywords from the JD (tools, languages, frameworks, methodologies, certifications)
2. For each keyword, check WHERE it appears in the resume:
   - In skills section only: 0.7 points
   - In summary: +0.5 points
   - In at least one bullet point with context: +0.7 points
   - In a role title or project name: +0.4 points
   Maximum per keyword: 2.3 points
3. Score = (total_keyword_points / max_possible_points) * 70 + (soft_skill_match * 12) + (experience_relevance * 18)
4. A keyword that appears ONLY in skills without any contextual usage in bullets should be flagged as "weak match"
5. Be BALANCED. Well-matched resumes can score 85-95. Good matches score 70-84. Only severely mismatched resumes score below 50.
6. missing_keywords should ONLY list keywords that are completely absent from the resume — not ones that are present but weak
7. Add a "weak_keywords" field for keywords that exist only in skills but not in context

SCORING GUIDANCE:
- 90-95: Exceptional match — nearly all keywords present in context, strong experience alignment, excellent summary
- 85-89: Excellent match — most keywords in context, good experience fit, well-tailored
- 75-84: Strong match — majority of keywords present, relevant experience, some optimization possible
- 65-74: Good match — decent keyword coverage, experience is relevant, needs refinement
- 55-64: Fair match — some keywords missing, experience somewhat relevant, needs work
- Below 55: Weak match — many missing keywords or misaligned experience

ANALYSIS RULES:
- missing_keywords: List keywords that appear in the JD but NOT in the resume. Be specific — list actual terms, not categories.
- matching_areas: List 3-5 specific strengths where the resume strongly matches (e.g., "3+ years Python experience matches requirement", not just "Python")
- recommendations: Give 3 specific, actionable improvements (e.g., "Add 'Kubernetes' to a deployment bullet — mentioned 4 times in JD")
- summary_feedback: One constructive paragraph about overall fit, mentioning both strengths and the biggest opportunity for improvement

RETURN ONLY THIS JSON:
{
    "score": 87,
    "missing_keywords": ["keyword completely absent from resume"],
    "weak_keywords": ["keyword in skills but not used in any bullet - needs contextual placement"],
    "matching_areas": ["Specific strength descriptions"],
    "recommendations": ["Specific actionable improvements"],
    "summary_feedback": "Constructive assessment paragraph highlighting both strengths and areas for improvement"
}

CRITICAL: Return ONLY valid JSON. No markdown. Be fair with the score — excellent matches should score 85-95, good matches 70-84.
`;
}

export function buildQuestionPrompt(question, resumeData, jdText) {
    return `
You are helping a job applicant write an answer for an application form field.

ROLE: ${resumeData.name || 'Applicant'} applying for a position
JOB CONTEXT: ${jdText ? jdText.substring(0, 1000) : 'Not provided'}

APPLICANT'S BACKGROUND:
- Skills: ${resumeData.skills ? JSON.stringify(resumeData.skills) : 'Not specified'}
- Recent role: ${resumeData.experience?.[0]?.role || 'Not specified'} at ${resumeData.experience?.[0]?.company || 'Not specified'}
- Key achievements: ${resumeData.experience?.[0]?.bullets?.slice(0, 2).join('; ') || 'Not specified'}
- Education: ${resumeData.education?.[0]?.degree || ''} from ${resumeData.education?.[0]?.institution || ''}

QUESTION: "${question}"

ANSWER RULES:
- Write in FIRST PERSON ("I have...", "In my role at...")
- Keep it 2-4 sentences unless the question clearly asks for more detail
- Reference SPECIFIC experiences, projects, or skills from the resume — not generic statements
- If it's a "why this company" question, connect your skills to what the company does
- If it's a behavioral question (tell me about a time...), use the STAR format briefly: Situation → Action → Result
- If it's a salary/compensation question, respond with "I'm open to discussing compensation that reflects the role's responsibilities and my experience."
- If asked about weaknesses/challenges, be honest but frame it as growth
- Match the formality of the question (casual question = casual answer)
- NO em dashes, NO "passionate about", NO "leverage", NO "utilize", NO "I am excited to"
- Use natural, conversational language a real human would write
- Ready to copy-paste directly — no quotes, no "Answer:" prefix

Write the answer now:
`;
}

export function buildExtractProfilePrompt(resumeText) {
    return `
You are an expert resume parser. Extract structured data from this resume text.

The text may come from a PDF and could be jumbled (columns merged, headers mixed with content). Use context clues to separate sections correctly.

RESUME TEXT:
${resumeText}

EXTRACTION RULES:
1. NAMES: The full name is usually the first prominent text. Do not confuse it with company names or section headers.
2. CONTACT: Look for email patterns, phone patterns (xxx-xxx-xxxx), city/state patterns, URLs. Also check for "[Extracted Link: ...]" patterns for LinkedIn/portfolio URLs.
3. SECTIONS: Match content to the closest section even if headers are non-standard:
   - "Professional Experience" / "Work History" / "Employment" → experience
   - "Academic Background" / "Schooling" → education
   - "Technical Proficiencies" / "Core Competencies" / "Tech Stack" → skills
   - "Selected Projects" / "Key Projects" → projects
   - "Activities" / "Extracurriculars" → leadership
   - "Publications" / "Papers" → research
4. BULLETS: Each bullet is a separate accomplishment. If text runs together, split at sentence boundaries or where a new action verb starts.
5. DATES: Normalize to "Mon YYYY - Mon YYYY" or "Mon YYYY - Present" format when possible. Keep original if ambiguous.
6. SKILLS: Group into categories. If the resume has categories, keep them. If skills are a flat list, group by type (Languages, Frameworks, Tools, Cloud, Databases, etc).
7. METRICS: Preserve ALL numbers, percentages, dollar amounts, and quantified results exactly as written.
8. ORDER: Set section_order based on how sections appear in the original resume (top to bottom).

RETURN ONLY THIS JSON STRUCTURE:
{
    "name": "Full Name",
    "contact": {
        "location": "City, State",
        "phone": "Phone",
        "email": "Email",
        "linkedin_url": "LinkedIn URL or empty string",
        "portfolio_url": "Portfolio URL or empty string"
    },
    "summary": "Professional summary paragraph, or empty string if none exists",
    "education": [
        {
            "institution": "University Name",
            "degree": "Full Degree (e.g. Bachelor of Science in Computer Science)",
            "gpa": "GPA if listed, otherwise empty string",
            "dates": "Start - End",
            "location": "City, State",
            "bullets": ["Relevant coursework, honors, activities if listed"]
        }
    ],
    "skills": {
        "Category Name": "Skill1, Skill2, Skill3"
    },
    "experience": [
        {
            "company": "Company Name",
            "role": "Exact Job Title",
            "dates": "Start - End",
            "location": "City, State",
            "bullets": ["Each bullet preserved exactly as written with all metrics"]
        }
    ],
    "projects": [
        {
            "name": "Project Name",
            "tech": "Technologies used if mentioned",
            "dates": "Date Range",
            "bullets": ["Description bullets"]
        }
    ],
    "leadership": [
        {
            "organization": "Org Name",
            "role": "Role",
            "dates": "Date Range",
            "location": "City, State",
            "bullets": ["Description"]
        }
    ],
    "research": [
        {
            "title": "Paper/Research Title",
            "conference": "Conference or Journal",
            "dates": "Date",
            "link": "URL if available",
            "bullets": ["Description"]
        }
    ],
    "certifications": [{ "name": "Name", "issuer": "Issuer", "dates": "Date" }],
    "awards": [{ "name": "Name", "organization": "Org", "dates": "Date" }],
    "volunteering": [{ "organization": "Org", "role": "Role", "dates": "Dates", "location": "Location", "bullets": [] }],
    "languages": "Language1, Language2",
    "section_order": ["summary", "education", "skills", "experience", "projects"]
}

CRITICAL:
- Return ONLY valid JSON. No markdown, no explanation, no preamble.
- section_order must list sections IN THE ORDER they appear in the original resume.
- Only include sections that have actual content. Do not create empty sections.
- Preserve the exact wording of bullet points — do NOT rephrase or summarize.
- Do NOT invent any information not present in the text.
`;
}

// --- Helpers ---

export function convert_markdown_to_html(text) {
    if (!text) return text;
    // Convert **text** to <b>text</b>
    text = text.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    // Also handle any stray single asterisks
    text = text.replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>');
    return text;
}

export function clean_tailored_resume(resume_data) {
    // Clean summary
    if (resume_data.summary) {
        resume_data.summary = convert_markdown_to_html(resume_data.summary);
    }

    // Clean skills
    if (resume_data.skills) {
        for (const category in resume_data.skills) {
            let val = resume_data.skills[category];
            if (Array.isArray(val)) {
                val = val.join(", ");
            }
            resume_data.skills[category] = convert_markdown_to_html(String(val));
        }
    }

    // Clean bullets.
    const sections = ['experience', 'projects', 'leadership', 'research', 'volunteering'];
    sections.forEach(sec => {
        if (resume_data[sec]) {
            resume_data[sec].forEach(item => {
                if (item.bullets) {
                    item.bullets = item.bullets.map(b => convert_markdown_to_html(b));
                }
            });
        }
    });

    // Ensure section_order exists
    if (!resume_data.section_order) {
        const defaultOrder = ["summary", "skills", "experience", "projects", "education", "leadership", "research", "certifications", "awards", "volunteering", "languages"];
        resume_data.section_order = defaultOrder.filter(s => {
            const val = resume_data[s];
            if (!val) return false;
            if (Array.isArray(val)) return val.length > 0;
            if (typeof val === 'string') return val.trim().length > 0;
            if (typeof val === 'object') return Object.keys(val).length > 0;
            return false;
        });
    }

    if (!resume_data.section_titles) {
        resume_data.section_titles = {};
    }

    return resume_data;
}

function find_best_match(gen_item, pool) {
    let best_match = null;
    let max_score = 0;

    const gen_company = (gen_item.company || gen_item.organization || "").toLowerCase().trim();
    const gen_role = (gen_item.role || gen_item.title || "").toLowerCase().trim();
    const gen_name = (gen_item.name || gen_item.title || "").toLowerCase().trim();

    for (const orig_item of pool) {
        let score = 0;
        const orig_company = (orig_item.company || orig_item.organization || orig_item.conference || "").toLowerCase().trim();
        const orig_role = (orig_item.role || orig_item.title || "").toLowerCase().trim();
        const orig_name = (orig_item.name || orig_item.title || "").toLowerCase().trim();

        // Company Match
        if (gen_company && orig_company && gen_company === orig_company) score += 3;
        else if (gen_company && orig_company && (gen_company.includes(orig_company) || orig_company.includes(gen_company))) score += 1;

        // Role Match
        if (gen_role && orig_role && gen_role === orig_role) score += 2;
        else if (gen_role && orig_role && (gen_role.includes(orig_role) || orig_role.includes(gen_role))) score += 1;

        // Name Match
        if (gen_name && orig_name && gen_name === orig_name) score += 5;
        else if (gen_name && orig_name && (gen_name.includes(orig_name) || orig_name.includes(gen_name))) score += 2;

        if (score > max_score && score >= 2) {
            max_score = score;
            best_match = orig_item;
        }
    }
    return best_match;
}

export function restore_immutable_fields(original_data, generated_data) {
    const pool = [];
    if (original_data.experience) pool.push(...original_data.experience);
    if (original_data.leadership) pool.push(...original_data.leadership);
    if (original_data.projects) pool.push(...original_data.projects);
    if (original_data.research) pool.push(...original_data.research);
    if (original_data.certifications) pool.push(...original_data.certifications);
    if (original_data.awards) pool.push(...original_data.awards);
    if (original_data.volunteering) pool.push(...original_data.volunteering);

    const restore_section = (section_name, fields_to_restore) => {
        if (generated_data[section_name]) {
            generated_data[section_name].forEach(gen_item => {
                const match = find_best_match(gen_item, pool);
                if (match) {
                    fields_to_restore.forEach(field => {
                        if (match[field]) gen_item[field] = match[field];
                    });
                }
            });
        }
    };

    restore_section('experience', ['role', 'company', 'duration', 'dates', 'location']);
    restore_section('projects', ['name', 'link', 'dates']);
    restore_section('leadership', ['role', 'organization', 'duration', 'dates', 'location']);
    restore_section('research', ['title', 'conference', 'dates', 'link']);
    restore_section('certifications', ['name', 'issuer', 'dates']);
    restore_section('awards', ['name', 'organization', 'dates']);
    restore_section('volunteering', ['role', 'organization', 'dates', 'location']);

    // Preserve section_order from original
    if (original_data.section_order) {
        generated_data.section_order = original_data.section_order;
    }

    // Preserve section_titles from original
    if (original_data.section_titles) {
        generated_data.section_titles = { ...original_data.section_titles, ...(generated_data.section_titles || {}) };
    }

    return generated_data;
}

export function enforce_bullet_limits(resume_data, bullet_counts) {
    if (!bullet_counts) return resume_data;

    ['experience', 'projects', 'leadership'].forEach(section => {
        if (bullet_counts[section] && resume_data[section]) {
            const counts = bullet_counts[section];
            resume_data[section].forEach((item, i) => {
                if (i < counts.length) {
                    const limit = counts[i];
                    if (item.bullets && Array.isArray(item.bullets)) {
                        item.bullets = item.bullets.slice(0, limit);
                    }
                }
            });
        }
    });

    return resume_data;
}

function flattenResumeForAnalysis(data) {
    let text = '';

    if (data.name) text += `NAME: ${data.name}\n`;

    if (data.summary) text += `SUMMARY: ${data.summary}\n\n`;

    if (data.skills) {
        text += 'SKILLS:\n';
        if (typeof data.skills === 'object' && !Array.isArray(data.skills)) {
            for (const [cat, val] of Object.entries(data.skills)) {
                const skillStr = Array.isArray(val) ? val.join(', ') : String(val);
                text += `  ${cat}: ${skillStr}\n`;
            }
        } else if (Array.isArray(data.skills)) {
            text += `  ${data.skills.join(', ')}\n`;
        }
        text += '\n';
    }

    const sections = ['experience', 'projects', 'leadership', 'research', 'volunteering'];
    sections.forEach(sec => {
        if (data[sec] && data[sec].length > 0) {
            text += `${sec.toUpperCase()}:\n`;
            data[sec].forEach(item => {
                const title = item.company || item.organization || item.name || item.title || '';
                const role = item.role || item.degree || '';
                const dates = item.dates || '';
                text += `  ${title}${role ? ' - ' + role : ''} (${dates})\n`;
                if (item.bullets) {
                    item.bullets.forEach(b => {
                        text += `    - ${b}\n`;
                    });
                }
            });
            text += '\n';
        }
    });

    if (data.education && data.education.length > 0) {
        text += 'EDUCATION:\n';
        data.education.forEach(edu => {
            text += `  ${edu.institution || ''} - ${edu.degree || ''} (${edu.dates || ''})\n`;
            if (edu.gpa) text += `    GPA: ${edu.gpa}\n`;
            if (edu.bullets) edu.bullets.forEach(b => text += `    - ${b}\n`);
        });
        text += '\n';
    }

    if (data.certifications && data.certifications.length > 0) {
        text += 'CERTIFICATIONS:\n';
        data.certifications.forEach(c => text += `  ${c.name} - ${c.issuer || ''} (${c.dates || ''})\n`);
        text += '\n';
    }

    if (data.languages) {
        const lang = Array.isArray(data.languages) ? data.languages.join(', ') : data.languages;
        text += `LANGUAGES: ${lang}\n`;
    }

    return text;
}
