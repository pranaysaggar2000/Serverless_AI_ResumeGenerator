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

        if (typeof prompt !== 'string') {
            return res.status(400).json({ error: 'Prompt must be a string' });
        }

        const MAX_PROMPT_LENGTH = 50000; // ~12,500 tokens roughly
        if (prompt.length > MAX_PROMPT_LENGTH) {
            return res.status(400).json({
                error: `Prompt too long (${prompt.length} chars). Maximum is ${MAX_PROMPT_LENGTH} characters.`
            });
        }

        // Validate taskType
        const VALID_TASK_TYPES = ['jdParse', 'tailor', 'score', 'default'];
        if (taskType && !VALID_TASK_TYPES.includes(taskType)) {
            return res.status(400).json({ error: `Invalid taskType: ${taskType}` });
        }

        // === PROMPT ABUSE PREVENTION ===
        // Validate that the prompt is actually a ForgeCV resume-related prompt.
        // We check for the presence of ForgeCV-specific markers that our prompt builder always includes.

        const promptLower = prompt.toLowerCase();

        // Our buildTailorPrompt, buildAnalysisPrompt, buildParseJobDescriptionPrompt, 
        // buildExtractProfilePrompt, buildQuestionPrompt, and buildExtractJDFromPagePrompt
        // all contain distinctive structural markers. Check for at least one.
        const FORGECV_MARKERS = [
            'resume',                            // Present in all ForgeCV prompts
            'job description',                   // Present in tailor/analysis prompts
            'section_order',                     // Present in tailor prompt output format
            'return only valid json',            // Present in most prompts
            'bullet',                            // Present in tailor prompts
            'mandatory_keywords',                // Present in JD parse output format
            'excluded_items',                    // Present in tailor prompt output format
            'extract structured data',           // Present in profile extraction prompt
            'applicant',                         // Present in question prompt
            'instructions',                      // Present in question/tailor prompts
            'answer',                            // Present in question prompt
            'ats',                               // Present in analysis prompts
        ];

        // Require at least 2 markers to be present — normal ForgeCV prompts hit 5+
        const markerHits = FORGECV_MARKERS.filter(m => promptLower.includes(m)).length;

        // Log low-marker prompts for monitoring (don't block the request flow)
        if (markerHits < 4) {
            try {
                const { supabaseAdmin } = require('../../lib/supabase');
                await supabaseAdmin.from('prompt_audit').insert({
                    user_id: user.id,
                    marker_hits: markerHits,
                    prompt_preview: prompt.substring(0, 200).replace(/\0/g, ''),
                    task_type: taskType || 'default',
                    flagged: markerHits < 2,
                    created_at: new Date().toISOString()
                }).catch(() => { }); // Silent fail — don't break the request
            } catch (_) { }
        }

        if (markerHits < 2) {
            console.warn(`Prompt abuse suspected: only ${markerHits} ForgeCV markers found. User: ${user.id}`);
            return res.status(400).json({
                error: 'Invalid prompt format. This API only accepts ForgeCV resume prompts.'
            });
        }

        // Additional check: block prompts that look like direct chat/conversation
        const ABUSE_PATTERNS = [
            /^(hi|hello|hey|what is|explain|tell me|write me|help me|can you)/i,
            /^(translate|summarize this article|write a (poem|story|essay|code))/i,
            /^(ignore previous|disregard|forget your|you are now|act as)/i,  // prompt injection patterns
        ];

        const isAbuse = ABUSE_PATTERNS.some(pattern => pattern.test(prompt.trim()));
        if (isAbuse) {
            console.warn(`Prompt injection/abuse blocked. User: ${user.id}, prompt start: "${prompt.substring(0, 100)}"`);
            return res.status(400).json({
                error: 'Invalid prompt format.'
            });
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
