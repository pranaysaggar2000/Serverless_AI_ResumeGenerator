const { verifyUser } = require('../../lib/auth');
const { checkAndIncrementUsage } = require('../../lib/rate-limit');
const { callAIServer } = require('../../lib/ai-providers');
const { withCors } = require('../../lib/cors');

/**
 * Main AI generation endpoint
 * POST /api/ai/generate
 */
module.exports = withCors(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Verify user authentication
        const user = await verifyUser(req);

        // Extract request body
        const { prompt, taskType, expectJson, actionId } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Missing required field: prompt' });
        }

        // Check rate limit and increment usage
        const usageResult = await checkAndIncrementUsage(user.id, taskType || 'default', actionId);

        if (!usageResult.allowed) {
            return res.status(429).json({
                error: 'Daily action limit exceeded',
                usage: {
                    remaining: 0,
                    limit: usageResult.limit,
                    resetsAt: getNextMidnightUTC()
                }
            });
        }

        // Call AI service
        const result = await callAIServer(prompt, {
            taskType,
            expectJson: expectJson || false
        });

        // Return successful response
        return res.status(200).json({
            result,
            usage: {
                remaining: usageResult.remaining,
                limit: usageResult.limit
            }
        });

    } catch (error) {
        console.error('AI generation error:', error);

        // Handle specific error types
        if (error.statusCode === 401) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (error.message.includes('authentication')) {
            return res.status(401).json({ error: 'AI provider authentication failed' });
        }

        if (error.message.includes('timeout')) {
            return res.status(504).json({ error: 'AI request timeout' });
        }

        // Generic server error
        return res.status(500).json({
            error: 'AI generation failed',
            message: error.message
        });
    }
});

/**
 * Get next UTC midnight as ISO string
 */
function getNextMidnightUTC() {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow.toISOString();
}
