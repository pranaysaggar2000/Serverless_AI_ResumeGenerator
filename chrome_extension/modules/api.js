import { state, updateState } from './state.js';
import { callAI, extractJSON } from './ai_provider.js';
import { debugLog } from './utils.js';
import * as Prompts from './ai_prompts.js';
import { generateResumePdf } from './pdf_builder.js';
import { logError } from './logger.js';
export async function extractText(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        if (!window.pdfjsLib) {
            throw new Error("PDF Library not loaded yet.");
        }

        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            // viewport is needed for normalization if coordinate systems vary, 
            // but usually raw transform is enough. We'll get it just in case.
            const viewport = await page.getViewport({ scale: 1.0 });

            // Position-aware text joining:
            // pdfjsLib items have transform[4]=x, transform[5]=y positions.
            // If two items are close horizontally and on the same line,
            // they're part of the same word — join WITHOUT space.
            // If there's a real gap, join WITH space.
            let pageText = '';
            let prevItem = null;

            for (const item of content.items) {
                if (!item.str) continue;

                if (!prevItem) {
                    pageText += item.str;
                    prevItem = item;
                    continue;
                }

                const prevX = prevItem.transform[4];
                const prevY = prevItem.transform[5];
                const curX = item.transform[4];
                const curY = item.transform[5];

                // Estimate the width of the previous item's text
                // width is usually available, fallback to heuristic
                const prevWidth = prevItem.width || (prevItem.str.length * (prevItem.height || 10) * 0.5);

                // Same line? (Y positions within ~3 units of each other)
                // Y increases upwards in PDF coords usually, but absolute diff works
                const sameLine = Math.abs(curY - prevY) < 3;

                if (!sameLine) {
                    // New line — add newline
                    pageText += '\n' + item.str;
                } else {
                    // Same line — check horizontal gap
                    const gap = curX - (prevX + prevWidth);
                    // Char width approx (height * 0.3 is a conservative tight estimate for a char)
                    const charWidth = (item.height || 10) * 0.3;

                    if (gap > charWidth * 1.5) {
                        // Real word gap — add space
                        pageText += ' ' + item.str;
                    } else {
                        // No significant gap — same word, join directly
                        pageText += item.str;
                    }
                }

                prevItem = item;
            }

            fullText += pageText + '\n';

            // Extract links from annotations
            const annotations = await page.getAnnotations();
            annotations.forEach(annot => {
                if (annot.subtype === 'Link' && annot.url) {
                    fullText += ` [Extracted Link: ${annot.url}] `;
                }
            });
        }

        // Final safety pass: collapse any remaining character-spaced runs
        // (catches edge cases where position data is unreliable)
        fullText = fullText.replace(
            /(?<![A-Za-z0-9])([A-Za-z0-9+#.]) ([A-Za-z0-9+#.])( [A-Za-z0-9+#.]){1,}(?![A-Za-z0-9])/g,
            (match) => match.replace(/ /g, '')
        );

        return { text: fullText };
    } catch (e) {
        console.error("PDF Extraction failed", e);
        return { error: e.message };
    }
}

export async function extractBaseProfile(text, apiKey, provider) {

    // NEW: Direct AI Call
    try {

        const prompt = Prompts.buildExtractProfilePrompt(text);

        const actionId = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        let responseText;
        try {
            responseText = await callAI(prompt, provider, apiKey, { expectJson: true, actionId });
        } catch (e) {
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
    // Clear previous exclusions as this is a fresh forge
    updateState({ excludedItems: null, mustIncludeItems: null });

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


        if (cachedJdAnalysis && cachedJdText?.trim() === jdText?.trim()) {
            // Reuse cached JD analysis - saves 1 API call!
            jdAnalysis = cachedJdAnalysis;
        } else {
            // Parse JD (only if JD changed or no cache)
            const jdPrompt = Prompts.buildParseJobDescriptionPrompt(jdText);
            const jdResponse = await callAI(jdPrompt, provider, apiKey, { expectJson: true, taskType: 'jdParse', actionId });
            jdAnalysis = extractJSON(jdResponse) || {
                // Fallback if parsing fails
                company_name: "Unknown_Company", job_title: "Role", mandatory_keywords: []
            };

            // Cache the JD analysis and the JD text it was parsed from
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

        // Create working copy for prompt building
        let resumeForPrompt = JSON.parse(JSON.stringify(baseResume));

        if (state.mergeResearchIntoProjects) {
            resumeForPrompt = Prompts.mergeResearchIntoProjects(resumeForPrompt);
        }

        // ── Step 2: Strategy agent (Cerebras if available, else falls through to Groq on server) ──
        let agentStrategy = null;
        try {
            const strategyPrompt = Prompts.buildStrategyPrompt(
                resumeForPrompt, jdAnalysis, tailoringStrategy, state.pageMode || '1page'
            );
            const strategyProvider = state.currentCerebrasKey ? 'cerebras' : provider;
            const strategyKey = state.currentCerebrasKey ? state.currentCerebrasKey : apiKey;
            const strategyResponse = await callAI(strategyPrompt, strategyProvider, strategyKey, {
                expectJson: true,
                taskType: 'strategy',
                actionId,
            });
            agentStrategy = extractJSON(strategyResponse);

            // Apply strategy exclusions to resumeForPrompt before the rewrite step
            if (agentStrategy?.exclude) {
                for (const [sec, names] of Object.entries(agentStrategy.exclude)) {
                    if (!Array.isArray(names) || !names.length || !Array.isArray(resumeForPrompt[sec])) continue;
                    resumeForPrompt[sec] = resumeForPrompt[sec].filter(item => {
                        const n = (item.company || item.name || item.organization || item.title || '').toLowerCase();
                        return !names.some(ex => n.includes(ex.toLowerCase()));
                    });
                }
            }
        } catch (stratErr) {
            // Strategy is best-effort — never block the forge if it fails
            console.warn('[forge] Strategy step failed, continuing without it:', stratErr.message);
        }

        const tailorPrompt = Prompts.buildTailorPrompt(resumeForPrompt, jdAnalysis, tailoringStrategy, null, state.pageMode || '1page', state.mustIncludeItems, state.formatSettings, agentStrategy);
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

        // Step 4: Post-processing (ORDER MATTERS)
        tailoredData = Prompts.restore_immutable_fields(baseResume, tailoredData);
        tailoredData = Prompts.clean_tailored_resume(tailoredData);
        tailoredData = Prompts.clean_keyword_stuffing(tailoredData, jdAnalysis);
        tailoredData = Prompts.remove_hallucinated_skills(tailoredData, baseResume, jdAnalysis);
        tailoredData = Prompts.ensure_keyword_coverage(tailoredData, jdAnalysis);
        tailoredData = Prompts.enforce_skill_limits(tailoredData);
        tailoredData = Prompts.enforce_bullet_limits(tailoredData, null); // Initial generation typically has no overrides

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

        // NORMALIZE EXCLUSIONS (Output)
        // If merge is ON, the AI might return research items as 'projects' (correct) or 'research' (unlikely but possible).
        // WE must ensure that if research is merged, all research exclusions are stored under 'projects'.
        if (state.mergeResearchIntoProjects) {
            if (excludedItems.research && excludedItems.research.length > 0) {
                if (!excludedItems.projects) excludedItems.projects = [];
                excludedItems.projects.push(...excludedItems.research);
                excludedItems.research = [];
            }
            // Also, deduplicate projects
            if (excludedItems.projects) {
                excludedItems.projects = [...new Set(excludedItems.projects)];
            }
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
        const doc = generateResumePdf(resumeData, state.formatSettings || {});
        return doc.output('blob');
    } catch (e) {
        console.error("PDF Generation failed", e);
        return { error: e.message };
    }
}

// ─── HALLUCINATION PREVENTION ───

/**
 * Find the index in sourceItems that best matches an editor item.
 * Uses name/company/org matching.
 */
function findMatchingSourceIndex(editorItem, sourceItems) {
    const editorId = (
        editorItem.company || editorItem.name ||
        editorItem.organization || editorItem.title || ''
    ).toLowerCase().trim();

    if (!editorId) return -1;

    for (let i = 0; i < sourceItems.length; i++) {
        const srcId = (
            sourceItems[i].company || sourceItems[i].name ||
            sourceItems[i].organization || sourceItems[i].title || ''
        ).toLowerCase().trim();

        if (srcId === editorId ||
            srcId.includes(editorId) ||
            editorId.includes(srcId)) {
            return i;
        }
    }
    return -1;
}

/**
 * Sanitize bullet counts to prevent hallucination.
 * Ensures bullet counts only apply to items the AI has real content for.
 */
function sanitizeBulletCounts(sourceResume, editorResume, bulletCounts) {
    if (!bulletCounts) return null;

    const sanitized = {};
    const trackedSections = ['experience', 'projects', 'leadership', 'research'];

    trackedSections.forEach(sec => {
        if (!bulletCounts[sec]) {
            sanitized[sec] = [];
            return;
        }

        const sourceItems = sourceResume[sec] || [];
        const editorItems = editorResume[sec] || [];
        sanitized[sec] = [];

        // Build a map: for each editor item, find its matching source item index
        editorItems.forEach((editorItem, editorIdx) => {
            const requestedCount = bulletCounts[sec][editorIdx];
            if (requestedCount === undefined) return;

            // Check if this editor item has any meaningful content
            const itemName = (
                editorItem.company || editorItem.role || editorItem.name ||
                editorItem.title || editorItem.organization || ''
            ).trim();

            const hasNonEmptyBullets = (editorItem.bullets || [])
                .some(b => b && b.trim().length > 0);

            const hasAnyContent = itemName.length > 0 || hasNonEmptyBullets;

            // Find matching item in source (base) resume
            const sourceIdx = findMatchingSourceIndex(editorItem, sourceItems);

            if (sourceIdx >= 0) {
                // Item exists in base resume — safe to use requested count
                const sourceItem = sourceItems[sourceIdx];
                const sourceBulletCount = (sourceItem.bullets || []).length;

                // But cap at reasonable maximum relative to source content
                // If source has 3 bullets, requesting 10 would likely hallucinate
                const maxSafe = Math.max(sourceBulletCount + 2, 3); // Allow +2 expansion
                sanitized[sec][sourceIdx] = Math.min(requestedCount, maxSafe);
            } else if (hasAnyContent) {
                // New item with content — editor index position is used
                // but cap conservatively
                sanitized[sec][editorIdx] = Math.min(requestedCount, 3);
            } else {
                // Empty item with no base match — SKIP (would hallucinate)
            }
        });

        // Fill remaining source items that weren't matched (use their existing count)
        sourceItems.forEach((item, srcIdx) => {
            if (sanitized[sec][srcIdx] === undefined) {
                // Not overridden by editor — use natural count
                sanitized[sec][srcIdx] = (item.bullets || []).length;
            }
        });
    });

    return sanitized;
}

export async function regenerateResume(tailoredResume, bulletCounts, jdAnalysis, apiKey, provider, tailoringStrategy, pageMode = '1page', mustIncludeItems = null, explicitSourceResume = null, explicitDeletedItemIds = null) {
    // Uses the base resume (full context) as the source for re-tailoring.
    // Preserves manual edits from the tailored resume (titles, order, summary).
    try {
        // Use explicitSourceResume (filtered base) if provided, otherwise fallback to state.baseResume
        // The tailored resume is only used to preserve user's manual edits (section_order, titles, etc.)
        const base = explicitSourceResume || state.baseResume || tailoredResume;

        if (!jdAnalysis) throw new Error("JD Analysis missing for regeneration");

        // Merge user customizations from tailored resume into the base before sending
        const sourceResume = JSON.parse(JSON.stringify(base));

        // Preserve section_order if user reordered
        if (tailoredResume.section_order) {
            sourceResume.section_order = tailoredResume.section_order;
        }
        // Preserve custom section_titles
        if (tailoredResume.section_titles) {
            sourceResume.section_titles = { ...sourceResume.section_titles, ...(tailoredResume.section_titles || {}) };
        }
        // Preserve user-edited summary if it differs from original
        if (tailoredResume.summary && tailoredResume.summary !== base.summary) {
            sourceResume.summary = tailoredResume.summary;
        }

        // Add company description from state if not found in JD parsing
        if (!jdAnalysis.company_description && state.detectedCompanyDescription) {
            jdAnalysis.company_description = state.detectedCompanyDescription;
        }

        const actionId = `regen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Sanitize bullet counts to prevent hallucination
        const safeBulletCounts = sanitizeBulletCounts(
            state.baseResume || base, // source resume AI sees
            tailoredResume,           // editor's current state
            bulletCounts
        );

        // Create working copy for prompt building
        let resumeForPrompt = sourceResume;

        // --- NORMALIZE EXCLUSIONS (Input) ---
        let activeExcludedItems = state.excludedItems ? JSON.parse(JSON.stringify(state.excludedItems)) : null;
        if (state.mergeResearchIntoProjects && activeExcludedItems) {
            if (activeExcludedItems.research && activeExcludedItems.research.length > 0) {
                if (!activeExcludedItems.projects) activeExcludedItems.projects = [];
                activeExcludedItems.projects.push(...activeExcludedItems.research);
                activeExcludedItems.research = [];
            }
        }

        if (state.mergeResearchIntoProjects) {
            resumeForPrompt = Prompts.mergeResearchIntoProjects(sourceResume);
        }

        // --- DELETION FILTER: Strip items manually deleted in full editor ---
        // This runs AFTER merge, so if research was merged into projects, the ID map 
        // will correctly filter it from projects if the editor deleted it.
        if (explicitDeletedItemIds) {
            // explicitDeletedItemIds = { section: [id1, id2] }
            resumeForPrompt = JSON.parse(JSON.stringify(resumeForPrompt));
            for (const [sec, deletedIds] of Object.entries(explicitDeletedItemIds)) {
                if (!Array.isArray(resumeForPrompt[sec])) continue;
                if (!Array.isArray(deletedIds) || deletedIds.length === 0) continue;

                resumeForPrompt[sec] = resumeForPrompt[sec].filter(item => {
                    const itemId = (item.company || item.name || item.organization || item.title || '').toLowerCase().trim();
                    return !deletedIds.includes(itemId);
                });
            }
        }

        // --- EXCLUSION FILTER: Strip previously AI-excluded items ---
        if (activeExcludedItems) {
            resumeForPrompt = JSON.parse(JSON.stringify(resumeForPrompt)); // Ensure deep clone for modification
            const mustInclude = state.mustIncludeItems || {};
            for (const [sec, excludedIds] of Object.entries(activeExcludedItems)) {
                if (!Array.isArray(excludedIds) || excludedIds.length === 0) continue;
                if (!Array.isArray(resumeForPrompt[sec])) continue;

                const reIncludeIds = (mustInclude[sec] || []).map(id => String(id).toLowerCase().trim());
                resumeForPrompt[sec] = resumeForPrompt[sec].filter(item => {
                    const itemId = (item.company || item.name || item.organization || item.title || '').toLowerCase().trim();
                    const isExcluded = excludedIds.some(id => {
                        const exLower = String(id).toLowerCase().trim();
                        return exLower === itemId || itemId.includes(exLower) || exLower.includes(itemId);
                    });
                    if (!isExcluded) return true;
                    return reIncludeIds.some(id => id === itemId || itemId.includes(id) || id.includes(itemId));
                });
            }
        }

        const tailorPrompt = Prompts.buildTailorPrompt(resumeForPrompt, jdAnalysis, tailoringStrategy, safeBulletCounts, pageMode, mustIncludeItems, state.formatSettings);
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

        // Post-process (ORDER MATTERS)
        // Use baseResume for immutable field restoration to maintain data integrity
        newTailoredData = Prompts.restore_immutable_fields(state.baseResume || base, newTailoredData);
        newTailoredData = Prompts.clean_tailored_resume(newTailoredData);
        newTailoredData = Prompts.clean_keyword_stuffing(newTailoredData, jdAnalysis);
        newTailoredData = Prompts.remove_hallucinated_skills(newTailoredData, state.baseResume || base, jdAnalysis);
        newTailoredData = Prompts.ensure_keyword_coverage(newTailoredData, jdAnalysis);
        newTailoredData = Prompts.enforce_skill_limits(newTailoredData);
        newTailoredData = Prompts.enforce_bullet_limits(newTailoredData, bulletCounts);

        // NORMALIZE EXCLUSIONS (Output)
        if (state.mergeResearchIntoProjects) {
            if (excludedItems.research && excludedItems.research.length > 0) {
                if (!excludedItems.projects) excludedItems.projects = [];
                excludedItems.projects.push(...excludedItems.research);
                excludedItems.research = [];
            }
            if (excludedItems.projects) {
                excludedItems.projects = [...new Set(excludedItems.projects)];
            }
        }

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
        const jdAnalysis = state.currentJdAnalysis || null;
        const prompt = Prompts.buildAnalysisPrompt(resumeData, jdText, jdAnalysis);
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

