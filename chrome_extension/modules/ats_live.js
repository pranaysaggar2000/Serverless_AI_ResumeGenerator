import { state } from './state.js';

/**
 * Lightweight client-side ATS keyword match estimator.
 * Uses cached JD keywords from the last tailor/analysis step.
 * Returns a quick score without API calls.
 */
export function calculateLiveAtsScore(resumeData, jdAnalysisOverride = null) {
    // 1. Get JD Analysis from storage OR override
    // Note: In live editor, we might need to pass this in because async storage read is too slow for sync render
    const analysisFull = jdAnalysisOverride || state.currentJdAnalysis;
    if (!analysisFull) return null;
    const keywords = analysisFull.keywords || analysisFull;
    const mandatoryKeywords = (keywords.mandatory_keywords || []).map(k => k.toLowerCase().trim()).filter(Boolean);
    const preferredKeywords = (keywords.preferred_keywords || []).map(k => k.toLowerCase().trim()).filter(Boolean);
    const industryTerms = (keywords.industry_terms || []).map(k => k.toLowerCase().trim()).filter(Boolean);

    if (mandatoryKeywords.length === 0 && preferredKeywords.length === 0) return null;

    // Flatten resume into searchable text
    const resumeText = flattenForSearch(resumeData);

    // Score mandatory keywords (weight: 3x)
    const mandatoryMatches = mandatoryKeywords.filter(k => matchKeyword(k, resumeText));

    // Score preferred keywords (weight: 1.5x)  
    const preferredMatches = preferredKeywords.filter(k => matchKeyword(k, resumeText));

    // Score industry terms (weight: 1x)
    const industryMatches = industryTerms.filter(k => matchKeyword(k, resumeText));

    // Calculate weighted score
    const maxScore = (mandatoryKeywords.length * 3) + (preferredKeywords.length * 1.5) + (industryTerms.length * 1);
    const actualScore = (mandatoryMatches.length * 3) + (preferredMatches.length * 1.5) + (industryMatches.length * 1);

    const percentage = maxScore > 0 ? Math.round((actualScore / maxScore) * 100) : 0;

    return {
        score: percentage,
        mandatory: { matched: mandatoryMatches, total: mandatoryKeywords, missing: mandatoryKeywords.filter(k => !mandatoryMatches.includes(k)) },
        preferred: { matched: preferredMatches, total: preferredKeywords, missing: preferredKeywords.filter(k => !preferredMatches.includes(k)) },
        industry: { matched: industryMatches, total: industryTerms, missing: industryTerms.filter(k => !industryMatches.includes(k)) }
    };
}

function matchKeyword(keyword, text) {
    // Handle multi-word keywords and common variations
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Try exact word boundary match first
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(text)) return true;

    // Also try without dots/periods for acronyms (e.g., "Node.js" matches "nodejs")
    const noDots = keyword.replace(/\./g, '');
    if (noDots !== keyword) {
        const altRegex = new RegExp(`\\b${noDots.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (altRegex.test(text)) return true;
    }

    return false;
}

function flattenForSearch(data) {
    if (!data) return '';
    let text = '';

    if (data.summary) text += data.summary + ' ';

    if (data.skills) {
        if (typeof data.skills === 'object' && !Array.isArray(data.skills)) {
            for (const vals of Object.values(data.skills)) {
                text += (Array.isArray(vals) ? vals.join(' ') : String(vals)) + ' ';
            }
        }
    }

    ['experience', 'projects', 'leadership', 'research', 'volunteering'].forEach(sec => {
        if (data[sec] && Array.isArray(data[sec])) {
            data[sec].forEach(item => {
                if (item.role) text += item.role + ' ';
                if (item.company) text += item.company + ' ';
                if (item.tech) text += item.tech + ' ';
                if (item.name) text += item.name + ' ';
                if (item.bullets) text += item.bullets.join(' ') + ' ';
            });
        }
    });

    if (data.certifications) {
        data.certifications.forEach(c => { text += (c.name || '') + ' '; });
    }

    return text.toLowerCase();
}

/**
 * Render a compact live ATS badge in the editor
 */
export function renderLiveAtsBadge(containerId = 'formContainer', resumeData = null) {
    // Only show in tailored resume editor context
    if (containerId === 'profileFormContainer') return;

    const resume = resumeData || state.tailoredResume;
    if (!resume) return;

    const result = calculateLiveAtsScore(resume);
    if (!result) return;

    // Find or create badge element
    let badge = document.getElementById('liveAtsBadge');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'liveAtsBadge';
        badge.style.cssText = 'position:sticky; top:0; z-index:10; padding:8px 12px; border-radius:8px; font-size:11px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition:all 0.3s;';
        badge.title = 'Keyword presence check — shows if JD keywords exist in your resume. Run "ATS Score" for contextual quality analysis.';

        const container = document.getElementById(containerId);
        if (container) container.insertBefore(badge, container.firstChild);
    }

    // Color based on missing mandatory keywords
    let bgColor, textColor, emoji;
    const missingMandatory = result.mandatory.missing.length;

    if (missingMandatory === 0) { bgColor = '#d1fae5'; textColor = '#065f46'; emoji = '✅'; }
    else if (missingMandatory <= 2) { bgColor = '#fef3c7'; textColor = '#92400e'; emoji = '⚠️'; }
    else { bgColor = '#fee2e2'; textColor = '#991b1b'; emoji = '🔴'; }

    badge.style.background = bgColor;
    badge.style.color = textColor;
    badge.style.border = `1px solid ${textColor}22`;

    // Build content safely
    const content = document.createElement('div');

    // Main Stats Line
    const statsLine = document.createElement('div');
    const mainStat = document.createElement('span');
    mainStat.style.fontWeight = 'bold';
    mainStat.textContent = `${emoji} Keywords: ${result.mandatory.matched.length}/${result.mandatory.total.length} required found`;

    const subStat = document.createElement('span');
    subStat.style.cssText = "opacity:0.7; margin-left:4px; font-weight:normal;";
    subStat.textContent = `· ${result.preferred.matched.length}/${result.preferred.total.length} preferred`;

    statsLine.appendChild(mainStat);
    statsLine.appendChild(subStat);

    // Missing Line
    const missingLine = document.createElement('div');
    missingLine.style.fontSize = '10px';

    if (missingMandatory > 0) {
        missingLine.textContent = `⚠️ Missing: ${result.mandatory.missing.slice(0, 4).join(', ')}${result.mandatory.missing.length > 4 ? '...' : ''}`;
    } else {
        missingLine.textContent = '✅ All required keywords present · Run ATS Score for full analysis';
    }

    content.appendChild(statsLine);
    content.appendChild(missingLine);

    badge.innerHTML = '';
    badge.appendChild(content);

    // Click to expand missing keywords
    badge.innerHTML = '';
    badge.appendChild(content);

    // Click to expand missing keywords
    badge.onclick = (e) => {
        // Prevent conflict if button inside badge is clicked (though none currently)
        e.stopPropagation();
        showAtsDetailsPopup(result);
    };
}

export function showAtsDetailsPopup(result) {
    let details = document.getElementById('liveAtsDetails');
    if (details) {
        details.remove();
        return;
    }
    details = document.createElement('div');
    details.id = 'liveAtsDetails';
    details.style.cssText = 'position:fixed; top:60px; right:20px; width:300px; padding:15px; background:white; border:1px solid #e5e7eb; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.1); z-index:100; font-size:12px; animation: fadeIn 0.2s ease;';

    const header = document.createElement('div');
    header.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #f3f4f6; padding-bottom:8px;";

    const title = document.createElement('div');
    title.style.cssText = "font-weight:bold; font-size:14px; color:#111827;";
    title.textContent = "🔍 Keyword Match Analysis";

    const closeBtn = document.createElement('button');
    closeBtn.textContent = "×";
    closeBtn.style.cssText = "background:none; border:none; font-size:18px; cursor:pointer; color:#6b7280;";
    closeBtn.onclick = () => details.remove();

    header.appendChild(title);
    header.appendChild(closeBtn);
    details.appendChild(header);

    const subtitle = document.createElement('div');
    // Helper to render section
    const renderSection = (title, items, color, isEmptyMessage = null) => {
        const div = document.createElement('div');
        div.style.cssText = `margin-bottom:10px; padding:8px; background:${color}10; border-radius:6px; border-left:3px solid ${color};`;

        const t = document.createElement('div');
        t.style.fontWeight = '600';
        t.style.color = color;
        t.style.marginBottom = '4px';
        t.textContent = title;

        const list = document.createElement('div');
        list.style.lineHeight = '1.4';
        list.style.color = '#374151';

        if (items && items.length > 0) {
            list.textContent = items.join(', ');
        } else if (isEmptyMessage) {
            list.textContent = isEmptyMessage;
            list.style.fontStyle = 'italic';
            list.style.opacity = '0.8';
        } else {
            return; // Don't render empty section without message
        }

        div.appendChild(t);
        div.appendChild(list);
        details.appendChild(div);
    };

    if (result.mandatory.missing.length > 0) {
        renderSection("❌ Missing Required", result.mandatory.missing, '#dc2626');
    } else {
        renderSection("✅ Required Keywords", [], '#059669', "All required keywords are present! Great job.");
    }

    if (result.preferred.missing.length > 0) {
        renderSection("⚠️ Missing Preferred", result.preferred.missing.slice(0, 15), '#d97706');
    }

    if (result.industry.missing.length > 0) {
        renderSection("ℹ️ Missing Industry Terms", result.industry.missing.slice(0, 15), '#4b5563');
    }

    // Also show what IS matched so it's not empty
    const allMatched = [...result.mandatory.matched, ...result.preferred.matched];
    if (allMatched.length > 0) {
        renderSection("🎉 Matched Keywords", allMatched.slice(0, 20).concat(allMatched.length > 20 ? ['...'] : []), '#2563eb');
    } else if (result.mandatory.missing.length === 0 && result.preferred.missing.length === 0) {
        // Edge case: No keywords defined at all?
        const noKeysDiv = document.createElement('div');
        noKeysDiv.style.padding = "10px";
        noKeysDiv.style.textAlign = "center";
        noKeysDiv.style.color = "#6b7280";
        noKeysDiv.textContent = "No specific keywords found in Job Description to analyze.";
        details.appendChild(noKeysDiv);
    }

    const tip = document.createElement('div');
    tip.style.cssText = "color:#6b7280; margin-top:10px; font-style:italic; font-size:10px; border-top:1px solid #f3f4f6; padding-top:8px;";
    tip.textContent = "💡 Pro Tip: Prioritize using 'Missing Required' keywords in your Bullet Points for maximum impact.";
    details.appendChild(tip);

    document.body.appendChild(details);

    // Auto-close on outside click
    const closeListener = (e) => {
        if (!details.contains(e.target) && e.target.id !== 'atsBadge' && e.target.id !== 'liveAtsBadge') {
            details.remove();
            document.removeEventListener('click', closeListener);
        }
    };
    // Delay to prevent immediate closing from the trigger click
    setTimeout(() => document.addEventListener('click', closeListener), 0);
}
