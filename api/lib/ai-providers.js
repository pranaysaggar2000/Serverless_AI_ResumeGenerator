const https = require('https');

// Model chains for different task types
const MODEL_CHAINS = {
    jdParse: [
        'meta-llama/llama-3.3-70b-instruct:free',
        'stepfun/step-3.5-flash:free',
        'openrouter/free'
    ],
    tailor: [
        'meta-llama/llama-3.3-70b-instruct:free',
        'openai/gpt-oss-120b:free',
        'openrouter/free'
    ],
    score: [
        'meta-llama/llama-3.3-70b-instruct:free',
        'stepfun/step-3.5-flash:free',
        'openrouter/free'
    ],
    default: [
        'meta-llama/llama-3.3-70b-instruct:free',
        'openrouter/free'
    ]
};

const GROQ_MODELS = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant'
];

/**
 * Make HTTPS request with timeout
 */
function httpsRequest(options, postData, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            req.destroy();
            reject(new Error('Request timeout'));
        }, timeout);

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                clearTimeout(timeoutId);
                resolve({ statusCode: res.statusCode, data });
            });
        });

        req.on('error', (error) => {
            clearTimeout(timeoutId);
            reject(error);
        });

        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

/**
 * Call OpenRouter API with model fallback chain
 */
async function callOpenRouterServer(prompt, options = {}) {
    const { taskType = 'default', expectJson = false } = options;
    const models = MODEL_CHAINS[taskType] || MODEL_CHAINS.default;
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY not configured');
    }

    const totalTimeout = 90000; // 90s total
    const startTime = Date.now();

    for (let i = 0; i < models.length; i++) {
        const model = models[i];
        const remainingTime = totalTimeout - (Date.now() - startTime);

        if (remainingTime <= 0) {
            throw new Error('Total timeout exceeded for OpenRouter');
        }

        try {
            const requestBody = JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                ...(expectJson && { response_format: { type: 'json_object' } })
            });

            const requestOptions = {
                hostname: 'openrouter.ai',
                path: '/api/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestBody)
                }
            };

            const { statusCode, data } = await httpsRequest(
                requestOptions,
                requestBody,
                Math.min(30000, remainingTime)
            );

            if (statusCode === 429) {
                console.log(`OpenRouter model ${model} rate limited, trying next...`);
                continue;
            }

            if (statusCode === 401 || statusCode === 403) {
                throw new Error('OpenRouter authentication failed');
            }

            if (statusCode !== 200) {
                console.error(`OpenRouter error ${statusCode}:`, data);
                continue;
            }

            const response = JSON.parse(data);
            const content = response.choices?.[0]?.message?.content;

            if (!content) {
                throw new Error('Invalid response format from OpenRouter');
            }

            return content;

        } catch (error) {
            if (error.message.includes('authentication') || error.message.includes('auth')) {
                throw error;
            }
            console.error(`OpenRouter model ${model} failed:`, error.message);
            if (i === models.length - 1) {
                throw error;
            }
        }
    }

    throw new Error('All OpenRouter models failed');
}

/**
 * Call Groq API with model fallback
 */
async function callGroqServer(prompt, options = {}) {
    const { expectJson = false } = options;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        throw new Error('GROQ_API_KEY not configured');
    }

    const totalTimeout = 90000;
    const startTime = Date.now();

    for (let i = 0; i < GROQ_MODELS.length; i++) {
        const model = GROQ_MODELS[i];
        const remainingTime = totalTimeout - (Date.now() - startTime);

        if (remainingTime <= 0) {
            throw new Error('Total timeout exceeded for Groq');
        }

        try {
            const requestBody = JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                ...(expectJson && { response_format: { type: 'json_object' } })
            });

            const requestOptions = {
                hostname: 'api.groq.com',
                path: '/openai/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestBody)
                }
            };

            const { statusCode, data } = await httpsRequest(
                requestOptions,
                requestBody,
                Math.min(30000, remainingTime)
            );

            if (statusCode === 429) {
                console.log(`Groq model ${model} rate limited, trying next...`);
                continue;
            }

            if (statusCode === 401 || statusCode === 403) {
                throw new Error('Groq authentication failed');
            }

            if (statusCode !== 200) {
                console.error(`Groq error ${statusCode}:`, data);
                continue;
            }

            const response = JSON.parse(data);
            const content = response.choices?.[0]?.message?.content;

            if (!content) {
                throw new Error('Invalid response format from Groq');
            }

            return content;

        } catch (error) {
            if (error.message.includes('authentication') || error.message.includes('auth')) {
                throw error;
            }
            console.error(`Groq model ${model} failed:`, error.message);
            if (i === GROQ_MODELS.length - 1) {
                throw error;
            }
        }
    }

    throw new Error('All Groq models failed');
}

/**
 * Call AI with OpenRouter primary, Groq fallback
 */
async function callAIServer(prompt, options = {}) {
    try {
        return await callOpenRouterServer(prompt, options);
    } catch (error) {
        console.log('OpenRouter failed, falling back to Groq:', error.message);
        return await callGroqServer(prompt, options);
    }
}

module.exports = {
    callOpenRouterServer,
    callGroqServer,
    callAIServer
};
