const https = require('https');

// ============================================
// TASK-BASED ROUTING CONFIGURATION
// ============================================
const TASK_ROUTING = {
    jdParse: { provider: 'groq', model: 'llama-3.3-70b-versatile', maxTokens: 1500 },
    strategy: { provider: 'cerebras', model: 'qwen-3-235b-a22b-instruct-2507', maxTokens: 800 },
    tailor: { provider: 'nvidia', model: 'qwen/qwen3.5-397b-a17b', maxTokens: 16384 },
    score: { provider: 'groq', model: 'moonshotai/kimi-k2-instruct', maxTokens: 2000 },
    default: { provider: 'groq', model: 'llama-3.3-70b-versatile', maxTokens: 8192 },
};

const TASK_FALLBACKS = {
    strategy: [
        { provider: 'cerebras', model: 'zai-glm-4.7', maxTokens: 800 },
        { provider: 'cerebras', model: 'gpt-oss-120b', maxTokens: 800 },
        { provider: 'groq', model: 'llama-3.3-70b-versatile', maxTokens: 800 },
    ],
    tailor: [
        { provider: 'groq', model: 'moonshotai/kimi-k2-instruct', maxTokens: 4000 },
        { provider: 'cerebras', model: 'gpt-oss-120b', maxTokens: 4000 }
    ],
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
// PROVIDER 3: NVIDIA NIM
// ============================================
async function callNvidia(prompt, model, maxTokens) {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) throw new Error('NVIDIA_API_KEY not configured');
    console.log(`[ForgeCV-Backend] Calling Nvidia NIM... Model: ${model}, MaxTokens: ${maxTokens}`);
    const start = Date.now();

    const body = {
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.60,
        top_p: 0.95,
        top_k: 20,
        presence_penalty: 0,
        repetition_penalty: 1,
        stream: false,
        chat_template_kwargs: { enable_thinking: true }
    };

    const result = await httpPost('integrate.api.nvidia.com', '/v1/chat/completions', JSON.stringify(body), {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }, 120000); // 120 seconds timeout for NIM

    const duration = Date.now() - start;
    const data = JSON.parse(result);
    if (data.choices?.[0]?.message?.content) {
        console.log(`[ForgeCV-Backend] ✓ Nvidia NIM success (${duration}ms)`);
        return data.choices[0].message.content;
    }
    throw new Error('Empty Nvidia response');
}


// ============================================
// MAIN ENTRY POINT
// ============================================
async function dispatchCall(provider, prompt, model, maxTokens, reasoningEffort) {
    if (provider === 'nvidia') {
        return await callNvidia(prompt, model, maxTokens);
    } else if (provider === 'cerebras') {
        const CEREBRAS_KEY = process.env.CEREBRAS_API_KEY;
        if (!CEREBRAS_KEY) throw new Error('Cerebras key missing');
        return await callCerebras(prompt, model, maxTokens, reasoningEffort);
    } else {
        return await callGroq(prompt, model, maxTokens); // Default to Groq
    }
}

async function callAIServer(prompt, options = {}) {
    const { taskType = 'default' } = options;
    const route = TASK_ROUTING[taskType] || TASK_ROUTING.default;

    console.log(`[ForgeCV-Backend] Request: taskType=${taskType}`);

    try {
        console.log(`[ForgeCV-Backend] Routing to Primary: ${route.provider.toUpperCase()}`);
        return await dispatchCall(route.provider, prompt, route.model, route.maxTokens, route.reasoningEffort);
    } catch (primaryErr) {
        console.warn(`[generate] Primary failed for taskType=${taskType}: ${primaryErr.message}`);

        const fallback = TASK_FALLBACKS[taskType];
        if (fallback) {
            const fallbackChain = Array.isArray(fallback) ? fallback : [fallback];
            for (const fb of fallbackChain) {
                try {
                    return await dispatchCall(fb.provider, prompt, fb.model, fb.maxTokens, fb.reasoningEffort);
                } catch (fbErr) {
                    console.warn(`[fallback] ${fb.provider}/${fb.model} failed: ${fbErr.message}`);
                    continue;
                }
            }
            throw primaryErr; // all fallbacks failed
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
