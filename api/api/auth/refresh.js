const { supabaseAdmin } = require('../../lib/supabase');
const { withCors } = require('../../lib/cors');

/**
 * Handle token refresh
 * POST /api/auth/refresh
 */
module.exports = withCors(async (req, res) => {

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            return res.status(400).json({ error: 'Missing refresh_token' });
        }

        const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token });

        if (error) {
            console.error('Supabase refresh error:', error);
            return res.status(401).json({ error: error.message });
        }

        return res.status(200).json({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            user: data.user
        });

    } catch (error) {
        console.error('Refresh endpoint error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
