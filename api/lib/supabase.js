const { createClient } = require('@supabase/supabase-js');

// Admin client for server-side operations (bypasses RLS)
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// Create a user-authenticated client
function createUserClient(accessToken) {
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
            global: {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            },
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );
}

module.exports = {
    supabaseAdmin,
    createUserClient
};
