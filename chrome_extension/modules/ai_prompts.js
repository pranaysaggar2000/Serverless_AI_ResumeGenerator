// ============================================================
// ai_prompts.js — ForgeCV Prompt Builder (v4.1 — Seniority-Aware)
// ============================================================
//
// OPTIMIZATIONS FOR LLAMA 3.3 70B & KIMI K2 1T:
//
// 1. TOKEN DENSITY REDUCTION — Target ~1000-1200 high-value tokens.
//    Llama 3.3 degrades >1500 instruction tokens.
//
// 2. SENIORITY ADAPTATION — Dynamic guidance based on experience level
//    (Junior -> Executive). Prevents "junior voice" for seniors and
//    "strategy fluff" for juniors.
//
// 3. GOAL-ORIENTED FRAMING — "Maximize ATS match and pass human review."
//
// 4. ATS 2025 INTELLIGENCE —
//    - Semantic keyword clustering
//    - Both-forms acronym injection
//    - Contextual placement & Anti-stuffing
//
// ============================================================


// ---------- 1. EXTRACT JD FROM RAW PAGE TEXT ----------

export function buildExtractJDFromPagePrompt(rawPageText) {
    const truncated = rawPageText.substring(0, 12000);
    return `You are a job posting extraction engine for resume analysis.

---
RAW WEBPAGE TEXT:
${truncated}
---

TASK: Extract the job posting content. Ignore navigation, footers, and sidebar ads.

Rule 1: Extract COMPLETE job description — every bullet, every section. Do not summarize.
Rule 2: company_description = what the company DOES (industry, products, mission).
Rule 3: If no job description is found, return {"error": "No job description found on this page"}.


FORMATTING: Output all text as normal continuous words. NEVER insert spaces between individual characters of a word.

` + 'Return ONLY JSON in ```json``` block:\n```json\n' + `{
  "job_title": "exact title from posting",
  "company_name": "company name",
  "location": "location(s) or Remote",
  "job_description": "full verbatim JD text with all sections",
  "company_description": "1-2 sentences about what company does, or empty string",
  "salary_range": "salary if mentioned, else empty string",
  "job_type": "Full-time/Part-time/Contract/Remote, else empty string"
}
` + '```';
}


// ---------- 2. PARSE JD INTO STRUCTURED KEYWORDS ----------

export function buildParseJobDescriptionPrompt(jdText) {
    return `You are an ATS keyword extraction specialist. Extract every skill, tool, and requirement.

---
JOB DESCRIPTION:
${jdText}
---

EXTRACTION RULES:

Rule 1 — MANDATORY vs PREFERRED:
- "required", "must have", "essential" → mandatory_keywords
- "nice to have", "preferred", "bonus" → preferred_keywords
- Default to mandatory if unclear.

Rule 2 — SPLIT COMPOUND TERMS:
BAD: "Hugging Face / LlamaIndex"
GOOD: "Hugging Face" and "LlamaIndex" as separate entries

Rule 3 — USE EXACT JD WORDING:
If JD says "AWS", use "AWS" (not "Amazon Web Services").

Rule 4 — INCLUDE BOTH FORMS:
If JD says "Machine Learning (ML)", include BOTH "Machine Learning" and "ML" as separate keywords.
If JD says "CI/CD", include "CI/CD".

Rule 5 — BE EXHAUSTIVE:
Include languages, frameworks, cloud platforms, methodologies (Agile, CI/CD), and domain terms (supply chain).

Rule 6 — CLASSIFY PRECISELY:
- tech_stack_nuances: versions/sub-products (Python 3.10, Salesforce CPQ).
- industry_terms: domain business language (underwriting, clinical trials).
- action_verbs: verbs describing what the person will DO.

Rule 7 — LEADERSHIP/STRATEGY TERMS:
For senior/lead/manager roles, extract "stakeholder management", "technical direction", "roadmap", "mentorship" as MANDATORY keywords (not soft skills). Only classify as soft_skills if the JD treats them as nice-to-haves.


FORMATTING: Output all text as normal continuous words. NEVER insert spaces between individual characters of a word.

` + 'Return ONLY JSON in ```json``` block:\n```json\n' + `{
  "company_name": "",
  "job_title": "",
  "job_identifier": "Job ID if found, else role_in_snake_case",
  "location": "",
  "seniority": "junior|mid|senior|staff|principal|lead|manager",
  "years_experience": "number or range, or not specified",
  "mandatory_keywords": ["every required skill as individual entries"],
  "preferred_keywords": ["every nice-to-have as individual entries"],
  "soft_skills": ["only if explicitly mentioned"],
  "action_verbs": ["from responsibilities section"],
  "industry_terms": ["domain-specific business language"],
  "tech_stack_nuances": ["specific versions and sub-tools"],
  "key_metrics_emphasis": ["scale indicators mentioned"],
  "domain_context": "industry/sector",
  "team_context": "team info, reporting structure if mentioned",
  "company_description": "2-3 sentences about what the company does",
  "role_summary": "2-3 sentences about daily work"
}
` + '```';
}


// ---------- 3. TAILOR RESUME TO JD ----------

function buildSeniorityGuidance(seniority, yearsExperience, candidateExperience = null) {
    // Parse years into a number for range checks
    const yrs = parseInt(yearsExperience) || 0;
    const level = (seniority || '').toLowerCase();

    // If candidate has more experience than JD requires, use the higher level
    // to avoid dumbing down a strong candidate's resume
    const candidateYrs = parseInt(candidateExperience) || 0;
    const effectiveYrs = Math.max(yrs, candidateYrs);

    if (level === 'junior' || level === 'entry' || effectiveYrs < 3) {
        return `=== SENIORITY GUIDANCE: JUNIOR/ENTRY-LEVEL ===
- Projects and education carry MORE weight than for senior roles — keep them prominent and detailed.
- Bullets should emphasize: technical skills used, what you built/shipped, learning velocity.
- It is OK to have fewer metrics — describe scope (users served, data volume, team size) instead of % improvements if the original resume lacks them. Do NOT invent metrics.
- Keep skills section technical-heavy. This is your strongest ATS signal at this level.
- Summary sentence 3: use a concrete project/deliverable if no strong work metric exists.
- KEYWORD STUFFING RISK IS HIGH at this level (fewer bullets to distribute keywords across). Be extra careful: if a keyword doesn't fit naturally in any bullet, put it in skills ONLY.
- Leadership/TA/mentoring bullets should stay authentic. Do NOT inject technical JD keywords into teaching, grading, or mentoring bullets — these demonstrate communication and leadership, not technical skills. Leave them as-is or only lightly reword.`;
    }

    if (level === 'mid' || (effectiveYrs >= 3 && effectiveYrs <= 7)) {
        return `=== SENIORITY GUIDANCE: MID-LEVEL ===
- Balance technical depth with measurable business impact in bullets.
- Bullets should show BOTH the "how" (tools/methods) AND the "so what" (metrics, outcomes).
- You should have enough experience to weave most keywords naturally — aim for the higher end of keyword coverage (60-70% of bullets).
- Projects section is still valuable but experience section takes priority for space.
- Summary sentence 3: use a work achievement with a metric, not a project.
- Do NOT inject technical keywords into leadership/TA/mentoring bullets — keep them authentic.`;
    }

    if (level === 'senior' || level === 'staff' || level === 'principal' || (effectiveYrs >= 8 && effectiveYrs <= 14)) {
        return `=== SENIORITY GUIDANCE: SENIOR/STAFF ===
- Bullets should lead with IMPACT and SCALE: team size managed, revenue influenced, systems owned, org-wide initiatives.
- Technical tools should appear as the "how" in bullets, not the "what". 
  BAD: "Used Kubernetes and Terraform for infrastructure"
  GOOD: "Architected multi-region infrastructure on Kubernetes serving 10M daily requests, reducing downtime by 99.5%"
- Include strategic keywords from JD: "architecture", "mentorship", "technical direction", "cross-functional", "roadmap" — these are NOT soft skills at this level, they are core competencies.
- Projects section can be shortened or removed if space is needed — experience section is what matters.
- Summary sentence 3: use a leadership/scale achievement (team size, budget, org impact).`;
    }

    if (level === 'lead' || level === 'manager' || level === 'director' || level === 'vp' || effectiveYrs >= 15) {
        return `=== SENIORITY GUIDANCE: LEADERSHIP/EXECUTIVE ===
- Bullets must emphasize: strategy, org-building, P&L/budget ownership, cross-functional leadership, business outcomes.
- Technical tool keywords belong primarily in the skills section — bullets should focus on WHAT you drove, not WHICH tool you used.
  BAD: "Managed team using Jira and Confluence for project tracking"
  GOOD: "Built and led 40-person engineering organization across 3 offices, delivering $12M product line on schedule"
- Include leadership keywords even if they look like "soft skills": "stakeholder management", "executive communication", "organizational design", "talent development" — at this level these ARE hard requirements.
- Education section: minimize to institution/degree/dates only (no GPA, no coursework).
- Projects section: remove entirely if space is needed unless projects demonstrate executive-level impact.
- Summary sentence 3: use a business/org-level achievement (revenue, team scale, market impact).
- Do NOT over-optimize for technical ATS keywords — at this level, hiring managers matter more than ATS filters.`;
    }

    // Fallback: generic guidance
    return `=== SENIORITY GUIDANCE ===
- Adapt bullet emphasis to the seniority level: junior = technical depth, senior = impact/scale/leadership.
- Ensure keyword integration matches what someone at this level would realistically do.`;
}

const ANTI_AI_WRITING_RULES = `
=== WRITING STYLE: SOUND HUMAN, NOT AI-GENERATED ===

BANNED WORDS (never use anywhere in the resume):
"Spearheaded", "Orchestrated", "Synergized", "Pioneered", "Revolutionized",
"Cutting-edge", "Best-in-class", "World-class", "Innovative solutions",
"Leveraging", "Utilizing", "Harnessing", "Drive/Drove innovation",
"Ensuring alignment with", "Diverse stakeholders", "Cross-functional synergies",
"Passionate about", "Results-driven", "Detail-oriented", "Self-starter",
"Significantly improved", "Effectively managed", "Successfully delivered",
"Proven track record", "Thought leader", "Value-add",
"Various" (when hiding lack of specifics), "Multiple" (same),
"Expert in" (inflated for most levels — use "Skilled in" or "Experienced in"),
"Expertise in" (same — prefer "Background in" or specific tool mentions).

VARY SENTENCE STRUCTURE — the #1 AI tell is uniform bullet rhythm:
- NOT every bullet should be "[Verb] [object] resulting in [metric]".
- Mix these patterns within each role:
  A: "[Verb] [thing] [how], [metric]." (standard)
  B: "[Metric] by [verb]-ing [method]." (lead with result)
  C: "[Verb] [thing] for [purpose] — [why it mattered]." (narrative)
  D: "[Verb] [thing] using [tool]; [outcome]." (compound)
- Each role with 3+ bullets must use at least 2 different patterns.

VARY BULLET LENGTH:
- Mix short punchy bullets (80-120 chars) with detailed ones (150-200 chars).
- Not every bullet should be the same length.

DO NOT INVENT METRICS:
- If original bullet has no number, do NOT add one.
- BAD: Original "Built dashboard" → "Built dashboard, improving productivity by 35%"
- GOOD: Original "Built dashboard" → "Built admin dashboard used by 15-person ops team for real-time order tracking."

USE NATURAL LANGUAGE:
- Write like an engineer/analyst describing work to a peer, not a press release.
- Prefer concrete nouns: "payment service" not "solution", "Slack bot" not "communication tool".
- Prefer simple verbs: "built" > "architected" (unless actual architecture), "fixed" > "remediated", "wrote" > "authored", "ran" > "facilitated".
- Use the candidate's OWN vocabulary. If they say "built", don't upgrade to "engineered".

EXCEPTIONS: "Architected" is acceptable when describing actual system architecture work (designing infrastructure, defining service boundaries, choosing patterns). It is NOT acceptable as a fancy synonym for "built" or "set up".
`;

const STRATEGY_INSTRUCTIONS = {
    profile_focus: `STRATEGY: PRESERVE ORIGINAL (Target ATS: 75-85%)
- Keep ALL original bullet wording and metrics exactly as-is.
- Do NOT add any keywords not already in the original resume.
- Skills: reorder by JD relevance, but add nothing new.
- Summary/Projects: only minimal adjustment for role title match.`,

    jd_focus: `STRATEGY: MAXIMIZE ATS MATCH (Target ATS: 90-95%)
- MANDATORY: Every mandatory keyword MUST appear in specific skills AND >1 bullet.
- Summary: Weave in 4-5 mandatory keywords naturally.
- Skills: Include ALL mandatory + preferred. Rename categories.
- Bullets: Integrate keywords INTO action (not suffix).
  BAD: "Built X, focusing on Y"
  GOOD: "Built Y-based X"
- If a keyword is in skills but 0 bullets, weave into most relevant bullet.
- Start bullets with JD action verbs where fitting.
- Aim for 60-70% keyword coverage in bullets.`,

    balanced: `STRATEGY: BALANCED OPTIMIZATION (Target ATS: 85-90%)
- Summary: Include 3-4 top mandatory keywords.
- Skills: Add missing JD keywords to categories.
- Bullets: Integrate JD terms naturally into action (50-60% coverage).
  BAD: "Task, with focus on X"
  GOOD: "X-based Task"
- NOT every bullet needs a keyword.
- Preserve all original metrics and substance.`
};

export function buildTailorPrompt(baseResume, jdAnalysis, tailoringStrategy, bulletCounts, pageMode = '1page', mustIncludeItems = null, formatSettings = null) {
    const strategy = STRATEGY_INSTRUCTIONS[tailoringStrategy] || STRATEGY_INSTRUCTIONS.balanced;
    const mandatory = jdAnalysis.mandatory_keywords || [];
    const preferred = jdAnalysis.preferred_keywords || [];
    const verbs = jdAnalysis.action_verbs || [];
    const techNuances = jdAnalysis.tech_stack_nuances || [];
    const industryTerms = jdAnalysis.industry_terms || [];

    // Estimate candidate's actual years of experience from resume dates
    const estimateCandidateYears = (resume) => {
        const items = resume.experience || [];
        if (items.length === 0) return 0;
        let earliest = new Date(), latest = new Date(0);
        for (const item of items) {
            if (!item.dates) continue;
            const parts = item.dates.split(/[-–—]/);
            const parseDate = (s) => {
                const t = (s || '').trim().toLowerCase();
                if (t === 'present') return new Date();
                const d = new Date(t);
                return isNaN(d) ? null : d;
            };
            const start = parseDate(parts[0]);
            const end = parts[1] ? parseDate(parts[1]) : start;
            if (start && start < earliest) earliest = start;
            if (end && end > latest) latest = end;
        }
        return Math.max(0, Math.round((latest - earliest) / (365.25 * 24 * 60 * 60 * 1000) * 2) / 2);
    };

    const candidateYrs = estimateCandidateYears(baseResume);

    const seniorityNote = buildSeniorityGuidance(
        jdAnalysis.seniority,
        jdAnalysis.years_experience,
        String(candidateYrs)
    );

    // --- Page constraint ---
    let pageNote = '';
    if (pageMode === '1page') {
        pageNote = `TARGET: One page. Write concise bullets (cut filler "in order to", "which allowed for") but KEEP all metrics/tools. Combine skill categories (max 4). Education GPA line only. Last resort: remove 0-overlap projects.
NON-NEGOTIABLE: NEVER remove experience/education entries. NEVER remove bullets (shorten instead). NEVER drop metrics.`;

        if (mustIncludeItems) {
            const includes = Object.entries(mustIncludeItems)
                .filter(([, v]) => v && v.length > 0)
                .map(([sec, ids]) => `  ${sec}: ${ids.map(id => `"${id}"`).join(', ')}`)
                .join('\n');
            if (includes) pageNote += `\nMANDATORY INCLUSIONS:\n${includes}`;
        }
    } else {
        pageNote = `TARGET: Two pages. Include ALL sections/items. Experience: 3-5 bullets. Projects: 2-3.`;
    }

    // --- Bullet count overrides ---
    let bulletNote = '';
    if (bulletCounts) {
        const parts = [];
        ['experience', 'projects', 'leadership', 'research'].forEach(sec => {
            if (bulletCounts[sec]?.length > 0) {
                const items = (baseResume[sec] || []).map((item, i) => {
                    const name = item.company || item.name || item.organization || item.title || `Item ${i + 1}`;
                    const count = bulletCounts[sec][i];
                    return count !== undefined ? `${name}: exactly ${count} bullets` : null;
                }).filter(Boolean);
                if (items.length > 0) parts.push(`${sec}: ${items.join(', ')}`);
            }
        });
        if (parts.length > 0) bulletNote = `=== BULLET COUNT OVERRIDES ===\n${parts.join('\n')}`;
    }

    return `You are an expert ATS resume optimizer. Rewrite this resume to maximize keyword match and pass both ATS screening and human hiring manager review.

=== TARGET JOB ===
Company: ${jdAnalysis.company_name || 'Unknown'}
Role: ${jdAnalysis.job_title || 'Unknown'}
Domain: ${jdAnalysis.domain_context || 'Unknown'}
${jdAnalysis.company_description ? `About: ${jdAnalysis.company_description}` : ''}

=== KEYWORDS ===
Mandatory: ${mandatory.join(', ')}
Preferred: ${preferred.join(', ')}
Verbs: ${verbs.join(', ')}
Tech: ${techNuances.join(', ')}
Industry: ${industryTerms.join(', ')}

=== STRATEGY ===
${strategy}

${seniorityNote}

${pageNote}

${bulletNote}

=== CANDIDATE RESUME ===
${JSON.stringify(baseResume)}

=== REWRITING RULES ===

Rule 1 — SUMMARY (exactly 4 sentences, third person, NO pronouns — "I", "my", "his", "her", "their"):

Sentence 1 = [Role title] with [X] years of experience in [2-3 specific domains from resume].
- Calculate years from WORK EXPERIENCE dates only (not education). Internships = partial years. Round to nearest half.
- The verb/scope must match what the candidate ACTUALLY did. Do not inflate: if they built one system, say "building", not "architecting enterprise-scale systems". If they worked on a team, don't imply they led.

Sentence 2 = Skilled in [5-7 specific tool/framework names from both resume AND JD].
- List ACTUAL TOOL NAMES (Python, PyTorch, LangChain, AWS), not capability claims ("building RAG architectures", "deploying high-availability models").
- This sentence is the primary ATS keyword hook — pack it with matchable nouns.

Sentence 3 = [One concrete achievement pulled from the experience section, with a real metric].
- MUST reference a metric that ALREADY EXISTS in the resume (users served, latency reduced, accuracy %, uptime %).
- If the resume has no metrics at all, describe a specific deliverable with its scope (what was built + who used it + at what scale). Do NOT invent a percentage.

Sentence 4 = Background in [2-3 concrete domain areas, NOT abstract phrases].
- Name specific fields: "NLP systems", "fraud detection", "e-commerce recommendations", "MLOps automation" — not "real-time production environments" or "scalable cloud solutions".
- If the candidate has published research or certifications, mention it here as a differentiator.

GLOBAL SUMMARY RULES:
- No buzzword chains: never put 3+ abstract nouns in a row ("scalable Generative AI systems and MLOps pipelines"). Break them into concrete items.
- A 2-sentence summary is TOO SHORT. A 5-sentence summary is TOO LONG. Exactly 4.
- NEVER include: visa status, "passionate about", "seeking a role", "results-driven", "proven track record", "Expert in", "Expertise in", "leverage", "utilize".

Rule 2 — BULLETS:
Structure: "Accomplished [X] as measured by [Y], by doing [Z]".
BAD: "Reduced latency by 40%, with expertise in Cloud"
GOOD: "Deployed low-latency service on AWS, reducing p95 latency by 40%"

TEST: If removing the keyword doesn't change what work the bullet describes, the keyword is decoration — remove it from the bullet, keep in skills only.

PRESERVE architectural reasoning: phrases like "to separate X from Y", "enabling Z to scale independently", "by decoupling A from B" show system design thinking. Cut filler words around them, but KEEP these clauses — they're what hiring managers care about most.

Rule 3 — SKILLS:
Every mandatory keyword must appear. Rename categories to match JD. Max 4 categories. No parenthetical expansions (use JD form). Priority: 70% JD keywords, 30% candidate's other strengths.
Keep up to 5 non-JD skills that demonstrate production/infrastructure breadth (Kafka, Terraform, Spark, etc.). Only drop non-JD skills that are truly irrelevant to the role's domain (e.g., drop Tableau for a pure backend role, keep Docker even if JD doesn't mention it).

Rule 4 — PROJECTS & RESEARCH:
Projects: Inject related JD keywords ONLY if tech field overlaps and era is plausible. Max 1 modified bullet per project. NEVER fabricate implausible tech.
Research: NEVER modify research/publication bullets — published work is immutable. Do not inject keywords into paper descriptions. Keywords from research topics can appear in the skills section.

Rule 5 — INTEGRITY:
NEVER invent companies, roles, dates, or metrics. NEVER change company names.

Rule 6 — FORMATTING:
NEVER insert spaces between letters ("P y t h o n"). Only renderable sections in section_order (no "name"/"contact").

${ANTI_AI_WRITING_RULES}

=== FINAL CHECK BEFORE OUTPUT ===
Before output: verify NO bullet ends with "with a focus on...", "utilizing...", "with expertise in...", "leveraging...", or "ensuring...". Rewrite any that do.
Every bullet MUST end with a period. If a bullet does not end with ".", add one.


FORMATTING: Output all text as normal continuous words. NEVER insert spaces between individual characters of a word.

` + 'Return ONLY JSON in ```json``` block:\n```json\n' + `{
  "name": "${baseResume.name || ''}",
  "contact": ${JSON.stringify(baseResume.contact || { location: "", phone: "", email: "", linkedin_url: "", portfolio_url: "" })},
  "summary": "rewritten summary",
  "education": [{"institution":"","degree":"","gpa":"","dates":"","location":"","bullets":[]}],
  "skills": {"Category": "skill1, skill2"},
  "experience": [{"company":"","role":"","dates":"","location":"","bullets":["bullet1"]}],
  "projects": [{"name":"","tech":"","dates":"","bullets":[]}],
  "leadership": [{"organization":"","role":"","dates":"","location":"","bullets":[]}],
  "research": [{"title":"","conference":"","dates":"","link":"","bullets":[]}],
  "certifications": [{"name":"","issuer":"","dates":""}],
  "awards": [{"name":"","organization":"","dates":""}],
  "volunteering": [{"organization":"","role":"","dates":"","location":"","bullets":[]}],
  "languages": "${baseResume.languages || ''}",
  "section_order": ${JSON.stringify(baseResume.section_order || ["summary", "skills", "experience", "projects", "education"])},
  "excluded_items": {"projects":[],"experience":[],"leadership":[],"research":[],"certifications":[],"awards":[],"volunteering":[]}
}
` + '```\n' + `Use item names as string identifiers in excluded_items.`;
}


// ---------- 4. ATS SCORE ANALYSIS ----------

export function buildAnalysisPrompt(resumeData, jdText, jdAnalysis = null) {
    const flatResume = flattenResumeForAnalysis(resumeData);
    const keywordsSection = jdAnalysis ? `
PARSED JD KEYWORDS:
Mandatory: ${(jdAnalysis.mandatory_keywords || []).join(', ')}
Preferred: ${(jdAnalysis.preferred_keywords || []).join(', ')}
` : '';

    return `You are a senior recruiter and ATS scoring engine. Score this resume for keyword match AND audit it for quality.

=== JOB DESCRIPTION ===
${jdText}
${keywordsSection}
=== RESUME ===
${flatResume}

=== PART 1: ATS SCORING ===
Adjust scoring expectations for seniority: For junior roles (0-2 yrs), a score of 70+ is strong. For mid-level (3-7 yrs), 75+ is strong. For senior+ (8+ yrs), focus more on leadership/strategy keyword presence and less on individual tool mentions.

Score placement: Skills=0.7 | Summary=+0.5 | Bullet=+0.7 | Project=+0.4. Max 2.3/KW.
Formula: (kw_pts/max) * 70 + soft_skills * 12 + relevance * 18.
Grades: >90 Exceptional, >85 Excellent, >75 Strong, >65 Good.

=== PART 2: QUALITY AUDIT (Check 1-5) ===
1. SUMMARY: Has years? Metric? Domain fit? No pronouns/clichés?
2. KEYWORD STUFFING: Any bullet ending with disconnected "focusing on X", "ensuring Y"?
3. BULLETS: Any stubs (<60 chars)? Vague filler? Mismatched keywords (e.g. AI tool in unrelated bullet)?
4. SKILLS: No duplicates? No parenthetical expansions?
5. GAPS: Missing requirements?
6. AI-SOUNDING LANGUAGE: Flag bullets using "spearheaded", "orchestrated", "synergized", "pioneered", "innovative solutions", "cutting-edge", "leveraging", "significantly improved", "effectively managed", "successfully delivered", "diverse stakeholders", "ensuring alignment". Also flag if ALL bullets in a role use identical "[Verb] [object] resulting in [metric]" structure.

Rate each: CRITICAL, MODERATE, MINOR.

` + 'Return ONLY JSON in ```json``` block:\n```json\n' + `{
  "score": 0,
  "missing_keywords": [],
  "weak_keywords": [],
  "matching_areas": ["3-5 strengths"],
  "summary_feedback": "paragraph",
  "audit": {
    "summary_issues": [{"issue": "desc", "severity": "CRITICAL|MODERATE|MINOR"}],
    "stuffing_found": [{"bullet": "text", "stuffed_phrase": "phrase", "severity": "CRITICAL"}],
    "bullet_issues": [{"section": "exp", "item": "name", "bullet": "text", "issue": "desc", "fix": "rewrite", "severity": "MODERATE"}],
    "skills_issues": [{"issue": "desc", "severity": "MODERATE"}],
    "content_gaps": [{"requirement": "req", "suggestion": "fix", "severity": "CRITICAL"}],
    "ai_language_issues": [{"bullet": "text", "issue": "what sounds AI", "fix": "rewrite", "severity": "MODERATE"}]
  },
  "top_3_actions": ["fix1", "fix2", "fix3"]
}
` + '```';
}


// ---------- 5. APPLICATION QUESTION ANSWERER ----------


export function buildQuestionPrompt(question, resumeData, jdText) {
    const fullResume = flattenResumeForAnalysis(resumeData);

    return `You are this applicant answering a job application question. Write as them — first person, using their real background.

=== APPLICANT RESUME ===
${fullResume}

=== JOB DESCRIPTION ===
${jdText || 'Not provided'}

=== QUESTION ===
"${question}"

=== INSTRUCTIONS ===
Classify and answer:

FACTUAL (stack, years, salary, visa): Answer directly using resume data. 1-3 sentences.
BEHAVIORAL (challenge, time you...): Real resume experience. Context -> Action -> Result. 3-5 sentences.
MOTIVATIONAL (why this role?): Connect info from JD to your background. 2-4 sentences.
OPEN-ENDED: Highlight 1-2 non-obvious strengths. Concise.

Rules:
- First person. Sound like a real person, not a press release.
- Use specific details (companies, tools, metrics) from resume.
- Vary sentence length. Mix short direct sentences with longer ones.
- NEVER use: "passionate about", "proven track record", "innovative solutions", "diverse stakeholders", "leverage/utilize", "spearheaded", "orchestrated".
- Prefer the candidate's own vocabulary from their resume over formal synonyms.
- Match voice to experience level: junior = enthusiastic, specific about technical work. Senior = confident, focused on impact/strategy.
- If resume lacks info, give best answer possible without fabricating.
- Output ONLY the answer text — no labels, no "Answer:", no quotes.`;
}


// ---------- 6. EXTRACT PROFILE FROM RESUME TEXT ----------

export function buildExtractProfilePrompt(resumeText) {
    return `You are an expert resume parser. Extract structured data from this resume text.

=== RESUME TEXT ===
${resumeText}

=== EXTRACTION RULES ===
Rule 1: NAME is usually the first prominent text.
Rule 2: CONTACT: email, phone, city/state, URLs (look for [Extracted Link]).
Rule 3: Map headers to standard sections (Professional Experience -> experience, etc).
Rule 4: BULLETS: Split where new action verbs start.
Rule 5: DATES: Normalize to "Mon YYYY - Mon YYYY".
Rule 6: SKILLS: Group by type (tools, languages).
Rule 7: PRESERVE all metrics, numbers, exact wording. Keep GPAs in their original scale (4.0, 10.0, percentage, letter grade) — do NOT convert between scales.
Rule 8: section_order = order they appear. Only include sections with content.
Rule 9: Do NOT rephrase or summarize.


FORMATTING: Output all text as normal continuous words. NEVER insert spaces between individual characters of a word.

` + 'Return ONLY JSON in ```json``` block:\n```json\n' + `{
  "name": "Full Name",
  "contact": {"location":"","phone":"","email":"","linkedin_url":"","portfolio_url":""},
  "summary": "content or empty",
  "education": [{"institution":"","degree":"","gpa":"","dates":"","location":"","bullets":[]}],
  "skills": {"Category": "skill1, skill2"},
  "experience": [{"company":"","role":"","dates":"","location":"","bullets":["exact text"]}],
  "projects": [{"name":"","tech":"","dates":"","bullets":[]}],
  "leadership": [{"organization":"","role":"","dates":"","location":"","bullets":[]}],
  "research": [{"title":"","conference":"","dates":"","link":"","bullets":[]}],
  "certifications": [{"name":"","issuer":"","dates":""}],
  "awards": [{"name":"","organization":"","dates":""}],
  "volunteering": [{"organization":"","role":"","dates":"","location":"","bullets":[]}],
  "languages": "",
  "section_order": ["summary", "skills", ...]
}
` + '```';
}


// ============================================================
// POST-PROCESSING HELPERS
// ============================================================
export function convert_markdown_to_html(text) {
    if (!text) return text;
    text = text.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    text = text.replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>');
    return text;
}

/**
 * Fix character-spaced hallucinations: "P y t h o n" → "Python"
 * Handles full spacing, partial spacing, and special chars like C++, C#, Node.js
 * Uses regex pattern matching to find runs of single chars separated by spaces,
 * without touching normal multi-word text like "I am fine".
 */
function deCharSpace(str) {
    if (!str || typeof str !== 'string' || str.length < 5) return str;

    // Find runs of (single non-space char + space) repeated 2+ times ending with single char
    // Matches "P y t h o n" but NOT "I am fine"
    const CHAR_SPACED_RUN = /(?<![A-Za-z0-9])([A-Za-z0-9+#.]) ([A-Za-z0-9+#.])( [A-Za-z0-9+#.]){1,}(?![A-Za-z0-9])/g;

    let fixed = str.replace(CHAR_SPACED_RUN, (match) => match.replace(/ /g, ''));

    // Restore expected spaces after punctuation that got collapsed
    fixed = fixed.replace(/,([A-Za-z])/g, ', $1');
    fixed = fixed.replace(/\.([A-Z])/g, '. $1');

    return fixed;
}

/**
 * Recursively apply deCharSpace to all string values (and keys) in an object.
 * Use AFTER JSON.parse to clean character-spacing inside parsed resume data.
 */
export function deCharSpaceDeep(obj) {
    if (typeof obj === 'string') return deCharSpace(obj);
    if (Array.isArray(obj)) return obj.map(deCharSpaceDeep);
    if (obj && typeof obj === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
            out[deCharSpace(k)] = deCharSpaceDeep(v);
        }
        return out;
    }
    return obj;
}

export function clean_tailored_resume(resume_data) {
    // Deep-clean all string values for character-spacing hallucinations FIRST
    resume_data = deCharSpaceDeep(resume_data);

    // Clean summary
    if (resume_data.summary) {
        resume_data.summary = convert_markdown_to_html(resume_data.summary);
    }

    // Clean skills
    if (resume_data.skills) {
        const fixed = {};
        for (const [cat, val] of Object.entries(resume_data.skills)) {
            let v = Array.isArray(val) ? val.join(", ") : String(val);
            fixed[cat] = convert_markdown_to_html(v);
        }
        resume_data.skills = fixed;
    }

    // Clean bullets in all sections
    ['experience', 'projects', 'leadership', 'research', 'volunteering'].forEach(sec => {
        if (resume_data[sec]) {
            resume_data[sec].forEach(item => {
                if (item.bullets) {
                    item.bullets = item.bullets.map(b => {
                        let cleaned = convert_markdown_to_html(b);
                        if (cleaned && !/[.!?]$/.test(cleaned.replace(/<\/[^>]+>$/g, '').trim())) {
                            cleaned = cleaned.replace(/\s*$/, '.');
                        }
                        return cleaned;
                    });
                }
            });
        }
    });

    // Fix section_order
    if (resume_data.section_order) {
        const NON_SECTION = ['name', 'contact', 'section_order', 'section_titles', 'excluded_items'];
        resume_data.section_order = resume_data.section_order.filter(s => !NON_SECTION.includes(s));
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

    // Deduplicate skills: strip parenthetical expansions, remove exact + near-duplicates across categories
    if (resume_data.skills && typeof resume_data.skills === 'object') {
        const seen = new Set();
        const cleaned = {};
        for (const [cat, val] of Object.entries(resume_data.skills)) {
            const skillStr = Array.isArray(val) ? val.join(', ') : String(val);
            const skills = skillStr.split(/,\s*/).map(s => s.trim()).filter(Boolean);
            const unique = [];
            for (const skill of skills) {
                const clean = skill.replace(/\s*\([^)]*\)\s*/g, '').trim();
                const normalized = clean.toLowerCase();
                const isNearDupe = [...seen].some(s =>
                    (normalized.includes(s) && s.length > 2) ||
                    (s.includes(normalized) && normalized.length > 2)
                );
                if (normalized && !seen.has(normalized) && !isNearDupe) {
                    seen.add(normalized);
                    unique.push(clean);
                }
            }
            if (unique.length > 0) {
                cleaned[cat] = unique.join(', ');
            }
        }
        resume_data.skills = cleaned;
    }

    return resume_data;
}

/**
 * Ensure all mandatory JD keywords appear in at least the skills section.
 * Safety net for when the AI drops keywords (common with free-tier models).
 */
export function ensure_keyword_coverage(resume_data, jdAnalysis) {
    if (!jdAnalysis || !resume_data.skills) return resume_data;

    const mandatory = jdAnalysis.mandatory_keywords || [];
    const preferred = jdAnalysis.preferred_keywords || [];
    if (mandatory.length === 0 && preferred.length === 0) return resume_data;

    const NON_SKILL_TERMS = new Set([
        'transparency', 'communication', 'leadership', 'teamwork',
        'problem-solving', 'critical thinking', 'attention to detail',
        'time management', 'adaptability', 'work ethic', 'initiative',
        'collaboration', 'self-driven', 'continuously learn', 'new challenges',
        'analytical skills', 'strong communication skills', 'communication skills',
        'stakeholder management', 'interpersonal skills', 'organizational skills',
        'metric alignment', 'statistical rigor',
        'data-driven decision-making', 'data-informed decision-making',
        'best practices', 'actionable insights', 'business strategy',
        'startup environment', 'fast-paced environment', 'cross-functional',
        'hybrid', 'remote', 'on-site',
        'large-scale data', 'large datasets', 'data-driven',
    ].map(t => t.toLowerCase()));

    const softSkills = new Set((jdAnalysis.soft_skills || []).map(s => s.toLowerCase()));

    // Flatten all skills text for matching
    const allSkillsText = Object.values(resume_data.skills)
        .map(v => (Array.isArray(v) ? v.join(', ') : String(v)).toLowerCase())
        .join(' | ');

    const missingFromSkills = [];
    for (const kw of [...mandatory, ...preferred]) {
        const kwLower = kw.toLowerCase();
        if (NON_SKILL_TERMS.has(kwLower) || softSkills.has(kwLower)) continue;
        if (!allSkillsText.includes(kwLower)) {
            missingFromSkills.push(kw);
        }
    }

    if (missingFromSkills.length === 0) return resume_data;

    // Add to last existing category or create "Additional Skills"
    const categories = Object.keys(resume_data.skills);
    const target = categories.length > 0 ? categories[categories.length - 1] : 'Additional Skills';
    const existing = resume_data.skills[target] || '';
    const existingStr = Array.isArray(existing) ? existing.join(', ') : String(existing);
    const toAdd = missingFromSkills.filter(kw => !existingStr.toLowerCase().includes(kw.toLowerCase()));

    if (toAdd.length > 0) {
        resume_data.skills[target] = existingStr + (existingStr ? ', ' : '') + toAdd.join(', ');
        console.debug(`[keyword-coverage] Added ${toAdd.length} missing keywords to "${target}": ${toAdd.join(', ')}`);
    }

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

    // Always restore name and contact from original
    if (original.name) generated.name = original.name;
    if (original.contact) generated.contact = original.contact;

    // Restore education immutable fields
    if (generated.education && original.education) {
        generated.education.forEach((edu, i) => {
            const orig = original.education[i];
            if (orig) {
                edu.institution = orig.institution || orig.school || edu.institution;
                edu.degree = orig.degree || edu.degree;
                edu.gpa = orig.gpa || edu.gpa;
                edu.dates = orig.dates || edu.dates;
                edu.location = orig.location || edu.location;
            }
        });
    }

    // Let AI's section_order stand; fall back to original only if missing
    if (!generated.section_order && original.section_order) {
        generated.section_order = original.section_order;
    }
    if (original.section_titles) {
        generated.section_titles = { ...original.section_titles, ...(generated.section_titles || {}) };
    }
    return generated;
}

export function enforce_bullet_limits(resume_data, bullet_counts) {
    const MINIMUMS = { experience: 2, projects: 2, leadership: 1, research: 1 };

    ['experience', 'projects', 'leadership', 'research'].forEach(sec => {
        if (!resume_data[sec]) return;
        const min = MINIMUMS[sec] || 1;

        resume_data[sec].forEach((item, i) => {
            if (!item.bullets) return;

            // User-specified exact counts override everything
            if (bullet_counts?.[sec]?.[i] !== undefined) {
                const requested = bullet_counts[sec][i];
                if (requested > 0 && item.bullets.length > requested) {
                    item.bullets = item.bullets.slice(0, requested);
                }
            }

            // Informational only — can't fabricate bullets in code
            if (item.bullets.length < min) {
                console.debug(`[bullet-limits] ${sec}[${i}] has ${item.bullets.length} bullets (guideline min: ${min})`);
            }
        });
    });

    // Skills category cap
    if (resume_data.skills && typeof resume_data.skills === 'object' && !Array.isArray(resume_data.skills)) {
        const entries = Object.entries(resume_data.skills);
        if (entries.length > 4) {
            resume_data.skills = Object.fromEntries(entries.slice(0, 4));
        }
    }

    return resume_data;
}

function flattenResumeForAnalysis(data) {
    let t = '';
    if (data.name) t += `NAME: ${data.name}\n`;
    if (data.summary) t += `SUMMARY: ${data.summary}\n\n`;

    if (data.skills) {
        t += 'SKILLS:\n';
        if (typeof data.skills === 'object' && !Array.isArray(data.skills)) {
            for (const [c, v] of Object.entries(data.skills)) {
                t += `  ${c}: ${Array.isArray(v) ? v.join(', ') : String(v)}\n`;
            }
        } else if (Array.isArray(data.skills)) {
            t += `  ${data.skills.join(', ')}\n`;
        }
        t += '\n';
    }

    ['experience', 'projects', 'leadership', 'research', 'volunteering'].forEach(sec => {
        if (data[sec]?.length > 0) {
            t += `${sec.toUpperCase()}:\n`;
            data[sec].forEach(item => {
                const title = item.company || item.organization || item.name || item.title || '';
                const role = item.role || item.degree || '';
                t += `  ${title}${role ? ' - ' + role : ''} (${item.dates || ''})\n`;
                item.bullets?.forEach(b => { t += `    - ${b}\n`; });
            });
            t += '\n';
        }
    });

    if (data.education?.length > 0) {
        t += 'EDUCATION:\n';
        data.education.forEach(e => {
            t += `  ${e.institution || ''} - ${e.degree || ''} (${e.dates || ''})\n`;
            if (e.gpa) t += `    GPA: ${e.gpa}\n`;
            e.bullets?.forEach(b => { t += `    - ${b}\n`; });
        });
        t += '\n';
    }

    if (data.certifications?.length > 0) {
        t += 'CERTIFICATIONS:\n';
        data.certifications.forEach(c => { t += `  ${c.name} - ${c.issuer || ''} (${c.dates || ''})\n`; });
        t += '\n';
    }

    if (data.languages) {
        t += `LANGUAGES: ${Array.isArray(data.languages) ? data.languages.join(', ') : data.languages}\n`;
    }
    return t;
}

/**
 * Detect and warn about metrics lost during tailoring.
 * Informational only — helps debug prompt quality.
 */
export function audit_metric_preservation(tailoredData, baseResume) {
    if (!baseResume || !tailoredData) return;

    const extractMetrics = (text) => {
        if (!text) return [];
        return (text.match(/\d[\d,.]*[+%]?|\$[\d,.]+[KMB]?/g) || []).map(m => m.trim());
    };

    ['experience', 'projects', 'leadership', 'research'].forEach(sec => {
        const baseItems = baseResume[sec] || [];
        const tailoredItems = tailoredData[sec] || [];

        baseItems.forEach(baseItem => {
            const baseName = (baseItem.company || baseItem.name || baseItem.organization || baseItem.title || '').toLowerCase();
            const tailoredItem = tailoredItems.find(t => {
                const tName = (t.company || t.name || t.organization || t.title || '').toLowerCase();
                return tName === baseName || tName.includes(baseName) || baseName.includes(tName);
            });
            if (!tailoredItem) return;
            const tailoredText = (tailoredItem.bullets || []).join(' ');

            (baseItem.bullets || []).forEach(bullet => {
                extractMetrics(bullet).forEach(metric => {
                    if (!tailoredText.includes(metric)) {
                        console.warn(`[metric-audit] "${baseName}": metric "${metric}" missing from tailored output`);
                    }
                });
            });
        });
    });
}
/**
 * Remove hallucinated skills that appear in neither the base resume nor the JD.
 * Free-tier models sometimes invent tools (PowerBI, Ansible, etc.) not in either source.
 */
export function remove_hallucinated_skills(resume_data, baseResume, jdAnalysis) {
    if (!resume_data.skills || !baseResume || !jdAnalysis) return resume_data;

    // Build a set of all legitimate skills: from base resume + JD keywords
    const legitimate = new Set();

    // From base resume skills
    if (baseResume.skills) {
        const baseSkills = typeof baseResume.skills === 'object'
            ? Object.values(baseResume.skills).join(', ')
            : String(baseResume.skills);
        baseSkills.split(/,\s*/).forEach(s => {
            const t = s.trim().toLowerCase();
            if (t) legitimate.add(t);
        });
    }

    // From base resume — ALL text content (summary, bullets, tech fields)
    const allBaseText = [
        baseResume.summary || '',
        ...['experience', 'projects', 'leadership', 'research', 'volunteering'].flatMap(sec =>
            (baseResume[sec] || []).flatMap(item => [
                item.tech || '',
                ...(item.bullets || [])
            ])
        )
    ].join(' ').toLowerCase();

    // From JD analysis
    const jdKeywords = [
        ...(jdAnalysis.mandatory_keywords || []),
        ...(jdAnalysis.preferred_keywords || []),
        ...(jdAnalysis.tech_stack_nuances || []),
    ];
    jdKeywords.forEach(k => legitimate.add(k.toLowerCase()));

    // Now filter skills — keep only those that are in the legitimate set
    // Use fuzzy matching: a generated skill is legitimate if any legitimate term contains it or vice versa
    const isLegitimate = (skill) => {
        const lower = skill.toLowerCase();
        for (const legit of legitimate) {
            if (legit.includes(lower) || lower.includes(legit)) return true;
        }
        if (lower.length >= 3 && allBaseText.includes(lower)) return true;
        if (lower.length < 3) {
            const regex = new RegExp(`\\b${lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            if (regex.test(allBaseText)) return true;
        }
        return false;
    };

    let removedCount = 0;
    const cleaned = {};
    for (const [cat, val] of Object.entries(resume_data.skills)) {
        const skillStr = Array.isArray(val) ? val.join(', ') : String(val);
        const skills = skillStr.split(/,\s*/).map(s => s.trim()).filter(Boolean);
        const filtered = skills.filter(s => {
            if (isLegitimate(s)) return true;
            console.debug(`[hallucination-check] Removing "${s}" — not found in base resume or JD`);
            removedCount++;
            return false;
        });
        if (filtered.length > 0) {
            cleaned[cat] = filtered.join(', ');
        }
    }

    if (removedCount > 0) {
        console.debug(`[hallucination-check] Removed ${removedCount} hallucinated skills`);
    }
    resume_data.skills = cleaned;
    return resume_data;
}



/**
 * Remove keyword-stuffing suffix patterns from bullets.
 * Role-agnostic: detects structural patterns, not specific keywords.
 */
export function clean_keyword_stuffing(resume_data, jdAnalysis = null) {
    // Structural suffix patterns that indicate lazy keyword appending.
    // These match the PATTERN, not specific keywords, so they work for any role.
    const STUFFING_PATTERNS = [
        // "..., with a focus on X and Y"
        /,?\s+with\s+(?:a\s+)?focus\s+on\s+.{8,}$/i,
        // "..., utilizing X and Y"
        /,?\s+utilizing\s+.{8,}$/i,
        // "..., with expertise in X and Y"
        /,?\s+with\s+expertise\s+in\s+.{8,}$/i,
        // "..., leveraging X and Y" (long suffix only)
        /,?\s+leveraging\s+.{15,}$/i,
        // "..., through [noun] and [noun]"
        /,?\s+through\s+\w+\s+\w+(?:\s+\w+)*$/i,
        // "..., by applying [X]"
        /,?\s+by\s+applying\s+.{8,}$/i,
    ];

    // Build JD keyword set for smarter detection
    const jdKeywords = new Set();
    if (jdAnalysis) {
        [...(jdAnalysis.mandatory_keywords || []),
        ...(jdAnalysis.preferred_keywords || []),
        ...(jdAnalysis.soft_skills || []),
        ...(jdAnalysis.industry_terms || [])
        ].forEach(k => jdKeywords.add(k.toLowerCase()));
    }

    // Detect if a suffix is keyword-dumping vs legitimate content.
    // Keyword dumps typically contain capitalized tech terms / proper nouns
    // disconnected from the sentence's main action.
    const looksLikeKeywordDump = (suffix) => {
        const lower = suffix.toLowerCase();
        // Check if any JD keyword appears in the suffix
        for (const kw of jdKeywords) {
            if (kw.length >= 4 && lower.includes(kw)) return true;
        }
        // Fallback: capitalized multi-word terms (tech names, tools, methodologies)
        const capitalTerms = suffix.match(/[A-Z][a-zA-Z+#.]*(?:\s+[A-Z][a-zA-Z+#.]*)*/g) || [];
        return capitalTerms.length >= 1;
    };

    // Detect "and [gerund] [Term]" at end of bullet
    // e.g. "and ensuring transparency", "and applying statistical rigor"
    // Requires at least 2 words after the gerund to avoid catching legitimate clauses like "and improving performance"
    const GERUND_SUFFIX = /,?\s+and\s+(?:ensuring|promoting|maintaining|enabling|supporting|applying|utilizing|leveraging|driving|fostering)\s+\S+(?:\s+\S+)+[^.]*$/;

    // Detect "..., [gerund] [Term]" (without "and")
    // e.g. ", applying data-driven decision-making", ", ensuring statistical rigor"
    const BARE_GERUND_SUFFIX = /,\s+(?:ensuring|promoting|maintaining|enabling|supporting|applying|utilizing|leveraging|driving|fostering)\s+\S+(?:\s+\S+)+[^.]*$/;

    // New pattern for "through" clauses
    const THROUGH_SUFFIX = /,?\s+(?:through|via)\s+\S+(?:\s+\S+){1,}$/i;

    const cleanBullet = (bullet) => {
        if (!bullet || typeof bullet !== 'string') return bullet;
        let cleaned = bullet;

        // Check structural patterns first
        for (const pattern of STUFFING_PATTERNS) {
            const match = cleaned.match(pattern);
            if (match && looksLikeKeywordDump(match[0])) {
                cleaned = cleaned.replace(pattern, '').trim();
                cleaned = cleaned.replace(/,\s*$/, '').trim();
                if (cleaned.length > 0 && !cleaned.endsWith('.')) cleaned += '.';
                console.debug(`[anti-stuffing] Removed suffix: "${match[0].trim()}"`);
                return cleaned;
            }
        }

        // Check gerund suffix patterns
        for (const pattern of [GERUND_SUFFIX, BARE_GERUND_SUFFIX, THROUGH_SUFFIX]) {
            const match = cleaned.match(pattern);
            if (match) {
                // Check if the suffix contains a JD keyword or looks like a keyword dump
                if (looksLikeKeywordDump(match[0])) {
                    cleaned = cleaned.replace(pattern, '').trim();
                    cleaned = cleaned.replace(/,\s*$/, '').trim();
                    if (cleaned.length > 0 && !cleaned.endsWith('.')) cleaned += '.';
                    console.debug(`[anti-stuffing] Removed gerund suffix: "${match[0].trim()}"`);
                    break;
                }
            }
        }

        // Final cleanup: fix any dangling "and." or "and ." artifacts
        // from previous cleaning passes or AI generating broken endings
        cleaned = cleaned.replace(/\s+and\s*\.\s*$/, '.').trim();
        cleaned = cleaned.replace(/,\s+and\s*$/, '.').trim();
        cleaned = cleaned.replace(/\s+and\s*$/, '.').trim();

        return cleaned;
    };

    ['experience', 'projects', 'leadership', 'research', 'volunteering'].forEach(sec => {
        if (resume_data[sec]) {
            resume_data[sec].forEach(item => {
                if (item.bullets) {
                    item.bullets = item.bullets.map(b => cleanBullet(b));
                }
            });
        }
    });

    // Clean summary sentences too
    if (resume_data.summary) {
        const sentences = resume_data.summary.split(/(?<=\.)\s+/);
        resume_data.summary = sentences.map(s => cleanBullet(s)).join(' ');
    }

    return resume_data;
}

/**
 * Remove common AI-generated language patterns from resume text.
 * Safety net for when models ignore anti-AI prompt instructions.
 * Call AFTER clean_keyword_stuffing, BEFORE ensure_keyword_coverage.
 */
export function clean_ai_language(resume_data) {
    const REPLACEMENTS = [
        [/\bspearheaded\b/gi, 'led'],
        [/\borchestrated\b/gi, 'coordinated'],
        [/\bsynergized\b/gi, 'combined'],
        [/\bpioneered\b/gi, 'introduced'],
        [/\brevolutionized\b/gi, 'redesigned'],
        [/\bharnessing\b/gi, 'using'],
        [/\butilizing\b/gi, 'using'],
        [/\bleveraging\b/gi, 'using'],
        [/\bfacilitated\b/gi, 'led'],
        [/\bauthored\b/gi, 'wrote'],
        [/\bsignificantly improved\b/gi, 'improved'],
        [/\beffectively managed\b/gi, 'managed'],
        [/\bsuccessfully delivered\b/gi, 'delivered'],
        [/\bsuccessfully\s+/gi, ''],
        [/\beffectively\s+/gi, ''],
        [/\binnovative solutions?\b/gi, 'tools'],
        [/\bcutting-edge\b/gi, 'modern'],
        [/\bbest-in-class\b/gi, 'top-performing'],
        [/\bworld-class\b/gi, 'high-quality'],
        [/\bdiverse stakeholders\b/gi, 'stakeholders'],
        [/\bvarious stakeholders\b/gi, 'stakeholders'],
        [/,?\s*ensuring alignment with business objectives\.?/gi, '.'],
        [/,?\s*in alignment with [\w\s]+\.?/gi, '.'],
        [/\bproven track record\b/gi, 'experience'],
        [/\bthought leader(ship)?\b/gi, 'expert$1'],
        [/\bvalue-add\b/gi, 'value'],
    ];

    const cleanText = (text) => {
        if (!text || typeof text !== 'string') return text;
        let c = text;
        for (const [pattern, replacement] of REPLACEMENTS) {
            c = c.replace(pattern, replacement);
        }
        c = c.replace(/\s{2,}/g, ' ').trim();
        c = c.replace(/^\w/, ch => ch.toUpperCase());
        c = c.replace(/\.\./g, '.').replace(/\s+\./g, '.');
        return c;
    };

    if (resume_data.summary) {
        resume_data.summary = cleanText(resume_data.summary);
    }

    ['experience', 'projects', 'leadership', 'research', 'volunteering'].forEach(sec => {
        if (resume_data[sec]) {
            resume_data[sec].forEach(item => {
                if (item.bullets) {
                    item.bullets = item.bullets.map(b => cleanText(b));
                }
            });
        }
    });

    return resume_data;
}
