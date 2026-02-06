import { state, updateState } from './modules/state.js';
import { checkCurrentProviderKey, updateStrategyDescription, formatSectionName, hasData, generateFilename, setButtonLoading } from './modules/utils.js';
import {
    showStatus,
    toggleProviderUI,
    showMainUI,
    showSetupUI,
    showSettings,
    showProfileUI,
    renderAnalysis,
    renderCopyList
} from './modules/ui.js';
import {
    extractText,
    extractBaseProfile,
    tailorResume,
    generatePdf,
    askQuestion,
    regenerateResume,
    analyzeResume
} from './modules/api.js';
import { renderProfileEditor, saveProfileChanges, collectBulletCounts, resetEditorState, getCurrentEditingResume } from './modules/editor.js';
import { extractJobDescription } from './modules/jd_extractor.js';
import { showProgress, hideProgress } from './modules/progress.js';

const setupUI = document.getElementById('setupUI');
const mainUI = document.getElementById('mainUI');
const settingsUI = document.getElementById('settingsUI');
const resumeFile = document.getElementById('resumeFile');
const uploadBtn = document.getElementById('uploadBtn');
const apiKeyInput = document.getElementById('apiKey');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const settingsToggle = document.getElementById('settingsToggle');
const generateBtn = document.getElementById('generateBtn');
const profileNameDisplay = document.getElementById('profileName');
const actionsDiv = document.getElementById('actions');
const tailoringSlider = document.getElementById('tailoringSlider');
const strategyDescription = document.getElementById('strategyDescription');
const generateBaseBtn = document.getElementById('generateBaseBtn');
const downloadBtn = document.getElementById('downloadBtn');
const previewBtn = document.getElementById('previewBtn');
const askBtn = document.getElementById('askBtn');
const questionInput = document.getElementById('questionInput');
const answerOutput = document.getElementById('answerOutput');
const editBtn = document.getElementById('editBtn');
const copyContentBtn = document.getElementById('copyContentBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const closeCopyBtn = document.getElementById('closeCopyBtn');
const saveManualBtn = document.getElementById('saveManualBtn');
const saveRegenBtn = document.getElementById('saveRegenBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const editorPreviewBtn = document.getElementById('editorPreviewBtn');

const reorderBtn = document.getElementById('reorderBtn');
const reorderUI = document.getElementById('reorderUI');
const sortableSections = document.getElementById('sortableSections');
const saveOrderBtn = document.getElementById('saveOrderBtn');
const cancelOrderBtn = document.getElementById('cancelOrderBtn');

async function loadProfiles() {
    const data = await chrome.storage.local.get(['profiles', 'active_profile']);
    let profiles = data.profiles || {};
    let activeProfile = data.active_profile || 'default';

    // Migration: if no profiles exist but base_resume does, create "Default" profile
    if (Object.keys(profiles).length === 0 && state.baseResume) {
        profiles['default'] = state.baseResume;
        await chrome.storage.local.set({ profiles, active_profile: 'default' });
    }

    updateState({ activeProfile });
    return profiles;
}

function renderProfileList(profiles, activeProfile) {
    const list = document.getElementById('profileList');
    if (!list) return;

    list.innerHTML = '';

    const profileNames = Object.keys(profiles);
    if (profileNames.length === 0) {
        list.innerHTML = '<div style="font-size:12px; color:#999; padding:4px 0;">No profiles yet. Upload a resume first.</div>';
        return;
    }

    profileNames.forEach(name => {
        const isActive = name === activeProfile;
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px 10px; border-radius:8px; margin-bottom:4px; font-size:12px;';
        div.style.background = isActive ? '#e0e7ff' : '#f9fafb';
        div.style.border = isActive ? '1px solid #c7d2fe' : '1px solid #e5e7eb';

        const displayName = profiles[name]?.name || name;

        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:6px;">
                <span style="width:8px; height:8px; border-radius:50%; background:${isActive ? '#6366f1' : '#d1d5db'};"></span>
                <span style="font-weight:${isActive ? '600' : '400'};">${name}</span>
                <span style="color:#9ca3af; font-size:10px;">(${displayName})</span>
            </div>
            <div style="display:flex; gap:4px;">
                ${!isActive ? `<button class="profile-switch-btn" data-name="${name}" style="font-size:10px; padding:2px 8px; cursor:pointer; border:1px solid #d1d5db; border-radius:4px; background:white;">Switch</button>` : '<span style="font-size:10px; color:#6366f1; font-weight:600;">Active</span>'}
                ${profileNames.length > 1 ? `<button class="profile-delete-btn" data-name="${name}" style="font-size:10px; padding:2px 6px; cursor:pointer; border:none; background:none; color:#ef4444;">✕</button>` : ''}
            </div>
        `;
        list.appendChild(div);
    });

    // Attach event listeners
    list.querySelectorAll('.profile-switch-btn').forEach(btn => {
        btn.onclick = async () => {
            const name = btn.dataset.name;
            const data = await chrome.storage.local.get('profiles');
            const profiles = data.profiles || {};

            if (profiles[name]) {
                // Save current profile first
                const currentData = await chrome.storage.local.get('active_profile');
                const currentName = currentData.active_profile || 'default';
                profiles[currentName] = state.baseResume;

                // Switch
                const newResume = profiles[name];
                updateState({ baseResume: newResume, activeProfile: name });
                await chrome.storage.local.set({
                    profiles,
                    active_profile: name,
                    base_resume: newResume,
                    user_profile_name: newResume.name || 'User'
                });

                if (profileNameDisplay) profileNameDisplay.textContent = newResume.name || 'User';
                updateActiveProfileLabel(name);
                renderProfileList(profiles, name);
                showStatus(`Switched to profile: ${name}`, 'success', 'profileStatus');

                // Re-render the editor if open
                const section = document.getElementById('profileSectionSelect').value;
                renderProfileEditor(section, newResume);
            }
        };
    });

    list.querySelectorAll('.profile-delete-btn').forEach(btn => {
        btn.onclick = async () => {
            const name = btn.dataset.name;
            if (!confirm(`Delete profile "${name}"?`)) return;

            const data = await chrome.storage.local.get(['profiles', 'active_profile']);
            const profiles = data.profiles || {};
            const activeProfile = data.active_profile || 'default';

            delete profiles[name];
            await chrome.storage.local.set({ profiles });

            // If deleted the active profile, switch to first remaining
            if (name === activeProfile) {
                const remaining = Object.keys(profiles);
                if (remaining.length > 0) {
                    const newName = remaining[0];
                    const newResume = profiles[newName];
                    updateState({ baseResume: newResume, activeProfile: newName });
                    await chrome.storage.local.set({
                        active_profile: newName,
                        base_resume: newResume,
                        user_profile_name: newResume.name || 'User'
                    });
                    if (profileNameDisplay) profileNameDisplay.textContent = newResume.name || 'User';
                    updateActiveProfileLabel(newName);
                }
            }

            renderProfileList(profiles, state.activeProfile);
            showStatus(`Profile "${name}" deleted`, 'info', 'profileStatus');
        };
    });
}

function updateActiveProfileLabel(name) {
    const label = document.getElementById('activeProfileLabel');
    if (label) {
        label.textContent = name !== 'default' ? `(${name})` : '';
    }
}

function setupProfileManagement() {
    const createBtn = document.getElementById('createProfileBtn');
    const nameInput = document.getElementById('newProfileName');

    if (createBtn && nameInput) {
        createBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            if (!name) {
                showStatus('Enter a profile name', 'error', 'profileStatus');
                return;
            }
            if (name.length > 30) {
                showStatus('Name must be under 30 characters', 'error', 'profileStatus');
                return;
            }

            const data = await chrome.storage.local.get('profiles');
            const profiles = data.profiles || {};

            if (Object.keys(profiles).length >= 5) {
                showStatus('Maximum 5 profiles allowed', 'error', 'profileStatus');
                return;
            }
            if (profiles[name]) {
                showStatus('Profile name already exists', 'error', 'profileStatus');
                return;
            }

            // Copy current base resume into new profile
            profiles[name] = JSON.parse(JSON.stringify(state.baseResume));

            // Switch to the new profile
            updateState({ activeProfile: name });
            await chrome.storage.local.set({
                profiles,
                active_profile: name
            });

            nameInput.value = '';
            renderProfileList(profiles, name);
            updateActiveProfileLabel(name);
            showStatus(`Profile "${name}" created!`, 'success', 'profileStatus');
        });
    }
}

async function init() {
    try {
        await loadState();

        // Check for Pop-out Mode
        if (new URL(window.location).searchParams.get('mode') === 'editor') {
            document.body.style.width = '100%';
            document.body.style.maxWidth = '800px';
            document.body.style.margin = '0 auto';
            document.body.classList.add('popout-mode');

            // Force editor open if tailored resume exists
            setTimeout(() => {
                if (state.tailoredResume) {
                    if (document.getElementById('editBtn')) document.getElementById('editBtn').click();
                } else if (state.baseResume) {
                    showMainUI();
                }
            }, 300);
        }

        setupEventListeners();
        setupHistoryUI();
        setupDragAndDrop();
        setupProfileManagement();
        setupFormatUI();
        detectJobDescription().catch(e => console.log("Silent detect fail:", e));
    } catch (e) {
        console.error("Critical Init Error:", e);
        const errDiv = document.getElementById('error');
        if (errDiv) {
            errDiv.textContent = "Extension Error: " + e.message;
            errDiv.style.display = 'block';
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

async function loadState() {
    const data = await chrome.storage.local.get(['gemini_api_key', 'groq_api_key', 'nvidia_api_key', 'provider', 'base_resume', 'tailored_resume', 'user_profile_name', 'tailoring_strategy', 'last_analysis', 'active_profile']);

    updateState({
        currentApiKey: data.gemini_api_key || "",
        currentGroqKey: data.groq_api_key || "",
        currentNvidiaKey: data.nvidia_api_key || "",
        currentProvider: data.provider || "gemini",
        baseResume: data.base_resume || null,
        tailoredResume: data.tailored_resume || null,
        tailoringStrategy: data.tailoring_strategy || "balanced",
        lastAnalysis: data.last_analysis || null,
        currentJdAnalysis: data.last_analysis || null,
        jdKeywords: data.last_analysis ? [
            ...(data.last_analysis.mandatory_keywords || []),
            ...(data.last_analysis.preferred_keywords || []),
            ...(data.last_analysis.industry_terms || [])
        ].map(k => k.toLowerCase()) : [],
        activeProfile: data.active_profile || 'default'
    });

    updateActiveProfileLabel(state.activeProfile);

    setupSettings();

    if (state.baseResume) {
        if (profileNameDisplay) profileNameDisplay.textContent = data.user_profile_name || "User";

        if (checkCurrentProviderKey()) {
            showMainUI();
            if (state.tailoredResume) actionsDiv.style.display = 'block';
            if (data.last_analysis) renderAnalysis(data.last_analysis);
            else document.getElementById('analysisResults').classList.add('hidden'); // Ensure hidden by default
        } else {
            showSettings();
        }
    } else {
        if (checkCurrentProviderKey()) {
            showSetupUI();
        } else {
            showSettings();
        }
    }

    if (tailoringSlider) {
        const sliderValue = state.tailoringStrategy === 'profile_focus' ? 0 : state.tailoringStrategy === 'balanced' ? 1 : 2;
        tailoringSlider.value = sliderValue;
        updateStrategyDescription(sliderValue, strategyDescription);
    }

    const backFromSetup = document.getElementById('backFromSetup');
    if (backFromSetup) {
        backFromSetup.style.display = state.baseResume ? 'inline-block' : 'none';
    }

    await loadFormatSettings();

    if (state.tailoredResume) {
        try {
            const blob = await generatePdf(state.tailoredResume);
            if (blob instanceof Blob) {
                updateState({ latestPdfBlob: blob });
                updateDragCard(state.tailoredResume);
            }
        } catch (e) {
            console.log("Pre-cache PDF failed (non-critical):", e);
        }
    }
}

function setupSettings() {
    const apiKeyInput = document.getElementById('apiKey');
    const groqApiKeyInput = document.getElementById('groqApiKey');
    const nvidiaApiKeyInput = document.getElementById('nvidiaApiKey');
    const providerSelect = document.getElementById('providerSelect');

    // Pre-fill
    if (apiKeyInput) apiKeyInput.value = state.currentApiKey;
    if (groqApiKeyInput) groqApiKeyInput.value = state.currentGroqKey;
    if (nvidiaApiKeyInput) nvidiaApiKeyInput.value = state.currentNvidiaKey;
    if (providerSelect) {
        providerSelect.value = state.currentProvider;
        toggleProviderUI(state.currentProvider);
    }
}

function setupEventListeners() {
    // Provider Change
    document.getElementById('providerSelect').addEventListener('change', (e) => {
        updateState({ currentProvider: e.target.value });
        toggleProviderUI(state.currentProvider);
    });

    // Settings Toggle
    settingsToggle.addEventListener('click', () => {
        const isVisible = settingsUI.style.display === 'block';
        if (!isVisible) {
            showSettings();
        } else {
            // Determine where to go back to
            if (state.baseResume && checkCurrentProviderKey()) showMainUI();
            else showSetupUI();
        }
    });

    // Slider Change
    tailoringSlider.addEventListener('input', async (e) => {
        const value = parseInt(e.target.value);
        updateStrategyDescription(value, strategyDescription);

        const strategies = ['profile_focus', 'balanced', 'jd_focus'];
        const newStrategy = strategies[value];
        updateState({ tailoringStrategy: newStrategy });
        await chrome.storage.local.set({ tailoring_strategy: newStrategy });
    });

    // Back Buttons
    document.getElementById('backFromSettings').addEventListener('click', () => {
        if (state.baseResume) showMainUI(); else showSetupUI();
    });
    document.getElementById('backFromSetup').addEventListener('click', () => {
        if (state.baseResume) showMainUI();
    });
    document.getElementById('backFromProfile').addEventListener('click', showMainUI);

    // Profile Toggle
    document.getElementById('profileToggle').addEventListener('click', async () => {
        resetEditorState(); // Clear any stale editor state
        showProfileUI();
        const profiles = await loadProfiles();
        renderProfileList(profiles, state.activeProfile);
        renderProfileEditor('contact', state.baseResume, 'profileFormContainer'); // First open — pass resume
    });

    // Profile Section Change
    document.getElementById('profileSectionSelect').addEventListener('change', (e) => {
        // Updated Fix: Don't pass resume data so logic uses currentEditingResume clone.
        // This prevents re-cloning on every switch and ensures unsaved edits persist across sections.
        const section = e.target.value;
        const profileVisible = document.getElementById('profileUI').style.display === 'block';
        if (profileVisible) {
            renderProfileEditor(section, null, 'profileFormContainer');
        } else {
            renderProfileEditor(section, null, 'formContainer');
        }
    });

    // Save Profile (Base)
    document.getElementById('saveProfileBtn').addEventListener('click', async () => {
        await saveProfileChanges(document.getElementById('profileSectionSelect').value);

        // Also update in profiles collection
        const pData = await chrome.storage.local.get(['profiles', 'active_profile']);
        const profiles = pData.profiles || {};
        profiles[pData.active_profile || 'default'] = state.baseResume; // state.baseResume is updated by saveProfileChanges
        await chrome.storage.local.set({ profiles });
    });
    document.getElementById('cancelProfileEditBtn').addEventListener('click', showMainUI);

    // Save Settings
    saveSettingsBtn.addEventListener('click', async () => {
        const geminiKey = apiKeyInput.value.trim();
        const groqKey = document.getElementById('groqApiKey').value.trim();
        const nvidiaKey = document.getElementById('nvidiaApiKey').value.trim();
        const provider = document.getElementById('providerSelect').value;

        if (provider === 'gemini' && !geminiKey) {
            showStatus("Please enter a Gemini API key.", "error", "settingsStatus");
            return;
        }
        if (provider === 'groq' && !groqKey) {
            showStatus("Please enter a Groq API key.", "error", "settingsStatus");
            return;
        }
        if (provider === 'nvidia' && !nvidiaKey) {
            showStatus("Please enter a NVIDIA API key.", "error", "settingsStatus");
            return;
        }

        await chrome.storage.local.set({
            gemini_api_key: geminiKey,
            groq_api_key: groqKey,
            nvidia_api_key: nvidiaKey,
            provider: provider
        });

        updateState({
            currentApiKey: geminiKey,
            currentGroqKey: groqKey,
            currentNvidiaKey: nvidiaKey,
            currentProvider: provider
        });

        showStatus("Settings saved!", "success", "settingsStatus");
        setTimeout(() => {
            if (state.baseResume) showMainUI();
            else showSetupUI();
        }, 1000);
    });

    // Upload Resume
    uploadBtn.addEventListener('click', async () => {
        const file = resumeFile.files[0];
        if (!file) {
            showStatus("Please select a PDF file.", "error", "uploadStatus");
            return;
        }
        if (!checkCurrentProviderKey()) {
            showStatus("Please save your API Key in settings first.", "error", "uploadStatus");
            return;
        }

        setButtonLoading(uploadBtn, true);
        showStatus("Extracting resume info...", "info", "uploadStatus");

        try {
            const textData = await extractText(file);
            if (textData.error) throw new Error(textData.error);

            // Use correct key for extraction
            const extractionKey = state.currentProvider === 'groq' ? state.currentGroqKey : state.currentApiKey;

            const profileData = await extractBaseProfile(textData.text, extractionKey, state.currentProvider);
            if (profileData.error) throw new Error(profileData.error);

            await chrome.storage.local.set({
                base_resume: profileData,
                user_profile_name: profileData.name || "User"
            });
            // Clear stale tailored data
            await chrome.storage.local.remove(['tailored_resume', 'last_analysis']);
            updateState({ baseResume: profileData, tailoredResume: null, currentJdAnalysis: null });

            // Also update in profiles collection
            const pData = await chrome.storage.local.get(['profiles', 'active_profile']);
            const profiles = pData.profiles || {};
            profiles[pData.active_profile || 'default'] = profileData;
            await chrome.storage.local.set({ profiles });

            if (profileNameDisplay) profileNameDisplay.textContent = profileData.name;
            showStatus("Profile created!", "success", "uploadStatus");
            setTimeout(showMainUI, 1500);

        } catch (e) {
            showStatus(`Error: ${e.message}`, "error", "uploadStatus");
        } finally {
            setButtonLoading(uploadBtn, false, "Upload & Create Profile");
        }
    });

    // Manual Text Processing
    const handleManualText = async (text, btnId, statusId) => {
        const btn = document.getElementById(btnId);
        if (!text || text.length < 50) {
            showStatus("Please enter at least 50 characters.", "error", statusId);
            return;
        }
        if (!checkCurrentProviderKey()) {
            showStatus("Please save your API Key first.", "error", statusId);
            return;
        }

        btn.disabled = true;
        showStatus("Processing...", "info", statusId);

        try {
            const extractionKey = state.currentProvider === 'groq' ? state.currentGroqKey : state.currentApiKey;
            const profileData = await extractBaseProfile(text, extractionKey, state.currentProvider);
            if (profileData.error) throw new Error(profileData.error);

            await chrome.storage.local.set({
                base_resume: profileData,
                user_profile_name: profileData.name || "User"
            });
            // Clear stale tailored data
            await chrome.storage.local.remove(['tailored_resume', 'last_analysis']);
            updateState({ baseResume: profileData, tailoredResume: null, currentJdAnalysis: null });

            // Also update in profiles collection
            const pData = await chrome.storage.local.get(['profiles', 'active_profile']);
            const profiles = pData.profiles || {};
            profiles[pData.active_profile || 'default'] = profileData;
            await chrome.storage.local.set({ profiles });

            if (profileNameDisplay) profileNameDisplay.textContent = profileData.name;

            showStatus("✅ Profile updated!", "success", statusId);
            setTimeout(() => {
                showMainUI();
                document.getElementById('resumeTextInit').value = '';
                document.getElementById('reuploadResumeText').value = '';
            }, 1000);
        } catch (e) {
            showStatus(`Error: ${e.message}`, "error", statusId);
        } finally {
            btn.disabled = false;
        }
    };

    document.getElementById('processTextInitBtn').addEventListener('click', () => {
        handleManualText(document.getElementById('resumeTextInit').value, 'processTextInitBtn', 'textStatus');
    });

    document.getElementById('reuploadTextBtn').addEventListener('click', () => {
        handleManualText(document.getElementById('reuploadResumeText').value, 'reuploadTextBtn', 'profileStatus');
    });

    // Re-upload logic
    document.getElementById('reuploadBtn').addEventListener('click', async () => {
        const file = document.getElementById('reuploadResumeFile').files[0];
        if (!file) {
            showStatus('Please select a PDF file.', 'error', 'profileStatus');
            return;
        }

        showStatus('Uploading...', 'info', 'profileStatus');
        try {
            const textData = await extractText(file);
            if (textData.error) throw new Error(textData.error);
            const extractionKey = state.currentProvider === 'groq' ? state.currentGroqKey : state.currentApiKey;
            const profileData = await extractBaseProfile(textData.text, extractionKey, state.currentProvider);
            if (profileData.error) throw new Error(profileData.error);

            await chrome.storage.local.set({ base_resume: profileData });
            // Clear stale tailored data
            await chrome.storage.local.remove(['tailored_resume', 'last_analysis']);
            updateState({ baseResume: profileData, tailoredResume: null, currentJdAnalysis: null });

            // Also update in profiles collection
            const pData = await chrome.storage.local.get(['profiles', 'active_profile']);
            const profiles = pData.profiles || {};
            profiles[pData.active_profile || 'default'] = profileData;
            await chrome.storage.local.set({ profiles });

            showStatus('✅ Updated!', 'success', 'profileStatus');
            renderProfileEditor(document.getElementById('profileSectionSelect').value, state.baseResume);
        } catch (e) {
            showStatus(`Error: ${e.message}`, 'error', 'profileStatus');
        }
    });

    // Generate Base Resume (No AI)
    if (generateBaseBtn) {
        generateBaseBtn.addEventListener('click', async () => {
            console.log("Generate Base Resume clicked");
            if (!state.baseResume) {
                showStatus("No base resume profile loaded.", "error");
                return;
            }

            setButtonLoading(generateBaseBtn, true);
            showStatus("Preparing base resume...", "info");

            try {
                // Set the current 'active' result to a DEEP CLONE of the base resume
                // This prevents edits to the "tailored" resume from contaminating the base state
                const baseClone = JSON.parse(JSON.stringify(state.baseResume));

                updateState({ tailoredResume: baseClone });

                // Persist this choice so reload works
                await chrome.storage.local.set({ tailored_resume: baseClone });

                showStatus("Base resume ready! output loaded below.", "success");
                await saveVersion(baseClone, 'Base Resume (No AI)');

                // Show actions
                if (actionsDiv) actionsDiv.style.display = 'block';

            } catch (e) {
                console.error("Base Resume Error:", e);
                showStatus(`Error preparing resume: ${e.message}`, "error");
            } finally {
                setTimeout(() => { setButtonLoading(generateBaseBtn, false, "Generate Base Resume"); }, 500);
            }
        });
    }


    // Generate Button
    generateBtn.addEventListener('click', async () => {
        console.log("Generate (AI) clicked");
        invalidatePdfCache();

        if (!state.currentJdText || state.currentJdText.length < 50) {
            console.warn("No JD detected");
            showStatus("No valid job description detected. Navigate to a job post.", "error");
            return;
        }

        // Disable UI
        setButtonLoading(generateBtn, true);
        const buttonsToDisable = [generateBaseBtn, editBtn, downloadBtn, previewBtn, analyzeBtn];
        buttonsToDisable.forEach(b => { if (b) b.disabled = true; });

        showProgress('detecting');

        const activeKey = state.currentProvider === 'groq' ? state.currentGroqKey :
            (state.currentProvider === 'nvidia' ? state.currentNvidiaKey : state.currentApiKey);

        try {
            showProgress('analyzing', `Using ${state.currentProvider === 'groq' ? 'Groq' : (state.currentProvider === 'nvidia' ? 'NVIDIA' : 'Gemini')}...`);
            showProgress('tailoring', 'This may take 10-15 seconds...');

            console.log("Calling tailorResume...");
            const data = await tailorResume(state.baseResume, state.currentJdText, activeKey, state.currentProvider, state.tailoringStrategy);
            if (data.error) throw new Error(data.error);

            showProgress('processing');
            console.log("Tailoring success", data);

            const newResume = data.tailored_resume;
            const analysis = data.jd_analysis;

            const keywords = analysis ? [
                ...(analysis.mandatory_keywords || []),
                ...(analysis.preferred_keywords || []),
                ...(analysis.industry_terms || [])
            ].map(k => k.toLowerCase()) : [];

            updateState({ tailoredResume: newResume, currentJdAnalysis: analysis, jdKeywords: keywords });
            await chrome.storage.local.set({
                tailored_resume: newResume,
                last_analysis: analysis
            });

            showProgress('complete');
            setTimeout(() => {
                hideProgress();
                if (actionsDiv) actionsDiv.style.display = 'block';
                showStatus("Resume generated successfully!", "success");

                // Save Version
                saveVersion(newResume, analysis ? (analysis.title || analysis.job_title || "New Role") : "Tailored Resume");
            }, 1000);

            if (analysis) {
                renderAnalysis(analysis);
            }

            // After tailoring success, pre-generate the PDF blob for drag-drop
            try {
                const pdfBlob = await generatePdf(newResume);
                if (pdfBlob instanceof Blob) {
                    updateState({ latestPdfBlob: pdfBlob });
                    updateDragCard(newResume);
                }
            } catch (e) {
                console.log("Pre-cache PDF for drag failed (non-critical):", e);
            }

        } catch (e) {
            console.error("Tailoring Error:", e);
            showProgress('error', e.message);
            showStatus(`Error: ${e.message}`, "error");
            setTimeout(hideProgress, 3000);
        } finally {
            setButtonLoading(generateBtn, false, "Generate Tailored Resume");
            buttonsToDisable.forEach(b => { if (b) b.disabled = false; });
        }
    });

    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => generateAndDisplayPDF(state.tailoredResume));
    }

    if (previewBtn) {
        previewBtn.addEventListener('click', async () => {
            console.log("Preview clicked");
            if (!state.tailoredResume) {
                showStatus("No tailored resume found.", "error");
                return;
            }
            setButtonLoading(previewBtn, true);
            showStatus("Generating Preview...", "info");
            try {
                const result = await generatePdf(state.tailoredResume);
                if (result instanceof Blob) {
                    const url = URL.createObjectURL(result);
                    chrome.tabs.create({ url: url });
                    setTimeout(() => URL.revokeObjectURL(url), 120000); // 2 mins
                    showStatus("Preview opened in new tab", "success");
                } else if (result.error) {
                    throw new Error(result.error);
                }
            } catch (e) {
                console.error("Preview Error:", e);
                showStatus(`Error: ${e.message}`, "error");
            } finally {
                setButtonLoading(previewBtn, false, "👁 Preview PDF");
            }
        });
    }

    if (askBtn) {
        askBtn.addEventListener('click', async () => {
            console.log("Ask clicked");
            const question = questionInput.value.trim();
            if (!question) {
                showStatus("Please enter a question.", "error");
                return;
            }
            if (!state.tailoredResume && !state.baseResume) {
                showStatus("No profile loaded.", "error");
                return;
            }

            setButtonLoading(askBtn, true);
            answerOutput.style.display = 'block';
            answerOutput.textContent = "Generating answer...";

            try {
                const activeKey = state.currentProvider === 'groq' ? state.currentGroqKey :
                    (state.currentProvider === 'nvidia' ? state.currentNvidiaKey : state.currentApiKey);
                const resumeToUse = state.tailoredResume || state.baseResume;

                const res = await askQuestion(question, resumeToUse, state.currentJdText || "", activeKey, state.currentProvider);

                if (res.error) throw new Error(res.error);

                answerOutput.textContent = res.answer || "No answer generated.";
            } catch (e) {
                answerOutput.textContent = `Error: ${e.message}`;
            } finally {
                setButtonLoading(askBtn, false, "Ask AI");
            }
        });
    }



    // Popout Editor
    const popoutBtn = document.getElementById('popoutEditorBtn');
    if (popoutBtn) {
        popoutBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?mode=editor') });
        });
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        const editorUI = document.getElementById('editorUI');
        if (!editorUI || editorUI.style.display !== 'block') return;

        // Ctrl+S or Cmd+S to Save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            console.log("Shortcut: Save");
            const saveBtn = document.getElementById('saveManualBtn');
            if (saveBtn) saveBtn.click();
        }
        // Escape to Cancel
        if (e.key === 'Escape') {
            console.log("Shortcut: Cancel");
            const cancelBtn = document.getElementById('cancelEditBtn');
            if (cancelBtn) cancelBtn.click();
        }
    });

    // Edit Tailored Resume
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            console.log("Edit clicked");
            if (!state.tailoredResume) return;
            resetEditorState(); // Clear any stale editor state
            document.getElementById('editorUI').style.display = 'block';
            document.getElementById('actions').style.display = 'none';
            // Default to summary or first available
            document.getElementById('sectionSelect').value = 'summary';
            renderProfileEditor('summary', state.tailoredResume, 'formContainer');
        });
    }

    const sectionSelect = document.getElementById('sectionSelect');
    if (sectionSelect) {
        sectionSelect.addEventListener('change', (e) => {
            // Updated Fix: Don't pass resumeToEdit (null) so logic uses currentEditingResume clone.
            // This prevents re-cloning on every switch and ensures unsaved edits persist across sections.
            renderProfileEditor(e.target.value, null, 'formContainer');
        });
    }

    // Cancel Edit (Tailored)
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            if (confirm("Discard unsaved changes?")) {
                document.getElementById('editorUI').style.display = 'none';
                document.getElementById('actions').style.display = 'block';
            }
        });
    }

    // Save Manual Changes (Tailored)
    if (saveManualBtn) {
        saveManualBtn.addEventListener('click', async () => {
            console.log("Save Manual clicked");
            invalidatePdfCache();
            setButtonLoading(saveManualBtn, true);
            try {
                const activeSection = document.getElementById('sectionSelect').value;
                // parse current DOM to update object
                await saveProfileChanges(activeSection, 'formContainer');

                // Generate PDF logic immediately
                await generateAndDisplayPDF(state.tailoredResume);

                document.getElementById('editorUI').style.display = 'none';
                document.getElementById('actions').style.display = 'block';
            } catch (e) {
                console.error("Save Manual Error:", e);
                showStatus(`Error: ${e.message}`, "error");
            } finally {
                setButtonLoading(saveManualBtn, false, "Save Changes");
            }
        });
    }



    // Save & Regenerate (Tailored)
    if (saveRegenBtn) {
        saveRegenBtn.addEventListener('click', async () => {
            console.log("Save & Regenerate clicked");
            invalidatePdfCache();
            setButtonLoading(saveRegenBtn, true);

            try {
                const activeSection = document.getElementById('sectionSelect').value;
                await saveProfileChanges(activeSection, 'formContainer');

                // 2. Collect Bullet Counts
                const bulletCounts = collectBulletCounts(activeSection, 'formContainer');

                // 3. Call API
                const activeKey = state.currentProvider === 'groq' ? state.currentGroqKey : state.currentApiKey;

                // We need the JD analysis to be present for regeneration context
                let jdAnalysis = state.lastAnalysis; // Might need to ensure this is loaded
                if (!jdAnalysis) {
                    // Attempt to recover from storage if not in state
                    const data = await chrome.storage.local.get('last_analysis');
                    jdAnalysis = data.last_analysis;
                }

                if (!jdAnalysis) {
                    showStatus("No JD context found for regeneration. Just saving...", "info");
                    await generateAndDisplayPDF(state.tailoredResume);
                } else {
                    const regenData = await regenerateResume(
                        state.tailoredResume,
                        bulletCounts,
                        jdAnalysis,
                        activeKey,
                        state.currentProvider,
                        state.tailoringStrategy
                    );

                    if (regenData.error) throw new Error(regenData.error);

                    const finalResume = regenData;

                    updateState({ tailoredResume: finalResume });
                    await chrome.storage.local.set({ tailored_resume: finalResume });

                    // Generate PDF
                    await generateAndDisplayPDF(finalResume);

                    // Save Version
                    await saveVersion(finalResume, jdAnalysis.title || jdAnalysis.job_title || "Edited Role");
                }

                document.getElementById('editorUI').style.display = 'none';
                document.getElementById('actions').style.display = 'block';

            } catch (e) {
                console.error("Regeneration Error:", e);
                showStatus("Error regenerating: " + e.message, "error");
            } finally {
                setButtonLoading(saveRegenBtn, false, "Save & Regenerate");
            }
        });
    }

    // Editor Preview
    if (editorPreviewBtn) {
        editorPreviewBtn.addEventListener('click', async () => {
            // Get the REAL current resume being acted on inside the module
            const editingResume = getCurrentEditingResume();

            if (!editingResume) {
                showStatus("No active resume to preview", "error");
                return;
            }

            // Capture latest changes from form to editingResume
            const activeSection = document.getElementById('sectionSelect').value;
            await saveProfileChanges(activeSection);

            try {
                const originalText = editorPreviewBtn.textContent;
                editorPreviewBtn.textContent = "Generating...";
                const result = await generatePdf(editingResume);
                if (result instanceof Blob) {
                    const url = URL.createObjectURL(result);
                    chrome.tabs.create({ url });
                    setTimeout(() => URL.revokeObjectURL(url), 120000);
                }
                editorPreviewBtn.textContent = originalText;
            } catch (e) {
                showStatus("Preview failed: " + e.message, "error");
                editorPreviewBtn.textContent = "👁 Preview";
            }
        });
    }

    // Copy Content
    // Copy Content (Restored Smart Logic)
    if (copyContentBtn) {
        copyContentBtn.addEventListener('click', () => {
            if (!state.tailoredResume && !state.baseResume) return;
            document.getElementById('copyUI').style.display = 'block';
            document.getElementById('actions').style.display = 'none';
            renderCopyList(state.tailoredResume || state.baseResume);
        });
    }

    if (closeCopyBtn) {
        closeCopyBtn.addEventListener('click', () => {
            document.getElementById('copyUI').style.display = 'none';
            document.getElementById('actions').style.display = 'block';
        });
    }

    // Analyze Button Logic
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async () => {
            const resumeToAnalyze = state.tailoredResume || state.baseResume;
            if (!resumeToAnalyze) {
                showStatus("No resume loaded to analyze.", "error");
                return;
            }
            if (!state.currentJdText) {
                showStatus("No Job Description detected. Refresh the page.", "error");
                return;
            }

            const statusMessage = state.hasAnalyzed ? "Re-analyzing ATS Score..." : "Analyzing ATS Score...";
            setButtonLoading(analyzeBtn, true);
            showStatus(statusMessage, "info");

            const activeKey = state.currentProvider === 'groq' ? state.currentGroqKey :
                (state.currentProvider === 'nvidia' ? state.currentNvidiaKey : state.currentApiKey);

            try {
                // Skeleton UI for analysis
                const analysisContainer = document.getElementById('analysisResults');
                const analysisDetails = document.getElementById('analysisDetails');
                const atsScore = document.getElementById('atsScore');

                if (analysisContainer) {
                    analysisContainer.style.display = 'block';
                }
                if (atsScore) {
                    atsScore.innerHTML = '<span class="spinner"></span>';
                }
                if (analysisDetails) {
                    analysisDetails.innerHTML = '<div class="skeleton" style="width:100%;height:100px;"></div>';
                }

                const start = Date.now();
                const data = await analyzeResume(resumeToAnalyze, state.currentJdText, activeKey, state.currentProvider);
                if (data.error) throw new Error(data.error);

                renderAnalysis(data);
                updateState({ hasAnalyzed: true });
                showStatus(`Analysis Complete! (${((Date.now() - start) / 1000).toFixed(1)}s)`, "success");
                setTimeout(() => showStatus("", ""), 3000);

            } catch (e) {
                showStatus("Analysis Failed: " + e.message, "error");
            } finally {
                setButtonLoading(analyzeBtn, false, "Analyze ATS Score");
            }
        });
    }

    // --- Reorder Logic ---
    if (reorderBtn) {
        reorderBtn.addEventListener('click', async () => {
            const isVisible = reorderUI.style.display === 'block';
            if (!isVisible) {
                // Sync current editor state first?
                const activeSection = document.getElementById('sectionSelect').value;
                await saveProfileChanges(activeSection);

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
            invalidatePdfCache();
            const newOrder = [];
            sortableSections.querySelectorAll('li').forEach(li => {
                newOrder.push(li.getAttribute('data-section'));
            });

            // Update logic
            if (state.tailoredResume) {
                state.tailoredResume.section_order = newOrder;
                await chrome.storage.local.set({ tailored_resume: state.tailoredResume });

                saveOrderBtn.textContent = "Updating PDF...";
                saveOrderBtn.disabled = true;

                await generateAndDisplayPDF(state.tailoredResume);

                saveOrderBtn.textContent = "Save Order";
                saveOrderBtn.disabled = false;
                reorderUI.style.display = 'none';
                showStatus("Order updated!", "success");
            }
        });
    }
}

// Helper: Generate PDF & Handle UI
async function generateAndDisplayPDF(resumeData) {
    if (!resumeData) {
        showStatus("No resume data to generate PDF.", "error");
        return;
    }

    showStatus("Generating PDF...", "info");

    try {
        const result = await generatePdf(resumeData);
        if (result instanceof Blob) {
            // Cache for drag-and-drop
            updateState({ latestPdfBlob: result });
            updateDragCard(resumeData);

            showStatus("PDF Ready. Downloading...", "success");

            // Auto download
            const url = URL.createObjectURL(result);
            const a = document.createElement('a');
            a.href = url;
            a.download = generateFilename(resumeData);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Also update preview button action? 
            // The preview button already generates on click, which is safer for stale data.
            // But we could cache the blob url if we wanted.

            setTimeout(() => { URL.revokeObjectURL(url); }, 60000);

        } else if (result.error) {
            throw new Error(result.error);
        }
    } catch (e) {
        console.error("PDF Gen Error:", e);
        showStatus(`Error: ${e.message}`, "error");
    }
}

// Reorder List Rendering
function renderReorderList() {
    sortableSections.innerHTML = '';
    const data = state.tailoredResume || state.baseResume;
    if (!data) return;

    const fullList = ["summary", "skills", "experience", "projects", "education", "leadership", "research", "certifications", "awards", "volunteering", "languages"];
    let order = data.section_order || fullList;

    // Merge missing
    fullList.forEach(sec => { if (!order.includes(sec)) order.push(sec); });

    order.forEach(section => {
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

        li.addEventListener('dragstart', handleDragStart);
        li.addEventListener('dragover', handleDragOver);
        li.addEventListener('drop', handleDrop);
        li.addEventListener('dragenter', handleDragEnter);
        li.addEventListener('dragleave', handleDragLeave);
        li.addEventListener('dragend', handleDragEnd);

        sortableSections.appendChild(li);
    });
}

// Drag Handlers
let dragSrcEl = null;

function handleDragStart(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    this.classList.add('dragging');
}

function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
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
    if (e.stopPropagation) e.stopPropagation();
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
    sortableSections.querySelectorAll('.sortable-item').forEach(item => item.classList.remove('over'));
}



// Job Detection
async function detectJobDescription() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractJobDescription
        });

        if (results && results[0] && results[0].result) {
            const data = results[0].result;

            if (data.text && data.text.length > 50) {
                updateState({
                    currentJdText: data.text,
                    detectedJobTitle: data.title,
                    detectedCompany: data.company
                });

                // UPDATE UI
                const jobTitle = data.title || "Job";
                const company = data.company || "Unknown";
                showStatus(`Detected: ${jobTitle} @ ${company}`, "success");
                setTimeout(() => showStatus('', ''), 4000); // slightly longer timeout
            } else {
                console.log("Extracted text too short.");
            }
        }
    } catch (e) {
        console.log("Could not extract JD", e);
    }
}

// Version History Logic
async function saveVersion(resumeData, jdTitle) {
    try {
        const data = await chrome.storage.local.get('resume_versions');
        const versions = data.resume_versions || [];

        versions.unshift({
            id: Date.now(),
            timestamp: new Date().toISOString(),
            jdTitle: jdTitle || 'Unknown Job',
            resume: resumeData
        });

        // Keep last 5
        if (versions.length > 5) versions.length = 5;

        await chrome.storage.local.set({ resume_versions: versions });
        console.log("Version saved:", jdTitle);

        // AUTO-REFRESH: If history panel is currently visible, re-render the list
        const historyUI = document.getElementById('historyUI');
        if (historyUI && historyUI.style.display === 'block') {
            renderHistoryList();
        }

    } catch (e) {
        console.error("Save Version Error:", e);
    }
}

async function renderHistoryList() {
    const list = document.getElementById('historyList');
    if (!list) return;

    list.innerHTML = '<div style="padding:10px;text-align:center;color:#666;">Loading...</div>';

    try {
        const data = await chrome.storage.local.get('resume_versions');
        const versions = data.resume_versions || [];

        list.innerHTML = '';
        if (versions.length === 0) {
            list.innerHTML = '<div style="padding:10px;text-align:center;color:#999;">No history found.</div>';
            return;
        }

        versions.forEach(v => {
            const date = new Date(v.timestamp);
            const timeStr = date.toLocaleString(); // Simple local format

            const div = document.createElement('div');
            div.className = 'history-item';
            div.style.cssText = "border-bottom:1px solid #eee; padding:10px 0; display:flex; justify-content:space-between; align-items:center;";

            div.innerHTML = `
                <div>
                    <div style="font-weight:bold; font-size:12px; color:#333;">${v.jdTitle}</div>
                    <div style="font-size:10px; color:#888;">${timeStr}</div>
                </div>
                <div style="display:flex; gap:5px;">
                    <button class="restore-btn" data-id="${v.id}" style="font-size:11px; padding:3px 8px; cursor:pointer;">Restore</button>
                    <button class="delete-btn" data-id="${v.id}" style="font-size:11px; padding:3px 8px; color:#c62828; border:none; background:none; cursor:pointer;">✕</button>
                </div>
            `;
            list.appendChild(div);
        });

        // Listeners
        list.querySelectorAll('.restore-btn').forEach(btn => {
            btn.onclick = async () => {
                if (!confirm("Restore this version? It will replace your current tailored resume.")) return;
                const id = parseInt(btn.dataset.id);
                // Refresh data to be sure
                const latestData = await chrome.storage.local.get('resume_versions');
                const latestVersions = latestData.resume_versions || [];
                const target = latestVersions.find(v => v.id === id);

                if (target) {
                    updateState({ tailoredResume: target.resume });
                    await chrome.storage.local.set({ tailored_resume: target.resume });
                    showStatus("Version restored!", "success");
                    document.getElementById('historyUI').style.display = 'none';
                    // Refresh Main UI actions if needed (should already be fine)
                    if (document.body.classList.contains('popout-mode')) {
                        // If in editor, force reload of active section
                        const editorUI = document.getElementById('editorUI');
                        if (editorUI.style.display === 'block') {
                            const sec = document.getElementById('sectionSelect').value;
                            renderProfileEditor(sec, target.resume, 'formContainer');
                        }
                    }
                }
            };
        });

        list.querySelectorAll('.delete-btn').forEach(btn => {
            btn.onclick = async () => {
                const id = parseInt(btn.dataset.id);
                const currentData = await chrome.storage.local.get('resume_versions');
                const newVersions = (currentData.resume_versions || []).filter(v => v.id !== id);
                await chrome.storage.local.set({ resume_versions: newVersions });
                renderHistoryList(); // Re-render
            };
        });

    } catch (e) {
        console.error("Render History Error:", e);
        list.innerHTML = '<div style="color:red; padding:10px;">Error loading history.</div>';
    }
}

function setupHistoryUI() {
    const historyBtn = document.getElementById('historyBtn');
    const closeHistoryBtn = document.getElementById('closeHistoryBtn');
    const historyUI = document.getElementById('historyUI');

    if (historyBtn) {
        historyBtn.addEventListener('click', () => {
            console.log("History Button Clicked");
            if (historyUI) {
                historyUI.style.display = 'block';
                renderHistoryList();
            }
        });
    }
    if (closeHistoryBtn) {
        closeHistoryBtn.addEventListener('click', () => {
            if (historyUI) historyUI.style.display = 'none';
        });
    }
}

// Auto-run setup if elements exist (extension context)
// Auto-run setup if elements exist (extension context)
// document.addEventListener('DOMContentLoaded', setupHistoryUI);

// ========== FORMAT SETTINGS ==========

const DEFAULT_FORMAT = {
    font: "times",
    density: "normal",
    margins: "normal",
    nameSize: 21,
    bodySize: 10,
    headerSize: 12,
    subheaderSize: 11,
    headerStyle: "uppercase_line",
    bulletChar: "•",
    showLinks: true,
    dateAlign: "right",
    pageSize: "letter"
};

async function loadFormatSettings() {
    const data = await chrome.storage.local.get('format_settings');
    const settings = { ...DEFAULT_FORMAT, ...(data.format_settings || {}) };
    updateState({ formatSettings: settings });
    refreshFormatUI(settings);
    return settings;
}

async function saveFormatSettings(settings) {
    updateState({ formatSettings: settings });
    await chrome.storage.local.set({ format_settings: settings });
}

function refreshFormatUI(settings) {
    // Highlight active toggle buttons
    document.querySelectorAll('.format-option').forEach(btn => {
        const setting = btn.dataset.setting;
        const value = btn.dataset.value;
        btn.classList.toggle('active', settings[setting] === value);
    });

    // Sliders
    const nameSlider = document.getElementById('nameSizeSlider');
    const bodySlider = document.getElementById('bodySizeSlider');
    const headerSizeSlider = document.getElementById('headerSizeSlider');
    const subheaderSizeSlider = document.getElementById('subheaderSizeSlider');

    if (nameSlider) { nameSlider.value = settings.nameSize; document.getElementById('nameSizeValue').textContent = settings.nameSize + 'pt'; }
    if (bodySlider) { bodySlider.value = settings.bodySize; document.getElementById('bodySizeValue').textContent = settings.bodySize + 'pt'; }
    if (headerSizeSlider) { headerSizeSlider.value = settings.headerSize; document.getElementById('headerSizeValue').textContent = settings.headerSize + 'pt'; }
    if (subheaderSizeSlider) { subheaderSizeSlider.value = settings.subheaderSize; document.getElementById('subheaderSizeValue').textContent = settings.subheaderSize + 'pt'; }

    // Dropdown
    const headerSelect = document.getElementById('headerStyleSelect');
    if (headerSelect) headerSelect.value = settings.headerStyle;

    // Checkbox
    const linksCheck = document.getElementById('showLinksCheck');
    if (linksCheck) linksCheck.checked = settings.showLinks;
}

function setupFormatUI() {
    const formatBtn = document.getElementById('formatBtn');
    const formatUI = document.getElementById('formatUI');
    const closeFormatBtn = document.getElementById('closeFormatBtn');

    if (formatBtn) {
        formatBtn.addEventListener('click', async () => {
            await loadFormatSettings();
            formatUI.style.display = 'block';
            document.getElementById('actions').style.display = 'none';
        });
    }

    if (closeFormatBtn) {
        closeFormatBtn.addEventListener('click', () => {
            formatUI.style.display = 'none';
            document.getElementById('actions').style.display = 'block';
        });
    }

    // Toggle buttons
    document.querySelectorAll('.format-option').forEach(btn => {
        btn.addEventListener('click', async () => {
            const setting = btn.dataset.setting;
            const value = btn.dataset.value;
            const settings = { ...state.formatSettings, [setting]: value };
            await saveFormatSettings(settings);
            refreshFormatUI(settings);
        });
    });

    // Sliders
    const nameSlider = document.getElementById('nameSizeSlider');
    if (nameSlider) {
        nameSlider.addEventListener('input', async (e) => {
            const val = parseInt(e.target.value);
            document.getElementById('nameSizeValue').textContent = val + 'pt';
            await saveFormatSettings({ ...state.formatSettings, nameSize: val });
        });
    }

    const bodySlider = document.getElementById('bodySizeSlider');
    if (bodySlider) {
        bodySlider.addEventListener('input', async (e) => {
            const val = parseFloat(e.target.value);
            document.getElementById('bodySizeValue').textContent = val + 'pt';
            await saveFormatSettings({ ...state.formatSettings, bodySize: val });
        });
    }

    const headerSizeSlider = document.getElementById('headerSizeSlider');
    if (headerSizeSlider) {
        headerSizeSlider.addEventListener('input', async (e) => {
            const val = parseFloat(e.target.value);
            document.getElementById('headerSizeValue').textContent = val + 'pt';
            await saveFormatSettings({ ...state.formatSettings, headerSize: val });
        });
    }

    const subheaderSizeSlider = document.getElementById('subheaderSizeSlider');
    if (subheaderSizeSlider) {
        subheaderSizeSlider.addEventListener('input', async (e) => {
            const val = parseFloat(e.target.value);
            document.getElementById('subheaderSizeValue').textContent = val + 'pt';
            await saveFormatSettings({ ...state.formatSettings, subheaderSize: val });
        });
    }

    // Header style dropdown
    const headerSelect = document.getElementById('headerStyleSelect');
    if (headerSelect) {
        headerSelect.addEventListener('change', async (e) => {
            await saveFormatSettings({ ...state.formatSettings, headerStyle: e.target.value });
        });
    }

    // Show links checkbox
    const linksCheck = document.getElementById('showLinksCheck');
    if (linksCheck) {
        linksCheck.addEventListener('change', async (e) => {
            await saveFormatSettings({ ...state.formatSettings, showLinks: e.target.checked });
        });
    }

    // Preview button
    const previewFormatBtn = document.getElementById('previewFormatBtn');
    if (previewFormatBtn) {
        previewFormatBtn.addEventListener('click', async () => {
            if (!state.tailoredResume && !state.baseResume) {
                showStatus("No resume to preview", "error");
                return;
            }
            const resume = state.tailoredResume || state.baseResume;
            // Show loading
            previewFormatBtn.textContent = "Generating...";
            try {
                const result = await generatePdf(resume);
                if (result instanceof Blob) {
                    const url = URL.createObjectURL(result);
                    chrome.tabs.create({ url });
                    setTimeout(() => URL.revokeObjectURL(url), 120000);
                }
            } catch (e) {
                showStatus(e.message, "error");
            } finally {
                previewFormatBtn.textContent = "👁 Preview";
            }
        });
    }

    // Reset button
    const resetFormatBtn = document.getElementById('resetFormatBtn');
    if (resetFormatBtn) {
        resetFormatBtn.addEventListener('click', async () => {
            await saveFormatSettings({ ...DEFAULT_FORMAT });
            refreshFormatUI(DEFAULT_FORMAT);
            showStatus("Format reset to defaults", "info");
        });
    }
}

// ========== DRAG & DROP RESUME ==========

function updateDragCard(resumeData) {
    const dragCard = document.getElementById('dragCard');
    const dragFileName = document.getElementById('dragFileName');
    if (!dragCard) return;

    if (state.latestPdfBlob) {
        dragCard.style.display = 'block';
        dragCard.classList.remove('hidden');
        if (dragFileName) {
            dragFileName.textContent = generateFilename(resumeData);
        }
    } else {
        dragCard.style.display = 'none';
    }
}

function setupDragAndDrop() {
    const dragHandle = document.getElementById('dragHandle');
    if (!dragHandle) return;

    dragHandle.addEventListener('dragstart', (e) => {
        if (!state.latestPdfBlob) {
            e.preventDefault();
            showStatus("No PDF generated yet.", "error");
            return;
        }

        const resumeData = state.tailoredResume || state.baseResume;
        const filename = generateFilename(resumeData);

        // Create a File object from the blob
        const file = new File([state.latestPdfBlob], filename, {
            type: 'application/pdf',
            lastModified: Date.now()
        });

        // Add the file to dataTransfer
        // This is the key line — it lets the browser treat the drag as a file drop
        try {
            e.dataTransfer.items.add(file);
            e.dataTransfer.effectAllowed = 'copy';
        } catch (err) {
            // Fallback: some environments don't support items.add(file)
            // In that case, we can at least set a download URL
            const url = URL.createObjectURL(state.latestPdfBlob);
            e.dataTransfer.setData('DownloadURL', "application/pdf:" + filename + ":" + url);
            // Clean up after drag ends
            dragHandle.addEventListener('dragend', () => URL.revokeObjectURL(url), { once: true });
        }

        dragHandle.classList.add('dragging');

        // Custom drag image (optional)
        const dragImage = document.createElement('div');
        dragImage.textContent = "📄 " + filename;
        dragImage.style.cssText = 'position:absolute; top:-1000px; padding:8px 12px; background:#4338ca; color:white; border-radius:6px; font-size:12px; font-weight:600; white-space:nowrap;';
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 0, 0);
        setTimeout(() => document.body.removeChild(dragImage), 0);
    });

    dragHandle.addEventListener('dragend', () => {
        dragHandle.classList.remove('dragging');
    });
}


function invalidatePdfCache() {
    updateState({ latestPdfBlob: null });
    const dragCard = document.getElementById('dragCard');
    if (dragCard) dragCard.style.display = 'none';
}
