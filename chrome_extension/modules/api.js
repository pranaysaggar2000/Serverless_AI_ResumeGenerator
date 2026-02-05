import { API_BASE_URL, state } from './state.js';

export async function extractText(file) {
    const formData = new FormData();
    formData.append('file', file);

    let response;
    try {
        response = await fetch(`${API_BASE_URL}/extract_text`, {
            method: 'POST',
            body: formData
        });
    } catch (e) {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.warn("Mocking extractText response for local testing");
            return { text: "Jane Doe\nSoftware Engineer\nExperience: 5 years..." };
        }
        throw e;
    }
    return await response.json();
}

export async function extractBaseProfile(text, apiKey, provider) {
    let response;
    try {
        response = await fetch(`${API_BASE_URL}/extract_base_profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                api_key: apiKey,
                provider: provider
            })
        });
    } catch (e) {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.warn("Mocking extractBaseProfile response for local testing");
            return {
                name: "Jane Doe",
                email: "jane@example.com",
                skills: { "Languages": "Python, JavaScript", "Tools": "Git, Docker" },
                experience: [
                    {
                        company: "Tech Corp",
                        role: "Senior Developer",
                        dates: "2020 - Present",
                        bullets: ["Led a team of 5", "Improved performance by 20%"]
                    }
                ],
                education: [
                    {
                        institution: "University of Tech",
                        degree: "B.S. Computer Science",
                        dates: "2016 - 2020"
                    }
                ],
                projects: [],
                summary: "Experienced developer..."
            };
        }
        throw e;
    }
    return await response.json();
}

export async function tailorResume(baseResume, jdText, apiKey, provider, tailoringStrategy) {
    const response = await fetch(`${API_BASE_URL}/tailor_resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            base_resume: baseResume,
            jd_text: jdText,
            api_key: apiKey,
            provider: provider,
            tailoring_strategy: tailoringStrategy
        })
    });
    return await response.json();
}

export async function generatePdf(resumeData) {
    const response = await fetch(`${API_BASE_URL}/generate_pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_data: resumeData })
    });

    const data = await response.json();

    if (data.error) {
        return { error: data.error };
    }

    if (data.pdf_base64) {
        const byteCharacters = atob(data.pdf_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: 'application/pdf' });
    }

    return { error: "Unknown response format" };
}

export async function regenerateResume(tailoredResume, bulletCounts, jdAnalysis, apiKey, provider, tailoringStrategy) {
    const response = await fetch(`${API_BASE_URL}/regenerate_resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tailored_resume: tailoredResume,
            bullet_counts: bulletCounts,
            jd_analysis: jdAnalysis,
            api_key: apiKey,
            provider: provider,
            tailoring_strategy: tailoringStrategy
        })
    });
    return await response.json();
}

export async function askQuestion(question, resumeData, jdText, apiKey, provider) {
    const response = await fetch(`${API_BASE_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            question: question,
            resume_data: resumeData,
            jd_text: jdText,
            api_key: apiKey,
            provider: provider
        })
    });
    return await response.json();
}

export async function analyzeResume(resumeData, jdText, apiKey, provider) {
    const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            resume_data: resumeData,
            jd_text: jdText,
            api_key: apiKey,
            provider: provider
        })
    });
    return await response.json();
}
