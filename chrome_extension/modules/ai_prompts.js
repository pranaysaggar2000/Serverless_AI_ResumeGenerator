
// Re-writing buildJDAnalysisPrompt with the JSON version from parse_job_description
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
    "role_summary": "2-3 sentence summary of what this person will actually DO day-to-day"
}

CRITICAL: Return ONLY valid JSON. No markdown blocks, no explanation text.
`;
}

export function buildTailorPrompt(baseResume, jdAnalysis, tailoringStrategy, bulletCounts) {
    // Strategy instructions
    let strategyNote = "";
    if (tailoringStrategy === "profile_focus") {
        strategyNote = `
=== TAILORING STRATEGY: PROFILE FOCUS ===
**PRIORITY: Preserve original content and authenticity - TARGET ATS: 75-85%**

CRITICAL RULES:
- PRESERVE original bullet point wording unless grammatically incorrect
- KEEP original metrics, numbers, and phrasing exactly as written
- DO NOT add keywords that weren't in the original resume
- DO NOT rephrase bullets just to match JD terminology
- ONLY change: (1) fix grammar, (2) add missing contact info, (3) adjust summary to match JD title
- Skills: Keep original skills, only reorder by JD relevance (don't add new ones)
- Experience bullets: Change NOTHING except fixing typos
- Values AUTHENTICITY over ATS score
`;
    } else if (tailoringStrategy === "jd_focus") {
        strategyNote = `
=== TAILORING STRATEGY: JD FOCUS ===
**PRIORITY: Maximize ATS keyword matching - TARGET ATS: 95%+**

CRITICAL RULES:
- AGGRESSIVELY rephrase every bullet to include JD keywords
- ADD JD-specific terminology even if it changes original meaning slightly
- REPLACE generic terms with exact JD terminology (e.g., "database" → "PostgreSQL")
- ENSURE every mandatory_keyword appears at least 2-3 times across resume
- ENSURE every preferred_keyword appears at least once
- Skills: Add ALL relevant JD keywords, even if not in original
- Experience bullets: Rewrite to maximize keyword density while staying truthful
- Values ATS SCORE over readability - be aggressive
`;
    } else {
        // Balanced
        strategyNote = `
=== TAILORING STRATEGY: BALANCED ===
**PRIORITY: Integrate JD keywords while maintaining authenticity - TARGET ATS: 88-92%**

CRITICAL RULES:
- ADD relevant JD keywords where they fit naturally
- REPHRASE bullets to include JD terminology while keeping original meaning
- MAINTAIN original metrics and accomplishments
- Skills: Add important JD keywords, keep original skills
- Experience bullets: Enhance with JD keywords but preserve core message
- Balance keyword optimization with genuine representation
`;
    }

    // Build bullet count instructions
    let bulletInstructions = "";
    if (bulletCounts) {
        bulletInstructions = `
BULLET COUNT LIMITS (MANDATORY):
${JSON.stringify(bulletCounts, null, 2)}
For each section, the array gives the max bullet count per item (in order).
If a count is 0, REMOVE that item entirely from the output.
Select the most JD-relevant bullets when cutting.
`;
    }

    // Build a human-readable resume summary instead of raw JSON
    let resumeSummary = `CANDIDATE: ${baseResume.name || 'Unknown'}\n`;
    if (baseResume.summary) resumeSummary += `CURRENT SUMMARY: ${baseResume.summary}\n`;
    if (baseResume.skills) {
        resumeSummary += `SKILLS:\n`;
        if (typeof baseResume.skills === 'object' && !Array.isArray(baseResume.skills)) {
            for (const [cat, skills] of Object.entries(baseResume.skills)) {
                resumeSummary += `  ${cat}: ${skills}\n`;
            }
        }
    }

    return `
You are an expert ATS Resume Optimizer. Rewrite this resume to match the target job.

=== TARGET JOB ===
Company: ${jdAnalysis.company_name || 'Unknown'}
Role: ${jdAnalysis.job_title || 'Unknown'}
Seniority: ${jdAnalysis.seniority || 'Unknown'}
Domain: ${jdAnalysis.domain_context || 'Unknown'}

Must-have keywords: ${(jdAnalysis.mandatory_keywords || []).join(', ')}
Nice-to-have keywords: ${(jdAnalysis.preferred_keywords || []).join(', ')}
Action verbs from JD: ${(jdAnalysis.action_verbs || []).join(', ')}
Tech specifics: ${(jdAnalysis.tech_stack_nuances || []).join(', ')}
Industry terms: ${(jdAnalysis.industry_terms || []).join(', ')}
Scale/metrics emphasis: ${(jdAnalysis.key_metrics_emphasis || []).join(', ')}

=== CANDIDATE RESUME ===
${JSON.stringify(baseResume, null, 2)}

${strategyNote}

${bulletInstructions}

=== REWRITING RULES ===

SUMMARY:
- Write a 2-3 sentence summary that positions the candidate for THIS specific role
- Lead with years of experience + most relevant domain
- Include 3-5 top JD keywords naturally
- Mention the most impressive quantified achievement
- Match the seniority tone (don't say "seasoned leader" for a junior role)

BULLET POINTS:
- Start every bullet with a STRONG ACTION VERB (from the JD's action_verbs when possible)
- Follow the XYZ formula: "Accomplished [X] as measured by [Y], by doing [Z]"
- PRESERVE all original metrics, numbers, percentages, and dollar amounts EXACTLY
- Integrate JD keywords by replacing generic terms with specific JD terminology:
  * "database" → the specific DB from the JD (e.g., "PostgreSQL")
  * "cloud" → the specific cloud from the JD (e.g., "AWS Lambda")
  * "built" → a JD action verb (e.g., "architected", "engineered")
- Each bullet MUST be under 200 characters
- If a bullet is too long, split the metric from the method or trim filler words

SKILLS:
- Reorder categories so the most JD-relevant category is FIRST
- Within each category, put JD keywords FIRST
- For balanced/JD-focus: Add missing JD keywords to the appropriate category
- For profile-focus: Only reorder, do not add new skills

EXPERIENCE / PROJECTS:
- Reorder items so the most JD-relevant one is FIRST (within each section)
- NEVER fabricate a company, role, project, or metric that doesn't exist in the original
- NEVER change company names, dates, or locations

=== WHAT NOT TO DO ===
- Do NOT hallucinate new experiences, companies, or achievements
- Do NOT change any dates, company names, school names, or locations
- Do NOT inflate metrics (if original says "10%", do not change to "25%")
- Do NOT add skills the candidate clearly doesn't have (no new programming languages)
- Do NOT use em dashes (—), use hyphens (-) instead
- Do NOT use generic filler phrases: "spearheaded initiatives", "drove innovation", "leveraged synergies"

=== OUTPUT ===
Return ONLY a valid JSON object with this structure:
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

CRITICAL: Return ONLY valid JSON. No markdown code blocks. No text before or after. Verify all brackets match.
`;
}

export function buildAnalysisPrompt(resumeData, jdText) {
    return `
You are a strict ATS (Applicant Tracking System) scoring engine. Analyze this resume against the job description.

JOB DESCRIPTION:
${jdText}

RESUME:
${JSON.stringify(resumeData, null, 2)}

SCORING METHODOLOGY (follow this exactly):
1. Extract ALL technical keywords from the JD (tools, languages, frameworks, methodologies, certifications)
2. Check which keywords appear in the resume (case-insensitive, but exact terms — "React" matches "React" or "ReactJS", but not "reactive")
3. Score = (matched_keywords / total_jd_keywords) * 70 + (soft_skill_match * 15) + (experience_relevance * 15)
4. Be STRICT. Most resumes score 40-75 unless heavily tailored. A score above 85 means near-perfect keyword coverage.

ANALYSIS RULES:
- missing_keywords: List keywords that appear in the JD but NOT in the resume. Be specific — list actual terms, not categories.
- matching_areas: List 3-5 specific strengths where the resume strongly matches (e.g., "3+ years Python experience matches requirement", not just "Python")
- recommendations: Give 3 specific, actionable improvements (e.g., "Add 'Kubernetes' to skills section — mentioned 4 times in JD")
- summary_feedback: One honest paragraph about overall fit, mentioning the biggest gap

RETURN ONLY THIS JSON:
{
    "score": 65,
    "missing_keywords": ["Kubernetes", "GraphQL", "CI/CD", "Terraform"],
    "matching_areas": ["Strong Python/Django match with 4+ years", "AWS experience aligns with cloud requirements", "Team lead experience matches senior role expectations"],
    "recommendations": ["Add 'Kubernetes' and 'Docker' to DevOps skills - mentioned 5 times in JD", "Rephrase 'built APIs' to 'designed and built RESTful and GraphQL APIs'", "Add a bullet about CI/CD pipeline experience"],
    "summary_feedback": "The candidate has strong backend development skills that align with 60% of the technical requirements. The main gaps are in infrastructure (Kubernetes, Terraform) and API design patterns (GraphQL). With targeted additions to the skills section and rephrased experience bullets, the score could improve to 80+."
}

CRITICAL: Return ONLY valid JSON. No markdown. Be honest with the score — do not inflate.
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

    // Clean bullets
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
