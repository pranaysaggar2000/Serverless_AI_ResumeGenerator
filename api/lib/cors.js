const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Higher-order function to wrap API handlers with CORS logic
 */
function withCors(handler) {
    return async (req, res) => {
        // Set CORS headers
        Object.entries(CORS_HEADERS).forEach(([key, val]) => res.setHeader(key, val));
        res.setHeader('Content-Type', 'application/json');

        // Handle preflight
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        return handler(req, res);
    };
}

module.exports = { withCors };
