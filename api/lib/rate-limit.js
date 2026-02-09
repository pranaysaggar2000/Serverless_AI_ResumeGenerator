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
        // 1. If actionId is provided, check if it already exists for this user today
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
                const { data: usageData } = await supabaseAdmin
                    .from('usage')
                    .select('id', { count: 'exact', head: false })
                    .eq('user_id', userId)
                    .gte('created_at', todayISO);

                const currentCount = usageData?.length || 0;

                return {
                    allowed: true,
                    remaining: DAILY_ACTION_LIMIT - currentCount,
                    limit: DAILY_ACTION_LIMIT
                };
            }
        }

        // 2. Count today's actions for this user
        const { data: usageData, error: countError } = await supabaseAdmin
            .from('usage')
            .select('id', { count: 'exact', head: false })
            .eq('user_id', userId)
            .gte('created_at', todayISO);

        if (countError) {
            console.error('Error counting usage:', countError);
            throw new Error('Failed to check usage limit');
        }

        const currentCount = usageData?.length || 0;

        // Check if limit exceeded
        if (currentCount >= DAILY_ACTION_LIMIT) {
            return {
                allowed: false,
                remaining: 0,
                limit: DAILY_ACTION_LIMIT
            };
        }

        // 3. Insert new usage record
        const { error: insertError } = await supabaseAdmin
            .from('usage')
            .insert({
                user_id: userId,
                action_type: actionType,
                action_id: actionId, // Include actionId if provided
                created_at: new Date().toISOString()
            });

        if (insertError) {
            console.error('Error inserting usage:', insertError);
            throw new Error('Failed to record usage');
        }

        return {
            allowed: true,
            remaining: DAILY_ACTION_LIMIT - currentCount - 1,
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
