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
 * Initiate Google OAuth flow
 * GET /api/auth/google
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
        // Get the callback URL from environment or construct it
        const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : process.env.API_BASE_URL || 'http://localhost:3000';

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
};
