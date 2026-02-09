// Production Vercel deployment URL
export const API_BASE_URL = "https://serverless-ai-resume-generator-api.vercel.app";

const stateShape = {
    currentJdText: "",
    baseResume: null,
    tailoredResume: null,
    currentApiKey: "",
    currentGroqKey: "",
    currentOpenRouterKey: "",
    currentProvider: "gemini", // Default
    hasAnalyzed: false,
    tailoringStrategy: "balanced",
    currentJdAnalysis: null,
    lastParsedJdText: "",  // Track which JD text was last parsed (for caching)
    lastAnalysis: null, // Stored analysis to display
    currentEditingData: null,
    detectedJobTitle: null,
    detectedCompany: null,
    detectedPageUrl: "",
    jdKeywords: [], // Computed from analysis
    activeProfile: "default",
    jdExtractionMethod: 'none',    // 'auto' | 'auto-partial' | 'ai' | 'manual' | 'none'
    detectedCompanyDescription: '',
    latestPdfBlob: null,
    formatSettings: {
        font: "times",           // "times" | "helvetica" | "courier"
        density: "normal",       // "compact" | "normal" | "spacious"
        margins: "normal",       // "narrow" | "normal" | "wide"
        nameSize: 21,            // 16-28 range
        bodySize: 10,            // 9-12 range
        headerSize: 12,          // 10-24 range
        subheaderSize: 11,       // 10-18 range
        headerStyle: "uppercase_line",  // "uppercase_line" | "uppercase_noline" | "bold_line" | "bold_noline"
        bulletChar: "•",         // "•" | "–"
        showLinks: true,         // show clickable LinkedIn/Portfolio in contact
        dateAlign: "right",      // "right" | "inline"
        pageSize: "letter"       // "letter" | "a4"
    },
    // Authentication & Free Tier Support
    authMode: "free",          // "free" | "byok" — which mode is active for AI calls
    user: null,                // { id, email, name, avatar_url } or null
    accessToken: null,         // Supabase JWT
    refreshToken: null,        // Supabase refresh token
    freeUsage: { used: 0, remaining: 15, limit: 15, resetsAt: null },
    isLoggedIn: false
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
    // Check if JD text is being updated and differs from both current AND cached version
    if ('currentJdText' in updates) {
        const newJdText = updates.currentJdText;
        const currentJdText = _state.currentJdText;
        const cachedJdText = _state.lastParsedJdText;

        // Only invalidate if:
        // 1. The new JD text is different from the current JD text (actual change)
        // 2. AND it's different from the cached version
        // This prevents invalidation when just loading from storage or when setting the same value
        if (newJdText !== currentJdText && newJdText !== cachedJdText) {
            console.log('🔄 JD text changed - invalidating cached JD analysis');
            updates.currentJdAnalysis = null;
            updates.lastParsedJdText = "";
        }
    }

    for (const key in updates) {
        if (!(key in stateShape)) {
            console.warn(`[ForgeCV State] updateState called with unknown key: "${key}"`);
        }
        _state[key] = updates[key]; // Update internal state directly to bypass excessive set warnings if we wanted, or go through proxy.
        // Actually, updating _state directly avoids the proxy trap for *this* call, but the proxy trap is useful validation.
        // But since we validate keys here explicitly, we can just update _state.
    }
}
