"""
AI Resume Generator - Main Module
Handles resume parsing, tailoring, and PDF generation.
"""

import os
import json
import re
import io
import pypdf
import requests
from resume_builder import create_resume_pdf
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

# Model provider options
PROVIDERS = ["gemini", "groq"]

def call_gemini_api(prompt: str, api_key: str, model: str = "gemini-2.5-flash") -> str:
    """
    Call Gemini API via REST to avoid heavy SDK dependencies (grpcio).
    """
    if not api_key:
        print("⚠️ Gemini API Key missing.")
        return ""
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        if response.status_code == 200:
            data = response.json()
            try:
                content = data['candidates'][0]['content']['parts'][0]['text']
                if not content:
                    raise Exception(f"Empty content in Gemini response: {data}")
                return content
            except (KeyError, IndexError) as e:
                raise Exception(f"Invalid Gemini response format: {data} - Error: {e}")
        else:
            raise Exception(f"Gemini API Error {response.status_code}: {response.text}")
    except Exception as e:
        raise Exception(f"Gemini Request Failed: {e}")




def query_groq(prompt: str, expect_json: bool = False, api_key: str = None) -> str:
    """
    Query Groq API with robust fallback chain.
    Chain: Llama 3.3 70B (Quality) -> Llama 3.1 8B (Speed/Volume) -> Qwen 32B (Backup)
    """
    if not api_key:
        api_key = os.getenv("GROQ_API_KEY")
    
    if not api_key:
        print("⚠️ GROQ_API_KEY not found.")
        return ""
        
    models_chain = [
         "llama-3.3-70b-versatile",
         "llama-3.1-8b-instant",
         "qwen/qwen3-32b" 
    ]

    for model_id in models_chain:
        try:
            print(f"   ⚡ Groq: Attempting with {model_id}...")
            
            payload = {
                "model": model_id,
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            }
            
            # Enforce JSON mode if requested
            if expect_json:
                payload["response_format"] = {"type": "json_object"}
            
            response = requests.post(
                url="https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json=payload,
                timeout=60 # Fast inference
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get('choices', [{}])[0].get('message', {}).get('content', '')
            
            elif response.status_code == 429:
                print(f"   ⚠️ Groq Rate Limit ({model_id}): Switching to fallback...")
                continue # Try next model
            elif response.status_code == 400 and expect_json:
                 # Some models might not support json_object type or require "json" in prompt (which we usually have)
                 print(f"   ⚠️ Groq JSON Mode Error ({model_id}): Retrying without force-json...")
                 payload.pop("response_format", None)
                 # Retry without forced json mode
                 retry_resp = requests.post(
                    url="https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}","Content-Type": "application/json"},
                    json=payload, timeout=60
                 )
                 if retry_resp.status_code == 200:
                     return retry_resp.json().get('choices', [{}])[0].get('message', {}).get('content', '')
                 else:
                     continue
            else:
                print(f"   ⚠️ Groq Error ({model_id}): {response.status_code} - {response.text}")
                continue # Try next model
                
        except Exception as e:
            print(f"   ⚠️ Groq Connection Error ({model_id}): {e}")
            continue
            
    raise Exception("All Groq models failed. Check logs for details.")

def query_provider(prompt: str, provider: str = "gemini", expect_json: bool = False, api_key: str = None) -> str:
    """Query the specified AI provider."""
    
    if provider == "groq":
        return query_groq(prompt, expect_json=expect_json, api_key=api_key)
    else:  # Default to gemini
        model_name = "gemini-2.5-flash"
        
        # Use Pro for complex tasks if analyzing
        if "analyze" in prompt.lower() or "ATS scoring" in prompt:
             model_name = "gemini-2.5-pro"

        if not api_key and os.getenv("GEMINI_API_KEY"):
            api_key = os.getenv("GEMINI_API_KEY")

        return call_gemini_api(prompt, api_key, model=model_name)


def analyze_resume_with_jd(resume_data: dict, jd_text: str, provider: str = "gemini", api_key: str = None) -> dict:
    """
    Analyze the resume against the JD using AI.
    Returns a dict with score and feedback.
    """
    prompt = f"""
    Analyze this resume against the job description and provide a strict ATS analysis.
    
    JOB DESCRIPTION:
    {jd_text}
    
    RESUME:
    {json.dumps(resume_data, indent=2)}
    
    TASK:
    1. Calculate a match score (0-100).
    2. Identify 3-5 specific missing keywords.
    3. Identify 3 strong matching areas.
    4. Provide 3 specific recommendations to improve the score.
    
    OUTPUT FORMAT (JSON ONLY):
    {{
      "score": 85,
      "missing_keywords": ["keyword1", "keyword2"],
      "matching_areas": ["area1", "area2"],
      "recommendations": ["rec1", "rec2"],
      "summary_feedback": "Brief summary of the fit."
    }}
    """
    
    try:
        print("   🧠 Analyzing with Gemini Pro...")
        
        # Force JSON mime type instruction in prompt is handled,
        # but for REST we just hope the model listens to "JSON ONLY".
        try:
            response_text = query_provider(prompt, provider=provider, api_key=api_key)
        except Exception as e:
            return {"error": f"AI Provider Error: {str(e)}"}
        
        # internal helper to clean json
        def clean_json_string(s):
            match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', s)
            if match:
                return match.group(1)
            match = re.search(r'\{[\s\S]*\}', s)
            if match:
                return match.group(0)
            return s

        cleaned_text = clean_json_string(response_text)
        
        if not cleaned_text:
            return {"error": "Empty response from AI"}

        return json.loads(cleaned_text)
            
    except Exception as e:
        print(f"Error in analysis: {e}")
        return {"error": str(e)}


def answer_question_with_context(question: str, resume_data: dict, jd_text: str, provider: str = "gemini", api_key: str = None) -> dict:
    """
    Answer a job application question based on the candidate's resume.
    Returns a plain-text answer suitable for copy-pasting into application forms.
    """
    prompt = f"""
    You are helping a job applicant answer a question from a job application form.
    
    JOB DESCRIPTION:
    {jd_text}
    
    APPLICANT'S RESUME:
    {json.dumps(resume_data, indent=2)}
    
    APPLICATION QUESTION:
    {question}
    
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
    """
    
    try:
        response_text = query_provider(prompt, provider=provider, api_key=api_key)
        return {"answer": response_text.strip()}
    except Exception as e:
        return {"error": f"Failed to answer question: {str(e)}"}


def extract_text_from_pdf(file_stream) -> str:
    """Extract text from a PDF file stream."""
    try:
        reader = pypdf.PdfReader(file_stream)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
            
            # Extract links from annotations
            if "/Annots" in page:
                for annot in page["/Annots"]:
                    obj = annot.get_object()
                    if "/A" in obj and "/URI" in obj["/A"]:
                        uri = obj["/A"]["/URI"]
                        text += f" [Extracted Link: {uri}] "
        
        return text
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
        return ""


def extract_base_resume_info(resume_text: str, provider: str = "gemini", api_key: str = None) -> dict:
    """
    Extract base resume information using AI.
    Returns a JSON dict matching the get_base_resume structure.
    """
    prompt = f"""
    Extract the following information from the resume text into a strict JSON format.
    
    IMPORTANT: Look for "[Extracted Link: ...]" patterns in the text to identify LinkedIn and Portfolio URLs if they are not explicitly written out.
    
    Resume Text:
    {resume_text}
    
    Required JSON Structure:
    {{
        "name": "Full Name",
        "contact": {{
            "location": "City, State",
            "phone": "Phone Number",
            "email": "Email",
            "linkedin_url": "Full LinkedIn URL",
            "portfolio_url": "Portfolio URL (optional)"
        }},
        "summary": "Professional summary",
        "education": [
            {{
                "institution": "University Name",
                "degree": "Degree Name",
                "gpa": "GPA (optional)",
                "dates": "Start - End Date",
                "location": "City, State"
            }}
        ],
        "skills": {{
            "Category Name 1": "Skill1, Skill2, Skill3",
            "Category Name 2": "Skill1, Skill2, Skill3"
        }},
        "experience": [
            {{
                "company": "Company Name",
                "role": "Job Title",
                "dates": "Start - End Date",
                "location": "City, State",
                "bullets": ["Bullet 1", "Bullet 2", "etc"]
            }}
        ],
        "projects": [
            {{
                "name": "Project Name",
                "dates": "Date Range",
                "bullets": ["Bullet 1", "Bullet 2"]
            }}
        ],
        "leadership": [
            {{
                "organization": "Org Name",
                "role": "Role Title",
                "dates": "Date Range",
                "location": "City, State",
                "bullets": ["Bullet 1"]
            }}
        ]
    }}
    
    Ensure all fields are filled based on the text. If a field is missing, use an empty string or empty list.
    Do not invent information.
    """
    
    try:
        response_text = query_provider(prompt, provider=provider, api_key=api_key)
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        print(f"Error extracting resume info: {e}")
    
    return {} # Return empty if failure


def trim_projects_to_fit(resume_data: dict, max_bullets_initial: int = 3, min_bullets: int = 2, min_projects: int = 2) -> dict:
    """
    Initial project trimming. Strategy:
    1. Start with 3 bullets per project (LLM generates 5)
    2. Will be further trimmed by trim_projects_further if needed
    """
    if 'projects' not in resume_data or not resume_data['projects']:
        return resume_data
    
    projects = resume_data['projects']
    
    # Initially cap each project to max_bullets_initial (use top ranked)
    for proj in projects:
        if 'bullets' in proj and len(proj['bullets']) > max_bullets_initial:
            proj['bullets'] = proj['bullets'][:max_bullets_initial]
    
    return resume_data


def trim_projects_further(resume_data: dict, target_reduction: int, min_bullets: int = 2, min_projects: int = 2) -> dict:
    """
    Further trim projects to reduce height. Strategy:
    1. First reduce bullets per project (down to min_bullets=2)
    2. Then remove entire projects (down to min_projects=2)
    3. After removing a project, try to add bullets back to remaining projects
    """
    if 'projects' not in resume_data or not resume_data['projects']:
        return resume_data
    
    projects = resume_data['projects']
    # Store original bullets for potential restoration
    original_bullets = {i: proj.get('bullets', [])[:] for i, proj in enumerate(projects)}
    reduction_achieved = 0
    
    # Phase 1: Trim bullets from last project first (down to min_bullets)
    for i in range(len(projects) - 1, -1, -1):
        if reduction_achieved >= target_reduction:
            break
        
        proj = projects[i]
        bullets = proj.get('bullets', [])
        
        while len(bullets) > min_bullets and reduction_achieved < target_reduction:
            bullets.pop()  # Remove last (least important) bullet
            reduction_achieved += 14  # Approximate height per bullet
        
        proj['bullets'] = bullets
    
    # Phase 2: If still over, remove entire projects (keep at least min_projects)
    removed_project = False
    while len(projects) > min_projects and reduction_achieved < target_reduction:
        removed = projects.pop()  # Remove last project
        # Estimate height saved: header + bullets + spacer
        saved = 13 + len(removed.get('bullets', [])) * 14 + 2
        reduction_achieved += saved
        removed_project = True
        print(f"      Removed project: {removed.get('name', 'Unknown')}")
    
    # Phase 3: If we removed a project, try to add bullets back to remaining projects
    if removed_project and reduction_achieved > target_reduction:
        extra_space = reduction_achieved - target_reduction
        bullets_can_add = extra_space // 14
        
        # Try to restore bullets to remaining projects (most important project first)
        for i, proj in enumerate(projects):
            if bullets_can_add <= 0:
                break
            original = original_bullets.get(i, [])
            current = proj.get('bullets', [])
            
            # Add back bullets that were trimmed (if any)
            while len(current) < len(original) and bullets_can_add > 0:
                # Find next bullet to restore
                if len(current) < 3:  # Max 3 bullets per project
                    current.append(original[len(current)])
                    bullets_can_add -= 1
                else:
                    break
            
            proj['bullets'] = current
    
    resume_data['projects'] = projects
    return resume_data


def trim_skills_to_fit(resume_data: dict, max_lines: int = 5) -> dict:
    """
    Trim skills section to fit strictly within max_lines (default 5).
    Strategy:
    1. Distribute lines among categories based on priority (keys order).
    2. Fill each category until it consumes its allocated lines.
    3. Stop when total lines used reaches limit.
    """
    if 'skills' not in resume_data:
        return resume_data
    
    skills = resume_data['skills']
    num_categories = len(skills)
    
    if num_categories == 0:
        return resume_data
    
    # CHAR constants (approximate for 10pt font)
    # 1 line = ~90 chars
    CHARS_PER_LINE = 90
    
    final_skills = {}
    lines_used = 0
    
    for category, skill_str in skills.items():
        if lines_used >= max_lines:
            break
            
        remaining_lines = max_lines - lines_used
        
        # Calculate how many lines this category WANTS
        # Prefix "• Category: "
        prefix_len = len(f"• {category}: ")
        skill_list = [s.strip() for s in skill_str.split(',')]
        
        # We can give this category at most 2 lines, unless it's the only one left and we have space
        # But generally 2 lines per category is a good max density
        allowed_lines_for_cat = min(remaining_lines, 2)
        
        max_chars = allowed_lines_for_cat * CHARS_PER_LINE
        available_chars = max_chars - prefix_len
        
        if available_chars <= 0:
            continue
            
        trimmed_list = []
        current_len = 0
        
        for skill in skill_list:
            skill_len = len(skill) + 2 # ", "
            if current_len + skill_len <= available_chars:
                trimmed_list.append(skill)
                current_len += skill_len
            else:
                break
        
        if trimmed_list:
            final_skills[category] = ', '.join(trimmed_list)
            # Estimate actual lines used by this category
            # (current_len + prefix) / 90, rounded up
            total_cat_chars = current_len + prefix_len
            lines_consumed = -(-total_cat_chars // CHARS_PER_LINE) # Ceiling division
            lines_used += lines_consumed
            
    resume_data['skills'] = final_skills
    return resume_data


def get_base_resume() -> dict:
    """
    Returns the source-of-truth resume data. 
    Tries to load from 'user_profile.json' first.
    """
    profile_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'user_profile.json')
    
    if os.path.exists(profile_path):
        try:
            with open(profile_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading user profile: {e}")

    # Fallback to empty structure or error out in a real app
    # For now, return a placeholder compatible structure
    return {
        "name": "User Name",
        "contact": {
            "location": "Location",
            "phone": "Phone",
            "email": "Email",
            "linkedin_url": "",
            "portfolio_url": ""
        },
        "summary": "Please upload your resume to generate a profile.",
        "education": [],
        "skills": {},
        "experience": [],
        "projects": [],
        "leadership": []
    }


class JDAnalysis(BaseModel):
    summary: str = Field(description="A concise summary of the job description.")
    keywords: List[str] = Field(description="Keywords mentioned in the job description.")
    required_skills: List[str] = Field(description="Skills required for the job.")
    company_name: str = Field(description="The canonical name of the hiring company (e.g., 'Google', 'Anthropic'). Do not use generic terms like 'Company'. If unknown, use 'Unknown_Company'.")
    job_identifier: str = Field(description="A short, file-safe identifier for the job. Prefer 'Job_<ID>' if a Job ID is prominent. Otherwise use 'Role_Name' (e.g., 'Software_Engineer'). Replace spaces with underscores.")

def get_jd_analysis_prompt(jd_text: str) -> str:
    return f"""
    Analyze the following Job Description (JD) and extract the key information.
    
    1.  **Summary**: A concise summary of the role and what they are looking for.
    2.  **Keywords**: A list of important keywords and technical terms found in the JD.
    3.  **Required Skills**: A list of explicit hard skills required.
    4.  **Company Name**: The name of the company hiring. Be precise.
    5.  **Job Identifier**: If a Job ID is found (e.g., 'R12345'), use that. If not, use the Job Title, but format it as snake_case (e.g., 'Senior_Data_Scientist'). Keep it short.
    
    Job Description:
    {jd_text}
    """

def parse_job_description(jd_text: str, provider: str = "gemini", api_key: str = None) -> dict:
    """
    Use AI provider to analyze the job description and extract key information.
    
    Args:
        jd_text: The job description text
        provider: One of 'gemini', 'ollama', or 'openrouter'
    
    Returns:
        dict with: location, job_title, keywords, action_verbs, skill_gaps
    """
    prompt = f"""
Analyze this job description and extract the following information. Return ONLY valid JSON.

Job Description:
{jd_text}

Extract and return this JSON structure:
{{
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
}}

Be thorough in extracting keywords.
- For "tech_stack_nuances", look for specific library names (e.g., "pandas" instead of just "Python") and cloud services (e.g., "Redshift" instead of just "AWS").
- For "industry_terms", extract business-specific language (e.g., "risk modeling", "patient outcomes", "click-through rate").
"""
    
    try:
        response_text = query_provider(prompt, provider, api_key=api_key)
        
        # Try to find JSON in the response
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass
    except Exception as e:
        print(f"⚠️ API Error (Job Parsing): {e}")
        print("   Using default job description values.")

    # Fallback structure
    return {
        "company_name": "Unknown_Company",
        "job_identifier": "Resume_Job",
        "location": "Remote",
        "job_title": "Data Scientist",
        "mandatory_keywords": [],
        "preferred_keywords": [],
        "soft_skills": [],
        "action_verbs": [],
        "industry_terms": [],
        "years_experience": ""
    }


def convert_markdown_to_html(text: str) -> str:
    """Convert markdown bold (**text**) to HTML bold (<b>text</b>)."""
    if not text:
        return text
    # Convert **text** to <b>text</b>
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    # Also handle any stray single asterisks
    text = re.sub(r'\*([^*]+)\*', r'<i>\1</i>', text)
    return text


def clean_tailored_resume(resume_data: dict) -> dict:
    """Post-process the tailored resume to convert markdown to HTML."""
    
    # Clean summary
    if 'summary' in resume_data:
        resume_data['summary'] = convert_markdown_to_html(resume_data['summary'])
    
    # Clean skills
    if 'skills' in resume_data:
        for category in resume_data['skills']:
            resume_data['skills'][category] = convert_markdown_to_html(resume_data['skills'][category])
    
    # Clean experience bullets
    if 'experience' in resume_data:
        for exp in resume_data['experience']:
            if 'bullets' in exp:
                # UPDATE: Removed hardcoded trimming (max 3/4). 
                # Bullet counts are now strictly enforced by tailor_resume based on user preference.
                pass
                
                exp['bullets'] = [convert_markdown_to_html(b) for b in exp['bullets']]
    
    # Clean project bullets
    if 'projects' in resume_data:
        for proj in resume_data['projects']:
            if 'bullets' in proj:
                proj['bullets'] = [convert_markdown_to_html(b) for b in proj['bullets']]
    
    # Clean leadership bullets
    if 'leadership' in resume_data:
        for lead in resume_data['leadership']:
            if 'bullets' in lead:
                lead['bullets'] = [convert_markdown_to_html(b) for b in lead['bullets']]
    
    return resume_data


def tailor_resume(
    base_resume: dict, 
    jd_analysis: dict, 
    provider: str = "gemini", 
    api_key: str = None, 
    tailoring_strategy: str = "balanced",
    bullet_counts: dict = None
) -> dict:
    """
    Use AI provider to tailor the resume content for ATS optimization.
    Preserves all metrics and facts, only adjusts vocabulary.
    
    Args:
        base_resume: The base resume data
        jd_analysis: Analysis from parse_job_description
        provider: One of 'gemini', 'groq'
        api_key: API key for the provider
        tailoring_strategy: 'profile_focus', 'balanced', or 'jd_focus'
        bullet_counts: Optional dict with desired bullet counts per section
                      Example: {'experience': [3, 4, 2], 'projects': [3, 0]}
                      0 means remove that item
    """
    # Pre-process resume: filter out items with bullet_count = 0
    # UPDATE: Removed aggressive filtering. 0 bullets should mean "keep item, 0 bullets".
    # User can delete items explicitly via the remove button in UI.
    if bullet_counts:
        # We perform a shallow copy just to be safe if we mutate deeper, 
        # but here we are just reading.
        pass
    
    # [Dynamic Prompt Construction enabled]
    # Old bullet_instructions logic removed in favor of itemized instructions below.
    pass
    
    # Strategy-specific instructions
    if tailoring_strategy == "profile_focus":
        strategy_note = """
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
"""
    elif tailoring_strategy == "jd_focus":
        strategy_note = """
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
"""
    else:  # balanced (default)
        strategy_note = """
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
"""
    
    # Build Dynamic Itemized Prompt Content
    current_resume_content = ""
    
    # Contact & Summary
    current_resume_content += "--- SECTION: CONTACT & SUMMARY ---\n"
    base_info = {k: v for k, v in base_resume.items() if k not in ['experience', 'projects', 'leadership', 'skills']}
    current_resume_content += json.dumps(base_info, indent=2) + "\n\n"
    
    # Skills
    if 'skills' in base_resume:
        current_resume_content += "--- SECTION: SKILLS ---\n"
        current_resume_content += json.dumps(base_resume['skills'], indent=2) + "\n"
        current_resume_content += "INSTRUCTION: Optimize skills for JD relevance. Keep within 5 lines.\n\n"

    # Experience
    if 'experience' in base_resume:
        current_resume_content += "--- SECTION: EXPERIENCE ---\n"
        exp_counts = bullet_counts.get('experience', []) if bullet_counts else []
        for i, item in enumerate(base_resume['experience']):
            target = exp_counts[i] if i < len(exp_counts) else 3
            current_resume_content += f"ITEM {i+1} [Role: {item.get('role', 'N/A')}]:\n"
            current_resume_content += f"Current Bullets: {json.dumps(item.get('bullets', []), indent=2)}\n"
            current_resume_content += f"ACTION: Rewrite these bullets into EXACTLY {target} high-impact bullets optimized for the JD.\n\n"

    # Projects
    if 'projects' in base_resume:
        current_resume_content += "--- SECTION: PROJECTS ---\n"
        proj_counts = bullet_counts.get('projects', []) if bullet_counts else []
        for i, item in enumerate(base_resume['projects']):
            target = proj_counts[i] if i < len(proj_counts) else 3
            current_resume_content += f"ITEM {i+1} [Name: {item.get('name', 'N/A')}]:\n"
            current_resume_content += f"Current Bullets: {json.dumps(item.get('bullets', []), indent=2)}\n"
            current_resume_content += f"ACTION: Rewrite into EXACTLY {target} bullets.\n\n"

    # Leadership
    if 'leadership' in base_resume:
        current_resume_content += "--- SECTION: LEADERSHIP ---\n"
        lead_counts = bullet_counts.get('leadership', []) if bullet_counts else []
        for i, item in enumerate(base_resume['leadership']):
            target = lead_counts[i] if i < len(lead_counts) else 3
            current_resume_content += f"ITEM {i+1}:\n"
            current_resume_content += f"Current Bullets: {json.dumps(item.get('bullets', []), indent=2)}\n"
            current_resume_content += f"ACTION: Rewrite into EXACTLY {target} bullets.\n\n"

    prompt = f"""
You are a Strategic Resume Architect.
JOB ANALYSIS:
{json.dumps(jd_analysis, indent=2)}

{strategy_note}

TASK: Rewrite the resume sections below.
STRICTLY follow the ACTION INSTRUCTION for each item regarding bullet counts.

{current_resume_content}

GENERAL RULES:
1. Contact Info: Preserve email, phone, links EXACTLY. Update location if needed.
2. Summary: Optimize for JD (2-3 sentences).
3. Skills: Optimize for JD (max 5 lines).
4. Formatting: Use <b>tags</b> for bolding.
5. JSON Output: Return the COMPLETE resume in valid JSON format matching the input structure.
6. KEY NAMING: Use "role" for Experience job titles.
"""

    try:
        response_text = query_provider(prompt, provider, api_key=api_key)
        
        # Extract JSON from response
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            try:
                tailored = json.loads(json_match.group())
                # Ensure we have all required fields
                if 'name' in tailored and 'contact' in tailored:
                    # Post-process to convert any remaining markdown to HTML
                    cleaned = clean_tailored_resume(tailored)
                    
                    # STRICTLY ENFORCE bullet counts if provided
                    if bullet_counts:
                        for section in ['experience', 'projects', 'leadership']:
                            if section in bullet_counts and section in cleaned:
                                counts = bullet_counts[section]
                                items = cleaned[section]
                                for i, item in enumerate(items):
                                    if i < len(counts):
                                        limit = counts[i]
                                        if 'bullets' in item and isinstance(item['bullets'], list):
                                            # Trim excess bullets to strict limit
                                            item['bullets'] = item['bullets'][:limit]
                    
                    return cleaned
            except json.JSONDecodeError:
                pass
    except Exception as e:
        print(f"⚠️ API Error (Tailoring): {e}")
        print("   Using base resume without AI tailoring.")

    # If parsing fails or API error, return base resume with just location updated (if valid)
    # If location detection also failed, it usually defaults to 'Remote' or 'N/A'
    if jd_analysis and 'location' in jd_analysis and jd_analysis['location'] not in ["Remote", "N/A"]:
         base_resume['contact']['location'] = jd_analysis['location']
         
    return base_resume


def generate_answer(question: str, jd_text: str, provider: str = "gemini") -> str:
    """
    Generate an answer to a user's question based on their resume and the job description.
    """
    base_resume = get_base_resume()
    
    prompt = f"""
You are a career coach and technical interviewer assisting the candidate during a job application or interview.

CANDIDATE PROFILE:
{json.dumps(base_resume, indent=2)}

JOB DESCRIPTION:
{jd_text}

USER QUESTION:
{question}

TASK:
Provide a concise, direct answer or talking point that the candidate can use.
- Connect their actual experience (from the profile) to the job requirements.
- Do NOT hallucinate experience they don't have.
- If the question is "Tell me about yourself", craft a short pitch relevant to this specific JD.
- If the question is technical, explain how they have used that technology based on their projects/work.
- Keep the tone professional and confident.
- Answer in PLAIN TEXT only. Do NOT use markdown, bolding, italics, bullet points, or headers.
"""
    try:
        return query_provider(prompt, provider)
    except Exception as e:
        return f"Error generating answer: {str(e)}"


def generate_tailored_resume(jd_text: str, output_filename: str = "Tailored_Resume.pdf") -> str:
    """
    Main function to generate a tailored resume from a job description.
    
    Args:
        jd_text: The full job description text
        output_filename: Name of the output PDF file
        
    Returns:
        Path to the generated PDF
    """
    print("📄 Loading base resume...")
    base_resume = get_base_resume()
    
    print("🔍 Analyzing job description with Gemini...")
    jd_analysis = parse_job_description(jd_text)
    print(f"   📍 Location: {jd_analysis.get('location', 'N/A')}")
    print(f"   💼 Title: {jd_analysis.get('job_title', 'N/A')}")
    print(f"   🔑 Keywords found: {len(jd_analysis.get('mandatory_keywords', []))} mandatory, "
          f"{len(jd_analysis.get('preferred_keywords', []))} preferred")
    
    print("✨ Tailoring resume for ATS optimization...")
    tailored_resume = tailor_resume(base_resume, jd_analysis)
    
    print("📝 Generating PDF...")
    output_path = create_resume_pdf(tailored_resume, output_filename)
    
    print(f"✅ Resume generated: {output_path}")
    return output_path


def main():
    """CLI entry point - accepts job description input."""
    print("=" * 60)
    print("  AUTOMATED RESUME GENERATOR - ATS Optimized")
    print("=" * 60)
    print()
    
    # Check for API key
    if not os.getenv("GEMINI_API_KEY"):
        print("❌ Error: GEMINI_API_KEY not found in environment.")
        print("   Please create a .env file with your API key.")
        print("   See .env.example for the format.")
        return
    
    print("Paste the Job Description below.")
    print("When done, enter an empty line followed by 'END' on a new line:")
    print("-" * 60)
    
    lines = []
    while True:
        try:
            line = input()
            if line.strip().upper() == 'END':
                break
            lines.append(line)
        except EOFError:
            break
    
    jd_text = '\n'.join(lines)
    
    if not jd_text.strip():
        print("❌ No job description provided. Exiting.")
        return
    
    print()
    print("-" * 60)
    
    # Generate the tailored resume
    output_file = generate_tailored_resume(jd_text)
    
    print()
    print("=" * 60)
    print(f"  Resume saved to: {output_file}")
    print("  Next steps:")
    print("    1. Review the PDF to ensure accuracy")
    print("    2. Test ATS score at jobscan.co or resumeworded.com")
    print("=" * 60)


if __name__ == "__main__":
    main()
