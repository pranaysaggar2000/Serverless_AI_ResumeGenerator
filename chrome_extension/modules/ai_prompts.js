
export function buildJDAnalysisPrompt(jdText) {
    return `
    Analyze the following Job Description (JD) and extract the key information.
    
    1.  **Summary**: A concise summary of the role and what they are looking for.
    2.  **Keywords**: A list of important keywords and technical terms found in the JD.
    3.  **Required Skills**: A list of explicit hard skills required.
    4.  **Company Name**: The name of the company hiring. Be precise.
    5.  **Job Identifier**: If a Job ID is found (e.g., 'R12345'), use that. If not, use the Job Title, but format it as snake_case (e.g., 'Senior_Data_Scientist'). Keep it short.
    
    Job Description:
    ${jdText}
    `;
}

export function parseJDAnalysis(responseText) {
    // This prompt was originally a descriptive one in python main.py (get_jd_analysis_prompt).
    // The CONSUMER of this prompt in main.py was `parse_job_description` which actually used a DIFFERENT JSON-heavy prompt.
    // The user instruction said "Port the exact prompt text from main.py functions: parse_job_description..."
    // Let's use the JSON prompt from parse_job_description instead as it's the functional one used for logic.
    return {};
}

// Re-writing buildJDAnalysisPrompt with the JSON version from parse_job_description
export function buildParseJobDescriptionPrompt(jdText) {
    return `
Analyze this job description and extract the following information. Return ONLY valid JSON.

Job Description:
${jdText}

Extract and return this JSON structure:
{
    "company_name": "The precise name of the company hiring (e.g., 'Google', 'Anthropic'). Do not use 'Unknown' unless absolutely necessary.",
    "job_identifier": "A short, unique identifier for the folder name. Use the Job ID if found (e.g., 'R12345'), otherwise use the Role Name in Snake Case (e.g., 'Senior_Software_Engineer').",
    "location": "City, State (extract ONLY the primary location, do not list multiple)",
    "job_title": "The exact job title from the posting",
    "mandatory_keywords": ["list", "of", "required", "technical", "skills"],
    "preferred_keywords": ["list", "of", "nice-to-have", "skills"],
    "soft_skills": ["communication", "leadership", "etc"],
    "action_verbs": ["developed", "implemented", "etc - verbs used in JD"],
    "industry_terms": ["domain-specific", "terminology"],
    "years_experience": "number or range if mentioned",
    "domain_context": "The industry/sector (e.g., Fintech, AdTech, Healthcare)",
    "tech_stack_nuances": ["specific versions (Java 17) only if mentioned in JD", "sub-tools (BigQuery, not just GCP)", "specific libraries"],
    "key_metrics_emphasis": ["scale (millions of users)", "speed (low latency)", "revenue", "efficiency"]
}

Be thorough in extracting keywords.
- For "tech_stack_nuances", look for specific library names (e.g., "pandas" instead of just "Python") and cloud services (e.g., "Redshift" instead of just "AWS").
- For "industry_terms", extract business-specific language (e.g., "risk modeling", "patient outcomes", "click-through rate").
`;
}

export function buildTailorPrompt(baseResume, jdAnalysis, tailoringStrategy, bulletCounts) {
    let strategyNote = "";
    if (tailoringStrategy === "profile_focus") {
        strategyNote = `
=== TAILORING STRATEGY: PROFILE FOCUS ===
**PRIORITY: Preserve original content and authenticity - TARGET ATS: 75-85%**

CRITICAL RULES FOR THIS STRATEGY:
- PRESERVE original bullet point wording unless it's grammatically incorrect
- KEEP original metrics, numbers, and phrasing exactly as written
- DO NOT add keywords that weren't in the original resume
- DO NOT rephrase bullets just to match JD terminology
- ONLY make changes if: (1) fixing grammar, (2) adding missing contact info, (3) adjusting summary to match JD title
- Skills section: Keep original skills, only reorder by JD relevance (don't add new ones)
- Experience bullets: Change NOTHING except fixing typos
- This strategy values AUTHENTICITY over ATS score - resist the urge to optimize
`;
    } else if (tailoringStrategy === "jd_focus") {
        strategyNote = `
=== TAILORING STRATEGY: JD FOCUS ===
**PRIORITY: Maximize ATS keyword matching - TARGET ATS: 95%+**

CRITICAL RULES FOR THIS STRATEGY:
- AGGRESSIVELY rephrase every bullet to include more JD keywords
- ADD JD-specific terminology even if it changes original meaning slightly
- REPLACE generic terms with exact JD terminology (e.g., "database" → "PostgreSQL", "cloud" → "AWS Lambda")
- ENSURE every mandatory_keyword appears at least 2-3 times across resume
- ENSURE every preferred_keyword appears at least once
- Skills section: Add ALL relevant JD keywords, even if not in original resume
- Experience bullets: Rewrite to maximize keyword density while staying truthful
- Prioritize keyword matching over natural language flow
- This strategy values ATS SCORE over readability - be aggressive
`;
    } else {
        // Balanced
        strategyNote = `
=== TAILORING STRATEGY: BALANCED ===
**PRIORITY: Integrate JD keywords while maintaining authenticity - TARGET ATS: 88-92%**

CRITICAL RULES FOR THIS STRATEGY:
- ADD relevant JD keywords where they fit naturally
- REPHRASE bullets to include JD terminology while keeping original meaning
- MAINTAIN original metrics and accomplishments
- Skills section: Add important JD keywords, keep original skills
- Experience bullets: Enhance with JD keywords but preserve core message
- Balance keyword optimization with genuine representation
- This is the DEFAULT behavior - good mix of authenticity and optimization
`;
    }

    // Build flattened resume content logic similar to python
    let current_resume_content = "--- SECTION: CONTACT & SUMMARY ---\n";
    // NOTE: In JS we are handling objects. Pushing simplified text construction.
    current_resume_content += JSON.stringify(baseResume, null, 2);

    // Bullet counts instructions
    let bullet_instructions = "";
    if (bulletCounts) {
        bullet_instructions = `
STRICT BULLET POINT COUNTS:
You MUST adhere to these exact bullet counts per section.
${JSON.stringify(bulletCounts, null, 2)}
If a count is 0, DO NOT include that item in the output array.
If a count is N, select the top N most relevant bullets.
`;
    }

    return `
You are an expert Resume Tailor and ATS Optimizer.
Your goal is to rewrite the candidate's resume to match the targeted Job Description (JD) while adhering to a specific tailoring strategy.

TARGET JOB DESCRIPTION:
${JSON.stringify(jdAnalysis, null, 2)}

CANDIDATE'S BASE RESUME:
${JSON.stringify(baseResume, null, 2)}

${strategyNote}

${bullet_instructions}

TASK:
1.  **Analyze** the JD and the Resume.
2.  **Rewrite** the resume content to maximize match with the JD.
3.  **Strictly follow** the Tailoring Strategy rules above.
4.  **Format** the output as a valid JSON object matching the resume structure.

OUTPUT JSON STRUCTURE:
{
    "name": "...",
    "contact": { ... },
    "summary": "...",
    "education": [ ... ],
    "skills": { ... },
    "experience": [
        {
            "company": "...",
            "role": "...",
            "dates": "...",
            "location": "...",
            "bullets": [ ... ]
        }
    ],
    "projects": [ ... ],
    "leadership": [ ... ],
    "research": [ ... ],
    "certifications": [ ... ],
    "awards": [ ... ],
    "volunteering": [ ... ],
    "languages": "..."
}

CRITICAL:
- Return ONLY valid JSON.
- No markdown code blocks.
- Verify JSON syntax before returning.
`;
}

export function buildAnalysisPrompt(resumeData, jdText) {
    return `
    Analyze this resume against the job description and provide a strict ATS analysis.
    
    JOB DESCRIPTION:
    ${jdText}
    
    RESUME:
    ${JSON.stringify(resumeData, null, 2)}
    
    TASK:
    1. Calculate a match score (0-100).
    2. Identify 3-5 specific missing keywords.
    3. Identify 3 strong matching areas.
    4. Provide 3 specific recommendations to improve the score.
    
    CRITICAL INSTRUCTIONS:
    - RETURN ONLY VALID JSON.
    - DO NOT use Markdown code blocks (e.g. \`\`\`json).
    - DO NOT include ANY preamble, explanation, or extra text.
    - The output must be directly parsable by Python json.loads().

    OUTPUT FORMAT:
    {
      "score": 85,
      "missing_keywords": ["keyword1", "keyword2"],
      "matching_areas": ["area1", "area2"],
      "recommendations": ["rec1", "rec2"],
      "summary_feedback": "Brief summary of the fit."
    }
    `;
}

export function buildQuestionPrompt(question, resumeData, jdText) {
    return `
    You are helping a job applicant answer a question from a job application form.
    
    JOB DESCRIPTION:
    ${jdText}
    
    APPLICANT'S RESUME:
    ${JSON.stringify(resumeData, null, 2)}
    
    APPLICATION QUESTION:
    ${question}
    
    INSTRUCTIONS:
    - Write a direct, professional answer based on the applicant's actual experience and skills
    - Keep it concise (2-4 sentences maximum)
    - Use plain text with NO formatting (no bold, italics, bullet points, or special characters)
    - Write in first person ("I have...", "My experience includes...")
    - Make it ready to copy-paste directly into an application form
    - Be honest - if they lack something, focus on related experience or willingness to learn
    - CRITICAL: Sound natural and human-written. Avoid AI tells:
      * NO em dashes (—) - use regular hyphens (-) or commas instead
      * NO overly formal or flowery language
      * NO phrases like "I am passionate about", "I am excited to", "leverage", "utilize"
      * Use simple, direct language that a real person would write
    
    Answer:
    `;
}

export function buildExtractProfilePrompt(resumeText) {
    return `
    Extract the following information from the resume text into a strict JSON format.
    
    IMPORTANT: Look for "[Extracted Link: ...]" patterns in the text to identify LinkedIn and Portfolio URLs if they are not explicitly written out.
    
    Resume Text:
    ${resumeText}
    
    Required JSON Structure:
    {
        "name": "Full Name",
        "contact": {
            "location": "City, State",
            "phone": "Phone Number",
            "email": "Email",
            "linkedin_url": "Full LinkedIn URL",
            "portfolio_url": "Portfolio URL (optional)"
        },
        "summary": "Professional summary",
        "education": [
            {
                "institution": "University Name",
                "degree": "Degree Name",
                "gpa": "GPA (optional)",
                "dates": "Start - End Date",
                "location": "City, State"
            }
        ],
        "skills": {
            "Category Name 1": "Skill1, Skill2, Skill3",
            "Category Name 2": "Skill1, Skill2, Skill3"
        },
        "experience": [
            {
                "company": "Company Name",
                "role": "Job Title",
                "dates": "Start - End Date",
                "location": "City, State",
                "bullets": ["Bullet 1", "Bullet 2", "etc"]
            }
        ],
        "projects": [
            {
                "name": "Project Name",
                "dates": "Date Range",
                "bullets": ["Bullet 1", "Bullet 2"]
            }
        ],
        "leadership": [
            {
                "organization": "Org Name",
                "role": "Role Title",
                "dates": "Date Range",
                "location": "City, State",
                "bullets": ["Bullet 1"]
            }
        ],
        "research": [
            {
                "title": "Paper Title",
                "conference": "Conference/Journal Name",
                "dates": "Date",
                "link": "URL (optional)",
                "bullets": ["Bullet 1"]
            }
        ],
        "certifications": [
            {
                "name": "Certification Name",
                "issuer": "Issuing Organization",
                "dates": "Date"
            }
        ],
        "awards": [
            {
                "name": "Award Name",
                "organization": "Organization",
                "dates": "Date"
            }
        ],
        "volunteering": [
            {
                "organization": "Organization",
                "role": "Role",
                "dates": "Date Range",
                "location": "City, State",
                "bullets": ["Bullet 1"]
            }
        ],
        "languages": "List of languages spoken (e.g. English, Spanish)"
    }
    
    Ensure all fields are filled based on the text. If a field is missing, use an empty string or empty list.
    Do not invent information.
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
