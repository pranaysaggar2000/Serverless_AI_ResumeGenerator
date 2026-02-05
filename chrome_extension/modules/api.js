import { API_BASE_URL, state } from './state.js';
import { callAI, extractJSON } from './ai_provider.js';
import * as Prompts from './ai_prompts.js';

export async function extractText(file) {
    const formData = new FormData();
    formData.append('file', file);

    let response;
    try {
        response = await fetch(`${API_BASE_URL}/extract_text`, {
            method: 'POST',
            body: formData
        });
    } catch (e) {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.warn("Mocking extractText response for local testing");
            return { text: "Jane Doe\nSoftware Engineer\nExperience: 5 years..." };
        }
        throw e;
    }
    return await response.json();
}

export async function extractBaseProfile(text, apiKey, provider) {
    // OLD: Call Backend
    /*
    response = await fetch(`${API_BASE_URL}/extract_base_profile`, ...);
    */

    // NEW: Direct AI Call
    try {
        const prompt = Prompts.buildExtractProfilePrompt(text);

        let responseText;
        try {
            responseText = await callAI(prompt, provider, apiKey, { expectJson: true });
        } catch (e) {
            if (window.location.hostname === 'localhost') {
                console.warn("Mocking extractBaseProfile failure for local testing fallback");
                return {
                    name: "Mock User",
                    email: "mock@example.com",
                    experience: [{ company: "Mock Co", role: "Dev", dates: "2020", bullets: ["Code things"] }]
                };
            }
            throw e;
        }

        const data = extractJSON(responseText);
        if (!data) throw new Error("Failed to parse AI response as JSON");

        // Normalize roles (logic ported from python extract_base_resume_info)
        // Python did this inside the function. We can do it here or in prompts helper.
        // Let's do it here to keep prompts pure text builders.

        if (data.experience) {
            data.experience.forEach(item => {
                if (!item.role) {
                    for (const key of ['title', 'position', 'job_title', 'designation']) {
                        if (item[key]) { item.role = item[key]; break; }
                    }
                }
            });
        }
        if (data.leadership) {
            data.leadership.forEach(item => {
                if (!item.role) {
                    for (const key of ['title', 'position']) {
                        if (item[key]) { item.role = item[key]; break; }
                    }
                }
            });
        }

        return data;

    } catch (e) {
        console.error("extractBaseProfile failed", e);
        throw e;
    }
}

export async function tailorResume(baseResume, jdText, apiKey, provider, tailoringStrategy) {
    // NEW: Direct AI Call

    // 1. Analyze JD first (we need jdAnalysis for the tailor prompt)
    // The python backend combined these steps or expected input. 
    // The previous frontend passed `jdAnalysis` to `tailorResume` call? 
    // Wait, the signature in api.js was `tailorResume(baseResume, jdText, ...)`
    // The python `tailor_resume` endpoint did: jd_analysis = parse_job_description(jd_text...) then tailor_resume(...)
    // So we must replicate that pipeline.

    try {
        // Step 1: Parse JD
        const jdPrompt = Prompts.buildParseJobDescriptionPrompt(jdText);
        const jdResponse = await callAI(jdPrompt, provider, apiKey, { expectJson: true });
        const jdAnalysis = extractJSON(jdResponse) || {
            // Fallback if parsing fails but generation might still work with raw text?
            // Python fell back to default structure.
            company_name: "Unknown_Company", job_title: "Role", mandatory_keywords: []
        };

        // Step 2: Tailor Resume
        // Note: bulletCounts are typically passed in regenerate, but here for initial generation
        // we might not have them, or we assume full keep?
        // Python `tailor_resume` took optional `bullet_counts`. The endpoint `tailor_resume` didn't seem to pass them from UI initial call?
        // UI `generateBtn` handler calls `tailorResume`. It doesn't pass bullet counts.

        const tailorPrompt = Prompts.buildTailorPrompt(baseResume, jdAnalysis, tailoringStrategy, null);
        const tailorResponse = await callAI(tailorPrompt, provider, apiKey, { expectJson: true });
        let tailoredData = extractJSON(tailorResponse);

        if (!tailoredData) throw new Error("Failed to generate tailored resume JSON");

        // Step 3: Post-processing
        tailoredData = Prompts.restore_immutable_fields(baseResume, tailoredData);
        tailoredData = Prompts.clean_tailored_resume(tailoredData);

        // Return object matching backend structure
        return {
            tailored_resume: tailoredData,
            jd_analysis: jdAnalysis
        };

    } catch (e) {
        console.error("tailorResume failed", e);
        throw e;
    }
}

export async function generatePdf(resumeData) {
    // KEEP: Needs server-side library
    const response = await fetch(`${API_BASE_URL}/generate_pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_data: resumeData })
    });

    const data = await response.json();

    if (data.error) {
        return { error: data.error };
    }

    if (data.pdf_base64) {
        const byteCharacters = atob(data.pdf_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: 'application/pdf' });
    }

    return { error: "Unknown response format" };
}

export async function regenerateResume(tailoredResume, bulletCounts, jdAnalysis, apiKey, provider, tailoringStrategy) {
    // NEW: Direct AI Call
    // This is similar to tailorResume but uses existing tailoredResume as base (or original base?)
    // Python endpoint `regenerate_resume` actually calls `tailor_resume(base_resume, jd_analysis, ... bullet_counts)`
    // It used `state.base_resume` from request if available, or just re-tailored.
    // In UI `saveRegenBtn`, we pass `state.baseResume`.
    // Wait, the UI passes `tailoredResume` as first arg to `activeSection` logic?
    // Let's check popup.js call... 
    // It calls `regenerateResume(state.tailoredResume...`? No.
    // `saveRegenBtn` calls `saveProfileChanges` then `regenerateResume`.
    // The signature in `api.js` was `regenerateResume(tailoredResume, bullet_counts...)`.
    // BUT the python endpoint used `tailored_resume` argument to mean... wait.
    // Actually the python endpoint `regenerate_resume` used `tailored_resume` to extract *base* info?
    // No, `tailor_resume` function takes `base_resume`.
    // If we want to *regenerate*, we should conceptually start from `state.baseResume` + `bullet_counts`.
    // However, the signature I must match is `regenerateResume(tailoredResume, bulletCounts....)`
    // Use `state.baseResume` (globally imported) if possible, or assume `tailoredResume` IS the base to use?
    // In `popup.js`: `await regenerateResume(state.tailoredResume, bulletCounts, state.currentJdAnalysis, ...)`
    // AND `state.tailoredResume` holds the current EDITS.
    // So we invoke tailoring using the current state of the resume (which might have manual edits) as the "Base".

    try {
        // We use the passed resume as base
        const base = tailoredResume;

        // We need jdAnalysis. If not passed (null), we might fail? 
        // popup.js passes `state.currentJdAnalysis`.

        if (!jdAnalysis) throw new Error("JD Analysis missing for regeneration");

        const tailorPrompt = Prompts.buildTailorPrompt(base, jdAnalysis, tailoringStrategy, bulletCounts);
        const tailorResponse = await callAI(tailorPrompt, provider, apiKey, { expectJson: true });
        let newTailoredData = extractJSON(tailorResponse);

        if (!newTailoredData) throw new Error("Failed to regenerate resume JSON");

        // Post-process
        // restore_immutable_fields might be tricky if we don't have the *original* original. 
        // But `base` here is the current state. 
        // If we restore from `base`, we keep manual edits! This is desired.
        newTailoredData = Prompts.restore_immutable_fields(base, newTailoredData);
        newTailoredData = Prompts.clean_tailored_resume(newTailoredData);
        newTailoredData = Prompts.enforce_bullet_limits(newTailoredData, bulletCounts);

        return newTailoredData;

    } catch (e) {
        console.error("regenerateResume failed", e);
        throw e;
    }
}

export async function askQuestion(question, resumeData, jdText, apiKey, provider) {
    try {
        const prompt = Prompts.buildQuestionPrompt(question, resumeData, jdText);
        const responseText = await callAI(prompt, provider, apiKey, { expectJson: false }); // Plain text answer
        // Python wrapped it in { answer: ... }
        return { answer: responseText.trim() };
    } catch (e) {
        console.error("askQuestion failed", e);
        // Return error object like backend did
        return { error: e.message };
    }
}

export async function analyzeResume(resumeData, jdText, apiKey, provider) {
    try {
        const prompt = Prompts.buildAnalysisPrompt(resumeData, jdText);
        const responseText = await callAI(prompt, provider, apiKey, { expectJson: true, useProModel: true });
        const data = extractJSON(responseText);
        if (!data) throw new Error("Failed to parse analysis JSON");
        return data;
    } catch (e) {
        console.error("analyzeResume failed", e);
        return { error: e.message };
    }
}
