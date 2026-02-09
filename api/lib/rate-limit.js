const { supabaseAdmin } = require('./supabase');

/**
 * Check if user has remaining actions and increment usage count
 * @param {string} userId - Supabase user ID
 * @param {string} actionType - Type of action (e.g., 'jdParse', 'tailor', 'score')
 * @param {string} actionId - Unique ID for the action (optional, for multi-call operations)
 * @returns {Promise<{allowed: boolean, remaining: number, limit: number}>}
 */
async function checkAndIncrementUsage(userId, actionType, actionId = null) {
    const DAILY_ACTION_LIMIT = parseInt(process.env.DAILY_ACTION_LIMIT || '15', 10);

    // Get start of today in UTC
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    try {
        // 1. Initial count of today's actions for this user
        const { count: currentCount, error: countError } = await supabaseAdmin
            .from('usage')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', todayISO);

        if (countError) {
            console.error('Error counting usage:', countError);
            throw new Error('Failed to check usage limit');
        }

        const currentUsageCount = currentCount || 0;

        // 2. If actionId is provided, check if it already exists for this user today (Deduplication)
        if (actionId) {
            const { data: existingAction, error: checkError } = await supabaseAdmin
                .from('usage')
                .select('id')
                .eq('user_id', userId)
                .eq('action_id', actionId)
                .gte('created_at', todayISO)
                .maybeSingle();

            if (checkError) {
                console.error('Error checking existing actionId:', checkError);
            }

            if (existingAction) {
                // This call is part of a compound action (e.g. JD Parse + Tailor) that was already counted
                return {
                    allowed: true,
                    remaining: DAILY_ACTION_LIMIT - currentUsageCount,
                    limit: DAILY_ACTION_LIMIT
                };
            }
        }

        // 3. Check if limit reached for NEW actions
        if (currentUsageCount >= DAILY_ACTION_LIMIT) {
            return {
                allowed: false,
                remaining: 0,
                limit: DAILY_ACTION_LIMIT
            };
        }

        // 4. Insert new unique usage record
        const { error: insertError } = await supabaseAdmin
            .from('usage')
            .insert({
                user_id: userId,
                action_type: actionType,
                action_id: actionId,
                created_at: new Date().toISOString()
            });

        if (insertError) {
            console.error('Error inserting usage:', insertError);
            throw new Error('Failed to record usage');
        }

        return {
            allowed: true,
            remaining: DAILY_ACTION_LIMIT - currentUsageCount - 1,
            limit: DAILY_ACTION_LIMIT
        };

    } catch (error) {
        console.error('Rate limit check failed:', error);
        throw error;
    }
}

module.exports = {
    checkAndIncrementUsage
};
