export function extractJobDescription() {
    const debug = (msg) => console.log(`[JD Extractor] ${msg}`);
    debug("Starting extraction...");

    // Helper: Clean text
    const cleanText = (text) => {
        if (!text) return "";
        return text
            .replace(/<[^>]*>/g, ' ') // strip tags (if any slipped through)
            .replace(/\s+/g, ' ')     // collapse whitespace
            .trim();
    };

    // 1. Site-Specific Selectors
    const siteSelectors = {
        'linkedin.com': [
            '.jobs-description__content',
            '.description__text',
            '.jobs-box__html-content',
            '#job-details'
        ],
        'indeed.com': [
            '#jobDescriptionText',
            '.jobsearch-jobDescriptionText',
            '#jobDescription'
        ],
        'greenhouse.io': [
            '#content',
            '.content-intro + div',
            '#app_body'
        ],
        'lever.co': [
            '.section-wrapper',
            '.content',
            '.posting-page'
        ],
        'myworkdayjobs.com': [
            '[data-automation-id="jobPostingDescription"]',
            '.css-kyg8or'
        ],
        'glassdoor.com': [
            '.JobDetails_jobDescription__uW_fK',
            '#JobDescriptionContainer'
        ],
        'ziprecruiter.com': [
            '.job_description',
            '.jobDescriptionSection'
        ],
        'monster.com': [
            '#JobDescription',
            '.job-description'
        ]
    };

    const hostname = window.location.hostname;
    let jdText = "";

    // Check site specific
    for (const [site, selectors] of Object.entries(siteSelectors)) {
        if (hostname.includes(site)) {
            debug(`Detected site: ${site}`);
            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el && el.innerText.length > 100) {
                    jdText = cleanText(el.innerText);
                    debug(`Found match with selector: ${selector}`);
                    break;
                }
            }
        }
        if (jdText) break;
    }

    // 2. Generic Selectors Fallback
    if (!jdText) {
        debug("No site match. Trying generic selectors...");
        const genericSelectors = [
            '[class*="job-description"]',
            '[class*="jobDescription"]',
            '[class*="description"]',
            '[id*="job-description"]',
            '[id*="jobDescription"]',
            'article',
            'main',
            '[role="main"]'
        ];

        for (const selector of genericSelectors) {
            // Because class*="description" is broad, we queryAll and find the biggest one
            const elements = document.querySelectorAll(selector);
            let bestEl = null;
            let maxLen = 0;

            elements.forEach(el => {
                // simple heuristic: visible text length
                const len = el.innerText.length;
                if (len > 300 && len > maxLen) { // Minimum 300 char for generic to avoid navs
                    maxLen = len;
                    bestEl = el;
                }
            });

            if (bestEl) {
                jdText = cleanText(bestEl.innerText);
                debug(`Found generic match: ${selector} (${maxLen} chars)`);
                break;
            }
        }
    }

    // 3. Body Fallback (Cleaned)
    if (!jdText) {
        debug("No selector match. Using cleaned body text...");
        // Clone body to manipulate
        const bodyClone = document.body.cloneNode(true);

        // Remove noise elements
        const noiseSelectors = [
            'nav', 'footer', 'header', 'aside',
            '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
            '.cookie', '.sidebar', '.nav', '.footer', '.header',
            'script', 'style', 'noscript', 'iframe'
        ];

        noiseSelectors.forEach(sel => {
            const noise = bodyClone.querySelectorAll(sel);
            noise.forEach(n => n.remove());
        });

        jdText = cleanText(bodyClone.innerText);
        // Truncate
        if (jdText.length > 15000) jdText = jdText.substring(0, 15000);
        debug(`Extracted body text: ${jdText.length} chars`);
    }

    // Metadata Extraction
    let detectedJobTitle = "";
    let detectedCompany = "";

    // Title: Check h1 or title tag
    const h1 = document.querySelector('h1');
    if (h1) detectedJobTitle = h1.innerText.trim();
    if (!detectedJobTitle) detectedJobTitle = document.title.split('-')[0].split('|')[0].trim();

    // Company: Hostname or title
    detectedCompany = hostname.replace('www.', '');
    if (document.title.includes(' at ')) {
        // "Role at Company" pattern
        const parts = document.title.split(' at ');
        if (parts.length > 1) detectedCompany = parts[1].split('|')[0].split('-')[0].trim();
    }

    return {
        text: jdText,
        title: detectedJobTitle,
        company: detectedCompany
    };
}
