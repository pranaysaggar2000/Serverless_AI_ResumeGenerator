
const API_BASE_URL = "http://localhost:5000/api"; // Placeholder as requested

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const setupUI = document.getElementById('setupUI');
    const mainUI = document.getElementById('mainUI');
    const settingsUI = document.getElementById('settingsUI');
    const resumeFile = document.getElementById('resumeFile');
    const uploadBtn = document.getElementById('uploadBtn');
    const apiKeyInput = document.getElementById('apiKey');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const settingsToggle = document.getElementById('settingsToggle');
    const statusDiv = document.getElementById('status');
    const generateBtn = document.getElementById('generateBtn');
    const profileNameDisplay = document.getElementById('profileName');
    const updateProfileLink = document.getElementById('updateProfileLink');
    const analysisResults = document.getElementById('analysisResults');
    const atsScoreDisplay = document.getElementById('atsScore');
    const analysisDetails = document.getElementById('analysisDetails');
    const actionsDiv = document.getElementById('actions');
    const previewBtn = document.getElementById('previewBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    // State
    let currentJdText = "";
    let baseResume = null;
    let tailoredResume = null;
    let currentApiKey = "";

    // 1. Initialization
    await loadState();

    async function loadState() {
        const data = await chrome.storage.local.get(['gemini_api_key', 'base_resume', 'user_profile_name']);

        if (data.gemini_api_key) {
            currentApiKey = data.gemini_api_key;
            apiKeyInput.value = currentApiKey;
        }

        if (data.base_resume) {
            baseResume = data.base_resume;
            profileNameDisplay.textContent = data.user_profile_name || "User";

            if (currentApiKey) {
                showMainUI();
            } else {
                showSettings(); // Force settings if no key
            }
        } else {
            if (currentApiKey) {
                showSetupUI();
            } else {
                showSettings(); // Force settings if no key
            }
        }
    }

    // 2. Navigation / UI Toggles
    settingsToggle.addEventListener('click', () => {
        if (settingsUI.style.display === 'none') {
            settingsUI.style.display = 'block';
            setupUI.style.display = 'none';
            mainUI.style.display = 'none';
        } else {
            settingsUI.style.display = 'none';
            // Determine where to go back to
            if (baseResume && currentApiKey) showMainUI();
            else showSetupUI();
        }
    });

    function showMainUI() {
        setupUI.style.display = 'none';
        settingsUI.style.display = 'none';
        mainUI.style.display = 'block';
        detectJobDescription();
    }

    function showSetupUI() {
        setupUI.style.display = 'block';
        settingsUI.style.display = 'none';
        mainUI.style.display = 'none';
    }

    function showSettings() {
        settingsUI.style.display = 'block';
        setupUI.style.display = 'none';
        mainUI.style.display = 'none';
    }

    // 3. Settings Logic
    saveSettingsBtn.addEventListener('click', async () => {
        const key = apiKeyInput.value.trim();
        if (!key) {
            showStatus("Please enter an API key.", "error", "settingsStatus");
            return;
        }

        await chrome.storage.local.set({ gemini_api_key: key });
        currentApiKey = key;
        showStatus("Settings saved!", "success", "settingsStatus");

        setTimeout(() => {
            if (baseResume) showMainUI();
            else showSetupUI();
        }, 1000);
    });

    // 4. Setup / Upload Logic
    uploadBtn.addEventListener('click', async () => {
        const file = resumeFile.files[0];
        if (!file) {
            showStatus("Please select a PDF file.", "error");
            return;
        }

        if (!currentApiKey) {
            showStatus("Please save your API Key in settings first.", "error");
            return;
        }

        showStatus("Extracting resume info... this may take a moment.", "info");
        uploadBtn.disabled = true;

        try {
            // First extract text (since we can't send file object to background easily without base64 or blob handling that matches backend)
            // Actually, we can send FormData to existing backend endpoint if we fetch directly from popup
            const formData = new FormData();
            formData.append('file', file);

            // Step A: Extract Text
            const textResp = await fetch(`${API_BASE_URL}/extract_text`, {
                method: 'POST',
                body: formData
            });
            const textData = await textResp.json();

            if (textData.error) throw new Error(textData.error);

            // Step B: Extract structured profile
            const profileResp = await fetch(`${API_BASE_URL}/extract_base_profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: textData.text,
                    api_key: currentApiKey
                })
            });
            const profileData = await profileResp.json();

            if (profileData.error) throw new Error(profileData.error);

            // Save to storage
            await chrome.storage.local.set({
                base_resume: profileData,
                user_profile_name: profileData.name || "User"
            });

            baseResume = profileData;
            profileNameDisplay.textContent = profileData.name;

            showStatus("Profile created! Redirecting...", "success");
            setTimeout(showMainUI, 1500);

        } catch (e) {
            showStatus(`Error: ${e.message}`, "error");
        } finally {
            uploadBtn.disabled = false;
        }
    });

    updateProfileLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSetupUI();
    });

    // 5. Job Detection
    async function detectJobDescription() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.id) return;

        // Simple extraction script
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => document.body.innerText
            });

            if (results && results[0]) {
                currentJdText = results[0].result;
                const jdContext = document.getElementById('jobContext');
                jdContext.style.display = 'block';
                jdContext.innerHTML = `Active Page Detected: <strong>${tab.title.substring(0, 30)}...</strong>`;
            }
        } catch (e) {
            console.log("Could not read tab content", e);
        }
    }

    // 6. Generation Logic
    generateBtn.addEventListener('click', async () => {
        if (!currentJdText || currentJdText.length < 50) {
            showStatus("Could not detect a valid job description on this page.", "error");
            return;
        }

        generateBtn.disabled = true;
        showStatus("Analyzing and tailoring resume... (this takes ~15s)", "info");

        try {
            const resp = await fetch(`${API_BASE_URL}/tailor_resume`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    base_resume: baseResume,
                    jd_text: currentJdText,
                    api_key: currentApiKey
                })
            });

            const data = await resp.json();
            if (data.error) throw new Error(data.error);

            tailoredResume = data.tailored_resume;

            // Show Analysis Score if available or trigger separate analysis
            // For now, let's just show success and enable PDF generation
            showStatus("Resume tailored! Generating PDF...", "info");

            // Generate PDF
            const pdfResp = await fetch(`${API_BASE_URL}/generate_pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resume_data: tailoredResume })
            });

            const pdfData = await pdfResp.json();
            if (pdfData.error) throw new Error(pdfData.error);

            // Store PDF blob URL
            const binary = atob(pdfData.pdf_base64);
            const array = [];
            for (let i = 0; i < binary.length; i++) array.push(binary.charCodeAt(i));
            const blob = new Blob([new Uint8Array(array)], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            previewBtn.onclick = () => window.open(url, '_blank');
            downloadBtn.onclick = () => {
                chrome.downloads.download({
                    url: url,
                    filename: `${data.jd_analysis.job_identifier}_Resume.pdf`
                });
            };

            actionsDiv.style.display = 'block';
            showStatus("Done! Check options below.", "success");

            // Trigger Analysis in background
            performAnalysis();

        } catch (e) {
            showStatus(`Error: ${e.message}`, "error");
        } finally {
            generateBtn.disabled = false;
        }
    });

    async function performAnalysis() {
        try {
            const resp = await fetch(`${API_BASE_URL}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resume_data: tailoredResume,
                    jd_text: currentJdText,
                    api_key: currentApiKey
                })
            });
            const data = await resp.json();
            if (data.error) return;

            analysisResults.style.display = 'block';
            atsScoreDisplay.textContent = data.score || "N/A";

            // Render details
            let html = `<strong>Missing Keywords:</strong> ${data.missing_keywords?.join(', ')}<br>`;
            html += `<strong>Recommendations:</strong><ul>`;
            data.recommendations?.forEach(rec => html += `<li>${rec}</li>`);
            html += `</ul>`;
            analysisDetails.innerHTML = html;

        } catch (e) {
            console.error(e);
        }
    }


    // 7. Editor Logic
    const editBtn = document.getElementById('editBtn');
    const editorUI = document.getElementById('editorUI');
    const sectionSelect = document.getElementById('sectionSelect');
    const formContainer = document.getElementById('formContainer');
    const saveRegenBtn = document.getElementById('saveRegenBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');

    editBtn.addEventListener('click', () => {
        editorUI.style.display = 'block';
        actionsDiv.style.display = 'none'; // Hide actions while editing
        renderEditor("summary"); // Default
    });

    cancelEditBtn.addEventListener('click', () => {
        editorUI.style.display = 'none';
        actionsDiv.style.display = 'block';
    });

    sectionSelect.addEventListener('change', () => {
        renderEditor(sectionSelect.value);
    });

    function renderEditor(section) {
        formContainer.innerHTML = "";
        const data = tailoredResume || baseResume;

        if (!data) return;

        if (section === 'summary') {
            const textarea = document.createElement('textarea');
            textarea.value = data.summary || "";
            textarea.id = "edit_summary";
            textarea.style.height = "100px";
            formContainer.appendChild(createField("Summary", textarea));
        }
        else if (section === 'skills') {
            const skills = data.skills || {};
            for (const [cat, val] of Object.entries(skills)) {
                const input = document.createElement('input');
                input.value = val;
                input.dataset.category = cat;
                input.className = "edit_skill_input";
                formContainer.appendChild(createField(cat, input));
            }
        }
        else if (section === 'contact') {
            // Basic implementation for contact
            const contact = data.contact || {};
            if (typeof contact === 'string') {
                // Handle if string (legacy/server formatting)
                const input = document.createElement('textarea');
                input.value = contact;
                input.id = "edit_contact_string";
                formContainer.appendChild(createField("Contact String", input));
            } else {
                const fields = ['location', 'phone', 'email', 'linkedin_url', 'portfolio_url'];
                fields.forEach(f => {
                    const input = document.createElement('input');
                    input.value = contact[f] || "";
                    input.id = `edit_contact_${f}`;
                    formContainer.appendChild(createField(f, input));
                });
            }
        }
        // Simplified handling for complex lists (Experience/Projects) - Textarea JSON/Text edit for bullets might be easier
        // But user asked for "existing UI/logic", implying fields.
        // We'll implement a simplified bullet editor for Experience
        else if (section === 'experience') {
            const expList = data.experience || [];
            expList.forEach((exp, idx) => {
                const block = document.createElement('div');
                block.className = "item-block";
                block.innerHTML = `<div class="item-header">${exp.company} - ${exp.role}</div>`;

                // Bullets
                const ul = document.createElement('ul');
                ul.className = "bullet-list";
                (exp.bullets || []).forEach((b, bIdx) => {
                    const li = document.createElement('li');
                    li.className = "bullet-item";
                    li.innerHTML = `
                        <input type="text" class="bullet-input" value="${b.replace(/"/g, '&quot;')}" data-exp-idx="${idx}" data-bullet-idx="${bIdx}">
                    `;
                    ul.appendChild(li);
                });
                block.appendChild(ul);
                formContainer.appendChild(block);
            });
        }
        else if (section === 'projects') {
            const projList = data.projects || [];
            projList.forEach((proj, idx) => {
                const block = document.createElement('div');
                block.className = "item-block";
                block.innerHTML = `<div class="item-header">${proj.name}</div>`;

                // Bullets
                const ul = document.createElement('ul');
                ul.className = "bullet-list";
                (proj.bullets || []).forEach((b, bIdx) => {
                    const li = document.createElement('li');
                    li.className = "bullet-item";
                    li.innerHTML = `
                        <input type="text" class="bullet-input" value="${b.replace(/"/g, '&quot;')}" data-proj-idx="${idx}" data-bullet-idx="${bIdx}">
                    `;
                    ul.appendChild(li);
                });
                block.appendChild(ul);
                formContainer.appendChild(block);
            });
        }
    }

    function createField(label, inputEl) {
        const div = document.createElement('div');
        div.className = "edit-field";
        const lbl = document.createElement('label');
        lbl.textContent = label.charAt(0).toUpperCase() + label.slice(1);
        div.appendChild(lbl);
        div.appendChild(inputEl);
        return div;
    }

    saveRegenBtn.addEventListener('click', async () => {
        const section = sectionSelect.value;
        const data = tailoredResume || baseResume; // Mutate in place (shim)

        // Save logic
        if (section === 'summary') {
            const el = document.getElementById('edit_summary');
            if (el) data.summary = el.value;
        }
        else if (section === 'skills') {
            const inputs = document.querySelectorAll('.edit_skill_input');
            inputs.forEach(input => {
                if (data.skills && data.skills[input.dataset.category]) {
                    data.skills[input.dataset.category] = input.value;
                }
            });
        }
        else if (section === 'experience') {
            const inputs = document.querySelectorAll('#formContainer .bullet-input');
            inputs.forEach(input => {
                const expIdx = parseInt(input.dataset.expIdx);
                const bIdx = parseInt(input.dataset.bulletIdx);
                if (data.experience[expIdx] && data.experience[expIdx].bullets) {
                    data.experience[expIdx].bullets[bIdx] = input.value;
                }
            });
        }
        else if (section === 'projects') {
            const inputs = document.querySelectorAll('#formContainer .bullet-input');
            inputs.forEach(input => {
                const projIdx = parseInt(input.dataset.projIdx);
                const bIdx = parseInt(input.dataset.bulletIdx);
                if (data.projects[projIdx] && data.projects[projIdx].bullets) {
                    data.projects[projIdx].bullets[bIdx] = input.value;
                }
            });
        }
        // ... (Implement other sections similarly)

        tailoredResume = data; // Update state

        // Regenerate
        showStatus("Regenerating PDF...", "info");
        try {
            const pdfResp = await fetch(`${API_BASE_URL}/generate_pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resume_data: tailoredResume })
            });
            const pdfData = await pdfResp.json();
            if (pdfData.error) throw new Error(pdfData.error);

            // Update Preview
            const binary = atob(pdfData.pdf_base64);
            const array = [];
            for (let i = 0; i < binary.length; i++) array.push(binary.charCodeAt(i));
            const blob = new Blob([new Uint8Array(array)], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            previewBtn.onclick = () => window.open(url, '_blank');
            downloadBtn.onclick = () => {
                chrome.downloads.download({
                    url: url,
                    filename: `${data.jd_analysis?.job_identifier || 'Resume'}_Revised.pdf`
                });
            };

            showStatus("Resume updated!", "success");
            editorUI.style.display = 'none';
            actionsDiv.style.display = 'block';

        } catch (e) {
            showStatus("Error regenerating: " + e.message, "error");
        }
    });

    // Helper
    function showStatus(msg, type, elementId = "status") {
        const el = document.getElementById(elementId);
        el.className = type;
        el.textContent = msg;
        el.style.display = 'block';
    }
});
