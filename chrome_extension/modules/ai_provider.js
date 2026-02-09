import { state } from './state.js';
import { debugLog } from './utils.js';

export async function callAI(prompt, provider, apiKey, options = {}) {
    debugLog('🤖 callAI invoked:', {
        provider,
        hasApiKey: !!apiKey,
        authMode: state.authMode,
        isLoggedIn: state.isLoggedIn,
        taskType: options.taskType
    });

    // 1. Handle Free Tier (Server-side)
    if (state.authMode === 'free') {
        debugLog('✅ Using FREE tier (server-side AI)');
        if (!state.isLoggedIn) {
            const { showStatus } = await import('./ui.js');
            showStatus('Please sign in with Google to use the free tier.', 'error');
            throw new Error('NOT_LOGGED_IN');
        }

        try {
            // Use server-proxied call
            const { callServerAI } = await import('./auth.js');
            return await callServerAI(prompt, options.taskType || 'default', options.expectJson || false, options.actionId);
        } catch (error) {
            const { showStatus } = await import('./ui.js');
            // Fallback to BYOK ONLY if they actually have a valid-looking key configured
            const hasActualByokKey = !!(state.currentApiKey || state.currentGroqKey || state.currentOpenRouterKey);
            if (error.message === 'SERVER_ERROR' && hasActualByokKey) {
                showStatus('Free tier server unavailable. Using your own API key instead.', 'warning');
                debugLog('Fallback to BYOK due to server error');
                // Fall through to BYOK logic below
            } else if (error.message === 'SERVER_ERROR' && !hasActualByokKey) {
                showStatus(
                    '⚠️ Our servers are temporarily unavailable. To continue without interruption, add your own free API key in Settings → Your Own Keys.',
                    'warning'
                );
                throw new Error('SERVER_UNAVAILABLE');
            } else if (error.message === 'LIMIT_REACHED') {
                showStatus("You've used all 15 free actions today! 🔄 Resets at midnight UTC.", 'warning');
                throw error;
            } else if (error.message === 'AUTH_EXPIRED') {
                showStatus('Session expired. Please sign in again.', 'error');
                throw error;
            } else {
                // If it's a server error but they have no key, or any other error
                throw error;
            }
        }
    }

    // 2. Handle BYOK (Direct API calls)
    debugLog('🔑 Using BYOK mode (Bring Your Own Key)');
    if (!apiKey) {
        throw new Error(`Please configure your ${provider.toUpperCase()} API key in settings.`);
    }

    if (provider === 'gemini') {
        return callGemini(prompt, apiKey, options);
    } else if (provider === 'groq') {
        return callGroq(prompt, apiKey, options);
    } else if (provider === 'openrouter') {
        return callOpenRouter(prompt, apiKey, options);
    }
    throw new Error(`Unknown provider: ${provider}`);
}

export function extractJSON(text) {
    if (!text) return null;

    try { return JSON.parse(text); } catch (e) { }

    const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (blockMatch) {
        try { return JSON.parse(blockMatch[1]); } catch (e) { }
    }

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');

    if (start !== -1 && end !== -1 && end > start) {
        const potentialJson = text.substring(start, end + 1);
        try { return JSON.parse(potentialJson); } catch (e) { }
    }

    return null;
}

async function callGemini(prompt, apiKey, options) {
    const targetModel = options.useProModel ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Gemini API Error ${response.status}: ${err}`);
        }

        const data = await response.json();
        try {
            return data.candidates[0].content.parts[0].text;
        } catch (e) {
            throw new Error(`Invalid Gemini response format: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        if (e.name === 'AbortError') throw new Error('Request timed out after 60 seconds. Please try again.');
        throw e;
    } finally {
        clearTimeout(timeout);
    }
}

async function callGroq(prompt, apiKey, options) {
    const modelsChain = [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "mixtral-8x7b-32768"
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

    try {
        for (const modelId of modelsChain) {
            try {
                const payload = {
                    model: modelId,
                    messages: [
                        { role: "user", content: prompt }
                    ]
                };

                if (options.expectJson) {
                    payload.response_format = { type: "json_object" };
                }

                const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: 'POST',
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                if (response.status === 401 || response.status === 403) {
                    throw new Error("GROQ_AUTH_ERROR");
                }

                if (response.status === 429) {
                    console.warn(`Groq Rate Limit (${modelId}), switching...`);
                    continue;
                }

                if (response.status === 400 && options.expectJson) {
                    // Formatting fallback
                    console.warn(`Groq JSON mode error (${modelId}), retrying without force-json...`);
                    delete payload.response_format;
                    const retryResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                        method: 'POST',
                        headers: {
                            "Authorization": `Bearer ${apiKey}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(payload),
                        signal: controller.signal
                    });

                    if (retryResp.status === 401 || retryResp.status === 403) {
                        throw new Error("GROQ_AUTH_ERROR");
                    }

                    if (retryResp.ok) {
                        const data = await retryResp.json();
                        return data.choices[0].message.content;
                    }
                }

                if (!response.ok) {
                    throw new Error(`Groq Error ${response.status}`);
                }

                const data = await response.json();
                return data.choices[0].message.content;

            } catch (e) {
                if (e.name === 'AbortError' || e.message === "GROQ_AUTH_ERROR") throw e; // Propagate abort and auth
                console.warn(`Groq model failed: ${modelId}`, e);
                continue;
            }
        }
    } catch (e) {
        if (e.name === 'AbortError') throw new Error('Request timed out after 60 seconds. Please try again.');
        if (e.message === "GROQ_AUTH_ERROR") throw new Error("Groq API Key is invalid or expired. Please check your settings.");
        throw e;
    } finally {
        clearTimeout(timeout);
    }
    throw new Error("All Groq models failed.");
}

// OpenRouter Model Chains - Optimized based on health check results
const OPENROUTER_CHAINS = {
    // For JD Parsing (simpler task, speed matters)
    jdParse: [
        "meta-llama/llama-3.3-70b-instruct:free",   // Fastest in tests (849ms)
        "stepfun/step-3.5-flash:free",              // Very fast (1.6s)
        "z-ai/glm-4.5-air:free",                    // Fast (3.45s)
        "openai/gpt-oss-120b:free",                 // Reliable but slower (11s)
        "openrouter/free"                           // Auto-router last resort
    ],

    // For Resume Tailoring (quality matters most)
    tailor: [
        "arcee-ai/trinity-large-preview:free",      // Fastest + high quality (711ms)
        "meta-llama/llama-3.3-70b-instruct:free",   // Very fast (790ms)
        "stepfun/step-3.5-flash:free",              // Fast (1.22s)
        "openai/gpt-oss-120b:free",                 // Best quality, slower (9s)
        "openrouter/free"                           // Auto-router last resort
    ],

    // For ATS Scoring (moderate complexity)
    score: [
        "meta-llama/llama-3.3-70b-instruct:free",   // Fastest (739ms)
        "openai/gpt-oss-20b:free",                  // Very fast (979ms)
        "stepfun/step-3.5-flash:free",              // Fast (1.03s)
        "z-ai/glm-4.5-air:free",                    // Good (3.06s)
        "openrouter/free"                           // Auto-router last resort (4.96s)
    ],

    // Default chain for general tasks
    default: [
        "meta-llama/llama-3.3-70b-instruct:free",
        "stepfun/step-3.5-flash:free",
        "openai/gpt-oss-120b:free",
        "openrouter/free"
    ]
};

async function callOpenRouter(prompt, apiKey, options) {
    // Determine which chain to use based on task type
    let modelChain;

    if (options.taskType === 'jdParse') {
        modelChain = OPENROUTER_CHAINS.jdParse;
    } else if (options.taskType === 'tailor') {
        modelChain = OPENROUTER_CHAINS.tailor;
    } else if (options.taskType === 'score') {
        modelChain = OPENROUTER_CHAINS.score;
    } else {
        modelChain = OPENROUTER_CHAINS.default;
    }

    // Use longer timeout for scoring tasks (more complex analysis)
    const totalTimeoutMs = options.taskType === 'score' ? 90000 : 60000;
    const perModelTimeoutMs = 20000; // 20 seconds per model attempt

    const totalController = new AbortController();
    const totalTimeout = setTimeout(() => totalController.abort(), totalTimeoutMs);

    try {
        for (const modelId of modelChain) {
            try {
                // Create a per-model timeout controller
                const modelController = new AbortController();
                const modelTimeout = setTimeout(() => modelController.abort(), perModelTimeoutMs);

                try {
                    const payload = {
                        model: modelId,
                        messages: [
                            { role: "user", content: prompt }
                        ]
                    };

                    // OpenRouter doesn't support response_format for most free models
                    // So we skip the expectJson option

                    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                        method: 'POST',
                        headers: {
                            "Authorization": `Bearer ${apiKey}`,
                            "Content-Type": "application/json",
                            "HTTP-Referer": "https://forgecv.extension",  // Optional: for OpenRouter analytics
                            "X-Title": "ForgeCV Resume Generator"         // Optional: app identification
                        },
                        body: JSON.stringify(payload),
                        signal: modelController.signal
                    });

                    clearTimeout(modelTimeout); // Clear per-model timeout on success

                    if (response.status === 401 || response.status === 403) {
                        throw new Error("OPENROUTER_AUTH_ERROR");
                    }

                    if (response.status === 429) {
                        console.warn(`OpenRouter Rate Limit (${modelId}), switching to next model...`);
                        continue;
                    }

                    if (response.status === 402) {
                        // Payment required - negative balance
                        throw new Error("OPENROUTER_PAYMENT_ERROR");
                    }

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.warn(`OpenRouter Error ${response.status} for ${modelId}: ${errorText}`);
                        continue;
                    }

                    const data = await response.json();
                    const content = data.choices[0].message.content;

                    // Log successful model for debugging
                    debugLog(`✓ OpenRouter: Used ${modelId} for ${options.taskType || 'default'} task`);

                    clearTimeout(totalTimeout); // Clear total timeout on success
                    return content;

                } catch (modelError) {
                    clearTimeout(modelTimeout);

                    // If this specific model timed out, try next model
                    if (modelError.name === 'AbortError') {
                        console.warn(`Model ${modelId} timed out after ${perModelTimeoutMs / 1000}s, trying next...`);
                        continue;
                    }
                    throw modelError; // Re-throw other errors
                }

            } catch (e) {
                if (e.name === 'AbortError') {
                    // This is the total timeout, not per-model
                    throw e;
                }
                if (e.message === "OPENROUTER_AUTH_ERROR" || e.message === "OPENROUTER_PAYMENT_ERROR") {
                    throw e; // Propagate critical errors
                }
                console.warn(`OpenRouter model failed: ${modelId}`, e);
                continue;
            }
        }
    } catch (e) {
        clearTimeout(totalTimeout);
        if (e.name === 'AbortError') {
            const timeoutSec = totalTimeoutMs / 1000;
            throw new Error(`Request timed out after ${timeoutSec} seconds. The models may be overloaded. Please try again.`);
        }
        if (e.message === "OPENROUTER_AUTH_ERROR") {
            throw new Error("OpenRouter API Key is invalid or expired. Please check your settings.");
        }
        if (e.message === "OPENROUTER_PAYMENT_ERROR") {
            throw new Error("OpenRouter account has insufficient credits. Please add credits at https://openrouter.ai/credits");
        }
        throw e;
    } finally {
        clearTimeout(totalTimeout);
    }

    throw new Error(`All OpenRouter models failed for ${options.taskType || 'default'} task. The service may be experiencing high demand.`);
}
