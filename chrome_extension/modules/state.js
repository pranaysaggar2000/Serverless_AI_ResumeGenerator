export const API_BASE_URL = "https://serverless-ai-resume-generator.vercel.app/api";

const stateShape = {
    currentJdText: "",
    baseResume: null,
    tailoredResume: null,
    currentApiKey: "",
    currentGroqKey: "",
    currentProvider: "gemini", // Default
    hasAnalyzed: false,
    tailoringStrategy: "balanced",
    currentJdAnalysis: null,
    lastAnalysis: null, // Stored analysis to display
    currentEditingData: null,
    detectedJobTitle: null,
    detectedCompany: null,
    jdKeywords: [], // Computed from analysis
    activeProfile: "default"
};

// Internal mutable state
const _state = { ...stateShape };

// Proxy to validate access
export const state = new Proxy(_state, {
    get(target, prop) {
        if (typeof prop === 'string' && !(prop in target) && prop !== 'then' && prop !== 'toJSON') {
            console.warn(`[ForgeCV State] Accessing unknown state property: "${prop}"`);
        }
        return target[prop];
    },
    set(target, prop, value) {
        if (!(prop in stateShape)) {
            console.warn(`[ForgeCV State] Setting unknown state property: "${prop}"`);
        }
        target[prop] = value;
        return true;
    }
});

// Helper to update state
export function updateState(updates) {
    for (const key in updates) {
        if (!(key in stateShape)) {
            console.warn(`[ForgeCV State] updateState called with unknown key: "${key}"`);
        }
        _state[key] = updates[key]; // Update internal state directly to bypass excessive set warnings if we wanted, or go through proxy.
        // Actually, updating _state directly avoids the proxy trap for *this* call, but the proxy trap is useful validation.
        // But since we validate keys here explicitly, we can just update _state.
    }
}
