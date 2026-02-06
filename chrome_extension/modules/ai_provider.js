export async function callAI(prompt, provider, apiKey, options = {}) {
    if (provider === 'gemini') {
        return callGemini(prompt, apiKey, options);
    } else if (provider === 'groq') {
        return callGroq(prompt, apiKey, options);
    }
    throw new Error(`Unknown provider: ${provider}`);
}

export function extractJSON(text) {
    if (!text) return null;

    // 1. Try markdown code block
    const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (blockMatch) {
        try { return JSON.parse(blockMatch[1]); } catch (e) { }
    }

    // 2. Try to find JSON by finding matching braces
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let end = -1;
    for (let i = start; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') {
            depth--;
            if (depth === 0) { end = i; break; }
        }
    }

    if (end !== -1) {
        try { return JSON.parse(text.substring(start, end + 1)); } catch (e) { }
    }

    return null;
}

async function callGemini(prompt, apiKey, options) {
    // Standard models: gemini-1.5-pro, gemini-1.5-flash.
    const targetModel = options.useProModel ? 'gemini-1.5-pro' : 'gemini-1.5-flash';
    // Construct URL for the chosen model
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

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
        "qwen/qwen3-32b"
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
                if (e.name === 'AbortError') throw e; // Propagate abort
                console.warn(`Groq model failed: ${modelId}`, e);
                continue;
            }
        }
    } catch (e) {
        if (e.name === 'AbortError') throw new Error('Request timed out after 60 seconds. Please try again.');
        throw e;
    } finally {
        clearTimeout(timeout);
    }
    throw new Error("All Groq models failed.");
}
