export function extractJobDescription() {


    // Helper: Clean text
    const cleanText = (text) => {
        if (!text) return "";
        return text
            .replace(/<[^>]*>/g, ' ') // strip tags
            .replace(/\s+/g, ' ')     // collapse whitespace
            .trim();
    };

    // Helper: Deep innerText (traverses Shadow DOM)
    const getDeepInnerText = (root) => {
        let text = "";
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null, false);

        let node = walker.nextNode();
        while (node) {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent + " ";
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.shadowRoot) {
                    text += getDeepInnerText(node.shadowRoot) + " ";
                }
            }
            node = walker.nextNode();
        }
        return text;
    };

    // 1. Site-Specific Selectors
    const siteSelectors = {
        'linkedin.com': ['.jobs-description__content', '.description__text', '.jobs-box__html-content', '#job-details'],
        'indeed.com': ['#jobDescriptionText', '.jobsearch-jobDescriptionText', '#jobDescription'],
        'greenhouse.io': ['#content', '.content-intro + div', '#app_body'],
        'lever.co': ['.section-wrapper', '.content', '.posting-page'],
        'myworkdayjobs.com': ['[data-automation-id="jobPostingDescription"]', '.css-kyg8or'],
        'glassdoor.com': ['.JobDetails_jobDescription__uW_fK', '#JobDescriptionContainer', '.jobDescriptionContent'],
        'ziprecruiter.com': ['.job_description', '.jobDescriptionSection'],
        'monster.com': ['#JobDescription', '.job-description'],
        'smartrecruiters.com': ['.job-details', '.job-description'],
        'workable.com': ['[data-automation-id="job-description"]', '.job-description']
    };

    const hostname = window.location.hostname;
    let jdText = "";

    // Check site specific
    for (const [site, selectors] of Object.entries(siteSelectors)) {
        if (hostname.includes(site)) {
            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el && (el.innerText || el.textContent).length > 100) {
                    jdText = cleanText(el.innerText || el.textContent);
                    break;
                }
            }
        }
        if (jdText) break;
    }

    // 2. Generic Selectors Fallback
    if (!jdText) {
        const genericSelectors = [
            '[class*="job-description"]', '[class*="jobDescription"]', '[class*="description"]',
            '[id*="job-description"]', '[id*="jobDescription"]', 'article', 'main', '[role="main"]',
            '.posting-description', '#posting-description'
        ];

        for (const selector of genericSelectors) {
            const elements = document.querySelectorAll(selector);
            let bestEl = null;
            let maxLen = 0;

            elements.forEach(el => {
                const text = el.innerText || el.textContent || "";
                const len = text.length;
                if (len > 300 && len > maxLen) {
                    maxLen = len;
                    bestEl = el;
                }
            });

            if (bestEl) {
                jdText = cleanText(bestEl.innerText || bestEl.textContent);
                break;
            }
        }
    }

    // 3. Consolidated Body Fallback (Traverses Shadow DOM & Removes Noise)
    if (!jdText) {
        const bodyClone = document.body.cloneNode(true);
        const noiseSelectors = 'nav, footer, header, aside, script, style, noscript, iframe, [role="navigation"], [role="banner"], [class*="cookie"], [class*="sidebar"], [class*="menu"], [id*="cookie"], [id*="footer"], [id*="nav"]';
        const noise = bodyClone.querySelectorAll(noiseSelectors);
        noise.forEach(n => n.remove());

        // Try clean fallback from standard clone
        const cleanedText = cleanText(bodyClone.innerText || bodyClone.textContent);

        if (cleanedText.length > 500) {
            jdText = cleanedText;
        } else {
            // Last resort: deep text if standard body text was too small
            const deepText = getDeepInnerText(document.body);
            const cleanedDeep = cleanText(deepText);
            if (cleanedDeep.length > 500) {
                jdText = cleanedDeep;
            }
        }
    }

    // Truncate if extreme
    if (jdText.length > 15000) jdText = jdText.substring(0, 15000);

    // Metadata Extraction
    let detectedJobTitle = "";
    let detectedCompany = "";

    // Title: Check h1 or job title specific classes
    const titleSelectors = ['h1', '[class*="job-title"]', '[class*="jobTitle"]', '.posting-header h2'];
    for (const sel of titleSelectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim()) {
            detectedJobTitle = el.innerText.trim();
            break;
        }
    }
    if (!detectedJobTitle) detectedJobTitle = document.title.split(/[-|—]/)[0].trim();

    // Company Detection
    detectedCompany = hostname.replace('www.', '').split('.')[0];
    const companySelectors = ['[class*="company"]', '[class*="organization"]', '.employer'];
    for (const sel of companySelectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim() && el.innerText.length < 50) {
            detectedCompany = el.innerText.trim();
            break;
        }
    }

    return {
        text: jdText,
        title: detectedJobTitle,
        company: detectedCompany
    };
}
