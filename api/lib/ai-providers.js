const https = require('https');

// ============================================
// PROVIDER 1: CEREBRAS (Primary - FREE)
// 14,400 requests/day, 1M tokens/day
// https://cloud.cerebras.ai/
// ============================================
const CEREBRAS_CHAINS = {
    jdParse: ['llama-3.3-70b', 'gpt-oss-120b'],
    tailor: ['qwen-3-235b-a22b-instruct-2507', 'gpt-oss-120b'],
    score: ['llama-3.3-70b', 'gpt-oss-120b'],
    default: ['llama-3.3-70b', 'gpt-oss-120b']
};

async function callCerebras(prompt, options = {}) {
    const { taskType = 'default', expectJson = false } = options;
    const models = CEREBRAS_CHAINS[taskType] || CEREBRAS_CHAINS.default;
    const apiKey = process.env.CEREBRAS_API_KEY;

    if (!apiKey) throw new Error('CEREBRAS_API_KEY not configured');

    for (const model of models) {
        try {
            const body = JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                ...(expectJson && { response_format: { type: 'json_object' } }),
                max_tokens: 4096,
                temperature: 0.3
            });

            const startTime = Date.now();
            const result = await httpPost('api.cerebras.ai', '/v1/chat/completions', body, {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }, 10000);
            const duration = Date.now() - startTime;

            const data = JSON.parse(result);
            if (data.choices?.[0]?.message?.content) {
                console.log(`[Cerebras] Model: ${model} | Duration: ${duration}ms | Success`);
                return data.choices[0].message.content;
            }
            throw new Error('Empty Cerebras response');
        } catch (e) {
            console.warn(`Cerebras ${model} failed:`, e.message);
            if (e.message.includes('401') || e.message.includes('403')) throw e; // Auth error, don't retry
            continue; // Try next model
        }
    }
    throw new Error('All Cerebras models failed');
}

// ============================================
// PROVIDER 2: MISTRAL (Secondary - FREE)
// 1B tokens/month, 500K tokens/min
// https://console.mistral.ai/
// ============================================
const MISTRAL_CHAINS = {
    jdParse: ['mistral-small-2506'],
    tailor: ['mistral-large-2512'],
    score: ['mistral-small-2506'],
    default: ['mistral-large-2512']
};

async function callMistral(prompt, options = {}) {
    const { taskType = 'default', expectJson = false } = options;
    const models = MISTRAL_CHAINS[taskType] || MISTRAL_CHAINS.default;
    const apiKey = process.env.MISTRAL_API_KEY;

    if (!apiKey) throw new Error('MISTRAL_API_KEY not configured');

    for (const model of models) {
        try {
            const body = JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                ...(expectJson && { response_format: { type: 'json_object' } }),
                max_tokens: 4096,
                temperature: 0.3
            });

            const startTime = Date.now();
            const result = await httpPost('api.mistral.ai', '/v1/chat/completions', body, {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }, 10000);
            const duration = Date.now() - startTime;

            const data = JSON.parse(result);
            if (data.choices?.[0]?.message?.content) {
                console.log(`[Mistral] Model: ${model} | Duration: ${duration}ms | Success`);
                return data.choices[0].message.content;
            }
            throw new Error('Empty Mistral response');
        } catch (e) {
            console.warn(`Mistral ${model} failed:`, e.message);
            if (e.message.includes('401') || e.message.includes('403')) throw e;
            continue;
        }
    }
    throw new Error('All Mistral models failed');
}

// ============================================
// PROVIDER 3: GROQ (Existing fallback - FREE)
// 1,000 requests/day for most models
// https://console.groq.com/
// ============================================
const GROQ_MODELS = [
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant'
];

async function callGroqServer(prompt, options = {}) {
    const { expectJson = false } = options;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) throw new Error('GROQ_API_KEY not configured');

    for (const model of GROQ_MODELS) {
        try {
            const body = JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                ...(expectJson && { response_format: { type: 'json_object' } }),
                max_tokens: 4096,
                temperature: 0.3
            });

            const startTime = Date.now();
            const result = await httpPost('api.groq.com', '/openai/v1/chat/completions', body, {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }, 10000);
            const duration = Date.now() - startTime;

            const data = JSON.parse(result);
            if (data.choices?.[0]?.message?.content) {
                console.log(`[Groq] Model: ${model} | Duration: ${duration}ms | Success`);
                return data.choices[0].message.content;
            }
            throw new Error('Empty Groq response');
        } catch (e) {
            console.warn(`Groq ${model} failed:`, e.message);
            if (e.message.includes('401')) throw e;
            if (e.message.includes('429')) continue; // Rate limited, try next
            continue;
        }
    }
    throw new Error('All Groq models failed');
}

// ============================================
// PROVIDER 4: OPENROUTER (Last resort - FREE)
// 50 requests/day (free models)
// https://openrouter.ai/
// ============================================
const OPENROUTER_FREE_MODELS = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'openai/gpt-oss-120b:free',
    'openrouter/free'
];

async function callOpenRouterServer(prompt, options = {}) {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

    for (const model of OPENROUTER_FREE_MODELS) {
        try {
            const body = JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 4096,
                temperature: 0.3
            });

            const startTime = Date.now();
            const result = await httpPost('openrouter.ai', '/api/v1/chat/completions', body, {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://forgecv.app',
                'X-Title': 'ForgeCV'
            }, 10000);
            const duration = Date.now() - startTime;

            const data = JSON.parse(result);
            if (data.choices?.[0]?.message?.content) {
                console.log(`[OpenRouter] Model: ${model} | Duration: ${duration}ms | Success`);
                return data.choices[0].message.content;
            }
            throw new Error('Empty OpenRouter response');
        } catch (e) {
            console.warn(`OpenRouter ${model} failed:`, e.message);
            if (e.message.includes('401')) throw e;
            continue;
        }
    }
    throw new Error('All OpenRouter models failed');
}

// ============================================
// MAIN ENTRY POINT — Cascading Provider Chain
// ============================================
async function callAIServer(prompt, options = {}) {
    const providers = [
        { name: 'Cerebras', fn: callCerebras, required_key: 'CEREBRAS_API_KEY' },
        { name: 'Mistral', fn: callMistral, required_key: 'MISTRAL_API_KEY' },
        { name: 'Groq', fn: callGroqServer, required_key: 'GROQ_API_KEY' },
        { name: 'OpenRouter', fn: callOpenRouterServer, required_key: 'OPENROUTER_API_KEY' }
    ];

    // Debug: Log which keys are available at runtime
    const availableKeys = providers.filter(p => !!process.env[p.required_key]).map(p => p.name);
    console.log(`[AI Configuration] Providers with keys: ${availableKeys.join(', ') || 'NONE'}`);

    const errors = [];

    for (const provider of providers) {
        // Skip provider if API key not configured
        if (!process.env[provider.required_key]) {
            console.log(`Skipping ${provider.name}: ${provider.required_key} not set`);
            continue;
        }

        try {
            console.log(`Trying ${provider.name}...`);
            const result = await provider.fn(prompt, options);
            console.log(`✓ ${provider.name} succeeded`);
            return result;
        } catch (e) {
            console.warn(`✗ ${provider.name} failed: ${e.message}`);
            errors.push(`${provider.name}: ${e.message}`);

            // Don't continue if it's an auth error — that provider is misconfigured
            if (e.message.includes('401') || e.message.includes('403')) {
                console.warn(`  Auth error on ${provider.name}, skipping to next provider`);
            }
            continue;
        }
    }

    throw new Error(`All AI providers failed. Errors: ${errors.join(' | ')}`);
}

// ============================================
// HTTP Helper
// ============================================
function httpPost(hostname, path, body, headers, timeout = 10000) {
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
