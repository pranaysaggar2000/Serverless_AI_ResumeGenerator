// ============================================================
// ai_prompts.js — ForgeCV Prompt Builder (v3 — Full PE Overhaul)
// ============================================================
//
// PROMPT ENGINEERING TECHNIQUES APPLIED:
//
// 1. ROLE PRIMING — Every prompt starts with a specific expert role
//    to activate domain knowledge in the model's weights.
//
// 2. STRUCTURED DELIMITERS — Use ===, ---, XML-style tags to
//    separate instructions from data. Models parse these better
//    than plain paragraphs.
//
// 3. FEW-SHOT INLINE — Show 1-2 concrete input→output examples
//    inside the prompt so the model copies the pattern.
//
// 4. RECENCY BIAS EXPLOIT — Put the most critical rules LAST,
//    right before the JSON schema. Free models weight the end
//    of the prompt most heavily.
//
// 5. CHAIN-OF-CONSTRAINTS — Number rules simply (Rule 1, Rule 2)
//    instead of nested bullets. Models follow numbered lists
//    more reliably than nested hierarchies.
//
// 6. NEGATIVE EXAMPLES — Show "BAD: ..." / "GOOD: ..." pairs
//    for the most common failure modes.
//
// 7. SCHEMA ANCHORING — The JSON schema is ALWAYS the last thing
//    in the prompt. Models copy the last structure they see.
//
// 8. TOKEN BUDGET AWARENESS — Prompts stay under ~1200 words
//    for the tailor prompt (the biggest one). Free-tier models
//    (Llama 70B, Mistral 8x7B) degrade above ~1500 words of
//    instructions.
//
// 9. SYSTEM/USER SPLIT SIMULATION — Even in single-turn prompts,
//    "You are..." priming followed by "---" then the task
//    simulates system+user separation for instruct models.
//
// 10. OUTPUT FORMAT FORCING — "Return ONLY JSON wrapped in
//     ```json ... ```" works better than "Return ONLY valid JSON"
//     because models have been trained to produce code blocks.
//     extractJSON already handles stripping the wrapper.
//
// ============================================================


// ---------- 1. EXTRACT JD FROM RAW PAGE TEXT ----------

export function buildExtractJDFromPagePrompt(rawPageText) {
    const truncated = rawPageText.substring(0, 12000);

    // Technique: Role priming + negative instruction + schema anchoring
    // Added "for resume analysis" to ensure "resume" marker is present for API validation
    return `You are a job posting extraction engine. Your ONLY job is to extract the job description from noisy webpage text for resume analysis.

---
RAW WEBPAGE TEXT:
${truncated}
---

TASK: Extract the job posting content. Ignore everything that is NOT the job posting (navigation menus, cookie banners, footer links, sidebar ads, related jobs, company boilerplate).

Rule 1: Extract the COMPLETE job description verbatim — do not summarize.
Rule 2: Include ALL bullet points for responsibilities, requirements, and qualifications.
Rule 3: company_description = what the company DOES (industry, products, mission), not just the name.
Rule 4: If the page has no job description, return {"error": "No job description found on this page"}.

` + 'Return your answer in ```json``` format:\n```json\n' + `{
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
    // Technique: Role priming + few-shot examples + explicit splitting rule
    return `You are an ATS keyword extraction specialist. Extract every skill, tool, and requirement from this job description.

---
JOB DESCRIPTION:
${jdText}
---

EXTRACTION RULES:

Rule 1 — MANDATORY vs PREFERRED:
- Words near "required", "must have", "X+ years", "essential" → mandatory_keywords
- Words near "nice to have", "preferred", "bonus", "ideally", "plus" → preferred_keywords
- If unclear, default to mandatory

Rule 2 — SPLIT COMPOUND TERMS into individual entries:
BAD:  "Hugging Face / LlamaIndex" as one entry
GOOD: "Hugging Face" and "LlamaIndex" as two separate entries
BAD:  "LoRA / QLoRA" as one entry
GOOD: "LoRA" and "QLoRA" as two separate entries
BAD:  "AWS/GCP/Azure" as one entry
GOOD: "AWS", "GCP", "Azure" as three separate entries

Rule 3 — USE EXACT JD WORDING:
BAD:  "React.js" when JD says "React"
BAD:  "Amazon Web Services" when JD says "AWS"
GOOD: Copy the exact term from the JD

Rule 4 — BE EXHAUSTIVE. Include:
- Programming languages, frameworks, libraries, tools
- Cloud platforms, databases, infrastructure
- Methodologies: "Agile", "Six Sigma", "GAAP", "Prompt Engineering", "CI/CD"
- Practices: "Code Review", "Responsible AI", "Compliance"
- Domain terms: "hybrid search", "vector embeddings", "supply chain", "due diligence"
- Soft skills ONLY if explicitly stated: "communication", "leadership"

Rule 5 — tech_stack_nuances = specific tools, versions, sub-products (e.g. "Python 3.10", "Salesforce CPQ", "Adobe XD", "SAP FICO")
Rule 6 — industry_terms = domain-specific business language (e.g. "underwriting", "ad serving", "clinical trials", "supply chain", "due diligence")
Rule 7 — action_verbs = verbs from the responsibilities section that describe what the person will DO

` + 'Return in ```json``` format:\n```json\n' + `{
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

const STRATEGY_INSTRUCTIONS = {
    profile_focus: `STRATEGY: PRESERVE ORIGINAL (Target ATS: 75-85%)
Rule S1: Keep ALL original bullet wording and metrics exactly as-is.
Rule S2: Do NOT add any keywords not already in the original resume.
Rule S3: Skills section — reorder categories by JD relevance, but add nothing new.
Rule S4: Summary — only adjust to mention the target role title if it's missing.
Rule S5: Projects — keep original descriptions unchanged.`,

    jd_focus: `STRATEGY: MAXIMIZE ATS MATCH (Target ATS: 90-95%)
Rule S1: Every mandatory keyword MUST appear in the skills section AND in at least one bullet with context.
Rule S2: Summary — weave in 4-5 mandatory keywords naturally into the sentence structure.
Rule S3: Skills — include ALL mandatory + preferred keywords. Rename categories to match JD language.
Rule S4: Bullets — integrate JD keywords INTO the action/method/tool part of the sentence, not as a suffix.
  BAD:  "Automated pipelines using Airflow, with a focus on AI Compliance and Responsible AI practices"
  BAD:  "Built a chatbot, utilizing PyTorch and TensorFlow for model training"
  BAD:  "Reduced latency by 40%, with expertise in Model deployment and Cloud platforms"
  GOOD: "Automated AI model validation pipelines using Airflow DAGs with compliance checks for responsible AI deployment"
  GOOD: "Fine-tuned transformer model in PyTorch, achieving 92% accuracy on domain classification task"
  GOOD: "Deployed low-latency inference service on AWS EKS, reducing p95 response time from 800ms to 200ms"
  The keyword must describe WHAT you did or HOW you did it — never tacked on at the end.
Rule S5: If a keyword appears in skills but ZERO bullets, find the most relevant bullet and weave it in naturally.
Rule S6: Use JD action verbs to start bullets where they fit.
Rule S7: NOT every bullet needs a JD keyword. A strong metric-driven bullet with no keyword is better than a weak bullet with keywords stuffed in. Aim for 60-70% of bullets containing a keyword, not 100%.

PROJECT TECH INJECTION:
- For each project, check if mandatory JD keywords are RELATED to that project's existing domain but missing.
- Related = same technical field and era (a backend project can get a backend framework, a data project can get a data tool, a cloud project can get a cloud service — but cross-domain injection is not allowed).
  GOOD: Project already uses tool X for task Y + JD needs tool Z which does the same kind of task → weave Z in naturally.
  BAD:  Project is in domain A + JD keyword is from completely different domain B → Do NOT inject.
- Max 1 new bullet per project. Must read as realistic work.`,

    balanced: `STRATEGY: BALANCED OPTIMIZATION (Target ATS: 85-90%)
Rule S1: Summary — include 3-4 top mandatory keywords woven into the sentence structure.
Rule S2: Skills — add missing JD keywords to appropriate categories.
Rule S3: Bullets — integrate JD terms where they fit naturally into the action/method/tool part of the sentence.
  BAD:  "[Completed task], with a focus on [KEYWORD1] and [KEYWORD2]"
  GOOD: "[Verb] [KEYWORD]-based [system] for [purpose], [achieving metric]"
Rule S4: NOT every bullet needs a keyword. Don't force them where they sound unnatural. 50-60% keyword coverage is fine.
Rule S5: Preserve all original metrics and core meaning.

PROJECT TECH INJECTION (selective):
- If a mandatory JD keyword is closely related to a project's existing tech domain, weave it into an existing bullet.
- ONLY if domains genuinely overlap. Do NOT inject cross-domain tech.
- Prefer modifying existing bullets over adding new ones. Max 1 injection per project.`
};

export function buildTailorPrompt(baseResume, jdAnalysis, tailoringStrategy, bulletCounts, pageMode = '1page', mustIncludeItems = null, formatSettings = null) {
    const strategy = STRATEGY_INSTRUCTIONS[tailoringStrategy] || STRATEGY_INSTRUCTIONS.balanced;

    const mandatory = jdAnalysis.mandatory_keywords || [];
    const preferred = jdAnalysis.preferred_keywords || [];
    const verbs = jdAnalysis.action_verbs || [];
    const techNuances = jdAnalysis.tech_stack_nuances || [];
    const industryTerms = jdAnalysis.industry_terms || [];

    // --- Page constraint ---
    let pageNote = '';
    if (pageMode === '1page') {
        pageNote = `=== PAGE CONSTRAINT: ONE PAGE ===
TARGET one page, but NEVER sacrifice content quality to achieve it. If keeping all detail means slightly overflowing, that is acceptable — the user can trim later.

SPACE-SAVING APPROACH (in this order):
1. Write concise bullets — cut filler words (a, the, in order to, which allowed for), keep all tools/metrics/details.
2. Max 4 skill categories. Combine related ones.
3. Education: GPA line only.
4. LAST RESORT: Remove projects/leadership/awards with ZERO JD keyword overlap (list in excluded_items by name).

NON-NEGOTIABLE:
- NEVER remove experience or education entries.
- NEVER remove bullets from experience — shorten them instead.
- NEVER drop metrics or tool names from bullets to save space.`;

        if (mustIncludeItems) {
            const includes = Object.entries(mustIncludeItems)
                .filter(([, v]) => v && v.length > 0)
                .map(([sec, ids]) => `  ${sec}: ${ids.map(id => `"${id}"`).join(', ')}`)
                .join('\n');
            if (includes) pageNote += `\nMANDATORY INCLUSIONS (never remove these):\n${includes}`;
        }
    } else {
        pageNote = `=== PAGE CONSTRAINT: TWO PAGES ===
- Experience: 3-5 bullets. Projects: 2-3. Leadership: 1-2.
- Include ALL sections and items. Set excluded_items to empty arrays.`;
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
        if (parts.length > 0) bulletNote = `=== BULLET COUNT OVERRIDES (user-specified, must follow exactly) ===\n${parts.join('\n')}`;
    }

    // Technique: Role priming, structured delimiters, numbered rules,
    // negative examples, recency bias (critical rules + schema at end)
    return `You are an expert ATS resume optimizer. Rewrite this resume to maximize keyword match for the target job.

=== TARGET JOB ===
Company: ${jdAnalysis.company_name || 'Unknown'}
Role: ${jdAnalysis.job_title || 'Unknown'}
Seniority: ${jdAnalysis.seniority || 'Unknown'}
Domain: ${jdAnalysis.domain_context || 'Unknown'}
${jdAnalysis.company_description ? `About: ${jdAnalysis.company_description}` : ''}

=== KEYWORDS (each mandatory keyword MUST appear in skills + at least one bullet) ===
Mandatory: ${mandatory.join(', ')}
Preferred: ${preferred.join(', ')}
Action verbs: ${verbs.join(', ')}
Tech specifics: ${techNuances.join(', ')}
Industry terms: ${industryTerms.join(', ')}

=== STRATEGY ===
${strategy}

${pageNote}

${bulletNote}

=== CANDIDATE RESUME ===
${JSON.stringify(baseResume)}

=== REWRITING RULES (follow ALL of these) ===

Rule 1 — SUMMARY (MUST be exactly 4 sentences, third person, NO pronouns):
  NEVER use "I", "my", "me", "am", "his", "her", "their", "enables me".
  BAD:  "I am a Data Scientist with expertise in ML. My experience includes..."
  GOOD: "Data Scientist with 5 years of experience in ML and NLP. Skilled in Python, TensorFlow, and cloud deployment. Built recommendation engine serving 2M users. Background in e-commerce and fintech domains."
  Structure: Sentence 1 = [Role] with [X] years in [domain]. Sentence 2 = Skilled in [3-4 tools from JD]. Sentence 3 = [Concrete accomplishment — use a metric if one exists in the experience section, otherwise describe what was built/delivered without inventing numbers]. Sentence 4 = [Domain fit or industry context].
  Calculate years from the work experience dates if not stated. A 2-sentence summary is TOO SHORT — always write 4 sentences.
  NEVER include: visa status, "passionate about", "seeking a role", "results-driven", "leverage", "utilize".

Rule 2 — BULLETS (most important — read carefully):
  Start with strong action verb (prefer JD verbs: ${verbs.slice(0, 5).join(', ')}).
  Use XYZ formula: "Accomplished [X] as measured by [Y], by doing [Z]".

  PRESERVE ALL ORIGINAL BULLETS — do not remove any:
  Every bullet from the original resume must appear in the output (reworded for JD keywords, but same content).
  If the original has 5 bullets for a role, output 5 bullets. If it has 3, output 3.
  BAD:  Removing bullets to save space, then adding generic filler to compensate.
  BAD:  Replacing a specific original bullet with vague filler like "Improved performance using various techniques"
  GOOD: Rewording each original bullet to be concise and keyword-optimized while keeping all tools, metrics, and details.

  NEVER HOLLOW OUT BULLETS — preserve technical substance:
  BAD:  Dropping specific tools, libraries, metrics, or architectural details from a bullet to shorten it.
  GOOD: Cutting filler words ("a", "the", "in order to", "which allowed for", "significantly") while keeping tool names, metrics, and technical specifics.
  If the original bullet mentions specific tools/libraries, the rewritten bullet must still mention them.
  If the original bullet has a metric (40%, 2000+ users, 30%), the rewritten bullet MUST keep that metric.

  SHORTENING TECHNIQUE — what to cut vs what to keep:
  CUT: articles (a, the), verbose phrases (in order to, which allowed for, resulting in a), redundant context
  KEEP: tool/library names, metrics/numbers, technical architecture details, action verbs
  The goal is the SAME information in fewer words — not less information.

  CRITICAL ANTI-STUFFING RULE — the #1 quality problem to avoid:
  NEVER append keywords to the end of a bullet as a disconnected suffix clause.
  NEVER end a bullet with a keyword that has no logical connection to the work described.

  BAD PATTERN — keyword stapled onto unrelated work:
  "Designed 5+ Airflow DAGs, cutting manual intervention by 60% and ensuring [KEYWORD]"
  "Guided 100+ students and grading assignments, promoting [KEYWORD]"
  "Deployed chatbot on GCP Cloud Run, ensuring [KEYWORD]"
  "Built REST API using Express, with a focus on [KEYWORD] and [KEYWORD]"
  "Reduced query latency by 40%, with expertise in [KEYWORD]"
  "Wrote unit tests for payment module, utilizing [KEYWORD] and [KEYWORD]"

  WHY THESE ARE BAD: The appended keyword has ZERO logical connection to the actual work described in the bullet. The keyword is just glued on as a suffix.

  GOOD PATTERN — keyword is integral to the work described:
  "Designed Airflow DAGs to automate model retraining, reducing manual intervention by 60%"
  "Deployed inference endpoint on AWS EKS, reducing p95 latency from 800ms to 200ms"
  "Built real-time data pipeline using Kafka and Spark, processing 2M events daily"
  "Implemented role-based access controls and audit logging to meet SOC 2 compliance requirements"

  TEST: For each bullet, ask "if I remove the keyword, does the sentence still describe the same work?" If yes, the keyword is just decoration — REMOVE it. Put it in skills only.
  If a keyword doesn't fit naturally in ANY bullet, it is FINE to only have it in the skills section. Do NOT force it.

  Max ~200 characters per bullet. Never write stub bullets under 80 characters like "Developed microservices using FastAPI." — always include the impact or scale.

Rule 3 — SKILLS (this is the #1 most common failure — pay extra attention):
  Go through the mandatory keyword list one by one. EVERY mandatory keyword must appear in a skills category.
  Also add preferred keywords where they fit.
  Rename categories to match JD language where possible.
  Put JD keywords FIRST within each category.
  If a keyword doesn't fit existing categories, create a new one.
  NEVER duplicate a keyword across multiple categories. Each keyword appears EXACTLY ONCE.
  NEVER use parenthetical expansions like "Large Language Models (LLMs)" — just use whichever form the JD uses.
  Group by function: AI/ML tools together, cloud/infra together, languages together. Don't put ML frameworks under "Data Engineering".
  Max 4 categories. Combine related skills rather than creating thin categories.
  PRIORITIZE JD-relevant skills. If space is limited, drop skills from the original resume that have ZERO overlap with the JD before dropping JD keywords. For example, if the JD doesn't mention "Tableau" or "PowerBI" but the resume has them, they can be omitted to make room for JD keywords.
  The skills section should be 70-80% JD keywords and 20-30% candidate's strongest remaining skills.

Rule 4 — PROJECTS (tech injection — be VERY careful):
  You MAY add related JD keywords to project bullets ONLY if:
  a) The project's existing tech stack is in the same field, AND
  b) The technology actually existed and was plausible at the time of the project dates.
  BAD:  Adding a 2024 framework/technique to a 2020 project — check if the technology existed at the project's date.
  BAD:  Adding a tool from a completely different paradigm (e.g. adding a container orchestration tool to an academic research paper, or adding a frontend framework to a data pipeline project).
  GOOD: Adding a JD keyword that is a direct alternative/extension of what the project already uses, from the same era.
  Max 1 modified bullet per project. NEVER fabricate an entirely new bullet with technologies the project clearly didn't use.
  When in doubt, do NOT inject. It's better to leave a project untouched than to add implausible technology.

Rule 5 — INTEGRITY (non-negotiable):
  NEVER invent companies, roles, dates, or metrics. NEVER inflate numbers.
  NEVER change company names, institution names, or dates.
  NEVER add tools/frameworks to a project that the original doesn't mention AND that aren't plausible for that project's scope and timeline.
  NEVER hollow out a detailed bullet into a stub. If the original bullet mentions specific tools (Celery, Redis, async processing), keep those details — they show depth. Reword to fit JD terminology but preserve the technical substance.
  Skills from the candidate's original resume ARE allowed even if not in the JD — but JD keywords take priority for space.
  NEVER add skills that appear in NEITHER the candidate's resume NOR the JD. No inventing from general knowledge.
  The ONLY sources for content are: (1) the candidate's resume and (2) the JD keywords.

Rule 6 — FORMATTING:
  NEVER insert spaces between letters ("P y t h o n" is WRONG, "Python" is CORRECT).
  section_order must ONLY contain renderable sections: summary, education, skills, experience, projects, research, leadership, certifications, awards, volunteering, languages.
  NEVER put "name" or "contact" in section_order.

` + '=== FINAL CHECK BEFORE OUTPUT ===\n' + `
Before generating, verify: NO bullet ends with "with a focus on...", "utilizing...", "with expertise in...", or "leveraging...". If any do, rewrite them.

` + '=== OUTPUT — Return ONLY this JSON in ```json``` block ===\n```json\n' + `{
  "name": "${baseResume.name || ''}",
  "contact": ${JSON.stringify(baseResume.contact || { location: "", phone: "", email: "", linkedin_url: "", portfolio_url: "" })},
  "summary": "rewritten summary here",
  "education": [{"institution":"","degree":"","gpa":"","dates":"","location":"","bullets":[]}],
  "skills": {"Category Name": "skill1, skill2, skill3"},
  "experience": [{"company":"","role":"","dates":"","location":"","bullets":["bullet1","bullet2","bullet3"]}],
  "projects": [{"name":"","tech":"","dates":"","bullets":["bullet1","bullet2"]}],
  "leadership": [{"organization":"","role":"","dates":"","location":"","bullets":["bullet1"]}],
  "research": [{"title":"","conference":"","dates":"","link":"","bullets":[]}],
  "certifications": [{"name":"","issuer":"","dates":""}],
  "awards": [{"name":"","organization":"","dates":""}],
  "volunteering": [{"organization":"","role":"","dates":"","location":"","bullets":[]}],
  "languages": "${baseResume.languages || ''}",
  "section_order": ${JSON.stringify(baseResume.section_order || ["summary", "skills", "experience", "projects", "education"])},
  "excluded_items": {"projects":[],"experience":[],"leadership":[],"research":[],"certifications":[],"awards":[],"volunteering":[]}
}
` + '```\n' + `Use item names as string identifiers in excluded_items (company name for experience, project name for projects, etc).`;
}


// ---------- 4. ATS SCORE ANALYSIS ----------

export function buildAnalysisPrompt(resumeData, jdText, jdAnalysis = null) {
    const flatResume = flattenResumeForAnalysis(resumeData);

    const keywordsSection = jdAnalysis ? `
PARSED JD KEYWORDS:
Mandatory: ${(jdAnalysis.mandatory_keywords || []).join(', ')}
Preferred: ${(jdAnalysis.preferred_keywords || []).join(', ')}
` : '';

    return `You are a senior recruiter and ATS scoring engine. Score this resume for keyword match AND audit it for quality issues. Be specific and actionable.

=== JOB DESCRIPTION ===
${jdText}
${keywordsSection}
=== RESUME ===
${flatResume}

=== PART 1: ATS SCORING ===

Extract every keyword from the JD. For each, score placement:
  Skills only = 0.7 | Also in summary = +0.5 | In a bullet with context = +0.7 | In title/project name = +0.4 | Max per keyword: 2.3
  Score = (keyword_pts / max_possible) * 70 + (soft_skill_match * 12) + (experience_relevance * 18)
  "missing" = completely absent. "weak" = in skills but never in a bullet with context.
  Calibration: 90-95 exceptional, 85-89 excellent, 75-84 strong, 65-74 good, 55-64 fair, <55 weak.

=== PART 2: QUALITY AUDIT ===

Check each of these and flag specific issues:

SUMMARY: Has years of experience? Has a metric or concrete accomplishment? Has domain fit? Is 3-4 sentences? Any "passionate about"/"results-driven"/"I/my" pronouns?

KEYWORD STUFFING: Does any bullet end with a disconnected phrase like "applying [keyword]", "ensuring [keyword]", "through [keyword]", "with a focus on [keyword]"? Quote the exact bullet.

BULLETS: Any stubs under 60 chars? Any over 250 chars? Any vague filler ("Improved performance using various techniques")? Any fabricated content? Any bullet where the keyword doesn't match the work described (e.g. "AI Voices" on a bullet about database queries, or "statistical rigor" on a bullet about deploying Kubernetes)? Any claim that contradicts the candidate's experience level or timeline?

SKILLS: Duplicates across categories? Soft skills listed as technical skills? Parenthetical expansions like "LLMs (Large Language Models)"?

CONTENT GAPS: Which JD requirements have zero evidence in the resume?

Rate each issue: CRITICAL (likely rejection), MODERATE (reduces competitiveness), MINOR (cosmetic).

` + 'Return in ```json``` format:\n```json\n' + `{
  "score": 0,
  "missing_keywords": [],
  "weak_keywords": [],
  "matching_areas": ["3-5 specific strengths"],
  "summary_feedback": "one paragraph assessment",
  "audit": {
    "summary_issues": [{"issue": "description", "severity": "CRITICAL|MODERATE|MINOR"}],
    "stuffing_found": [{"bullet": "exact text", "stuffed_phrase": "the phrase", "severity": "CRITICAL"}],
    "bullet_issues": [{"section": "experience", "item": "company/project name", "bullet": "exact text", "issue": "what's wrong", "fix": "suggested rewrite", "severity": "CRITICAL|MODERATE|MINOR"}],
    "skills_issues": [{"issue": "description", "severity": "MODERATE"}],
    "content_gaps": [{"requirement": "JD requirement", "suggestion": "how to address", "severity": "CRITICAL|MODERATE"}]
  },
  "top_3_actions": [
    "Most impactful fix with exact instructions",
    "Second most impactful fix",
    "Third most impactful fix"
  ]
}
` + '```';
}


// ---------- 5. APPLICATION QUESTION ANSWERER ----------


export function buildQuestionPrompt(question, resumeData, jdText) {
    // Reuse the existing full-resume serializer
    const fullResume = flattenResumeForAnalysis(resumeData);

    return `You are an applicant answering a job application question. Your goal is to write the answer exactly as this person would — using their real background, in their voice.

=== APPLICANT RESUME ===
${fullResume}

=== JOB DESCRIPTION ===
${jdText || 'Not provided'}

=== APPLICATION QUESTION ===
"${question}"

=== INSTRUCTIONS ===

First, classify the question type, then answer accordingly:

FACTUAL / DIRECT (e.g. tech stack, years of experience, location, availability, work authorization, salary expectations, notice period, LinkedIn URL):
→ Answer directly and specifically using the resume data above.
→ For tech preferences, list actual technologies from the applicant's skills and experience — don't generalize.
→ For years of experience, calculate from the dates in the resume.
→ For salary/compensation: say you're open to discussing compensation aligned with the role scope and your experience level, and ask about the budgeted range if appropriate.
→ Keep it 1-3 sentences. No fluff.

BEHAVIORAL / SITUATIONAL (e.g. "tell me about a time...", "describe a challenge...", "how do you handle..."):
→ Pick the most relevant real experience from the resume that matches the question.
→ Structure as: brief context → what you did → measurable result. Don't label these as "Situation/Action/Result".
→ 3-5 sentences.

MOTIVATIONAL / FIT (e.g. "why this role?", "why this company?", "what interests you?"):
→ Connect a specific detail from the job description to a specific part of your background.
→ Show alignment between what the role needs and what you've actually done.
→ 2-4 sentences.

OPEN-ENDED / OTHER (e.g. "anything else?", "additional information", cover letter):
→ Highlight 1-2 strengths from the resume that aren't obvious elsewhere in the application.
→ Tie them to something specific in the job description if available.
→ Keep it concise unless the question explicitly asks for length.

=== WRITING RULES ===
- First person. Write as the applicant.
- Use specific details: real company names, technologies, metrics, and outcomes from the resume.
- Sound human. Vary sentence structure. No corporate buzzword chains.
- If the resume doesn't contain enough info to answer well, give the best answer possible with what's available rather than making things up.
- Output ONLY the answer text. No labels, no "Answer:", no quotes around it.`;
}


// ---------- 6. EXTRACT PROFILE FROM RESUME TEXT ----------

export function buildExtractProfilePrompt(resumeText) {
    // Technique: Role priming, specific edge case handling, schema anchoring
    return `You are an expert resume parser. Extract structured data from this resume text. The text may be jumbled from PDF column merging.

=== RESUME TEXT ===
${resumeText}

=== EXTRACTION RULES ===

Rule 1 — NAME: Usually the first prominent text. Do NOT confuse with company names or headers.
Rule 2 — CONTACT: Look for email (x@y.z), phone (xxx-xxx-xxxx), city/state, URLs. Check for "[Extracted Link: ...]" patterns for LinkedIn/portfolio.
Rule 3 — SECTION MAPPING: Map non-standard headers to standard sections:
  "Professional Experience" / "Work History" / "Employment" → experience
  "Academic Background" / "Schooling" → education
  "Technical Proficiencies" / "Core Competencies" / "Tech Stack" → skills
  "Selected Projects" / "Key Projects" → projects
  "Activities" / "Extracurriculars" → leadership
  "Publications" / "Papers" → research
Rule 4 — BULLETS: Each bullet = one accomplishment. If text runs together, split where a new action verb starts.
Rule 5 — DATES: Normalize to "Mon YYYY - Mon YYYY" or "Mon YYYY - Present". Keep original if ambiguous.
Rule 6 — SKILLS: Group into categories. Keep original categories if present. If flat list, group by type (e.g. tools, methods, platforms, languages, certifications — adapt to the role's domain).
Rule 7 — PRESERVE all metrics, numbers, percentages, dollar amounts EXACTLY as written.
Rule 8 — section_order: List sections in the ORDER they appear in the original resume (top to bottom).
Rule 9 — Only include sections that have actual content. Skip empty sections.
Rule 10 — Do NOT rephrase, summarize, or reword bullets. Preserve EXACT original wording.

` + 'Return in ```json``` format:\n```json\n' + `{
  "name": "Full Name",
  "contact": {"location":"","phone":"","email":"","linkedin_url":"","portfolio_url":""},
  "summary": "professional summary or empty string if none",
  "education": [{"institution":"","degree":"","gpa":"","dates":"","location":"","bullets":[]}],
  "skills": {"Category Name": "skill1, skill2, skill3"},
  "experience": [{"company":"","role":"","dates":"","location":"","bullets":["exact bullet text"]}],
  "projects": [{"name":"","tech":"","dates":"","bullets":[]}],
  "leadership": [{"organization":"","role":"","dates":"","location":"","bullets":[]}],
  "research": [{"title":"","conference":"","dates":"","link":"","bullets":[]}],
  "certifications": [{"name":"","issuer":"","dates":""}],
  "awards": [{"name":"","organization":"","dates":""}],
  "volunteering": [{"organization":"","role":"","dates":"","location":"","bullets":[]}],
  "languages": "",
  "section_order": ["sections in order they appear"]
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
    // Clean summary
    if (resume_data.summary) {
        resume_data.summary = convert_markdown_to_html(deCharSpace(resume_data.summary));
    }

    // Clean skills
    if (resume_data.skills) {
        const fixed = {};
        for (const [cat, val] of Object.entries(resume_data.skills)) {
            let v = Array.isArray(val) ? val.join(", ") : String(val);
            fixed[deCharSpace(cat)] = convert_markdown_to_html(deCharSpace(v));
        }
        resume_data.skills = fixed;
    }

    // Clean bullets in all sections
    ['experience', 'projects', 'leadership', 'research', 'volunteering'].forEach(sec => {
        if (resume_data[sec]) {
            resume_data[sec].forEach(item => {
                if (item.bullets) {
                    item.bullets = item.bullets.map(b => convert_markdown_to_html(deCharSpace(b)));
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
