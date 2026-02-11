const { verifyUser } = require('../lib/auth');
const { supabaseAdmin } = require('../lib/supabase');
const { withCors } = require('../lib/cors');
const crypto = require('crypto');

function hashUserId(userId) {
    if (!userId) return 'anon';
    return crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);
}

module.exports = withCors(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const user = await verifyUser(req);
        const { rating, comment, metadata } = req.body;

        if (![-1, 1].includes(rating)) {
            return res.status(400).json({ error: 'Rating must be -1 or 1' });
        }

        // Only allow safe metadata
        const cleanMeta = {};
        if (metadata?.provider) cleanMeta.provider = String(metadata.provider).substring(0, 30);
        if (metadata?.strategy) cleanMeta.strategy = String(metadata.strategy).substring(0, 30);
        if (metadata?.pageMode) cleanMeta.pageMode = String(metadata.pageMode).substring(0, 10);

        await supabaseAdmin.from('feedback').insert({
            user_hash: hashUserId(user.id),
            rating,
            comment: comment ? String(comment).substring(0, 500) : null,
            metadata: cleanMeta,
            created_at: new Date().toISOString()
        });

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Feedback endpoint error:', error);
        return res.status(500).json({ error: 'Failed' });
    }
});
