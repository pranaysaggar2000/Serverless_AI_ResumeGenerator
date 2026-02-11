// ============================================================
// ai_prompts.js — ForgeCV Prompt Builder (v2 — Revamped)
// ============================================================
// Design principles:
//   1. SHORT prompts — free-tier models (Llama 70B, etc.) follow
//      ~800-1200 word prompts reliably. Beyond that, compliance drops.
//   2. ONE job per prompt — don't mix extraction + analysis + formatting.
//   3. JSON schema at the END — models copy the last structure they see.
//   4. No hardcoded JD examples — all examples are generic/parameterized.
//   5. Control layout in CODE (bulletCounts, enforce_bullet_limits),
//      not in prose the model can't actually compute.
// ============================================================

// ---------- 1. Extract JD from raw page text ----------

export function buildExtractJDFromPagePrompt(rawPageText) {
    const truncated = rawPageText.substring(0, 12000);

    return `Extract the job posting from this webpage text. Ignore navigation, footers, ads, cookie notices.

RAW TEXT:
${truncated}

Return ONLY this JSON (no markdown, no explanation):
{
  "job_title": "exact title",
  "company_name": "company",
  "location": "location(s)",
  "job_description": "full JD text — all responsibilities, requirements, qualifications verbatim",
  "company_description": "1-2 sentences about what the company does, or empty string",
  "salary_range": "if mentioned, else empty string",
  "job_type": "Full-time/Part-time/Contract/Remote if mentioned, else empty string"
}

If no job description exists, return: {"error": "No job description found on this page"}`;
}

// ---------- 2. Parse JD into structured keywords ----------

export function buildParseJobDescriptionPrompt(jdText) {
    return `Extract structured information from this job description.

JOB DESCRIPTION:
${jdText}

RULES:
- "required"/"must have"/"X+ years" → mandatory_keywords
- "nice to have"/"preferred"/"bonus" → preferred_keywords
- Use EXACT terms from the JD (e.g. "React" not "React.js", "AWS" not "Amazon Web Services")
- Be exhaustive — missing a keyword costs ATS points
- tech_stack_nuances = specific versions/sub-tools (e.g. "Python 3.10", "PostgreSQL 15", "pandas")
- industry_terms = domain business language (e.g. "underwriting", "ad serving", "clinical trials")

Return ONLY this JSON:
{
  "company_name": "string",
  "job_title": "string",
  "job_identifier": "Job ID if found, else role_in_snake_case",
  "location": "string",
  "seniority": "junior|mid|senior|staff|principal|lead|manager",
  "years_experience": "number/range or 'not specified'",
  "mandatory_keywords": [],
  "preferred_keywords": [],
  "soft_skills": [],
  "action_verbs": [],
  "industry_terms": [],
  "tech_stack_nuances": [],
  "key_metrics_emphasis": [],
  "domain_context": "string",
  "team_context": "string",
  "company_description": "2-3 sentences about the company",
  "role_summary": "2-3 sentences about daily work"
}`;
}

// ---------- 3. Tailor resume to JD ----------

const STRATEGY_INSTRUCTIONS = {
    profile_focus: `STRATEGY: PRESERVE ORIGINAL (Target: 75-85% ATS)
- Keep all original bullet wording and metrics exactly
- Do NOT add keywords not already present
- Skills: reorder by JD relevance, do not add new ones
- Summary: only adjust to mention target role title if missing`,

    jd_focus: `STRATEGY: MAXIMIZE ATS (Target: 90-95%)
- Every mandatory keyword MUST appear in at least 2 sections (skills + a bullet, or summary + a bullet)
- Summary: weave in 4-5 mandatory keywords naturally
- Skills: include ALL mandatory + preferred keywords, rename categories to match JD language
- Bullets: each must contain 1-2 JD keywords IN CONTEXT (not just listed)
- If a keyword is in skills but zero bullets, add it to the most relevant bullet
- Projects: rewrite descriptions using JD terminology
- Use JD action verbs to start bullets`,

    balanced: `STRATEGY: BALANCED (Target: 85-90%)
- Summary: include 3-4 top mandatory keywords naturally
- Skills: add missing JD keywords to appropriate categories
- Bullets: integrate JD terms where they fit naturally, aim for 1 keyword per bullet
- Don't force keywords where they sound unnatural
- Preserve all original metrics and core meaning`
};

export function buildTailorPrompt(baseResume, jdAnalysis, tailoringStrategy, bulletCounts, pageMode = '1page', mustIncludeItems = null, formatSettings = null) {
    const strategy = STRATEGY_INSTRUCTIONS[tailoringStrategy] || STRATEGY_INSTRUCTIONS.balanced;

    const mandatory = (jdAnalysis.mandatory_keywords || []);
    const preferred = (jdAnalysis.preferred_keywords || []);
    const verbs = (jdAnalysis.action_verbs || []);
    const techNuances = (jdAnalysis.tech_stack_nuances || []);
    const industryTerms = (jdAnalysis.industry_terms || []);

    // Page mode instructions
    let pageNote = '';
    if (pageMode === '1page') {
        pageNote = `PAGE: Must fit ONE page. Be concise.
- Experience: 3-4 bullets per role (5 max for most recent)
- Projects: 2-3 bullets. Leadership: 1-2 bullets.
- NEVER remove experience or education entries.
- List removed items in "excluded_items" by name.`;
    } else {
        pageNote = `PAGE: Up to TWO pages allowed.
- Include ALL sections. Set excluded_items to empty arrays.`;
    }

    // Bullet count overrides
    let bulletNote = '';
    if (bulletCounts) {
        bulletNote = `BULLET COUNT OVERRIDES (hard limits):\n${JSON.stringify(bulletCounts)}`;
    }

    return `You are an ATS resume optimizer. Rewrite this resume to match the target job.

TARGET JOB:
- Company: ${jdAnalysis.company_name || 'Unknown'} | Role: ${jdAnalysis.job_title || 'Unknown'}
- Seniority: ${jdAnalysis.seniority || 'Unknown'} | Domain: ${jdAnalysis.domain_context || 'Unknown'}

KEYWORDS:
- Mandatory: ${mandatory.join(', ')}
- Preferred: ${preferred.join(', ')}

${strategy}

${pageNote}

${bulletNote}

RESUME TO TAILOR:
${JSON.stringify(baseResume)}

REWRITING RULES:
1. SUMMARY: 3-4 sentences focusing on Identity, Core Skills, Accomplishments, and Domain Fit.
2. BULLETS: Start with strong action verb. Use XYZ formula: "Did [X] measured by [Y] by doing [Z]".
3. SKILLS: Put JD keywords first.
4. INTEGRITY: Never invent roles, dates, or metrics.
5. SECTION_ORDER must only contain renderable body sections: summary, education, skills, experience, projects, research, leadership, certifications, awards, volunteering, languages. NEVER include "name" or "contact" in section_order.
6. FORMATTING: Never insert spaces between letters in words. "P y t h o n" is WRONG, "Python" is correct. All text must use normal word spacing.

Return ONLY valid JSON wrapped in a markdown code block.

` + '```json\n' + `{
  "name": "",
  "contact": {"location":"","phone":"","email":"","linkedin_url":"","portfolio_url":""},
  "summary": "",
  "education": [{"institution":"","degree":"","gpa":"","dates":"","location":"","bullets":[]}],
  "skills": {"Category": "skill1, skill2"},
  "experience": [{"company":"","role":"","dates":"","location":"","bullets":[]}],
  "projects": [{"name":"","tech":"","dates":"","bullets":[]}],
  "leadership": [{"organization":"","role":"","dates":"","location":"","bullets":[]}],
  "research": [{"title":"","conference":"","dates":"","link":"","bullets":[]}],
  "certifications": [{"name":"","issuer":"","dates":""}],
  "awards": [{"name":"","organization":"","dates":""}],
  "volunteering": [{"organization":"","role":"","dates":"","location":"","bullets":[]}],
  "languages": "",
  "section_order": ${JSON.stringify(baseResume.section_order || ["summary", "skills", "experience", "projects", "education"])},
  "excluded_items": {"projects":[],"experience":[],"leadership":[],"research":[],"certifications":[],"awards":[],"volunteering":[]}
}
` + '```';
}

// ---------- 4. ATS Score Analysis ----------

export function buildAnalysisPrompt(resumeData, jdText) {
    const flatResume = flattenResumeForAnalysis(resumeData);

    return `Score this resume against the job description for ATS keyword match.

JOB DESCRIPTION:
${jdText}

    RESUME:
${flatResume}

    SCORING:
    - Extract all technical keywords from JD
        - For each keyword, check placement:
  Skills only = 0.7 pts | Summary = +0.5 | In a bullet with context = +0.7 | In title / project name = +0.4
  Max per keyword: 2.3 pts
        - Score = (keyword_pts / max_possible) * 70 + (soft_skill_match * 12) + (experience_relevance * 18)
            - "weak match" = keyword appears in skills but never in a bullet with context
            - missing_keywords = keywords COMPLETELY absent from resume
                - 90 - 95: exceptional | 85 - 89: excellent | 75 - 84: strong | 65 - 74: good | 55 - 64: fair | < 55: weak

Return ONLY this JSON:
    {
        "score": 0,
            "missing_keywords": [],
                "weak_keywords": [],
                    "matching_areas": ["3-5 specific strengths"],
                        "recommendations": ["3 specific actionable improvements"],
                            "summary_feedback": "one paragraph assessment"
    } `;
}

// ---------- 5. Application Question Answerer ----------

export function buildQuestionPrompt(question, resumeData, jdText) {
    return `Write an answer for this job application question.

        APPLICANT: ${resumeData.name || 'Applicant'}
    ROLE: ${resumeData.experience?.[0]?.role || ''} at ${resumeData.experience?.[0]?.company || ''}
TOP SKILLS: ${resumeData.skills ? Object.values(resumeData.skills).slice(0, 3).join('; ') : ''}
KEY ACHIEVEMENTS: ${resumeData.experience?.[0]?.bullets?.slice(0, 2).join('; ') || ''}
    EDUCATION: ${resumeData.education?.[0]?.degree || ''} from ${resumeData.education?.[0]?.institution || ''}
JOB CONTEXT: ${jdText ? jdText.substring(0, 800) : 'Not provided'}

    QUESTION: "${question}"

    RULES:
    - First person("I have...", "In my role at...")
        - 2 - 4 sentences unless question asks for more
            - Reference SPECIFIC experiences from above, not generic statements
                - Behavioral questions: brief STAR format(Situation → Action → Result)
                    - Salary questions: "I'm open to discussing compensation that reflects the role's responsibilities and my experience."
                        - Natural conversational tone, no "passionate about", no "leverage", no "I am excited to"
                            - Output the answer directly, no quotes or "Answer:" prefix`;
}

// ---------- 6. Extract Profile from Resume Text ----------

export function buildExtractProfilePrompt(resumeText) {
    return `Parse this resume text into structured JSON.The text may be jumbled from PDF extraction.

RESUME TEXT:
${resumeText}

    RULES:
    - Name: usually the first prominent text
        - Contact: look for email, phone(xxx - xxx - xxxx), city / state, URLs, "[Extracted Link: ...]" patterns
            - Map non - standard headers to standard sections(e.g. "Work History" → experience, "Core Competencies" → skills)
                - Each bullet = one accomplishment.Split run - on text at action verbs.
- Dates: normalize to "Mon YYYY - Mon YYYY" or "Mon YYYY - Present"
        - Skills: group by category.Keep original categories if present.
- Preserve ALL metrics, numbers, percentages exactly as written
        - section_order: list sections in the order they appear in the original
            - Only include sections that have content
                - Do NOT rephrase bullets — preserve exact wording

Return ONLY this JSON:
    {
        "name": "",
            "contact": { "location": "", "phone": "", "email": "", "linkedin_url": "", "portfolio_url": "" },
        "summary": "",
            "education": [{ "institution": "", "degree": "", "gpa": "", "dates": "", "location": "", "bullets": [] }],
                "skills": { "Category": "skill1, skill2" },
        "experience": [{ "company": "", "role": "", "dates": "", "location": "", "bullets": [] }],
            "projects": [{ "name": "", "tech": "", "dates": "", "bullets": [] }],
                "leadership": [{ "organization": "", "role": "", "dates": "", "location": "", "bullets": [] }],
                    "research": [{ "title": "", "conference": "", "dates": "", "link": "", "bullets": [] }],
                        "certifications": [{ "name": "", "issuer": "", "dates": "" }],
                            "awards": [{ "name": "", "organization": "", "dates": "" }],
                                "volunteering": [{ "organization": "", "role": "", "dates": "", "location": "", "bullets": [] }],
                                    "languages": "",
                                        "section_order": []
    } `;
}

// ============================================================
// Post-processing helpers (unchanged logic, cleaned up)
// ============================================================

export function convert_markdown_to_html(text) {
    if (!text) return text;
    text = text.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    text = text.replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>');
    return text;
}

/**
 * Detect and fix character-spaced hallucinations like "P y t h o n" → "Python"
 */
function deCharSpace(str) {
    if (!str || typeof str !== 'string' || str.length < 5) return str;

    const spacedPattern = /(?<=\S) (?=\S)/g;
    const spaces = (str.match(spacedPattern) || []).length;
    const nonSpaceChars = str.replace(/\s/g, '').length;

    if (spaces < nonSpaceChars * 0.4) return str;

    return str
        .replace(/(\S) (?=\S)/g, '$1')
        .replace(/,(\S)/g, ', $1')
        .replace(/\+\+/g, '++')
        .replace(/\.(\w)/g, '.$1');
}

export function clean_tailored_resume(resume_data) {
    if (resume_data.summary) {
        resume_data.summary = convert_markdown_to_html(deCharSpace(resume_data.summary));
    }

    if (resume_data.skills) {
        const fixedSkills = {};
        for (const [cat, val] of Object.entries(resume_data.skills)) {
            let v = Array.isArray(val) ? val.join(", ") : String(val);
            fixedSkills[deCharSpace(cat)] = convert_markdown_to_html(deCharSpace(v));
        }
        resume_data.skills = fixedSkills;
    }

    ['experience', 'projects', 'leadership', 'research', 'volunteering'].forEach(sec => {
        if (resume_data[sec]) {
            resume_data[sec].forEach(item => {
                if (item.bullets) {
                    item.bullets = item.bullets.map(b => convert_markdown_to_html(deCharSpace(b)));
                }
            });
        }
    });

    if (resume_data.section_order) {
        const NON_SECTION_KEYS = ['name', 'contact', 'section_order', 'section_titles', 'excluded_items'];
        resume_data.section_order = resume_data.section_order.filter(s => !NON_SECTION_KEYS.includes(s));
    } else {
        const all = ["summary", "skills", "experience", "projects", "education", "leadership", "research", "certifications", "awards", "volunteering", "languages"];
        resume_data.section_order = all.filter(s => {
            const v = resume_data[s];
            if (!v) return false;
            if (Array.isArray(v)) return v.length > 0;
            if (typeof v === 'string') return v.trim().length > 0;
            if (typeof v === 'object') return Object.keys(v).length > 0;
            return false;
        });
    }

    if (!resume_data.section_titles) resume_data.section_titles = {};
    return resume_data;
}

function find_best_match(gen_item, pool) {
    let best = null, maxScore = 0;
    const gc = (gen_item.company || gen_item.organization || "").toLowerCase().trim();
    const gr = (gen_item.role || gen_item.title || "").toLowerCase().trim();
    const gn = (gen_item.name || gen_item.title || "").toLowerCase().trim();

    for (const orig of pool) {
        let s = 0;
        const oc = (orig.company || orig.organization || orig.conference || "").toLowerCase().trim();
        const or_ = (orig.role || orig.title || "").toLowerCase().trim();
        const on = (orig.name || orig.title || "").toLowerCase().trim();

        if (gc && oc && gc === oc) s += 3;
        else if (gc && oc && (gc.includes(oc) || oc.includes(gc))) s += 1;
        if (gr && or_ && gr === or_) s += 2;
        else if (gr && or_ && (gr.includes(or_) || or_.includes(gr))) s += 1;
        if (gn && on && gn === on) s += 5;
        else if (gn && on && (gn.includes(on) || on.includes(gn))) s += 2;

        if (s > maxScore && s >= 2) { maxScore = s; best = orig; }
    }
    return best;
}

export function restore_immutable_fields(original, generated) {
    const pool = [
        ...(original.experience || []),
        ...(original.leadership || []),
        ...(original.projects || []),
        ...(original.research || []),
        ...(original.certifications || []),
        ...(original.awards || []),
        ...(original.volunteering || []),
        ...(original.education || [])
    ];

    const restore = (section, fields) => {
        if (generated[section]) {
            generated[section].forEach(item => {
                const match = find_best_match(item, pool);
                if (match) fields.forEach(f => { if (match[f]) item[f] = match[f]; });
            });
        }
    };

    restore('experience', ['role', 'company', 'duration', 'dates', 'location']);
    restore('projects', ['name', 'link', 'dates']);
    restore('leadership', ['role', 'organization', 'duration', 'dates', 'location']);
    restore('research', ['title', 'conference', 'dates', 'link']);
    restore('certifications', ['name', 'issuer', 'dates']);
    restore('awards', ['name', 'organization', 'dates']);
    restore('volunteering', ['role', 'organization', 'dates', 'location']);
    // Always restore name and contact from original — these are never tailored
    if (original.name) generated.name = original.name;
    if (original.contact) generated.contact = original.contact;

    // Restore education immutable fields
    if (generated.education && original.education) {
        generated.education.forEach((edu, i) => {
            const orig = original.education[i];
            if (orig) {
                edu.institution = orig.institution || orig.school || edu.institution;
                edu.school = orig.school || orig.institution || edu.school;
                edu.degree = orig.degree || edu.degree;
                edu.gpa = orig.gpa || edu.gpa;
                edu.dates = orig.dates || edu.dates;
                edu.location = orig.location || edu.location;
            }
        });
    }

    // Don't overwrite section_order — let AI's ordering stand, fall back only if missing
    if (!generated.section_order && original.section_order) {
        generated.section_order = original.section_order;
    }
    if (original.section_titles) {
        generated.section_titles = { ...original.section_titles, ...(generated.section_titles || {}) };
    }
    return generated;
}

export function enforce_bullet_limits(resume_data, bullet_counts) {
    if (!bullet_counts) return resume_data;
    ['experience', 'projects', 'leadership'].forEach(sec => {
        if (bullet_counts[sec] && resume_data[sec]) {
            const counts = bullet_counts[sec];
            resume_data[sec].forEach((item, i) => {
                if (i < counts.length && item.bullets) {
                    item.bullets = item.bullets.slice(0, counts[i]);
                }
            });
        }
    });
    return resume_data;
}

function flattenResumeForAnalysis(data) {
    let t = '';
    if (data.name) t += `NAME: ${data.name} \n`;
    if (data.summary) t += `SUMMARY: ${data.summary} \n\n`;

    if (data.skills) {
        t += 'SKILLS:\n';
        if (typeof data.skills === 'object' && !Array.isArray(data.skills)) {
            for (const [c, v] of Object.entries(data.skills)) {
                t += `  ${c}: ${Array.isArray(v) ? v.join(', ') : String(v)} \n`;
            }
        } else if (Array.isArray(data.skills)) {
            t += `  ${data.skills.join(', ')} \n`;
        }
        t += '\n';
    }

    ['experience', 'projects', 'leadership', 'research', 'volunteering'].forEach(sec => {
        if (data[sec]?.length > 0) {
            t += `${sec.toUpperCase()}: \n`;
            data[sec].forEach(item => {
                const title = item.company || item.organization || item.name || item.title || '';
                const role = item.role || item.degree || '';
                t += `  ${title}${role ? ' - ' + role : ''} (${item.dates || ''}) \n`;
                item.bullets?.forEach(b => { t += `    - ${b} \n`; });
            });
            t += '\n';
        }
    });

    if (data.education?.length > 0) {
        t += 'EDUCATION:\n';
        data.education.forEach(e => {
            t += `  ${e.institution || ''} - ${e.degree || ''} (${e.dates || ''}) \n`;
            if (e.gpa) t += `    GPA: ${e.gpa} \n`;
            e.bullets?.forEach(b => { t += `    - ${b} \n`; });
        });
        t += '\n';
    }

    if (data.certifications?.length > 0) {
        t += 'CERTIFICATIONS:\n';
        data.certifications.forEach(c => { t += `  ${c.name} - ${c.issuer || ''} (${c.dates || ''}) \n`; });
        t += '\n';
    }

    if (data.languages) {
        t += `LANGUAGES: ${Array.isArray(data.languages) ? data.languages.join(', ') : data.languages} \n`;
    }
    return t;
}