const { supabaseAdmin } = require('../lib/supabase');
const { withCors } = require('../lib/cors');
const crypto = require('crypto');

function hashUserId(userId) {
    if (!userId) return 'anon';
    return crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);
}

// Sanitize error messages — strip anything that looks like PII or content
function sanitizeMessage(msg) {
    if (!msg) return '';
    return String(msg)
        .substring(0, 300)
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')  // emails
        .replace(/\+?1?\d{10,}/g, '[PHONE]')                                       // phone numbers
        .replace(/sk-[a-zA-Z0-9-]+/g, '[API_KEY]')                                 // API keys
        .replace(/eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+/g, '[JWT]')               // JWTs
        .replace(/Bearer [^\s]+/g, 'Bearer [REDACTED]');                            // auth headers
}

// Only allow these metadata keys — reject everything else
const ALLOWED_METADATA_KEYS = [
    'provider', 'model', 'taskType', 'duration', 'statusCode',
    'authMode', 'strategy', 'pageMode', 'modelChainIndex', 'retryCount'
];

function sanitizeMetadata(meta) {
    if (!meta || typeof meta !== 'object') return {};
    const clean = {};
    for (const key of ALLOWED_METADATA_KEYS) {
        if (meta[key] !== undefined) {
            // Ensure values are primitives only
            const val = meta[key];
            if (typeof val === 'string') clean[key] = val.substring(0, 100);
            else if (typeof val === 'number') clean[key] = val || 0;
            else if (typeof val === 'boolean') clean[key] = val;
        }
    }
    return clean;
}

module.exports = withCors(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        // Auth optional — allow anonymous error reports
        let userId = null;
        try {
            const { verifyUser } = require('../lib/auth');
            const user = await verifyUser(req);
            userId = user.id;
        } catch (_) { }

        const { level, event, message, metadata, appVersion } = req.body;
        if (!event) return res.status(400).json({ error: 'Missing event' });

        const VALID_LEVELS = ['error', 'warn', 'info'];
        const cleanLevel = VALID_LEVELS.includes(level) ? level : 'error';

        await supabaseAdmin.from('logs').insert({
            user_hash: hashUserId(userId),
            level: cleanLevel,
            event: String(event).substring(0, 100),
            message: sanitizeMessage(message),
            metadata: sanitizeMetadata(metadata),
            app_version: appVersion ? String(appVersion).substring(0, 20) : null,
            created_at: new Date().toISOString()
        });

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Log endpoint error:', error);
        return res.status(500).json({ error: 'Failed' });
    }
});
