
const API_BASE_URL = "https://serverless-ai-resume-generator.vercel.app/api"; // Updated to Vercel deployment

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
    let currentGroqKey = "";
    let currentProvider = "gemini";
    let hasAnalyzed = false; // Track if analysis has been performed

    // 1. Initialization
    await loadState();

    async function loadState() {
        const data = await chrome.storage.local.get(['gemini_api_key', 'groq_api_key', 'provider', 'base_resume', 'user_profile_name']);

        // Load Provider
        if (data.provider) {
            currentProvider = data.provider;
            document.getElementById('providerSelect').value = currentProvider;
        }

        // Load Keys
        if (data.gemini_api_key) {
            currentApiKey = data.gemini_api_key;
            apiKeyInput.value = currentApiKey;
        }
        if (data.groq_api_key) {
            currentGroqKey = data.groq_api_key;
            document.getElementById('groqApiKey').value = currentGroqKey;
        }

        // Update UI based on provider
        toggleProviderUI(currentProvider);

        if (data.base_resume) {
            baseResume = data.base_resume;
            profileNameDisplay.textContent = data.user_profile_name || "User";

            if (checkCurrentProviderKey()) {
                showMainUI();
            } else {
                showSettings(); // Force settings if no key for selected provider
            }
        } else {
            if (checkCurrentProviderKey()) {
                showSetupUI();
            } else {
                showSettings(); // Force settings if no key
            }
        }
    }

    function toggleProviderUI(provider) {
        if (provider === 'gemini') {
            document.getElementById('geminiKeyData').style.display = 'block';
            document.getElementById('groqKeyData').style.display = 'none';
        } else {
            document.getElementById('geminiKeyData').style.display = 'none';
            document.getElementById('groqKeyData').style.display = 'block';
        }
    }

    function checkCurrentProviderKey() {
        if (currentProvider === 'gemini') return !!currentApiKey;
        if (currentProvider === 'groq') return !!currentGroqKey;
        return false;
    }

    document.getElementById('providerSelect').addEventListener('change', (e) => {
        currentProvider = e.target.value;
        toggleProviderUI(currentProvider);
    });

    // 2. Navigation / UI Toggles
    settingsToggle.addEventListener('click', () => {
        if (settingsUI.style.display === 'none') {
            settingsUI.style.display = 'block';
            setupUI.style.display = 'none';
            mainUI.style.display = 'none';
        } else {
            settingsUI.style.display = 'none';
            // Determine where to go back to
            if (baseResume && checkCurrentProviderKey()) showMainUI();
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
        const geminiKey = apiKeyInput.value.trim();
        const groqKey = document.getElementById('groqApiKey').value.trim();
        const provider = document.getElementById('providerSelect').value;

        let settingsToSave = {
            gemini_api_key: geminiKey,
            groq_api_key: groqKey,
            provider: provider
        };

        if (provider === 'gemini' && !geminiKey) {
            showStatus("Please enter a Gemini API key.", "error", "settingsStatus");
            return;
        }
        if (provider === 'groq' && !groqKey) {
            showStatus("Please enter a Groq API key.", "error", "settingsStatus");
            return;
        }

        await chrome.storage.local.set(settingsToSave);
        currentApiKey = geminiKey;
        currentGroqKey = groqKey;
        currentProvider = provider;

        showStatus("Settings saved! Using " + (provider === 'gemini' ? "Gemini" : "Groq"), "success", "settingsStatus");

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

        if (!checkCurrentProviderKey()) {
            showStatus("Please save your API Key in settings first.", "error");
            return;
        }

        showStatus("Extracting resume info... this may take a moment.", "info");
        uploadBtn.disabled = true;

        try {
            // First extract text
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
            // Use Gemini for extraction if available, as it's better at JSON extraction usually.
            // But we respect current provider choice or fallback to Gemini key if user only has that.
            let extractionKey = currentProvider === 'groq' ? currentGroqKey : currentApiKey;
            // Hack: Extraction currently hardcoded to Gemini in backend potentially? 
            // extract_base_resume_info calls query_provider default.
            // We should pass provider.

            const profileResp = await fetch(`${API_BASE_URL}/extract_base_profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: textData.text,
                    api_key: extractionKey,
                    provider: currentProvider
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
        showStatus(`Analyzing and tailoring resume with ${currentProvider === 'groq' ? 'Groq' : 'Gemini'}...`, "info");

        const activeKey = currentProvider === 'groq' ? currentGroqKey : currentApiKey;

        try {
            const resp = await fetch(`${API_BASE_URL}/tailor_resume`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    base_resume: baseResume,
                    jd_text: currentJdText,
                    api_key: activeKey,
                    provider: currentProvider
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



        } catch (e) {
            showStatus(`Error: ${e.message}`, "error");
        } finally {
            generateBtn.disabled = false;
        }
    });

    async function performAnalysis() {
        const activeKey = currentProvider === 'groq' ? currentGroqKey : currentApiKey;
        try {
            const resp = await fetch(`${API_BASE_URL}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resume_data: tailoredResume,
                    jd_text: currentJdText,
                    api_key: activeKey,
                    provider: currentProvider
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

    // 6b. Action Buttons Logic
    const copyContentBtn = document.getElementById('copyContentBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const copyUI = document.getElementById('copyUI');
    const copyList = document.getElementById('copyList');
    const closeCopyBtn = document.getElementById('closeCopyBtn');

    copyContentBtn.addEventListener('click', () => {
        if (!tailoredResume) return;
        // Hide Actions, Show Copy UI
        actionsDiv.style.display = 'none';
        copyUI.style.display = 'block';
        renderCopyList();
    });

    closeCopyBtn.addEventListener('click', () => {
        copyUI.style.display = 'none';
        actionsDiv.style.display = 'block';
    });

    function renderCopyList() {
        copyList.innerHTML = "";
        const data = tailoredResume;

        // Helper to create sections
        const createSection = (title, items, type) => {
            if (!items || items.length === 0) return;

            const header = document.createElement('h4');
            header.style.cssText = "margin: 10px 0 5px 0; color: #555; text-transform: uppercase; font-size: 11px; border-bottom: 1px solid #eee; padding-bottom: 2px;";
            header.textContent = title;
            copyList.appendChild(header);

            items.forEach((item, index) => {
                const div = document.createElement('div');
                div.style.cssText = "background: #fff; border: 1px solid #eee; border-radius: 4px; padding: 8px; margin-bottom: 8px;";

                // Title Construction
                let titleText = "";
                let subtitleText = "";

                if (type === 'experience') {
                    titleText = item.company || "Company";
                    subtitleText = item.role || item.title || "Role";
                } else if (type === 'project') {
                    titleText = item.name || "Project";
                    subtitleText = item.tech || ""; // item.tech might not exist in new schema, check if needed
                }

                div.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 5px;">
                        <div>
                            <div style="font-weight: bold; font-size: 12px;">${titleText}</div>
                            <div style="font-size: 11px; color: #666;">${subtitleText}</div>
                        </div>
                        <button class="copy-btn" data-type="${type}" data-index="${index}" 
                            style="width: auto; padding: 4px 8px; font-size: 11px; background: #e9ecef; color: #333; border: 1px solid #ccc; cursor: pointer;">
                            📋 Copy Desc.
                        </button>
                    </div>
                    <div style="font-size: 10px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${(item.bullets || []).join(' ')}
                    </div>
                `;
                copyList.appendChild(div);
            });
        };

        // Summary (Special Case)
        if (data.summary) {
            const header = document.createElement('h4');
            header.style.cssText = "margin: 10px 0 5px 0; color: #555; text-transform: uppercase; font-size: 11px; border-bottom: 1px solid #eee; padding-bottom: 2px;";
            header.textContent = "Summary";
            copyList.appendChild(header);

            const div = document.createElement('div');
            div.style.cssText = "background: #fff; border: 1px solid #eee; border-radius: 4px; padding: 8px; margin-bottom: 8px;";
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 5px;">
                    <div style="font-weight: bold; font-size: 12px;">Professional Summary</div>
                    <button class="copy-btn" data-type="summary" 
                        style="width: auto; padding: 4px 8px; font-size: 11px; background: #e9ecef; color: #333; border: 1px solid #ccc; cursor: pointer;">
                        📋 Copy
                    </button>
                </div>
                <div style="font-size: 10px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${data.summary}
                </div>
            `;
            copyList.appendChild(div);
        }

        createSection('Experience', data.experience, 'experience');
        createSection('Projects', data.projects, 'project');

        // Add Event Listeners
        const matchBtns = copyList.querySelectorAll('.copy-btn');
        matchBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = btn.dataset.type;
                const index = btn.dataset.index;
                let textToCopy = "";

                if (type === 'summary') {
                    textToCopy = data.summary;
                } else if (type === 'experience') {
                    const item = data.experience[index];
                    if (item.bullets) textToCopy = item.bullets.map(b => `• ${b}`).join('\n');
                } else if (type === 'project') {
                    const item = data.projects[index];
                    if (item.bullets) textToCopy = item.bullets.map(b => `• ${b}`).join('\n');
                }

                if (textToCopy) {
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        const originalText = btn.innerHTML; // Store HTML (icon + text)
                        btn.innerHTML = "✅ Copied!";
                        btn.style.background = "#d4edda";
                        setTimeout(() => {
                            btn.innerHTML = originalText;
                            btn.style.background = "#e9ecef";
                        }, 1500);
                    });
                }
            });
        });
    }

    async function performAnalysis() {
        const activeKey = currentProvider === 'groq' ? currentGroqKey : currentApiKey;
        if (!currentJdText) {
            showStatus("No Job Description detected. Refresh the page.", "error");
            return false;
        }

        try {
            const resp = await fetch(`${API_BASE_URL}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resume_data: tailoredResume,
                    jd_text: currentJdText,
                    api_key: activeKey,
                    provider: currentProvider
                })
            });
            const data = await resp.json();

            if (data.error) {
                showStatus(`Analysis Error: ${data.error}`, "error");
                return false;
            }

            analysisResults.style.display = 'block';
            atsScoreDisplay.textContent = data.score || "N/A";

            // Render details
            let html = ``;

            // Summary Feedback
            if (data.summary_feedback) {
                html += `<div style="margin-bottom: 12px; padding: 8px; background: #f8f9fa; border-left: 3px solid #4A00E0; border-radius: 4px;">
                    <strong>📋 Summary:</strong> ${data.summary_feedback}
                </div>`;
            }

            // Matching Areas
            if (data.matching_areas && data.matching_areas.length) {
                html += `<div style="margin-bottom: 10px;">
                    <strong>✅ Strong Matches:</strong>
                    <ul style="margin: 5px 0; padding-left: 20px;">`;
                data.matching_areas.forEach(area => html += `<li style="color: #28a745;">${area}</li>`);
                html += `</ul></div>`;
            }

            // Missing Keywords
            if (data.missing_keywords && data.missing_keywords.length) {
                html += `<div style="margin-bottom: 10px;">
                    <strong>⚠️ Missing Keywords:</strong> 
                    <span style="color: #d63384;">${data.missing_keywords.join(', ')}</span>
                </div>`;
            }

            // Recommendations
            if (data.recommendations && data.recommendations.length) {
                html += `<div style="margin-bottom: 8px;">
                    <strong>💡 Recommendations:</strong>
                    <ul style="margin: 5px 0; padding-left: 20px;">`;
                data.recommendations.forEach(rec => html += `<li>${rec}</li>`);
                html += `</ul></div>`;
            }

            analysisDetails.innerHTML = html;

            // Auto-scroll to results
            setTimeout(() => {
                analysisResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);

            return true;

        } catch (e) {
            console.error("Analysis Failed", e);
            showStatus(`Analysis Failed: ${e.message}`, "error");
            return false;
        }
    }



    analyzeBtn.addEventListener('click', async () => {
        if (!tailoredResume) {
            showStatus("No resume generated to analyze.", "error");
            return;
        }
        const statusMessage = hasAnalyzed ? "Re-analyzing ATS Score..." : "Analyzing ATS Score...";
        showStatus(statusMessage, "info");

        const success = await performAnalysis();

        if (success) {
            hasAnalyzed = true; // Mark as analyzed
            showStatus("Analysis Complete!", "success");
            setTimeout(() => showStatus("", ""), 3000);
        }
        // If failed, performAnalysis handler already showed error status
    });


    // 7. Editor Logic
    const editBtn = document.getElementById('editBtn');
    const editorUI = document.getElementById('editorUI');
    const sectionSelect = document.getElementById('sectionSelect');
    const formContainer = document.getElementById('formContainer');
    const saveRegenBtn = document.getElementById('saveRegenBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');

    // Advanced Editor Logic (see below)


    let currentEditingData = null;
    let previousSection = null;

    editBtn.addEventListener('click', () => {
        // Load data to edit: deep copy tailoredResume
        if (!tailoredResume && !baseResume) return;
        currentEditingData = JSON.parse(JSON.stringify(tailoredResume || baseResume));

        editorUI.style.display = 'block';
        actionsDiv.style.display = 'none';

        // Render default
        sectionSelect.value = "summary";
        previousSection = "summary";
        renderEditor("summary", currentEditingData["summary"]);
    });

    sectionSelect.addEventListener('change', () => {
        if (!currentEditingData) return;

        // Auto-save previous section to local state
        if (previousSection) {
            const savedData = parseEditor(previousSection);
            if (savedData !== null) {
                currentEditingData[previousSection] = savedData;
            }
        }

        const section = sectionSelect.value;
        renderEditor(section, currentEditingData[section]);
        previousSection = section;
    });

    function renderEditor(section, data) {
        formContainer.innerHTML = '';

        if (section === 'summary') {
            const div = document.createElement('div');
            div.className = 'edit-field';
            div.innerHTML = `<label>Summary Text</label>
                             <textarea id="edit_summary_text" style="height: 100px;">${data || ''}</textarea>`;
            formContainer.appendChild(div);
        }
        else if (section === 'contact') {
            // Handle raw string case just in case
            if (typeof data !== 'object') data = { location: data || "" };

            const fields = [
                { key: 'location', label: 'Location' },
                { key: 'email', label: 'Email' },
                { key: 'phone', label: 'Phone' },
                { key: 'linkedin_url', label: 'LinkedIn URL' },
                { key: 'portfolio_url', label: 'Portfolio URL' }
            ];

            fields.forEach(f => {
                let val = data[f.key] || "";
                const div = document.createElement('div');
                div.className = 'edit-field';
                div.innerHTML = `<label>${f.label}</label>
                                  <input type="text" data-key="${f.key}" class="contact-input" value="${val}" placeholder="${f.label}">`;
                formContainer.appendChild(div);
            });
        }
        else if (section === 'skills') {
            if (!data) data = {};
            const listDiv = document.createElement('div');
            listDiv.id = 'skillsList';

            for (const [category, skills] of Object.entries(data)) {
                const div = document.createElement('div');
                div.className = 'item-block';
                div.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <input type="text" class="skill-category-input" value="${category}" style="font-weight: bold; width: 60%;" placeholder="Category Name">
                        <button class="remove-btn remove-category-btn">🗑️ Remove</button>
                    </div>
                    <textarea class="skill-values-input" style="height: 60px;">${skills}</textarea>
                 `;
                listDiv.appendChild(div);
            }
            formContainer.appendChild(listDiv);

            const addBtn = document.createElement('button');
            addBtn.textContent = "➕ Add Skill Category";
            addBtn.style.cssText = "width: 100%; padding: 8px; background: #e9ecef; border: 1px dashed #ccc; color: #333; cursor: pointer; margin-top: 10px;";
            addBtn.onclick = () => {
                const div = document.createElement('div');
                div.className = 'item-block';
                div.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <input type="text" class="skill-category-input" value="New Category" style="font-weight: bold; width: 60%;">
                        <button class="remove-btn remove-category-btn">🗑️ Remove</button>
                    </div>
                    <textarea class="skill-values-input" style="height: 60px;"></textarea>
                `;
                listDiv.appendChild(div);
            };
            formContainer.appendChild(addBtn);

            formContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('remove-category-btn')) {
                    e.target.closest('.item-block').remove();
                }
            });
        }
        else if (['experience', 'projects', 'leadership'].includes(section)) {
            if (!data) data = [];
            const listDiv = document.createElement('div');
            listDiv.id = 'itemsList';

            data.forEach(item => renderItemBlock(listDiv, item, section));
            formContainer.appendChild(listDiv);

            let btnLabel = section === 'experience' ? 'Job' : (section === 'projects' ? 'Project' : 'Role');
            const addBtn = document.createElement('button');
            addBtn.textContent = `➕ Add ${btnLabel}`;
            addBtn.style.cssText = "width: 100%; padding: 8px; background: #e9ecef; border: 1px dashed #ccc; color: #333; cursor: pointer; margin-top: 10px;";

            addBtn.onclick = () => {
                let newItem = { bullets: ["New bullet"] };
                if (section === 'experience') newItem = { company: "New Co", role: "Role", location: "", dates: "Dates", bullets: ["New bullet"] };
                if (section === 'projects') newItem = { name: "New Project", tech: "", dates: "", bullets: ["New bullet"] };
                renderItemBlock(listDiv, newItem, section);
            };
            formContainer.appendChild(addBtn);
        }
    }

    function renderItemBlock(container, item, section) {
        const div = document.createElement('div');
        div.className = 'item-block';

        let headerHtml = '';
        if (section === 'experience') {
            headerHtml = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 5px;">
                    <input type="text" class="item-company" value="${item.company || ''}" placeholder="Company">
                    <input type="text" class="item-role" value="${item.role || ''}" placeholder="Role">
                    <input type="text" class="item-location" value="${item.location || ''}" placeholder="Location">
                    <input type="text" class="item-dates" value="${item.dates || ''}" placeholder="Dates">
                </div>`;
        } else if (section === 'projects') {
            headerHtml = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 5px;">
                    <input type="text" class="item-name" value="${item.name || ''}" placeholder="Project Name">
                    <input type="text" class="item-tech" value="${item.tech || ''}" placeholder="Technologies">
                    <input type="text" class="item-dates" value="${item.dates || ''}" placeholder="Dates" style="grid-column: span 2;">
                </div>`;
        } // leadership similar if needed

        let bulletsHtml = '';
        (item.bullets || []).forEach(b => bulletsHtml += createBulletRow(b));

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="font-weight: bold; color: #555;">Item</span>
                <button class="remove-btn remove-item-btn">🗑️ Remove</button>
            </div>
            ${headerHtml}
            <div class="edit-field">
                <label>Bullets</label>
                <div class="bullet-list-container">${bulletsHtml}</div>
                <button class="add-bullet-btn" style="font-size: 10px; padding: 2px 5px; margin-top: 5px;">+ Add Bullet</button>
            </div>
        `;

        div.querySelector('.remove-item-btn').onclick = () => div.remove();
        const bContainer = div.querySelector('.bullet-list-container');
        div.querySelector('.add-bullet-btn').onclick = () => {
            bContainer.insertAdjacentHTML('beforeend', createBulletRow(""));
        };
        bContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-bullet-btn')) e.target.closest('.bullet-item').remove();
        });
        container.appendChild(div);
    }

    function createBulletRow(text) {
        const safeText = text ? text.replace(/"/g, '&quot;') : '';
        return `<div class="bullet-item" style="display: grid; grid-template-columns: 1fr auto; gap: 5px; margin-bottom: 5px; width: 100%;">
                    <textarea class="bullet-input" style="width: 100%; height: 50px; resize: vertical; padding: 5px;">${safeText}</textarea>
                    <button class="remove-btn remove-bullet-btn">❌</button>
                </div>`;
    }

    function parseEditor(section) {
        if (!formContainer) return null;

        if (section === 'summary') {
            const el = document.getElementById('edit_summary_text');
            return el ? el.value : '';
        } else if (section === 'contact') {
            const inputs = formContainer.querySelectorAll('.contact-input');
            const data = {};
            inputs.forEach(i => { if (i.value) data[i.dataset.key] = i.value; });
            return data;
        } else if (section === 'skills') {
            const blocks = formContainer.querySelectorAll('.item-block');
            const skills = {};
            blocks.forEach(b => {
                const k = b.querySelector('.skill-category-input').value;
                const v = b.querySelector('.skill-values-input').value;
                if (k) skills[k] = v;
            });
            return skills;
        } else if (['experience', 'projects'].includes(section)) {
            const blocks = formContainer.querySelectorAll('.item-block');
            const list = [];
            blocks.forEach(b => {
                const getVal = (c) => (b.querySelector(c) || {}).value || "";
                let item = {};
                if (section === 'experience') {
                    item.company = getVal('.item-company');
                    item.role = getVal('.item-role');
                    item.location = getVal('.item-location');
                    item.dates = getVal('.item-dates');
                } else {
                    item.name = getVal('.item-name');
                    item.tech = getVal('.item-tech');
                    item.dates = getVal('.item-dates');
                }
                const bInputs = b.querySelectorAll('.bullet-input');
                item.bullets = Array.from(bInputs).map(i => i.value).filter(t => t.trim().length > 0);
                list.push(item);
            });
            return list;
        }
        return null;
    }

    saveRegenBtn.addEventListener('click', async () => {
        // Save final section
        const section = sectionSelect.value;
        const currentData = parseEditor(section);
        if (currentData !== null) currentEditingData[section] = currentData;

        tailoredResume = currentEditingData; // Update global state

        saveRegenBtn.disabled = true;
        saveRegenBtn.textContent = "Regenerating PDF...";

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
                    filename: 'Resume_Revised.pdf'
                });
            };

            showStatus("Resume updated!", "success");
            editorUI.style.display = 'none';
            actionsDiv.style.display = 'block';

        } catch (e) {
            showStatus("Error regenerating: " + e.message, "error");
        } finally {
            saveRegenBtn.disabled = false;
            saveRegenBtn.textContent = "Save & Regenerate";
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
