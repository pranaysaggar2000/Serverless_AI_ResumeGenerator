import { state } from './state.js';

/**
 * Lightweight client-side ATS keyword match estimator.
 * Uses cached JD keywords from the last tailor/analysis step.
 * Returns a quick score without API calls.
 */
export function calculateLiveAtsScore(resumeData) {
    // Get keywords from either the JD analysis or the last ATS analysis
    const jdAnalysis = state.currentJdAnalysis;
    if (!jdAnalysis) return null;

    const mandatoryKeywords = (jdAnalysis.mandatory_keywords || []).map(k => k.toLowerCase().trim()).filter(Boolean);
    const preferredKeywords = (jdAnalysis.preferred_keywords || []).map(k => k.toLowerCase().trim()).filter(Boolean);
    const industryTerms = (jdAnalysis.industry_terms || []).map(k => k.toLowerCase().trim()).filter(Boolean);

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
        industry: { matched: industryMatches, total: industryTerms }
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
        badge.title = 'Click for details — This is a quick keyword-match estimate, not the full AI ATS analysis';

        const container = document.getElementById(containerId);
        if (container) container.insertBefore(badge, container.firstChild);
    }

    // Color based on score
    let bgColor, textColor, emoji;
    if (result.score >= 80) { bgColor = '#d1fae5'; textColor = '#065f46'; emoji = '🟢'; }
    else if (result.score >= 60) { bgColor = '#fef3c7'; textColor = '#92400e'; emoji = '🟡'; }
    else { bgColor = '#fee2e2'; textColor = '#991b1b'; emoji = '🔴'; }

    badge.style.background = bgColor;
    badge.style.color = textColor;
    badge.style.border = `1px solid ${textColor}22`;

    const missingMandatory = result.mandatory.missing.length;

    badge.innerHTML = `
        <div>
            <span style="font-weight:bold;">${emoji} ATS Match: ~${result.score}%</span>
            <span style="opacity:0.8; margin-left:6px;">(${result.mandatory.matched.length}/${result.mandatory.total.length} required)</span>
        </div>
        ${missingMandatory > 0 ? `<div style="font-size:10px;">⚠️ ${missingMandatory} required keyword${missingMandatory > 1 ? 's' : ''} missing</div>` : '<div style="font-size:10px;">✅ All required keywords present</div>'}
    `;

    // Click to expand missing keywords
    badge.onclick = () => {
        let details = document.getElementById('liveAtsDetails');
        if (details) {
            details.remove();
            return;
        }
        details = document.createElement('div');
        details.id = 'liveAtsDetails';
        details.style.cssText = 'padding:10px; margin-bottom:10px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; font-size:10px;';

        let html = '<div style="font-weight:bold; margin-bottom:6px;">📊 Quick Keyword Scan (live estimate)</div>';
        if (result.mandatory.missing.length > 0) {
            html += `<div style="color:#dc2626; margin-bottom:4px;"><strong>Missing Required:</strong> ${result.mandatory.missing.join(', ')}</div>`;
        }
        if (result.preferred.missing.length > 0) {
            html += `<div style="color:#d97706; margin-bottom:4px;"><strong>Missing Preferred:</strong> ${result.preferred.missing.slice(0, 8).join(', ')}${result.preferred.missing.length > 8 ? '...' : ''}</div>`;
        }
        html += `<div style="color:#6b7280; margin-top:6px; font-style:italic;">This is a keyword scan, not the full AI ATS score. Run "📊 ATS Score" for detailed analysis.</div>`;

        badge.after(details);
    };
}
