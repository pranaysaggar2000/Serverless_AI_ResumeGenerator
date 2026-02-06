export async function callAI(prompt, provider, apiKey, options = {}) {
    if (provider === 'gemini') {
        return callGemini(prompt, apiKey, options);
    } else if (provider === 'groq') {
        return callGroq(prompt, apiKey, options);
    } else if (provider === 'nvidia') {
        return callNvidia(prompt, apiKey, options);
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

async function callNvidia(prompt, apiKey, options) {
    const invokeUrl = "https://integrate.api.nvidia.com/v1/chat/completions";

    const model = options.useProModel
        ? "nvidia/llama-3.1-nemotron-70b-instruct"
        : "meta/llama-4-maverick-17b-128e-instruct";

    const payload = {
        model: model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 10240,
        temperature: 0.7,
        top_p: 1.0,
        stream: true
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);

    try {
        const response = await fetch(invokeUrl, {
            method: 'POST',
            headers: {
                "Authorization": "Bearer " + apiKey.trim(),
                "Content-Type": "application/json",
                "Accept": "text/event-stream"
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        if (response.status === 401 || response.status === 403) {
            throw new Error("Invalid NVIDIA API key. Check your key in Settings.");
        }

        if (response.status === 429) {
            throw new Error("NVIDIA rate limit reached. Please wait and try again.");
        }

        if (!response.ok) {
            const errText = await response.text();
            console.warn(`NVIDIA streaming failed for ${model}: ${response.status} — trying non-streaming fallback...`);
            return await callNvidiaNonStreaming(prompt, apiKey, options, controller.signal);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line in buffer

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;
                if (!trimmed.startsWith('data: ')) continue;

                try {
                    const json = JSON.parse(trimmed.slice(6)); // Remove "data: " prefix
                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta) {
                        fullContent += delta;
                    }
                } catch (e) {
                    continue;
                }
            }
        }

        if (!fullContent) {
            throw new Error("NVIDIA returned empty response");
        }

        console.log(`NVIDIA: Success with model ${model} (streamed ${fullContent.length} chars)`);
        return fullContent;

    } catch (e) {
        if (e.name === 'AbortError') throw new Error('NVIDIA request timed out after 180s.');
        throw e;
    } finally {
        clearTimeout(timeout);
    }
}

async function callNvidiaNonStreaming(prompt, apiKey, options, signal) {
    const invokeUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
    const model = "moonshotai/kimi-k2.5";

    const payload = {
        model: model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 10240,
        temperature: 0.7,
        top_p: 1.0,
        stream: false
    };

    const response = await fetch(invokeUrl, {
        method: 'POST',
        headers: {
            "Authorization": "Bearer " + apiKey.trim(),
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify(payload),
        signal: signal
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error("NVIDIA API Error " + response.status + ": " + err);
    }

    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
        console.log(`NVIDIA: Success with fallback model ${model} (non-streaming)`);
        return data.choices[0].message.content;
    }

    throw new Error("All NVIDIA models failed.");
}
