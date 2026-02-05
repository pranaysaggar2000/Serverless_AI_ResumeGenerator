export const API_BASE_URL = "https://serverless-ai-resume-generator.vercel.app/api";

export const state = {
    currentJdText: "",
    baseResume: null,
    tailoredResume: null,
    currentApiKey: "",
    currentGroqKey: "",
    currentProvider: "gemini", // Default
    hasAnalyzed: false,
    tailoringStrategy: "balanced",
    currentJdAnalysis: null,
    lastAnalysis: null,
    currentEditingData: null,
    detectedJobTitle: null,
    detectedCompany: null
};

// Helper to update state to trigger potential listeners if we add them later
// For now, direct access is fine, but functions help with imports
export function updateState(updates) {
    Object.assign(state, updates);
}
