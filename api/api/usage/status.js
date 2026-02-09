const { verifyUser } = require('../../lib/auth');
const { supabaseAdmin } = require('../../lib/supabase');

/**
 * CORS headers for all responses
 */
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

/**
 * Get usage status endpoint
 * GET /api/usage/status
 */
module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Verify user authentication
        const user = await verifyUser(req);

        const DAILY_ACTION_LIMIT = parseInt(process.env.DAILY_ACTION_LIMIT || '15', 10);

        // Get start of today in UTC
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        // Count today's actions for this user
        const { data: usageData, error: countError } = await supabaseAdmin
            .from('usage')
            .select('id', { count: 'exact', head: false })
            .eq('user_id', user.id)
            .gte('created_at', todayISO);

        if (countError) {
            console.error('Error counting usage:', countError);
            return res.status(500).json({ error: 'Failed to fetch usage data' });
        }

        const used = usageData?.length || 0;
        const remaining = Math.max(0, DAILY_ACTION_LIMIT - used);

        // Calculate next reset time (next UTC midnight)
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(0, 0, 0, 0);

        return res.status(200).json({
            used,
            remaining,
            limit: DAILY_ACTION_LIMIT,
            resetsAt: tomorrow.toISOString()
        });

    } catch (error) {
        console.error('Usage status error:', error);

        if (error.statusCode === 401) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        return res.status(500).json({
            error: 'Failed to fetch usage status',
            message: error.message
        });
    }
};
