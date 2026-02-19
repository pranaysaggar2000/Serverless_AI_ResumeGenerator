const https = require('https');

// ============================================
// TASK-BASED ROUTING CONFIGURATION
// ============================================
const TASK_ROUTING = {
    jdParse: { provider: 'groq', model: 'llama-3.3-70b-versatile', maxTokens: 1500 },
    strategy: { provider: 'cerebras', model: 'gpt-oss-120b', maxTokens: 600, reasoningEffort: 'low' },
    tailor: { provider: 'groq', model: 'moonshotai/kimi-k2-instruct', maxTokens: 4000 },
    score: { provider: 'groq', model: 'moonshotai/kimi-k2-instruct', maxTokens: 2000 },
    default: { provider: 'groq', model: 'llama-3.3-70b-versatile', maxTokens: 8192 },
};

const TASK_FALLBACKS = {
    strategy: { provider: 'groq', model: 'llama-3.3-70b-versatile', maxTokens: 600 },
    tailor: { provider: 'cerebras', model: 'gpt-oss-120b', maxTokens: 4000 },
    score: { provider: 'groq', model: 'llama-3.3-70b-versatile', maxTokens: 2000 },
};

// ============================================
// PROVIDER 1: CEREBRAS
// ============================================
async function callCerebras(prompt, model, maxTokens, reasoningEffort) {
    const apiKey = process.env.CEREBRAS_API_KEY;
    if (!apiKey) throw new Error('CEREBRAS_API_KEY not configured');

    console.log(`[ForgeCV-Backend] Calling Cerebras... Model: ${model}, MaxTokens: ${maxTokens}`);
    const start = Date.now();

    const body = {
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
    };
    if (reasoningEffort) body.reasoning_effort = reasoningEffort;

    const result = await httpPost('api.cerebras.ai', '/v1/chat/completions', JSON.stringify(body), {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    });

    const duration = Date.now() - start;
    const data = JSON.parse(result);
    if (data.choices?.[0]?.message?.content) {
        console.log(`[ForgeCV-Backend] ✓ Cerebras success (${duration}ms)`);
        return data.choices[0].message.content;
    }
    throw new Error('Empty Cerebras response');
}

// ============================================
// PROVIDER 2: GROQ
// ============================================
async function callGroq(prompt, model, maxTokens) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');

    console.log(`[ForgeCV-Backend] Calling Groq... Model: ${model}, MaxTokens: ${maxTokens}`);
    const start = Date.now();

    const body = JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.3
    });

    const result = await httpPost('api.groq.com', '/openai/v1/chat/completions', body, {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    });

    const duration = Date.now() - start;
    const data = JSON.parse(result);
    if (data.choices?.[0]?.message?.content) {
        console.log(`[ForgeCV-Backend] ✓ Groq success (${duration}ms)`);
        return data.choices[0].message.content;
    }
    throw new Error('Empty Groq response');
}

// ============================================
// MAIN ENTRY POINT
// ============================================
async function callAIServer(prompt, options = {}) {
    const { taskType = 'default' } = options;
    const route = TASK_ROUTING[taskType] || TASK_ROUTING.default;
    const CEREBRAS_KEY = process.env.CEREBRAS_API_KEY;

    console.log(`[ForgeCV-Backend] Request: taskType=${taskType}`);

    // Simplification based on user request logic:
    const useCerebras = route.provider === 'cerebras' && !!CEREBRAS_KEY;

    try {
        if (useCerebras) {
            console.log(`[ForgeCV-Backend] Routing to Primary: CEREBRAS`);
            return await callCerebras(prompt, route.model, route.maxTokens, route.reasoningEffort);
        } else {
            if (route.provider === 'cerebras' && !CEREBRAS_KEY) {
                console.warn(`[ForgeCV-Backend] Wanted Cerebras but CEREBRAS_API_KEY missing. Forcing fallback.`);
                throw new Error('Cerebras key missing, forcing fallback');
            }
            console.log(`[ForgeCV-Backend] Routing to Primary: GROQ`);
            return await callGroq(prompt, route.model, route.maxTokens);
        }
    } catch (primaryErr) {
        console.warn(`[generate] Primary failed for taskType=${taskType}: ${primaryErr.message}`);

        const fallback = TASK_FALLBACKS[taskType];
        if (fallback) {
            const useFallbackCerebras = fallback.provider === 'cerebras' && !!CEREBRAS_KEY;

            try {
                if (useFallbackCerebras) {
                    return await callCerebras(prompt, fallback.model, fallback.maxTokens);
                } else {
                    return await callGroq(prompt, fallback.model, fallback.maxTokens);
                }
            } catch (fallbackErr) {
                console.error(`[generate] Fallback also failed: ${fallbackErr.message}`);
                throw primaryErr; // Throw original error if fallback fails
            }
        } else {
            throw primaryErr;
        }
    }
}

// ============================================
// HTTP Helper
// ============================================
function httpPost(hostname, path, body, headers, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            req.destroy();
            reject(new Error(`Request to ${hostname} timed out after ${timeout}ms`));
        }, timeout);

        const options = {
            hostname,
            path,
            method: 'POST',
            headers: {
                ...headers,
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                clearTimeout(timeoutId);

                if (res.statusCode === 429) {
                    reject(new Error(`429 Rate limited by ${hostname}`));
                    return;
                }
                if (res.statusCode === 401 || res.statusCode === 403) {
                    reject(new Error(`${res.statusCode} Auth error on ${hostname}`));
                    return;
                }
                if (res.statusCode >= 400) {
                    reject(new Error(`${res.statusCode} Error from ${hostname}: ${data.substring(0, 200)}`));
                    return;
                }
                resolve(data);
            });
        });

        req.on('error', (error) => {
            clearTimeout(timeoutId);
            reject(error);
        });

        req.write(body);
        req.end();
    });
}

module.exports = { callAIServer };
