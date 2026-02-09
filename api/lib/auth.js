const { supabaseAdmin } = require('./supabase');

/**
 * Verify user from Bearer token in Authorization header
 * @param {Request} req - HTTP request object
 * @returns {Promise<{id: string, email: string}>} User object
 * @throws {Error} 401 error if token is invalid
 */
async function verifyUser(req) {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const error = new Error('Missing or invalid authorization header');
        error.statusCode = 401;
        throw error;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
        const { data, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !data.user) {
            const authError = new Error('Invalid or expired token');
            authError.statusCode = 401;
            throw authError;
        }

        return {
            id: data.user.id,
            email: data.user.email
        };

    } catch (error) {
        if (error.statusCode === 401) {
            throw error;
        }
        console.error('Auth verification failed:', error);
        const authError = new Error('Authentication failed');
        authError.statusCode = 401;
        throw authError;
    }
}

module.exports = {
    verifyUser
};
