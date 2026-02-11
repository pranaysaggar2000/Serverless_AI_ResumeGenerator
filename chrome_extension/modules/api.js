import { state, updateState } from './state.js';
import { callAI, extractJSON } from './ai_provider.js';
import { debugLog } from './utils.js';
import * as Prompts from './ai_prompts.js';
import { generateResumePdf } from './pdf_builder.js';
import { logError } from './logger.js';
export async function extractText(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();

        // Wait for pdfjsLib to be available on window (it's loaded via module script)
        if (!window.pdfjsLib) {
            throw new Error("PDF Library not loaded yet.");
        }

        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();

            // Join items with space, but preserve structure roughly
            const pageText = content.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';

            // Extract links from annotations
            const annotations = await page.getAnnotations();
            annotations.forEach(annot => {
                if (annot.subtype === 'Link' && annot.url) {
                    fullText += ` [Extracted Link: ${annot.url}] `;
                }
            });
        }

        return { text: fullText };
    } catch (e) {
        console.error("PDF Extraction failed", e);
        return { error: e.message };
    }
}

export async function extractBaseProfile(text, apiKey, provider) {
    // OLD: Call Backend
    /*
    response = await fetch(`${API_BASE_URL}/extract_base_profile`, ...);
    */

    // NEW: Direct AI Call
    try {
        debugLog('📄 extractBaseProfile called with:', {
            provider,
            hasApiKey: !!apiKey,
            apiKeyLength: apiKey?.length || 0,
            authMode: state.authMode,
            isLoggedIn: state.isLoggedIn
        });

        const prompt = Prompts.buildExtractProfilePrompt(text);

        const actionId = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        let responseText;
        try {
            responseText = await callAI(prompt, provider, apiKey, { expectJson: true, actionId });
        } catch (e) {
            const DEBUG_MODE = false; // Set to true only for local testing
            if (DEBUG_MODE && window.location.hostname === 'localhost') {
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

        if (data.section_order) {
            const NON_SECTION_KEYS = ['name', 'contact', 'section_order', 'section_titles', 'excluded_items'];
            data.section_order = data.section_order.filter(s => !NON_SECTION_KEYS.includes(s));
        }

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
        logError('profile_extract_failed', e, { taskType: 'profile' });
        throw e;
    }
}

export async function tailorResume(baseResume, jdText, apiKey, provider, tailoringStrategy) {
    // NEW: Direct AI Call with JD Analysis Caching

    // 1. Analyze JD first (we need jdAnalysis for the tailor prompt)
    // The python backend combined these steps or expected input. 
    // The previous frontend passed `jdAnalysis` to `tailorResume` call? 
    // Wait, the signature in api.js was `tailorResume(baseResume, jdText, ...)`
    // The python `tailor_resume` endpoint did: jd_analysis = parse_job_description(jd_text...) then tailor_resume(...)
    // So we must replicate that pipeline.
    const actionId = `forge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
        let jdAnalysis;

        // Step 1: Check if we have cached JD analysis for this exact JD text
        const cachedJdAnalysis = state.currentJdAnalysis;
        const cachedJdText = state.lastParsedJdText;

        debugLog('🔍 JD Cache Check:', {
            hasCachedAnalysis: !!cachedJdAnalysis,
            cachedJdTextLength: cachedJdText?.length || 0,
            currentJdTextLength: jdText?.length || 0,
            textsMatch: cachedJdText === jdText,
            cachedJdPreview: cachedJdText?.substring(0, 100),
            currentJdPreview: jdText?.substring(0, 100)
        });

        if (cachedJdAnalysis && cachedJdText?.trim() === jdText?.trim()) {
            // Reuse cached JD analysis - saves 1 API call!
            debugLog('✅ Reusing cached JD analysis (saving 1 API call)');
            jdAnalysis = cachedJdAnalysis;
        } else {
            // Parse JD (only if JD changed or no cache)
            debugLog('🔍 Parsing JD (first time or JD changed)');
            const jdPrompt = Prompts.buildParseJobDescriptionPrompt(jdText);
            const jdResponse = await callAI(jdPrompt, provider, apiKey, { expectJson: true, taskType: 'jdParse', actionId });
            jdAnalysis = extractJSON(jdResponse) || {
                // Fallback if parsing fails
                company_name: "Unknown_Company", job_title: "Role", mandatory_keywords: []
            };

            // Cache the JD analysis and the JD text it was parsed from
            debugLog('💾 Caching JD analysis for future use');
            updateState({
                currentJdAnalysis: jdAnalysis,
                lastParsedJdText: jdText
            });
            await chrome.storage.local.set({
                jd_analysis: jdAnalysis,
                last_parsed_jd_text: jdText
            });
        }

        // Add company description from state if not found in JD parsing
        if (!jdAnalysis.company_description && state.detectedCompanyDescription) {
            jdAnalysis.company_description = state.detectedCompanyDescription;
        }

        // Step 2: Tailor Resume
        // Note: bulletCounts are typically passed in regenerate, but here for initial generation
        // we might not have them, or we assume full keep?
        // Python `tailor_resume` took optional `bullet_counts`. The endpoint `tailor_resume` didn't seem to pass them from UI initial call?
        // UI `generateBtn` handler calls `tailorResume`. It doesn't pass bullet counts.

        const tailorPrompt = Prompts.buildTailorPrompt(baseResume, jdAnalysis, tailoringStrategy, null, state.pageMode || '1page', state.mustIncludeItems, state.formatSettings);
        const tailorResponse = await callAI(tailorPrompt, provider, apiKey, { expectJson: true, taskType: 'tailor', actionId });
        let tailoredData = extractJSON(tailorResponse);

        if (!tailoredData) {
            const snippet = tailorResponse ? tailorResponse.substring(0, 100).replace(/\n/g, ' ') : "EMPTY";
            throw new Error(`Failed to parse AI response as JSON. Snippet: "${snippet}..."`);
        }

        // Step 3: Extract excluded items BEFORE cleanup (so clean doesn't see it as a section)
        let excludedItems = tailoredData.excluded_items || {
            projects: [], experience: [], leadership: [],
            research: [], certifications: [], awards: [], volunteering: []
        };
        delete tailoredData.excluded_items;

        // Step 4: Post-processing
        tailoredData = Prompts.restore_immutable_fields(baseResume, tailoredData);
        tailoredData = Prompts.clean_tailored_resume(tailoredData);

        // Accept both strings (new format) and numbers (legacy), convert numbers to strings
        for (const key of Object.keys(excludedItems)) {
            if (!Array.isArray(excludedItems[key])) {
                excludedItems[key] = [];
            }
            excludedItems[key] = excludedItems[key]
                .map(i => {
                    if (typeof i === 'string') return i.trim();
                    if (typeof i === 'number') {
                        // Legacy: convert index to item name from baseResume
                        const sectionItems = state.baseResume?.[key] || [];
                        if (i < sectionItems.length) {
                            const item = sectionItems[i];
                            return item.company || item.name || item.organization || item.title || '';
                        }
                    }
                    return null;
                })
                .filter(i => i && i.length > 0);
        }

        // Store excluded items in state
        updateState({ excludedItems });
        await chrome.storage.local.set({ excluded_items: excludedItems });

        // Return object matching backend structure — now includes excludedItems
        return {
            tailored_resume: tailoredData,
            jd_analysis: jdAnalysis,
            excluded_items: excludedItems
        };

    } catch (e) {
        console.error("tailorResume failed", e);
        logError('tailor_failed', e, { taskType: 'tailor' });
        throw e;
    }
}



export async function generatePdf(resumeData) {
    try {
        return generateResumePdf(resumeData, state.formatSettings || {});
    } catch (e) {
        console.error("PDF Generation failed", e);
        return { error: e.message };
    }
}

export async function regenerateResume(tailoredResume, bulletCounts, jdAnalysis, apiKey, provider, tailoringStrategy, pageMode = '1page', mustIncludeItems = null) {
    // Uses the current tailored resume (with manual edits) as the base for re-tailoring.
    // Applies bullet count limits and post-processing.
    try {
        const base = tailoredResume;

        if (!jdAnalysis) throw new Error("JD Analysis missing for regeneration");

        // Add company description from state if not found in JD parsing
        if (!jdAnalysis.company_description && state.detectedCompanyDescription) {
            jdAnalysis.company_description = state.detectedCompanyDescription;
        }

        const actionId = `regen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const tailorPrompt = Prompts.buildTailorPrompt(base, jdAnalysis, tailoringStrategy, bulletCounts, pageMode, mustIncludeItems, state.formatSettings);
        const tailorResponse = await callAI(tailorPrompt, provider, apiKey, { expectJson: true, taskType: 'tailor', actionId });
        let newTailoredData = extractJSON(tailorResponse);

        if (!newTailoredData) throw new Error("Failed to regenerate resume JSON");

        // Extract excluded items before cleanup
        let excludedItems = newTailoredData.excluded_items || {};
        delete newTailoredData.excluded_items;

        // Accept both strings (new format) and numbers (legacy), convert numbers to strings
        for (const key of Object.keys(excludedItems)) {
            if (!Array.isArray(excludedItems[key])) {
                excludedItems[key] = [];
            }
            excludedItems[key] = excludedItems[key]
                .map(i => {
                    if (typeof i === 'string') return i.trim();
                    if (typeof i === 'number') {
                        // Legacy: convert index to item name from baseResume
                        const sectionItems = state.baseResume?.[key] || [];
                        if (i < sectionItems.length) {
                            const item = sectionItems[i];
                            return item.company || item.name || item.organization || item.title || '';
                        }
                    }
                    return null;
                })
                .filter(i => i && i.length > 0);
        }

        // Post-process
        // Use baseResume for immutable field restoration to maintain data integrity
        newTailoredData = Prompts.restore_immutable_fields(state.baseResume || base, newTailoredData);
        newTailoredData = Prompts.clean_tailored_resume(newTailoredData);
        newTailoredData = Prompts.enforce_bullet_limits(newTailoredData, bulletCounts);

        // Update excluded items state
        updateState({ excludedItems: excludedItems });
        await chrome.storage.local.set({ excluded_items: excludedItems });

        return newTailoredData;

    } catch (e) {
        console.error("regenerateResume failed", e);
        logError('regen_failed', e, { taskType: 'tailor' });
        throw e;
    }
}

export async function askQuestion(question, resumeData, jdText, apiKey, provider) {
    try {
        const actionId = `ask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const prompt = Prompts.buildQuestionPrompt(question, resumeData, jdText);
        const responseText = await callAI(prompt, provider, apiKey, { expectJson: false, actionId }); // Plain text answer
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
        const actionId = `score_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const prompt = Prompts.buildAnalysisPrompt(resumeData, jdText);
        const responseText = await callAI(prompt, provider, apiKey, { expectJson: true, useProModel: true, taskType: 'score', actionId });
        const data = extractJSON(responseText);
        if (!data) throw new Error("Failed to parse analysis JSON");
        return data;
    } catch (e) {
        console.error("analyzeResume failed", e);
        logError('score_failed', e, { taskType: 'score' });
        return { error: e.message };
    }
}

export async function extractJDWithAI(rawPageText, apiKey, provider) {
    try {
        const actionId = `jd_ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const prompt = Prompts.buildExtractJDFromPagePrompt(rawPageText);
        const responseText = await callAI(prompt, provider, apiKey, { expectJson: true, taskType: 'jdParse', actionId });
        const data = extractJSON(responseText);

        if (!data || data.error) {
            return { error: data?.error || "AI could not extract JD from page" };
        }

        // Combine into a single JD text that the tailoring pipeline expects
        let fullJdText = '';
        if (data.job_title) fullJdText += `Job Title: ${data.job_title}\n`;
        if (data.company_name) fullJdText += `Company: ${data.company_name}\n`;
        if (data.location) fullJdText += `Location: ${data.location}\n`;
        if (data.salary_range) fullJdText += `Salary: ${data.salary_range}\n`;
        if (data.company_description) fullJdText += `About the Company: ${data.company_description}\n\n`;
        if (data.job_description) fullJdText += data.job_description;

        return {
            text: fullJdText,
            title: data.job_title || '',
            company: data.company_name || '',
            companyDescription: data.company_description || '',
            location: data.location || ''
        };
    } catch (e) {
        console.error("AI JD extraction failed:", e);
        return { error: e.message };
    }
}

