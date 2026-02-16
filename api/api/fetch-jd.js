const cheerio = require('cheerio');

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Or restrict to your extension ID
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        return res.status(200).json({}, corsHeaders);
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing content URL' });
    }

    // SSRF Prevention: Basic URL Validation
    let parsedUrl;
    let hostname;
    try {
        parsedUrl = new URL(url);
        hostname = parsedUrl.hostname;

        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return res.status(400).json({ error: 'Invalid protocol. Only http and https are allowed.' }, corsHeaders);
        }

        // Block private IP ranges (basic check)
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
            return res.status(403).json({ error: 'Access to private networks is denied.' }, corsHeaders);
        }

    } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format' }, corsHeaders);
    }


    // Check for Workday URLs to use their JSON API directly (better than scraping raw HTML for SPAs)
    if (hostname.endsWith('myworkdayjobs.com')) {
        try {
            const company = hostname.split('.')[0];
            const pathParts = parsedUrl.pathname.split('/').filter(p => p);

            if (pathParts.length >= 2) {
                const tenant = pathParts[0];
                const jobPath = pathParts.slice(1).join('/'); // Includes 'job/' and the ID
                const apiUrl = `https://${hostname}/wday/cxs/${company}/${tenant}/${jobPath}`;

                const apiResponse = await fetch(apiUrl, {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    signal: AbortSignal.timeout(8000)
                });

                if (apiResponse.ok) {
                    const data = await apiResponse.json();
                    if (data.jobPostingInfo) {
                        const job = data.jobPostingInfo;
                        // Strip HTML tags from the description
                        const rawText = (job.jobDescription || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

                        return res.status(200).json({
                            text: rawText.substring(0, 15000),
                            title: job.title || '',
                            company: job.hiringOrganization || company,
                            url: url
                        }, corsHeaders);
                    }
                }
            }
        } catch (e) {
            console.error('Workday API specific fetch failed, falling back to generic fetch:', e);
        }
    }


    try {
        // Fetch HTML with a browser-like User-Agent
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            signal: AbortSignal.timeout(8000) // 8s timeout
        });

        if (!response.ok) {
            return res.status(response.status).json({
                error: `Failed to fetch page: ${response.status} ${response.statusText}`
            }, corsHeaders);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Remove non-content elements
        $('script, style, noscript, iframe, svg, header, footer, nav').remove();

        // Extract text
        let text = $('body').text()
            .replace(/\s+/g, ' ')
            .trim();

        // Metadata extraction
        const title = $('title').text().trim() ||
            $('meta[property="og:title"]').attr('content') || '';

        const company = $('meta[property="og:site_name"]').attr('content') || '';

        // Limit text length to avoid token limits later
        const maxLength = 15000;
        if (text.length > maxLength) {
            text = text.substring(0, maxLength);
        }

        return res.status(200).json({
            text,
            title,
            company,
            url
        }, corsHeaders);

    } catch (error) {
        console.error('Fetch error:', error);
        return res.status(500).json({
            error: 'Failed to extract content',
            details: error.message
        }, corsHeaders);
    }
}
