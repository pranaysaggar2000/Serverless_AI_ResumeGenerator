const { supabaseAdmin } = require('../../lib/supabase');
const { withCors } = require('../../lib/cors');

/**
 * Initiate Google OAuth flow
 * GET /api/auth/google
 */
module.exports = withCors(async (req, res) => {
    // Only allow GET
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get the callback URL (Prioritize manual production URL for Supabase consistency)
        let baseUrl = process.env.API_BASE_URL
            ? process.env.API_BASE_URL
            : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

        // Strip trailing slash if present
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

        const redirectTo = `${baseUrl}/api/auth/callback`;

        // Generate OAuth URL
        const { data, error } = await supabaseAdmin.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent'
                }
            }
        });

        if (error) {
            console.error('OAuth URL generation error:', error);
            return res.status(500).json({ error: 'Failed to generate OAuth URL' });
        }

        // Return the OAuth URL for the extension to open
        return res.status(200).json({
            url: data.url
        });

    } catch (error) {
        console.error('Google auth error:', error);
        return res.status(500).json({
            error: 'Authentication failed',
            message: error.message
        });
    }
});
