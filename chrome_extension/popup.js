
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
    const analysisResults = document.getElementById('analysisResults');
    const atsScoreDisplay = document.getElementById('atsScore');
    const analysisDetails = document.getElementById('analysisDetails');
    const actionsDiv = document.getElementById('actions');
    const previewBtn = document.getElementById('previewBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    // Tailoring Strategy Slider elements (must be declared early)
    const tailoringSlider = document.getElementById('tailoringSlider');
    const strategyDescription = document.getElementById('strategyDescription');

    // State
    let currentJdText = "";
    let baseResume = null;
    let tailoredResume = null;
    let currentApiKey = "";
    let currentGroqKey = "";
    let currentProvider = "gemini";
    let hasAnalyzed = false; // Track if analysis has been performed
    let tailoringStrategy = "balanced"; // Track tailoring strategy: profile_focus, balanced, jd_focus
    let currentJdAnalysis = null; // Store JD analysis for regeneration
    let currentEditingData = null; // Top-level state for bullet/editor preferences

    // 1. Initialization
    await loadState();

    async function loadState() {
        const data = await chrome.storage.local.get(['gemini_api_key', 'groq_api_key', 'provider', 'base_resume', 'user_profile_name', 'tailoring_strategy']);

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

        // Load Tailoring Strategy
        if (data.tailoring_strategy) {
            tailoringStrategy = data.tailoring_strategy;
            const sliderValue = tailoringStrategy === 'profile_focus' ? 0 : tailoringStrategy === 'balanced' ? 1 : 2;
            if (tailoringSlider) {
                tailoringSlider.value = sliderValue;
            }
            updateStrategyDescription(sliderValue);
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

    function updateStrategyDescription(value) {
        const descriptions = [
            '📝 Profile Focus - Preserves original content, minimal keyword forcing',
            '⚖️ Balanced - Integrates JD keywords while maintaining authenticity',
            '🎯 JD Focus - Aggressive keyword matching for maximum ATS score'
        ];
        if (strategyDescription) {
            strategyDescription.textContent = descriptions[value];
        }
    }

    tailoringSlider.addEventListener('input', async (e) => {
        const value = parseInt(e.target.value);
        updateStrategyDescription(value);

        // Map slider value to strategy name
        const strategies = ['profile_focus', 'balanced', 'jd_focus'];
        tailoringStrategy = strategies[value];

        // Save to storage
        await chrome.storage.local.set({ tailoring_strategy: tailoringStrategy });
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

    function showMain() {
        const profileUI = document.getElementById('profileUI');
        settingsUI.style.display = 'none';
        setupUI.style.display = 'none';
        profileUI.style.display = 'none';

        // Ensure editor is hidden
        if (typeof editorUI !== 'undefined') editorUI.style.display = 'none';

        mainUI.style.display = 'block';

        // Restore actions if resume exists
        if (typeof tailoredResume !== 'undefined' && tailoredResume) {
            actionsDiv.style.display = 'block';
        } else {
            actionsDiv.style.display = 'none';
        }
    }

    // Back button handlers
    document.getElementById('backFromSettings').addEventListener('click', () => {
        showMain();
    });

    document.getElementById('backFromSetup').addEventListener('click', () => {
        showMain();
    });

    document.getElementById('backFromProfile').addEventListener('click', () => {
        showMain();
    });

    // Profile Toggle
    document.getElementById('profileToggle').addEventListener('click', () => {
        const profileUI = document.getElementById('profileUI');
        const settingsUI = document.getElementById('settingsUI');
        const mainUI = document.getElementById('mainUI');
        const setupUI = document.getElementById('setupUI');

        profileUI.style.display = 'block';
        settingsUI.style.display = 'none';
        mainUI.style.display = 'none';
        setupUI.style.display = 'none';

        // Load current profile into editor
        renderProfileEditor('contact');
    });

    // Profile Section Selector
    document.getElementById('profileSectionSelect').addEventListener('change', (e) => {
        renderProfileEditor(e.target.value);
    });

    // Profile Editor Rendering (reuse editor logic)
    function renderProfileEditor(section) {
        const container = document.getElementById('profileFormContainer');
        if (!baseResume) {
            container.innerHTML = '<p style="font-size: 11px; color: #999;">No profile data loaded.</p>';
            return;
        }

        let html = '';

        if (section === 'contact') {
            const contact = baseResume.contact || {};
            html = `
                <div class="edit-field">
                    <label>Location</label>
                    <input type="text" data-field="contact.location" value="${contact.location || ''}" placeholder="City, State">
                </div>
                <div class="edit-field">
                    <label>Phone</label>
                    <input type="text" data-field="contact.phone" value="${contact.phone || ''}" placeholder="Phone Number">
                </div>
                <div class="edit-field">
                    <label>Email</label>
                    <input type="text" data-field="contact.email" value="${contact.email || ''}" placeholder="Email">
                </div>
                <div class="edit-field">
                    <label>LinkedIn URL</label>
                    <input type="text" data-field="contact.linkedin_url" value="${contact.linkedin_url || ''}" placeholder="LinkedIn URL">
                </div>
                <div class="edit-field">
                    <label>Portfolio URL</label>
                    <input type="text" data-field="contact.portfolio_url" value="${contact.portfolio_url || ''}" placeholder="Portfolio URL">
                </div>
            `;
        } else if (section === 'education') {
            const education = baseResume.education || [];
            education.forEach((edu, idx) => {
                html += `
                    <div style="border: 1px solid #ddd; padding: 8px; margin-bottom: 8px; border-radius: 4px;">
                        <strong style="font-size: 12px;">${edu.institution || 'Education'} #${idx + 1}</strong>
                        <div class="edit-field">
                            <label>Institution</label>
                            <input type="text" data-field="education.${idx}.institution" value="${edu.institution || ''}" placeholder="University Name">
                        </div>
                        <div class="edit-field">
                            <label>Degree</label>
                            <input type="text" data-field="education.${idx}.degree" value="${(edu.degree || '').replace(/"/g, '&quot;')}" placeholder="Degree/Major">
                        </div>
                        <div class="edit-field">
                            <label>GPA</label>
                            <input type="text" data-field="education.${idx}.gpa" value="${(edu.gpa || '').replace(/"/g, '&quot;')}" placeholder="GPA">
                        </div>
                        <div class="edit-field">
                            <label>Dates</label>
                            <input type="text" data-field="education.${idx}.dates" value="${(edu.dates || '').replace(/"/g, '&quot;')}" placeholder="e.g., 2016 - 2020">
                        </div>
                    </div>
                `;
            });
        } else if (section === 'experience') {
            const experiences = baseResume.experience || [];
            experiences.forEach((exp, idx) => {
                html += `
                    <div style="border: 1px solid #ddd; padding: 8px; margin-bottom: 8px; border-radius: 4px;">
                        <strong style="font-size: 12px;">${exp.company || 'Experience'} #${idx + 1}</strong>
                        <div class="edit-field">
                            <label>Company</label>
                            <input type="text" data-field="experience.${idx}.company" value="${exp.company || ''}" placeholder="Company Name">
                        </div>
                        <div class="edit-field">
                            <label>Role</label>
                            <input type="text" data-field="experience.${idx}.role" value="${(exp.role || exp.title || exp.position || exp.job_title || '').replace(/"/g, '&quot;')}" placeholder="Job Title">
                        </div>
                        <div class="edit-field">
                            <label>Dates</label>
                            <input type="text" data-field="experience.${idx}.dates" value="${(exp.dates || '').replace(/"/g, '&quot;')}" placeholder="e.g., Jan 2020 - Present">
                        </div>
                        <div class="edit-field">
                            <label>Bullets (one per line)</label>
                            <textarea data-field="experience.${idx}.bullets" rows="4" placeholder="Enter bullet points, one per line">${(exp.bullets || []).join('\\n')}</textarea>
                        </div>
                    </div>
                `;
            });
        } else if (section === 'skills') {
            const skills = baseResume.skills || {};
            let idx = 0;
            Object.entries(skills).forEach(([category, items]) => {
                html += `
                    <div style="border: 1px solid #ddd; padding: 8px; margin-bottom: 8px; border-radius: 4px;">
                        <div class="edit-field">
                            <label>Category Name</label>
                            <input type="text" data-field="skills.${category}" data-category="${category}" value="${category}" placeholder="e.g., Languages" readonly>
                        </div>
                        <div class="edit-field">
                            <label>Skills (comma-separated)</label>
                            <textarea data-field="skills.${category}" rows="2" placeholder="Python, JavaScript, etc.">${items || ''}</textarea>
                        </div>
                    </div>
                `;
                idx++;
            });
        } else if (section === 'projects') {
            const projects = baseResume.projects || [];
            projects.forEach((proj, idx) => {
                html += `
                    <div style="border: 1px solid #ddd; padding: 8px; margin-bottom: 8px; border-radius: 4px;">
                        <strong style="font-size: 12px;">${proj.name || 'Project'} #${idx + 1}</strong>
                        <div class="edit-field">
                            <label>Project Name</label>
                            <input type="text" data-field="projects.${idx}.name" value="${proj.name || ''}" placeholder="Project Name">
                        </div>
                         <div class="edit-field">
                            <label>Dates</label>
                            <input type="text" data-field="projects.${idx}.dates" value="${(proj.dates || '').replace(/"/g, '&quot;')}" placeholder="Date Range">
                        </div>
                        <div class="edit-field">
                            <label>Bullets (one per line)</label>
                            <textarea data-field="projects.${idx}.bullets" rows="3" placeholder="Enter bullet points, one per line">${(proj.bullets || []).join('\\n')}</textarea>
                        </div>
                    </div>
                `;
            });
        } else if (section === 'leadership') {
            const leadership = baseResume.leadership || [];
            leadership.forEach((lead, idx) => {
                html += `
                    <div style="border: 1px solid #ddd; padding: 8px; margin-bottom: 8px; border-radius: 4px;">
                        <div class="edit-field">
                            <label>Role</label>
                            <input type="text" data-field="leadership.${idx}.role" value="${(lead.role || lead.title || lead.position || '').replace(/"/g, '&quot;')}" placeholder="Leadership Role">
                        </div>
                        <div class="edit-field">
                            <label>Dates</label>
                            <input type="text" data-field="leadership.${idx}.dates" value="${(lead.dates || '').replace(/"/g, '&quot;')}" placeholder="e.g., 2020 - 2021">
                        </div>
                        <div class="edit-field">
                            <label>Description (one per line)</label>
                            <textarea data-field="leadership.${idx}.bullets" rows="2" placeholder="Description/Bullets">${(lead.bullets || []).join('\\n')}</textarea>
                        </div>
                    </div>
                `;
            });
        } else if (section === 'research') {
            const research = baseResume.research || [];
            research.forEach((paper, idx) => {
                html += `
                    <div style="border: 1px solid #ddd; padding: 8px; margin-bottom: 8px; border-radius: 4px;">
                        <strong style="font-size: 12px;">${paper.title || 'Research Paper'} #${idx + 1}</strong>
                        <div class="edit-field">
                            <label>Paper Title</label>
                            <input type="text" data-field="research.${idx}.title" value="${paper.title || ''}" placeholder="Paper Title">
                        </div>
                        <div class="edit-field">
                            <label>Conference/Journal</label>
                            <input type="text" data-field="research.${idx}.conference" value="${paper.conference || ''}" placeholder="Conference or Journal Name">
                        </div>
                        <div class="edit-field">
                            <label>Link</label>
                            <input type="text" data-field="research.${idx}.link" value="${paper.link || ''}" placeholder="URL to paper">
                        </div>
                        <div class="edit-field">
                            <label>Date</label>
                            <input type="text" data-field="research.${idx}.dates" value="${(paper.dates || '').replace(/"/g, '&quot;')}" placeholder="Publication Date">
                        </div>
                        <div class="edit-field">
                            <label>Bullets (one per line)</label>
                            <textarea data-field="research.${idx}.bullets" rows="2" placeholder="Key points about the research">${(paper.bullets || []).join('\\n')}</textarea>
                        </div>
                    </div>
                `;
            });
            const hasItems = (baseResume.research && baseResume.research.length > 0);
            if (hasItems) {
                html = `
                    <div style="margin-bottom: 20px; padding: 10px; background: #eef; border-radius: 4px; border: 1px solid #cce;">
                        <p style="margin: 0 0 10px 0; font-size: 11px; color: #557;">Prefer to list these as Projects instead?</p>
                        <button id="moveResearchToProjectsBtn" class="secondary-btn" style="width: 100%;">Move All Research to Projects Section</button>
                    </div>
                ` + html;
            }
        }

        container.innerHTML = html || '<p style="font-size: 11px; color: #999;">No data for this section.</p>';

        // Add "Add Item" buttons for list sections
        if (['experience', 'projects', 'leadership', 'research', 'education'].includes(section)) {
            const addBtn = document.createElement('button');
            const labels = {
                experience: "Experience",
                projects: "Project",
                leadership: "Leadership Role",
                research: "Research Paper",
                education: "Education"
            };
            addBtn.textContent = `➕ Add ${labels[section]}`;
            addBtn.className = "secondary-btn";
            addBtn.style.width = "100%";
            addBtn.style.marginTop = "10px";

            addBtn.onclick = async () => {
                // Initialize empty item based on section
                const newItem = { bullets: ["New bullet point"] };
                if (section === 'experience') Object.assign(newItem, { company: "New Company", role: "Role", location: "", dates: "Dates" });
                if (section === 'education') Object.assign(newItem, { institution: "University Name", degree: "Degree", gpa: "", dates: "Dates", location: "", bullets: [] });
                if (section === 'projects') Object.assign(newItem, { name: "New Project", dates: "Dates" });
                if (section === 'leadership') Object.assign(newItem, { organization: "New Org", role: "Role", dates: "Dates" });
                if (section === 'research') Object.assign(newItem, { title: "New Paper Title", conference: "Conference/Journal", dates: "Date", link: "" });

                if (!baseResume[section]) baseResume[section] = [];
                baseResume[section].push(newItem);

                // Save and re-render
                await chrome.storage.local.set({ base_resume: baseResume });
                renderProfileEditor(section);
            };

            container.appendChild(addBtn);
        }

        // Attach event listener for the move button if it exists
        const moveBtn = document.getElementById('moveResearchToProjectsBtn');
        if (moveBtn) {
            moveBtn.addEventListener('click', async () => {
                if (!confirm("This will move all Research items to the Projects section and clear the Research section. Continue?")) return;

                if (!baseResume.projects) baseResume.projects = [];
                const researchItems = baseResume.research || [];

                if (researchItems.length === 0) {
                    alert("No research items to move.");
                    return;
                }

                researchItems.forEach(item => {
                    const newBullets = [...(item.bullets || [])];
                    if (item.conference) newBullets.unshift(`Published in: ${item.conference}`);
                    if (item.link) newBullets.push(`Link: ${item.link}`);

                    baseResume.projects.push({
                        name: item.title || "Research Project",
                        dates: item.dates || "",
                        bullets: newBullets
                    });
                });

                baseResume.research = [];
                await chrome.storage.local.set({ base_resume: baseResume });

                showStatus(`Moved ${researchItems.length} items to Projects.`, 'success', 'profileStatus');

                // Switch to projects view to show the result
                document.getElementById('profileSectionSelect').value = 'projects';
                renderProfileEditor('projects');
            });
        }
    }

    // Save Profile Changes
    document.getElementById('saveProfileBtn').addEventListener('click', async () => {
        const container = document.getElementById('profileFormContainer');
        const inputs = container.querySelectorAll('input, textarea');

        // Parse changes back into baseResume
        inputs.forEach(input => {
            const field = input.dataset.field;
            if (!field) return;

            const parts = field.split('.');
            let obj = baseResume;

            for (let i = 0; i < parts.length - 1; i++) {
                if (!obj[parts[i]]) obj[parts[i]] = {};
                obj = obj[parts[i]];
            }

            const lastKey = parts[parts.length - 1];
            if (input.tagName === 'TEXTAREA' && lastKey === 'bullets') {
                obj[lastKey] = input.value.split('\\n').filter(b => b.trim());
            } else {
                obj[lastKey] = input.value;
            }
        });

        // Save to storage
        await chrome.storage.local.set({ base_resume: baseResume });

        const statusEl = document.getElementById('profileStatus');
        statusEl.textContent = '✅ Profile saved successfully!';
        statusEl.style.color = '#28a745';
        setTimeout(() => {
            statusEl.textContent = '';
            showMain();
        }, 1000);
    });




    // Cancel Profile Edit
    document.getElementById('cancelProfileEditBtn').addEventListener('click', () => {
        showMain();
    });

    // Re-upload Resume
    document.getElementById('reuploadBtn').addEventListener('click', async () => {
        const fileInput = document.getElementById('reuploadResumeFile');
        const file = fileInput.files[0];

        if (!file) {
            showStatus('Please select a PDF file.', 'error', 'profileStatus');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            showStatus('Uploading and parsing resume...', 'info', 'profileStatus');

            const extractResp = await fetch(`${API_BASE_URL}/extract_text`, {
                method: 'POST',
                body: formData
            });
            const extractData = await extractResp.json();
            if (extractData.error) throw new Error(extractData.error);

            const profileResp = await fetch(`${API_BASE_URL}/extract_base_profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: extractData.text,
                    api_key: currentProvider === 'groq' ? currentGroqKey : currentApiKey,
                    provider: currentProvider
                })
            });
            const profileData = await profileResp.json();
            if (profileData.error) throw new Error(profileData.error);

            baseResume = profileData;
            await chrome.storage.local.set({ base_resume: baseResume });

            showStatus('✅ Resume re-uploaded and profile updated!', 'success', 'profileStatus');
            renderProfileEditor(document.getElementById('profileSectionSelect').value);

        } catch (e) {
            showStatus(`Error: ${e.message}`, 'error', 'profileStatus');
        }
    });

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


    // --- Manual Text Input Logic ---

    async function processManualText(text, btnElement, statusElementId) {
        if (!text || text.length < 50) {
            showStatus("Please enter at least 50 characters of resume text.", "error", statusElementId);
            return;
        }

        if (!checkCurrentProviderKey()) {
            showStatus("Please save your API Key in settings first.", "error", statusElementId);
            return;
        }

        btnElement.disabled = true;
        showStatus("Processing text... please wait.", "info", statusElementId);

        try {
            let extractionKey = currentProvider === 'groq' ? currentGroqKey : currentApiKey;

            const profileResp = await fetch(`${API_BASE_URL}/extract_base_profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
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

            showStatus("✅ Profile updated successfully!", "success", statusElementId);

            setTimeout(() => {
                showMainUI();
                // Clear inputs
                document.getElementById('resumeTextInit').value = '';
                document.getElementById('reuploadResumeText').value = '';
            }, 1000);

        } catch (e) {
            showStatus(`Error: ${e.message}`, "error", statusElementId);
        } finally {
            btnElement.disabled = false;
        }
    }

    document.getElementById('processTextInitBtn').addEventListener('click', () => {
        const text = document.getElementById('resumeTextInit').value;
        processManualText(text, document.getElementById('processTextInitBtn'));
    });

    document.getElementById('reuploadTextBtn').addEventListener('click', () => {
        const text = document.getElementById('reuploadResumeText').value;
        processManualText(text, document.getElementById('reuploadTextBtn'), 'profileStatus');
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

        // Reset editor state for fresh generation
        currentEditingData = null;

        const activeKey = currentProvider === 'groq' ? currentGroqKey : currentApiKey;

        try {
            const resp = await fetch(`${API_BASE_URL}/tailor_resume`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    base_resume: baseResume,
                    jd_text: currentJdText,
                    api_key: activeKey,
                    provider: currentProvider,
                    tailoring_strategy: tailoringStrategy
                })
            });

            const data = await resp.json();
            if (data.error) throw new Error(data.error);

            tailoredResume = data.tailored_resume;
            currentJdAnalysis = data.jd_analysis; // Store for regeneration

            // Check for API warnings (fallback usage)
            if (tailoredResume.warning) {
                showStatus(`⚠️ ${tailoredResume.warning}`, "warning");
                // Keep warning visible for a moment before "Generating PDF"
                await new Promise(r => setTimeout(r, 2000));

                // Remove warning from object to avoid cluttering PDF data (though likely ignored)
                delete tailoredResume.warning;
            }

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

    // Generate Base Resume (No AI)
    const generateBaseBtn = document.getElementById('generateBaseBtn');
    if (generateBaseBtn) {
        generateBaseBtn.addEventListener('click', async () => {
            if (!baseResume) {
                showStatus("No base resume profile found. Please upload one in the Setup tab.", "error");
                return;
            }

            // Sync state so editing/analysis works on the base resume
            tailoredResume = JSON.parse(JSON.stringify(baseResume));
            currentEditingData = tailoredResume; // Also update editor state

            generateBaseBtn.textContent = "Generating...";
            generateBaseBtn.disabled = true;

            try {
                await generateAndDisplayPDF(baseResume);

                showStatus("✅ Base resume generated! You can now Edit or Analyze it.", "success");

                // Show actions
                const actionsDiv = document.getElementById('actions');
                if (actionsDiv) actionsDiv.style.display = 'block';

            } catch (e) {
                showStatus("Error generating base resume: " + e.message, "error");
            } finally {
                generateBaseBtn.textContent = "Generate Base Resume (No AI)";
                generateBaseBtn.disabled = false;
            }
        });
    }

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

    async function performAnalysis(resumeData = tailoredResume) {
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
                    resume_data: resumeData,
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
        const resumeToAnalyze = tailoredResume || baseResume;

        if (!resumeToAnalyze) {
            showStatus("No resume loaded to analyze.", "error");
            return;
        }
        const statusMessage = hasAnalyzed ? "Re-analyzing ATS Score..." : "Analyzing ATS Score...";
        showStatus(statusMessage, "info");

        const success = await performAnalysis(resumeToAnalyze);

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


    // Advanced Editor Logic (see below)

    // currentEditingData is now defined at top-level state
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

    cancelEditBtn.addEventListener('click', () => {
        currentEditingData = null; // discard changes
        editorUI.style.display = 'none';
        if (typeof showMain === 'function') showMain();
        else actionsDiv.style.display = 'block';
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

            // Section Title Input
            const currentTitle = (baseResume.section_titles && baseResume.section_titles[section]) || "Summary";
            div.innerHTML = `
                <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
                    <label>Section Title (vs "Summary")</label>
                    <input type="text" id="sectionTitleInput" value="${currentTitle}" placeholder="Summary">
                </div>
                <label>Summary Text</label>
                <textarea id="edit_summary_text" style="height: 100px;">${data || ''}</textarea>`;
            formContainer.appendChild(div);
        }
        else if (section === 'contact') {
            // ... (Contact doesn't need a section title usually, it's the header)
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
            // ... already handled ...
            if (!data) data = {};

            // Section Title Input
            const titleDiv = document.createElement('div');
            titleDiv.className = 'edit-field';
            titleDiv.style.marginBottom = "15px";
            titleDiv.style.paddingBottom = "10px";
            titleDiv.style.borderBottom = "1px solid #eee";
            const currentTitle = (baseResume.section_titles && baseResume.section_titles[section]) || "Technical Knowledge";
            titleDiv.innerHTML = `<label>Section Title (vs "Technical Knowledge")</label>
                                  <input type="text" id="sectionTitleInput" value="${currentTitle}" placeholder="Technical Knowledge">`;
            formContainer.appendChild(titleDiv);

            const listDiv = document.createElement('div');
            listDiv.id = 'skillsList';

            for (const [category, skills] of Object.entries(data)) {
                renderSkillBlock(listDiv, category, skills);
            }
            formContainer.appendChild(listDiv);

            const addBtn = document.createElement('button');
            addBtn.textContent = "➕ Add Skill Category";
            addBtn.style.cssText = "width: 100%; padding: 8px; background: #e9ecef; border: 1px dashed #ccc; color: #333; cursor: pointer; margin-top: 10px;";
            addBtn.onclick = () => {
                renderSkillBlock(listDiv, "New Category", "");
            };
            formContainer.appendChild(addBtn);

            // Replaces the old delegation listener with individual listeners in renderSkillBlock
            // to ensure consistency with arrow logic
        }

        // Helper for Skills Rendering to support Arrows

        else if (section === 'languages') {
            if (!data) data = "";
            if (Array.isArray(data)) data = data.join(", ");

            const div = document.createElement('div');
            div.className = 'edit-field';
            const currentTitle = (baseResume.section_titles && baseResume.section_titles[section]) || "Languages";
            div.innerHTML = `
                <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
                    <label>Section Title (vs "Languages")</label>
                    <input type="text" id="sectionTitleInput" value="${currentTitle}" placeholder="Languages">
                </div>
                <label>Languages (Comma separated)</label>
                <textarea id="edit_languages_text" style="height: 60px;">${data || ''}</textarea>`;
            formContainer.appendChild(div);
        }
        else if (['experience', 'projects', 'leadership', 'research', 'certifications', 'awards', 'volunteering', 'education'].includes(section)) {
            if (!data) data = [];

            // GENERIC LISTS TITLE INPUT
            const defaultTitles = {
                experience: "Work Experience",
                projects: "Research and Projects",
                leadership: "Leadership Experience",
                research: "Research & Publications",
                certifications: "Certifications",
                awards: "Awards & Honors",
                volunteering: "Volunteering",
                education: "Education"
            };

            const titleDiv = document.createElement('div');
            titleDiv.className = 'edit-field';
            titleDiv.style.marginBottom = "15px";
            titleDiv.style.paddingBottom = "10px";
            titleDiv.style.borderBottom = "1px solid #eee";
            const currentTitle = (baseResume.section_titles && baseResume.section_titles[section]) || defaultTitles[section];
            titleDiv.innerHTML = `<label>Section Title (vs "${defaultTitles[section]}")</label>
                                  <input type="text" id="sectionTitleInput" value="${currentTitle}" placeholder="${defaultTitles[section]}">`;
            formContainer.appendChild(titleDiv);


            const listDiv = document.createElement('div');
            listDiv.id = 'itemsList';

            data.forEach(item => renderItemBlock(listDiv, item, section));
            formContainer.appendChild(listDiv);

            let btnLabel = "Item";
            if (section === 'experience') btnLabel = "Job";
            else if (section === 'projects') btnLabel = "Project";
            else if (section === 'research') btnLabel = "Paper";
            else if (section === 'certifications') btnLabel = "Certification";
            else if (section === 'awards') btnLabel = "Award";
            else if (section === 'volunteering') btnLabel = "Volunteering";
            else if (section === 'education') btnLabel = "School";

            const addBtn = document.createElement('button');
            addBtn.textContent = `➕ Add ${btnLabel}`;
            addBtn.style.cssText = "width: 100%; padding: 8px; background: #e9ecef; border: 1px dashed #ccc; color: #333; cursor: pointer; margin-top: 10px;";

            addBtn.onclick = () => {
                let newItem = { bullets: ["New bullet"] };
                if (section === 'experience') newItem = { company: "New Co", role: "Role", location: "", dates: "Dates", bullets: ["New bullet"] };
                if (section === 'leadership') newItem = { organization: "New Org", role: "Role", location: "", dates: "Dates", bullets: ["New bullet"] };
                if (section === 'research') newItem = { title: "New Paper", conference: "Conference", link: "", dates: "Date", bullets: ["New bullet"] };
                if (section === 'projects') newItem = { name: "New Project", tech: "", dates: "", bullets: ["New bullet"] };
                if (section === 'volunteering') newItem = { organization: "Organization", role: "Volunteer", location: "", dates: "", bullets: ["New bullet"] };
                if (section === 'certifications') newItem = { name: "Certification Name", issuer: "Issuer", dates: "Date" };
                if (section === 'education') newItem = { institution: "University Name", degree: "Degree", gpa: "", location: "", dates: "Dates", bullets: [] };

                renderItemBlock(listDiv, newItem, section);
            };
            formContainer.appendChild(addBtn);

            const removeSectionBtn = document.createElement('button');
            removeSectionBtn.textContent = `🗑️ Remove Entire ${btnLabel} Section`;
            removeSectionBtn.style.cssText = "width: 100%; padding: 8px; background: #ffebee; border: 1px dashed #ffcdd2; color: #c62828; cursor: pointer; margin-top: 5px;";
            removeSectionBtn.onclick = () => {
                if (confirm(`Are you sure you want to remove the entire '${section}' section?`)) {
                    // clear list
                    const listDiv = document.getElementById('itemsList');
                    listDiv.innerHTML = '';
                }
            };
            formContainer.appendChild(removeSectionBtn);
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
        } else if (section === 'leadership' || section === 'volunteering') {
            headerHtml = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 5px;">
                    <input type="text" class="item-org" value="${item.organization || ''}" placeholder="Organization">
                    <input type="text" class="item-role" value="${item.role || ''}" placeholder="Role">
                    <input type="text" class="item-location" value="${item.location || ''}" placeholder="Location">
                    <input type="text" class="item-dates" value="${item.dates || ''}" placeholder="Dates">
                </div>`;
        } else if (section === 'research') {
            headerHtml = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 5px;">
                    <input type="text" class="item-title" value="${item.title || ''}" placeholder="Paper Title" style="font-weight:bold;">
                    <input type="text" class="item-conference" value="${item.conference || ''}" placeholder="Conference/Journal">
                    <input type="text" class="item-link" value="${item.link || ''}" placeholder="Link (URL)">
                    <input type="text" class="item-dates" value="${item.dates || ''}" placeholder="Dates">
                </div>`;
        } else if (section === 'certifications') {
            headerHtml = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 5px;">
                    <input type="text" class="item-name" value="${item.name || ''}" placeholder="Certification Name" style="font-weight:bold;">
                    <input type="text" class="item-issuer" value="${item.issuer || ''}" placeholder="Issuer">
                    <input type="text" class="item-dates" value="${item.dates || ''}" placeholder="Date" style="grid-column: span 2;">
                </div>`;
        } else if (section === 'awards') {
            headerHtml = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 5px;">
                    <input type="text" class="item-name" value="${item.name || ''}" placeholder="Award Name" style="font-weight:bold;">
                    <input type="text" class="item-org" value="${item.organization || ''}" placeholder="Organization">
                    <input type="text" class="item-dates" value="${item.dates || ''}" placeholder="Date" style="grid-column: span 2;">
                </div>`;
        } else if (section === 'education') {
            headerHtml = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 5px;">
                    <input type="text" class="item-institution" value="${item.institution || ''}" placeholder="Institution" style="font-weight:bold;">
                    <input type="text" class="item-degree" value="${item.degree || ''}" placeholder="Degree/Major">
                    <input type="text" class="item-gpa" value="${item.gpa || ''}" placeholder="GPA">
                    <input type="text" class="item-location" value="${item.location || ''}" placeholder="Location">
                    <input type="text" class="item-dates" value="${item.dates || ''}" placeholder="Dates" style="grid-column: span 2;">
                </div>`;
        }

        let bulletsHtml = '';
        const hasBullets = !['certifications', 'awards', 'education'].includes(section);

        if (hasBullets) {
            (item.bullets || []).forEach(b => bulletsHtml += createBulletRow(b));
        }

        // Get current bullet count
        const currentBulletCount = item.bullet_count_preference !== undefined
            ? item.bullet_count_preference
            : (item.bullets || []).length;

        const bulletControls = hasBullets ? `
             <div style="display: flex; gap: 10px; align-items: center;">
                <label style="font-size: 11px; display: flex; align-items: center; gap: 5px;">
                    📊 Bullets:
                    <button class="bullet-count-decrease" style="width: 24px; height: 24px; padding: 0; font-size: 16px; cursor: pointer; border: 1px solid #ccc; background: #f5f5f5; border-radius: 3px;" title="Decrease bullets">−</button>
                    <span class="bullet-count-display" style="min-width: 20px; text-align: center; font-weight: bold;">${currentBulletCount}</span>
                    <button class="bullet-count-increase" style="width: 24px; height: 24px; padding: 0; font-size: 16px; cursor: pointer; border: 1px solid #ccc; background: #f5f5f5; border-radius: 3px;" title="Increase bullets">+</button>
                    <input type="hidden" class="bullet-count-input" value="${currentBulletCount}">
                </label>
                <div style="display:flex; gap:2px;">
                    <button class="move-up-btn" title="Move Up" style="cursor:pointer; padding:2px 6px;">⬆️</button>
                    <button class="move-down-btn" title="Move Down" style="cursor:pointer; padding:2px 6px;">⬇️</button>
                </div>
                <button class="remove-btn remove-item-btn">🗑️ Remove</button>
            </div>
        ` : `
            <div style="display:flex; gap:10px; align-items:center;">
                 <div style="display:flex; gap:2px;">
                    <button class="move-up-btn" title="Move Up" style="cursor:pointer; padding:2px 6px;">⬆️</button>
                    <button class="move-down-btn" title="Move Down" style="cursor:pointer; padding:2px 6px;">⬇️</button>
                </div>
                <button class="remove-btn remove-item-btn">🗑️ Remove</button>
            </div>
        `;

        div.innerHTML = `
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <span class="item-handle" style="cursor:grab; font-size:16px; color:#aaa; user-select:none;">☰</span>
                                        <span style="font-weight: bold; color: #555;">Item</span>
                                    </div>
                                    ${bulletControls}
                                </div>
                                ${headerHtml}
                                ${hasBullets ? `
                                <div class="edit-field">
                                    <label>Bullets</label>
                                    <div class="bullet-list-container">${bulletsHtml}</div>
                                    <button class="add-bullet-btn" style="font-size: 10px; padding: 2px 5px; margin-top: 5px;">+ Add Bullet</button>
                                </div>` : ''}
                                `;

        div.querySelector('.remove-item-btn').onclick = () => {
            div.remove();
            updateArrowVisibility(container);
        };

        // Remove Drag & Drop listeners (replaced with arrows)
        // div.setAttribute('draggable', 'true');
        // div.addEventListener('dragstart', handleItemDragStart);
        // div.addEventListener('dragover', handleItemDragOver);
        // div.addEventListener('drop', handleItemDrop);
        // div.addEventListener('dragenter', handleItemDragEnter);
        // div.addEventListener('dragleave', handleItemDragLeave);
        // div.addEventListener('dragend', handleItemDragEnd);

        // Arrow Logic
        const upBtn = div.querySelector('.move-up-btn');
        const downBtn = div.querySelector('.move-down-btn');

        if (upBtn) upBtn.onclick = () => {
            if (div.previousElementSibling) {
                div.parentNode.insertBefore(div, div.previousElementSibling);
                updateArrowVisibility(container);
            }
        };

        if (downBtn) downBtn.onclick = () => {
            if (div.nextElementSibling) {
                div.parentNode.insertBefore(div.nextElementSibling, div); // Insert next before current = swap
                updateArrowVisibility(container);
            }
        };

        if (hasBullets) {
            const bContainer = div.querySelector('.bullet-list-container');
            div.querySelector('.add-bullet-btn').onclick = () => {
                bContainer.insertAdjacentHTML('beforeend', createBulletRow(""));
            };
            bContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('remove-bullet-btn')) e.target.closest('.bullet-item').remove();
            });

            // +/- button handlers
            const countInput = div.querySelector('.bullet-count-input');
            const countDisplay = div.querySelector('.bullet-count-display');
            const decreaseBtn = div.querySelector('.bullet-count-decrease');
            const increaseBtn = div.querySelector('.bullet-count-increase');

            decreaseBtn.onclick = () => {
                let count = parseInt(countInput.value) || 0;
                if (count > 0) {
                    count--;
                    countInput.value = count;
                    countDisplay.textContent = count;
                }
            };

            increaseBtn.onclick = () => {
                let count = parseInt(countInput.value) || 0;
                if (count < 5) {
                    count++;
                    countInput.value = count;
                    countDisplay.textContent = count;
                }
            };
        }

        container.appendChild(div);
        updateArrowVisibility(container);
    }

    function updateArrowVisibility(container) {
        const items = container.querySelectorAll('.item-block');
        items.forEach((item, index) => {
            const upBtn = item.querySelector('.move-up-btn');
            const downBtn = item.querySelector('.move-down-btn');

            if (upBtn) upBtn.style.visibility = index === 0 ? 'hidden' : 'visible';
            if (downBtn) downBtn.style.visibility = index === items.length - 1 ? 'hidden' : 'visible';
        });
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
        } else if (section === 'languages') {
            const el = document.getElementById('edit_languages_text');
            // Save Title
            const titleInput = document.getElementById('sectionTitleInput');
            if (titleInput && currentEditingData) {
                if (!currentEditingData.section_titles) currentEditingData.section_titles = {};
                currentEditingData.section_titles[section] = titleInput.value;
            }
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

            // Save Title
            const titleInput = document.getElementById('sectionTitleInput');
            if (titleInput && currentEditingData) {
                if (!currentEditingData.section_titles) currentEditingData.section_titles = {};
                currentEditingData.section_titles[section] = titleInput.value;
            }

            return skills;
        } else if (['experience', 'projects', 'leadership', 'research', 'certifications', 'awards', 'volunteering', 'education'].includes(section)) {
            // Save Title
            const titleInput = document.getElementById('sectionTitleInput');
            if (titleInput && currentEditingData) {
                if (!currentEditingData.section_titles) currentEditingData.section_titles = {};
                currentEditingData.section_titles[section] = titleInput.value;
            }

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
                } else if (section === 'leadership' || section === 'volunteering') {
                    item.organization = getVal('.item-org');
                    item.role = getVal('.item-role');
                    item.location = getVal('.item-location');
                    item.dates = getVal('.item-dates');
                } else if (section === 'research') {
                    item.title = getVal('.item-title');
                    item.conference = getVal('.item-conference');
                    item.link = getVal('.item-link');
                    item.dates = getVal('.item-dates');
                } else if (section === 'certifications') {
                    item.name = getVal('.item-name');
                    item.issuer = getVal('.item-issuer');
                    item.dates = getVal('.item-dates');
                } else if (section === 'awards') {
                    item.name = getVal('.item-name');
                    item.organization = getVal('.item-org');
                    item.dates = getVal('.item-dates');
                } else if (section === 'education') {
                    item.institution = getVal('.item-institution');
                    item.degree = getVal('.item-degree');
                    item.gpa = getVal('.item-gpa');
                    item.location = getVal('.item-location');
                    item.dates = getVal('.item-dates');
                } else {
                    item.name = getVal('.item-name');
                    item.tech = getVal('.item-tech');
                    item.dates = getVal('.item-dates');
                }

                // Only sections with bullets
                if (!['certifications', 'awards', 'education'].includes(section)) {
                    const bInputs = b.querySelectorAll('.bullet-input');
                    item.bullets = Array.from(bInputs).map(i => i.value).filter(t => t.trim().length > 0);

                    // Capture bullet count preference
                    const countInput = b.querySelector('.bullet-count-input');
                    if (countInput) {
                        item.bullet_count_preference = parseInt(countInput.value) || item.bullets.length;
                    }
                }

                list.push(item);
            });
            return list;
        }
        return null;
    }

    /**
     * Collect bullet count preferences from the UI.
     * Returns object like: {experience: [3, 4, 2], projects: [3, 0, 2]}
     */
    function collectBulletCounts() {
        const bulletCounts = {
            experience: [],
            projects: [],
            leadership: [],
            research: []
        };

        // Get current section being edited
        const section = sectionSelect.value;
        const trackedSections = ['experience', 'projects', 'leadership', 'research'];

        // If currently editing one of these sections, scrape values from DOM
        if (trackedSections.includes(section)) {
            const itemBlocks = formContainer.querySelectorAll('.item-block');
            itemBlocks.forEach(block => {
                const countInput = block.querySelector('.bullet-count-input');
                if (countInput) {
                    const count = parseInt(countInput.value) || 0;
                    bulletCounts[section].push(count);
                }
            });
        }

        // For sections NOT being edited, rely on currentEditingData or tailoredResume
        trackedSections.forEach(sec => {
            if (sec !== section) {
                // Priority 1: Check currentEditingData (contains latest user save)
                if (currentEditingData && currentEditingData[sec]) {
                    bulletCounts[sec] = currentEditingData[sec].map(item => {
                        return item.bullet_count_preference !== undefined
                            ? parseInt(item.bullet_count_preference)
                            : (item.bullets || []).length;
                    });
                }
                // Priority 2: Fallback to tailoredResume (previous generation)
                else if (tailoredResume && tailoredResume[sec]) {
                    bulletCounts[sec] = tailoredResume[sec].map(item =>
                        (item.bullets || []).length
                    );
                }
            }
        });

        return bulletCounts;
    }

    async function generateAndDisplayPDF(resumeData, statusId = "status") {
        try {
            showStatus("Generating PDF...", "info", statusId);

            const pdfResp = await fetch(`${API_BASE_URL}/generate_pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resume_data: resumeData })
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

            showStatus("✅ Resume updated successfully!", "success", statusId);

            // Reset editor state and return to main view
            currentEditingData = null;
            if (typeof editorUI !== 'undefined') editorUI.style.display = 'none';
            if (typeof showMain === 'function') showMain();
            else actionsDiv.style.display = 'block';
            actionsDiv.style.display = 'block';

        } catch (e) {
            showStatus("Error generating PDF: " + e.message, "error", statusId);
        }
    }

    const saveManualBtn = document.getElementById('saveManualBtn');
    if (saveManualBtn) {
        saveManualBtn.addEventListener('click', async () => {
            // Save current section to state
            const section = sectionSelect.value;
            const currentData = parseEditor(section);
            if (currentData !== null) currentEditingData[section] = currentData;
            tailoredResume = currentEditingData; // Update global state

            saveManualBtn.disabled = true;
            saveManualBtn.textContent = "Saving...";

            await generateAndDisplayPDF(tailoredResume);

            saveManualBtn.disabled = false;
            saveManualBtn.textContent = "Save Changes";
        });
    }

    saveRegenBtn.addEventListener('click', async () => {
        // Save final section
        const section = sectionSelect.value;
        const currentData = parseEditor(section);
        if (currentData !== null) currentEditingData[section] = currentData;

        tailoredResume = currentEditingData; // Update global state

        saveRegenBtn.disabled = true;
        saveRegenBtn.textContent = "Adjusting bullets...";

        try {
            // Collect bullet count preferences from UI
            const bulletCounts = collectBulletCounts();

            // Check if user changed any bullet counts
            const hasChanges = Object.values(bulletCounts).some(counts =>
                counts.some((count, idx) => {
                    const section = Object.keys(bulletCounts).find(k => bulletCounts[k] === counts);
                    const items = tailoredResume[section] || [];
                    return count !== (items[idx]?.bullets?.length || 0);
                })
            );

            let finalResume = tailoredResume;

            // If bullet counts changed, call regenerate API
            if (hasChanges && currentJdAnalysis) {
                saveRegenBtn.textContent = "Regenerating content...";

                const activeKey = currentProvider === 'groq' ? currentGroqKey : currentApiKey;

                const regenResp = await fetch(`${API_BASE_URL}/regenerate_resume`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tailored_resume: tailoredResume,
                        bullet_counts: bulletCounts,
                        jd_analysis: currentJdAnalysis,
                        api_key: activeKey,
                        provider: currentProvider,
                        tailoring_strategy: tailoringStrategy
                    })
                });

                const regenData = await regenResp.json();
                if (regenData.error) throw new Error(regenData.error);

                finalResume = regenData.resume;
                tailoredResume = finalResume; // Update global state
            }

            // Generate PDF with final resume
            await generateAndDisplayPDF(finalResume);

        } catch (e) {
            showStatus("Error regenerating: " + e.message, "error");
        } finally {
            saveRegenBtn.disabled = false;
            saveRegenBtn.textContent = "Save & Regenerate";
        }
    });

    // 8. Q&A Logic
    const askBtn = document.getElementById('askBtn');
    const questionInput = document.getElementById('questionInput');
    const answerOutput = document.getElementById('answerOutput');

    askBtn.addEventListener('click', async () => {
        const question = questionInput.value.trim();
        if (!question) {
            showStatus("Please enter a question.", "error");
            return;
        }

        if (!currentJdText) {
            showStatus("No job description detected. Navigate to a job posting first.", "error");
            return;
        }

        const resumeData = tailoredResume || baseResume;
        if (!resumeData) {
            showStatus("No resume data available. Generate a resume first.", "error");
            return;
        }

        askBtn.disabled = true;
        askBtn.textContent = "Thinking...";
        answerOutput.style.display = 'none';

        const activeKey = currentProvider === 'groq' ? currentGroqKey : currentApiKey;

        try {
            const resp = await fetch(`${API_BASE_URL}/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: question,
                    resume_data: resumeData,
                    jd_text: currentJdText,
                    api_key: activeKey,
                    provider: currentProvider
                })
            });

            const data = await resp.json();

            if (data.error) {
                showStatus(`Q&A Error: ${data.error}`, "error");
                return;
            }

            answerOutput.textContent = data.answer || "No answer received.";
            answerOutput.style.display = 'block';
            showStatus("", "");

        } catch (e) {
            console.error("Q&A Failed", e);
            showStatus(`Q&A Failed: ${e.message}`, "error");
        } finally {
            askBtn.disabled = false;
            askBtn.textContent = "Ask Question";
        }
    });

    // Helper
    function showStatus(msg, type, elementId = "status") {
        const el = document.getElementById(elementId);
        el.className = type;
        el.textContent = msg;
        el.style.display = 'block';
    }

    // 9. Section Reordering Logic
    const reorderBtn = document.getElementById('reorderBtn');
    const reorderUI = document.getElementById('reorderUI');
    const sortableSections = document.getElementById('sortableSections');
    const saveOrderBtn = document.getElementById('saveOrderBtn');
    const cancelOrderBtn = document.getElementById('cancelOrderBtn');

    let currentSectionOrder = []; // default order

    if (reorderBtn) {
        reorderBtn.addEventListener('click', () => {
            if (reorderUI.style.display === 'none') {
                // SYNC: Ensure currentEditingData reflects the currently open editor section
                if (currentEditingData && sectionSelect) {
                    const activeSection = sectionSelect.value;
                    const currentData = parseEditor(activeSection);
                    if (currentData !== null) {
                        currentEditingData[activeSection] = currentData;
                    }
                }

                reorderUI.style.display = 'block';
                renderReorderList();
            } else {
                reorderUI.style.display = 'none';
            }
        });
    }

    if (cancelOrderBtn) {
        cancelOrderBtn.addEventListener('click', () => {
            reorderUI.style.display = 'none';
        });
    }

    if (saveOrderBtn) {
        saveOrderBtn.addEventListener('click', async () => {
            // Save new order to tailoredResume (or baseResume)
            const newOrder = [];
            sortableSections.querySelectorAll('li').forEach(li => {
                newOrder.push(li.getAttribute('data-section'));
            });

            // Update all state objects
            if (tailoredResume) tailoredResume.section_order = newOrder;
            if (baseResume) baseResume.section_order = newOrder;
            if (currentEditingData) currentEditingData.section_order = newOrder;

            reorderUI.style.display = 'none';

            // Directly generate PDF (No LLM Call)
            const dataToUse = currentEditingData || tailoredResume || baseResume;
            if (dataToUse) {
                saveOrderBtn.textContent = "Updating PDF...";
                saveOrderBtn.disabled = true;
                await generateAndDisplayPDF(dataToUse);
                saveOrderBtn.textContent = "Save Order (Quick)";
                saveOrderBtn.disabled = false;
                showStatus("✅ Order updated!", "success");
            }
        });
    }

    function renderReorderList() {
        sortableSections.innerHTML = '';

        // Use currentEditingData if available, otherwise tailoredResume, then baseResume
        const data = currentEditingData || tailoredResume || baseResume;
        if (!data) return;

        // Default Full List
        const fullList = ["summary", "skills", "experience", "projects", "education", "leadership", "research", "certifications", "awards", "volunteering", "languages"];

        // Get existing order from data or default
        let order = data.section_order || fullList;

        // Merge missing keys
        fullList.forEach(sec => {
            if (!order.includes(sec)) order.push(sec);
        });

        currentSectionOrder = order;

        order.forEach(section => {
            // DYNAMIC FILTER: Check if section has data
            if (!hasData(data, section)) return;

            const li = document.createElement('li');
            li.className = 'sortable-item';
            li.setAttribute('draggable', 'true');
            li.setAttribute('data-section', section);
            li.innerHTML = `
                <div style="display:flex; align-items:center;">
                    <span class="handle">☰</span> 
                    <span class="section-name">${formatSectionName(section)}</span>
                </div>
            `;

            // Drag Events
            li.addEventListener('dragstart', handleDragStart);
            li.addEventListener('dragover', handleDragOver);
            li.addEventListener('drop', handleDrop);
            li.addEventListener('dragenter', handleDragEnter);
            li.addEventListener('dragleave', handleDragLeave);
            li.addEventListener('dragend', handleDragEnd);

            sortableSections.appendChild(li);
        });
    }

    function hasData(data, section) {
        if (!data[section]) return false;

        const val = data[section];

        if (Array.isArray(val)) {
            return val.length > 0;
        } else if (typeof val === 'object') {
            // For skills (dict) or contact
            return Object.keys(val).length > 0;
        } else if (typeof val === 'string') {
            return val.trim().length > 0;
        }
        return false;
    }

    function formatSectionName(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Drag & Drop Handlers
    let dragSrcEl = null;

    function handleDragStart(e) {
        dragSrcEl = this;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.innerHTML);
        this.classList.add('dragging');
    }

    function handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    function handleDragEnter(e) {
        this.classList.add('over');
    }

    function handleDragLeave(e) {
        this.classList.remove('over');
    }

    function handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }

        if (dragSrcEl !== this) {
            const list = this.parentNode;
            const items = Array.from(list.children);
            const fromIndex = items.indexOf(dragSrcEl);
            const toIndex = items.indexOf(this);

            if (fromIndex < toIndex) {
                this.after(dragSrcEl);
            } else {
                this.before(dragSrcEl);
            }
        }
        return false;
    }

    function handleDragEnd(e) {
        this.classList.remove('dragging');
        sortableSections.querySelectorAll('.sortable-item').forEach(item => {
            item.classList.remove('over');
        });
    }

    // --- Item Drag & Drop Handlers (Projects, Experience, etc.) ---
    let dragItemSrcEl = null;

    function handleItemDragStart(e) {
        dragItemSrcEl = this;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.innerHTML);
        this.classList.add('dragging');
        e.stopPropagation(); // Prevent bubbling to section reorder if any
    }

    function handleItemDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    function handleItemDragEnter(e) {
        this.classList.add('over');
    }

    function handleItemDragLeave(e) {
        this.classList.remove('over');
    }

    function handleItemDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }

        if (dragItemSrcEl !== this) {
            const list = this.parentNode;
            const items = Array.from(list.children);
            const fromIndex = items.indexOf(dragItemSrcEl);
            const toIndex = items.indexOf(this);

            if (fromIndex < toIndex) {
                this.after(dragItemSrcEl);
            } else {
                this.before(dragItemSrcEl);
            }
        }
        return false;
    }

    function handleItemDragEnd(e) {
        this.classList.remove('dragging');

        // Clean up 'over' class from all potential siblings
        const container = this.parentNode;
        if (container) {
            container.querySelectorAll('.item-block').forEach(item => {
                item.classList.remove('over');
            });
        }
    }

    // Helper for Skills Rendering to support Arrows
    function renderSkillBlock(container, category, skills) {
        const div = document.createElement('div');
        div.className = 'item-block';
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <input type="text" class="skill-category-input" value="${category}" style="font-weight: bold; width: 50%;" placeholder="Category Name">
                
                <div style="display:flex; gap:10px; align-items:center;">
                    <div style="display:flex; gap:2px;">
                        <button class="move-up-btn" title="Move Up" style="cursor:pointer; padding:2px 6px;">⬆️</button>
                        <button class="move-down-btn" title="Move Down" style="cursor:pointer; padding:2px 6px;">⬇️</button>
                    </div>
                    <button class="remove-btn remove-category-btn">🗑️ Remove</button>
                </div>
            </div>
            <textarea class="skill-values-input" style="height: 60px;">${skills}</textarea>
        `;

        // Remove handler
        div.querySelector('.remove-category-btn').onclick = () => {
            div.remove();
            updateArrowVisibility(container);
        };

        // Arrow handlers
        const upBtn = div.querySelector('.move-up-btn');
        const downBtn = div.querySelector('.move-down-btn');

        if (upBtn) upBtn.onclick = () => {
            if (div.previousElementSibling) {
                div.parentNode.insertBefore(div, div.previousElementSibling);
                updateArrowVisibility(container);
            }
        };

        if (downBtn) downBtn.onclick = () => {
            if (div.nextElementSibling) {
                div.parentNode.insertBefore(div.nextElementSibling, div);
                updateArrowVisibility(container);
            }
        };

        container.appendChild(div);
        updateArrowVisibility(container);
    }

});
