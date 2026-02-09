/**
 * Higher-order function to wrap API handlers with CORS logic
 */
function withCors(handler) {
    return async (req, res) => {
        const origin = req.headers.origin;

        // Dynamic Origin Validation
        let allowedOrigin = null;

        if (origin) {
            const isChromeExtension = origin.startsWith('chrome-extension://');
            const isLocalhost = origin.startsWith('http://localhost') || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin);
            const isAllowedDomain = [
                'serverless-ai-resume-generator-api.vercel.app',
                'forgecv.vercel.app' // Assuming this might be a frontend domain
            ].some(domain => origin.endsWith(domain));

            if (isChromeExtension || isLocalhost || isAllowedDomain) {
                allowedOrigin = origin;
            }
        }

        // Set CORS headers
        if (allowedOrigin) {
            res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
        }

        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        // Handle preflight
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        return handler(req, res);
    };
}

module.exports = { withCors };
