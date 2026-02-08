import { state, updateState } from './modules/state.js';
import { checkCurrentProviderKey, updateStrategyDescription, generateFilename, setButtonLoading, generateDiffSummary } from './modules/utils.js';
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
    analyzeResume,
    extractJDWithAI
} from './modules/api.js';
import { renderProfileEditor, saveProfileChanges, collectBulletCounts, resetEditorState, getCurrentEditingResume } from './modules/editor.js';
import { extractJobDescription } from './modules/jd_extractor.js';
import { showProgress, hideProgress } from './modules/progress.js';
import { saveVersion, setupHistoryUI } from './modules/history.js';
import { setupFormatUI, loadFormatSettings, debouncedSaveFormat } from './modules/format.js';
import { setupReorderUI } from './modules/reorder.js';

let isScanning = false;
let tabDetectionTimer = null;

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

// Helper: Save new profile data (used by all upload/import handlers)
async function saveNewProfile(profileData) {
    // Read what we need first (one read)
    const pData = await chrome.storage.local.get(['profiles', 'active_profile']);
    const profiles = pData.profiles || {};
    profiles[pData.active_profile || 'default'] = profileData;

    // Write everything in one call + one remove (parallel)
    await Promise.all([
        chrome.storage.local.set({
            base_resume: profileData,
            user_profile_name: profileData.name || "User",
            profiles: profiles
        }),
        chrome.storage.local.remove(['tailored_resume', 'jd_analysis', 'ats_analysis'])
    ]);

    // Update in-memory state
    updateState({
        baseResume: profileData,
        tailoredResume: null,
        currentJdAnalysis: null
    });

    if (profileNameDisplay) profileNameDisplay.textContent = profileData.name || "User";
}

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
            // Batch read all needed data in one call
            const data = await chrome.storage.local.get(['profiles', 'active_profile']);
            const profiles = data.profiles || {};
            const currentName = data.active_profile || 'default';

            if (profiles[name]) {
                // Save current profile first
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
        // Drag and drop removed
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

    window.addEventListener('unhandledrejection', (e) => {
        console.error('Unhandled rejection:', e.reason);
        showStatus('Something went wrong. Please try again.', 'error');
        // Re-enable all potentially stuck buttons
        document.querySelectorAll('button:disabled').forEach(btn => {
            if (btn.dataset.originalText) {
                btn.disabled = false;
                btn.textContent = btn.dataset.originalText;
            }
        });
        hideProgress();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

async function loadState() {
    const data = await chrome.storage.local.get([
        'gemini_api_key',
        'groq_api_key',
        'provider',
        'base_resume',
        'tailored_resume',
        'user_profile_name',
        'tailoring_strategy',
        'jd_analysis',
        'ats_analysis',
        'last_analysis',
        'active_profile',
        'current_jd_text',
        'detected_job_title',
        'detected_company',
        'detected_page_url',
        'jd_extraction_method',
        'detected_company_description'
    ]);

    // Backward compatibility: use last_analysis as fallback for jd_analysis
    const jdAnalysis = data.jd_analysis || data.last_analysis || null;

    updateState({
        currentApiKey: data.gemini_api_key || "",
        currentGroqKey: data.groq_api_key || "",
        currentProvider: data.provider || "gemini",
        baseResume: data.base_resume || null,
        tailoredResume: data.tailored_resume || null,
        tailoringStrategy: data.tailoring_strategy || "balanced",
        lastAnalysis: data.ats_analysis || null,
        currentJdAnalysis: jdAnalysis,
        jdKeywords: jdAnalysis ? [
            ...(jdAnalysis.mandatory_keywords || []),
            ...(jdAnalysis.preferred_keywords || []),
            ...(jdAnalysis.industry_terms || [])
        ].map(k => k.toLowerCase()) : [],
        activeProfile: data.active_profile || 'default',
        currentJdText: data.current_jd_text || "",
        detectedJobTitle: data.detected_job_title || null,
        detectedCompany: data.detected_company || null,
        detectedPageUrl: data.detected_page_url || "",
        jdExtractionMethod: data.jd_extraction_method || 'none',
        detectedCompanyDescription: data.detected_company_description || ""
    });

    updateActiveProfileLabel(state.activeProfile);

    setupSettings();
    updateJdStatus();
    updateActiveTabLabel();

    if (state.baseResume) {
        if (profileNameDisplay) profileNameDisplay.textContent = data.user_profile_name || "User";

        if (checkCurrentProviderKey()) {
            showMainUI();
            if (state.tailoredResume) actionsDiv.style.display = 'block';
            if (data.ats_analysis) renderAnalysis(data.ats_analysis);
            else {
                const analysisResults = document.getElementById('analysisResults');
                if (analysisResults) {
                    analysisResults.classList.add('hidden');
                    analysisResults.style.display = 'none';
                }
            }
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
        // Non-blocking: pre-cache PDF in background after UI is ready
        generatePdf(state.tailoredResume).then(blob => {
            if (blob instanceof Blob) {
                updateState({ latestPdfBlob: blob });
                // Drag and drop removed
            }
        }).catch(e => console.log("Pre-cache PDF failed (non-critical):", e));
    }
    updateJdStatus();
}

function setupSettings() {
    const apiKeyInput = document.getElementById('apiKey');
    const groqApiKeyInput = document.getElementById('groqApiKey');
    const providerSelect = document.getElementById('providerSelect');

    // Pre-fill
    if (apiKeyInput) apiKeyInput.value = state.currentApiKey;
    if (groqApiKeyInput) groqApiKeyInput.value = state.currentGroqKey;
    if (providerSelect) {
        providerSelect.value = state.currentProvider;
        toggleProviderUI(state.currentProvider);
    }
}

function setupEventListeners() {
    // Input method tabs (Setup UI)
    document.querySelectorAll('.method-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab styling
            document.querySelectorAll('.method-tab').forEach(t => {
                t.classList.remove('active');
                t.style.background = 'var(--card-bg)';
                t.style.color = 'var(--text-secondary)';
            });
            tab.classList.add('active');
            tab.style.background = 'var(--primary)';
            tab.style.color = 'white';

            // Show correct panel
            document.querySelectorAll('.method-panel').forEach(p => p.style.display = 'none');
            const method = tab.dataset.method;
            if (method === 'resume') document.getElementById('methodResume').style.display = 'block';
            else if (method === 'linkedin') document.getElementById('methodLinkedin').style.display = 'block';
            else if (method === 'text') document.getElementById('methodText').style.display = 'block';
        });
    });

    // LinkedIn PDF upload (Setup UI)
    document.getElementById('uploadLinkedinPdfBtn').addEventListener('click', async () => {
        const file = document.getElementById('linkedinPdfFile').files[0];
        if (!file) {
            showStatus('Please select a LinkedIn PDF file.', 'error', 'uploadStatus');
            return;
        }
        if (!checkCurrentProviderKey()) {
            showStatus('API Key required. Go to Settings.', 'error', 'uploadStatus');
            setTimeout(showSettings, 2000);
            return;
        }

        setButtonLoading(document.getElementById('uploadLinkedinPdfBtn'), true);
        showStatus('Extracting LinkedIn profile...', 'info', 'uploadStatus');

        try {
            const textData = await extractText(file);
            if (textData.error) throw new Error(textData.error);

            const extractionKey = state.currentProvider === 'groq' ? state.currentGroqKey : state.currentApiKey;
            const profileData = await extractBaseProfile(textData.text, extractionKey, state.currentProvider);
            if (profileData.error) throw new Error(profileData.error);

            await saveNewProfile(profileData);

            showStatus('✅ LinkedIn profile imported!', 'success', 'uploadStatus');
            setTimeout(showMainUI, 1500);
        } catch (e) {
            showStatus(`Error: ${e.message}`, 'error', 'uploadStatus');
        } finally {
            setButtonLoading(document.getElementById('uploadLinkedinPdfBtn'), false, 'Upload LinkedIn PDF');
        }
    });

    // LinkedIn URL fetch (Setup UI)
    document.getElementById('fetchLinkedinBtn').addEventListener('click', async () => {
        const urlInput = document.getElementById('linkedinUrlInput');
        const url = urlInput.value.trim();

        // Validate LinkedIn URL
        if (!url || !url.includes('linkedin.com/in/')) {
            showStatus('Please enter a valid LinkedIn profile URL (e.g., https://linkedin.com/in/your-name)', 'error', 'linkedinUrlStatus');
            return;
        }
        if (!checkCurrentProviderKey()) {
            showStatus('API Key required. Go to Settings.', 'error', 'linkedinUrlStatus');
            setTimeout(showSettings, 2000);
            return;
        }

        const btn = document.getElementById('fetchLinkedinBtn');
        setButtonLoading(btn, true);
        showStatus('Opening LinkedIn profile...', 'info', 'linkedinUrlStatus');

        try {
            // Normalize URL
            let profileUrl = url;
            if (!profileUrl.startsWith('http')) profileUrl = 'https://' + profileUrl;

            // Open the LinkedIn URL in a new tab, extract text, then close
            const tab = await chrome.tabs.create({ url: profileUrl, active: false });

            // Wait for page to load
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Page load timed out')), 20000);
                chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
                    if (tabId === tab.id && changeInfo.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        clearTimeout(timeout);
                        // Give LinkedIn a moment to render dynamic content
                        setTimeout(resolve, 3000);
                    }
                });
            });

            // Extract page text
            showStatus('Extracting profile data...', 'info', 'linkedinUrlStatus');
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => document.body.innerText.substring(0, 15000)
            });

            // Close the tab
            chrome.tabs.remove(tab.id).catch(() => { });

            const pageText = results?.[0]?.result || '';
            if (pageText.length < 100) {
                throw new Error('Could not extract profile data. LinkedIn may require you to be logged in. Try the PDF method instead.');
            }

            // Use AI to parse the LinkedIn page text into structured profile
            showStatus('AI is parsing your profile...', 'info', 'linkedinUrlStatus');
            const extractionKey = state.currentProvider === 'groq' ? state.currentGroqKey : state.currentApiKey;
            const profileData = await extractBaseProfile(pageText, extractionKey, state.currentProvider);
            if (profileData.error) throw new Error(profileData.error);

            await saveNewProfile(profileData);

            showStatus('✅ LinkedIn profile imported! Some fields may be incomplete — review in Profile editor.', 'success', 'linkedinUrlStatus');
            setTimeout(showMainUI, 2000);
        } catch (e) {
            showStatus(`LinkedIn import failed: ${e.message}`, 'error', 'linkedinUrlStatus');
        } finally {
            setButtonLoading(btn, false, '🔍 Fetch');
        }
    });

    // Provider Change
    document.getElementById('providerSelect').addEventListener('change', (e) => {
        updateState({ currentProvider: e.target.value });
        toggleProviderUI(state.currentProvider);
    });

    // JD Status buttons



    const manualJdBtn = document.getElementById('manualJdBtn');
    const manualJdInput = document.getElementById('manualJdInput');
    if (manualJdBtn && manualJdInput) {
        manualJdBtn.addEventListener('click', () => {
            manualJdInput.style.display = manualJdInput.style.display === 'none' ? 'block' : 'none';
        });
    }

    const cancelManualJdBtn = document.getElementById('cancelManualJdBtn');
    if (cancelManualJdBtn) {
        cancelManualJdBtn.addEventListener('click', () => {
            document.getElementById('manualJdInput').style.display = 'none';
        });
    }

    const fetchJdBtn = document.getElementById('fetchJdBtn');
    if (fetchJdBtn) {
        fetchJdBtn.addEventListener('click', async () => {
            if (isScanning) return;
            const dot = document.getElementById('jdStatusDot');
            const text = document.getElementById('jdStatusText');
            if (dot) dot.style.background = '#f59e0b';
            if (text) text.textContent = 'Scanning page...';
            fetchJdBtn.disabled = true;
            fetchJdBtn.textContent = '⏳ Scanning...';

            try {
                // Clear success/error before starting
                showStatus("", "");

                const result = await detectJobDescription();

                // If detectJobDescription actually found something new
                if (result && result.text && result.text.length > 50) {
                    const method = state.jdExtractionMethod;
                    if (method === 'ai') {
                        showStatus("🤖 JD extracted using AI — review for accuracy", "success");
                    } else {
                        showStatus("✅ Job description fetched successfully!", "success");
                    }
                } else if (!state.currentJdText || state.currentJdText.length < 50) {
                    showStatus("❌ Could not detect a job description on this page. Try pasting it manually.", "error");
                } else {
                    // We have a JD, but the scan didn't find a *new/better* one for this page?
                    // Or it found nothing but we have old state.
                    showStatus("⚠️ No job details found on this tab. Try pasting it manually.", "info");
                }
                setTimeout(() => showStatus('', ''), 4000);

            } catch (e) {
                showStatus("Scan failed: " + e.message, "error");
            } finally {
                fetchJdBtn.disabled = false;
                fetchJdBtn.textContent = '🔍 Fetch from Page';
                updateJdStatus();
            }
        });
    }

    const jdPdfFile = document.getElementById('jdPdfFile');
    if (jdPdfFile) {
        jdPdfFile.addEventListener('change', () => {
            const nameEl = document.getElementById('jdPdfFileName');
            if (nameEl) {
                nameEl.textContent = jdPdfFile.files[0] ? jdPdfFile.files[0].name : '';
            }
        });
    }

    const saveManualJdBtn = document.getElementById('saveManualJdBtn');
    if (saveManualJdBtn) {
        saveManualJdBtn.addEventListener('click', async () => {
            // Check for PDF first
            const jdFile = document.getElementById('jdPdfFile');
            let jdText = '';

            if (jdFile && jdFile.files[0]) {
                // Extract text from uploaded JD PDF
                showStatus("Extracting JD from PDF...", "info");
                const result = await extractText(jdFile.files[0]);
                if (result.error) {
                    showStatus("Failed to read PDF: " + result.error, "error");
                    return;
                }
                jdText = result.text;
            } else {
                jdText = document.getElementById('manualJdText').value.trim();
            }

            if (jdText.length < 50) {
                showStatus("JD text is too short (min 50 characters)", "error");
                return;
            }

            updateState({
                currentJdText: jdText,
                detectedJobTitle: 'Manual JD',
                detectedCompany: 'Pasted',
                detectedPageUrl: '',
                jdExtractionMethod: 'manual'
            });
            updateJdStatus();
            document.getElementById('manualJdInput').style.display = 'none';

            // Hide ATS analysis UI when JD is updated
            hideAtsAnalysisUI();

            showStatus("Job description loaded!", "success");
            setTimeout(() => showStatus('', ''), 2000);
        });
    }

    const toggleJdBtn = document.getElementById('toggleJdPreviewBtn');
    if (toggleJdBtn) {
        toggleJdBtn.addEventListener('click', () => {
            const previewText = document.getElementById('jdPreviewText');
            const isExpanded = previewText.classList.contains('expanded');

            if (isExpanded) {
                previewText.classList.remove('expanded');
                previewText.style.maxHeight = '48px';
                previewText.style.overflowY = 'hidden';
                toggleJdBtn.textContent = 'Expand View';
            } else {
                previewText.classList.add('expanded');
                previewText.style.maxHeight = '400px';
                previewText.style.overflowY = 'auto';
                toggleJdBtn.textContent = 'Collapse View';
            }
        });
    }

    const previewText = document.getElementById('jdPreviewText');
    const saveJdEditBtn = document.getElementById('saveJdEditBtn');
    const jdEditSaveContainer = document.getElementById('jdEditSaveContainer');

    if (previewText && saveJdEditBtn && jdEditSaveContainer) {
        previewText.addEventListener('input', () => {
            const hasChanged = previewText.value !== state.currentJdText;
            jdEditSaveContainer.style.display = hasChanged ? 'block' : 'none';
        });

        saveJdEditBtn.addEventListener('click', () => {
            const newText = previewText.value.trim();
            if (newText.length < 50) {
                showStatus("JD text is too short", "error");
                return;
            }
            updateState({
                currentJdText: newText,
                jdExtractionMethod: 'manual'
            });
            jdEditSaveContainer.style.display = 'none';

            // Hide ATS analysis UI when JD is updated
            hideAtsAnalysisUI();

            showStatus("JD updated!", "success");
            setTimeout(() => showStatus('', ''), 2000);
            updateJdStatus();
        });
    }


    // Tab change listeners for JD card context
    chrome.tabs.onActivated.addListener(() => {
        updateActiveTabLabel();
        clearTimeout(tabDetectionTimer);
        tabDetectionTimer = setTimeout(() => {
            detectJobDescription().catch(() => { });
        }, 500);
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete') {
            updateActiveTabLabel();
            clearTimeout(tabDetectionTimer);
            tabDetectionTimer = setTimeout(() => {
                detectJobDescription().catch(() => { });
            }, 500);
        }
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
        renderProfileEditor('summary', state.baseResume, 'profileFormContainer'); // First open — pass resume
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

        // Close profile section and return to main UI
        showMainUI();
    });
    document.getElementById('cancelProfileEditBtn').addEventListener('click', showMainUI);

    // Save Settings
    saveSettingsBtn.addEventListener('click', async () => {
        const geminiKey = apiKeyInput.value.trim();
        const groqKey = document.getElementById('groqApiKey').value.trim();
        const provider = document.getElementById('providerSelect').value;

        if (provider === 'gemini' && !geminiKey) {
            showStatus("Please enter a Gemini API key.", "error", "settingsStatus");
            return;
        }
        if (provider === 'groq' && !groqKey) {
            showStatus("Please enter a Groq API key.", "error", "settingsStatus");
            return;
        }

        await chrome.storage.local.set({
            gemini_api_key: geminiKey,
            groq_api_key: groqKey,
            provider: provider
        });

        updateState({
            currentApiKey: geminiKey,
            currentGroqKey: groqKey,
            currentProvider: provider
        });

        showStatus("Settings saved!", "success", "settingsStatus");
        setTimeout(() => {
            if (state.baseResume) showMainUI();
            else showSetupUI();
        }, 1000);
    });

    // Skip Settings
    const skipSettingsBtn = document.getElementById('skipSettingsBtn');
    if (skipSettingsBtn) {
        skipSettingsBtn.addEventListener('click', () => {
            if (state.baseResume) showMainUI();
            else showSetupUI();
        });
    }

    // Upload Resume
    uploadBtn.addEventListener('click', async () => {
        const file = resumeFile.files[0];
        if (!file) {
            showStatus("Please select a PDF file.", "error", "uploadStatus");
            return;
        }
        if (!checkCurrentProviderKey()) {
            showStatus("API Key required. Please go to Settings to add it.", "error", "uploadStatus");
            setTimeout(showSettings, 2000);
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

            await saveNewProfile(profileData);

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
            showStatus("API Key required for text processing.", "error", statusId);
            setTimeout(showSettings, 2000);
            return;
        }

        btn.disabled = true;
        showStatus("Processing...", "info", statusId);

        try {
            const extractionKey = state.currentProvider === 'groq' ? state.currentGroqKey : state.currentApiKey;
            const profileData = await extractBaseProfile(text, extractionKey, state.currentProvider);
            if (profileData.error) throw new Error(profileData.error);

            await saveNewProfile(profileData);

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

            await saveNewProfile(profileData);

            showStatus('✅ Updated!', 'success', 'profileStatus');
            renderProfileEditor(document.getElementById('profileSectionSelect').value, state.baseResume);
        } catch (e) {
            showStatus(`Error: ${e.message}`, 'error', 'profileStatus');
        }
    });

    // LinkedIn PDF re-upload (Profile UI)
    document.getElementById('reuploadLinkedinPdfBtn').addEventListener('click', async () => {
        const file = document.getElementById('reuploadLinkedinPdf').files[0];
        if (!file) {
            showStatus('Please select a LinkedIn PDF.', 'error', 'profileStatus');
            return;
        }
        showStatus('Importing LinkedIn PDF...', 'info', 'profileStatus');
        try {
            const textData = await extractText(file);
            if (textData.error) throw new Error(textData.error);
            const extractionKey = state.currentProvider === 'groq' ? state.currentGroqKey : state.currentApiKey;
            const profileData = await extractBaseProfile(textData.text, extractionKey, state.currentProvider);
            if (profileData.error) throw new Error(profileData.error);

            await saveNewProfile(profileData);

            showStatus('✅ Profile updated from LinkedIn!', 'success', 'profileStatus');
            renderProfileEditor(document.getElementById('profileSectionSelect').value, state.baseResume);
        } catch (e) {
            showStatus(`Error: ${e.message}`, 'error', 'profileStatus');
        }
    });

    // LinkedIn URL re-upload (Profile UI)
    document.getElementById('reuploadLinkedinUrlBtn').addEventListener('click', async () => {
        const url = document.getElementById('reuploadLinkedinUrl').value.trim();
        if (!url || !url.includes('linkedin.com/in/')) {
            showStatus('Enter a valid LinkedIn URL.', 'error', 'profileStatus');
            return;
        }
        if (!checkCurrentProviderKey()) {
            showStatus('API Key required.', 'error', 'profileStatus');
            return;
        }

        const btn = document.getElementById('reuploadLinkedinUrlBtn');
        setButtonLoading(btn, true);
        showStatus('Fetching LinkedIn profile...', 'info', 'profileStatus');

        try {
            let profileUrl = url;
            if (!profileUrl.startsWith('http')) profileUrl = 'https://' + profileUrl;

            const tab = await chrome.tabs.create({ url: profileUrl, active: false });
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Page load timed out')), 20000);
                chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
                    if (tabId === tab.id && changeInfo.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        clearTimeout(timeout);
                        setTimeout(resolve, 3000);
                    }
                });
            });

            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => document.body.innerText.substring(0, 15000)
            });
            chrome.tabs.remove(tab.id).catch(() => { });

            const pageText = results?.[0]?.result || '';
            if (pageText.length < 100) throw new Error('Could not extract data. Try PDF upload instead.');

            showStatus('Parsing profile with AI...', 'info', 'profileStatus');
            const extractionKey = state.currentProvider === 'groq' ? state.currentGroqKey : state.currentApiKey;
            const profileData = await extractBaseProfile(pageText, extractionKey, state.currentProvider);
            if (profileData.error) throw new Error(profileData.error);

            await saveNewProfile(profileData);

            showStatus('✅ Profile updated from LinkedIn!', 'success', 'profileStatus');
            renderProfileEditor(document.getElementById('profileSectionSelect').value, state.baseResume);
        } catch (e) {
            showStatus(`Error: ${e.message}`, 'error', 'profileStatus');
        } finally {
            setButtonLoading(btn, false, '🔍 Fetch');
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

                document.getElementById('actions').style.display = 'block';
                document.getElementById('actions').classList.remove('hidden');

            } catch (e) {
                console.error("Base Resume Error:", e);
                showStatus(`Error preparing resume: ${e.message}`, "error");
            } finally {
                setTimeout(() => { setButtonLoading(generateBaseBtn, false, "📄 Export Base Resume (No AI)"); }, 500);
            }
        });
    }


    // Generate Button
    generateBtn.addEventListener('click', async () => {
        console.log("Generate (AI) clicked");
        // Drag and drop removed

        if (!checkCurrentProviderKey()) {
            showStatus("API Key missing! Cannot generate AI resume.", "error");
            setTimeout(showSettings, 2000);
            return;
        }

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

        const activeKey = state.currentProvider === 'groq' ? state.currentGroqKey : state.currentApiKey;

        try {
            showProgress('analyzing', `Using ${state.currentProvider === 'groq' ? 'Groq' : 'Gemini'}...`);
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
                jd_analysis: analysis
            });

            showProgress('complete');
            setTimeout(() => {
                hideProgress();
                if (actionsDiv) actionsDiv.style.display = 'block';

                const wittySuccess = [
                    "Resume forged! 🔥 Ready to crush that ATS.",
                    "Done! Your resume is now armed and dangerous.",
                    "Tailored and loaded. Go get that interview! 💪",
                    "Resume locked in. ATS doesn't stand a chance.",
                    "Forged! Your resume now speaks their language."
                ];
                showStatus(wittySuccess[Math.floor(Math.random() * wittySuccess.length)], "success");

                // Save Version
                saveVersion(newResume, analysis ? (analysis.title || analysis.job_title || "New Role") : "Tailored Resume");

                const diff = generateDiffSummary(state.baseResume, newResume);
                const diffContainer = document.getElementById('diffSummaryContainer');
                if (diff && diffContainer) {
                    const parts = [];
                    if (diff.bulletsChanged > 0) parts.push(`${diff.bulletsChanged} bullets tailored`);
                    if (diff.summaryChanged) parts.push('summary rewritten');
                    if (diff.skillsAdded > 0) parts.push(`${diff.skillsAdded} skills added`);
                    if (diff.skillsRemoved > 0) parts.push(`${diff.skillsRemoved} skills removed`);

                    if (parts.length > 0) {
                        diffContainer.innerHTML = `<div class="card" style="font-size:11px; padding:10px; margin-top:8px; background:#f0fdf4; border:1px solid #a7f3d0;">
                            ✨ AI changes: ${parts.join(' · ')}
                        </div>`;
                        setTimeout(() => { diffContainer.innerHTML = ''; }, 10000);
                    }
                }
            }, 1000);

            // Don't show ATS analysis UI after forging - only when user clicks ATS Score button
            // Hide the ATS analysis UI if it was previously shown
            hideAtsAnalysisUI();

            // After tailoring success, pre-generate the PDF and download
            await generateAndDownloadPDF(newResume);

        } catch (e) {
            console.error("Tailoring Error:", e);
            showProgress('error', e.message);
            showStatus(`Error: ${e.message}`, "error");
            setTimeout(hideProgress, 3000);
        } finally {
            setButtonLoading(generateBtn, false, "🔥 Forge My Resume");
            buttonsToDisable.forEach(b => { if (b) b.disabled = false; });
        }
    });

    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => generateAndDownloadPDF(state.tailoredResume));
    }

    if (previewBtn) {
        previewBtn.addEventListener('click', async () => {
            console.log("Preview clicked");
            if (!state.tailoredResume) {
                showStatus("Nothing to preview yet. Forge a resume first! 🔥", "error");
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
                setButtonLoading(previewBtn, false, "👁 Preview");
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
            answerOutput.classList.remove('hidden');
            answerOutput.style.display = 'block';
            answerOutput.textContent = "Generating answer...";

            try {
                const activeKey = state.currentProvider === 'groq' ? state.currentGroqKey : state.currentApiKey;
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
            // Drag and drop removed
            setButtonLoading(saveManualBtn, true);
            try {
                const activeSection = document.getElementById('sectionSelect').value;
                // parse current DOM to update object
                await saveProfileChanges(activeSection, 'formContainer');

                // Generate PDF logic immediately (cache only)
                await generateAndCachePDF(state.tailoredResume);

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
            // Drag and drop removed
            setButtonLoading(saveRegenBtn, true);

            try {
                const activeSection = document.getElementById('sectionSelect').value;
                await saveProfileChanges(activeSection, 'formContainer');

                // 2. Collect Bullet Counts
                const bulletCounts = collectBulletCounts(activeSection, 'formContainer');

                // 3. Call API
                const activeKey = state.currentProvider === 'groq' ? state.currentGroqKey : state.currentApiKey;

                // We need the JD analysis to be present for regeneration context
                let jdAnalysis = state.currentJdAnalysis;
                if (!jdAnalysis) {
                    // Attempt to recover from storage if not in state
                    const data = await chrome.storage.local.get('jd_analysis');
                    jdAnalysis = data.jd_analysis;
                }

                if (!jdAnalysis) {
                    showStatus("No JD context found for regeneration. Just saving...", "info");
                    setButtonLoading(saveRegenBtn, false, "Save & Regenerate");
                    return;
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

                    // Generate PDF (cache only for regeneration)
                    await generateAndCachePDF(finalResume);

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
            await saveProfileChanges(activeSection, 'formContainer');

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

            const activeKey = state.currentProvider === 'groq' ? state.currentGroqKey : state.currentApiKey;

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
                updateState({ lastAnalysis: data, hasAnalyzed: true });
                await chrome.storage.local.set({ ats_analysis: data });
                showStatus(`Analysis Complete! (${((Date.now() - start) / 1000).toFixed(1)}s)`, "success");
                setTimeout(() => showStatus("", ""), 3000);

            } catch (e) {
                showStatus("Analysis Failed: " + e.message, "error");
            } finally {
                setButtonLoading(analyzeBtn, false, "📊 ATS Score");
            }
        });
    }

    // --- Reorder Logic ---
    setupReorderUI(generateAndCachePDF);
}

// Helper: Generate PDF & Cache Blob
async function generateAndCachePDF(resumeData) {
    if (!resumeData) {
        showStatus("No resume data to generate PDF.", "error");
        return null;
    }

    showStatus("Generating PDF...", "info");

    try {
        const result = await generatePdf(resumeData);
        if (result instanceof Blob) {
            // Cache for drag-and-drop
            updateState({ latestPdfBlob: result });
            // Drag and drop removed

            showStatus("PDF Ready!", "success");
            setTimeout(() => { showStatus('', ''); }, 2000);
            return result;
        } else if (result.error) {
            throw new Error(result.error);
        }
        return null;
    } catch (e) {
        console.error("PDF generation failed:", e);
        showStatus(`PDF Error: ${e.message}`, "error");
        return null;
    }
}

async function generateAndDownloadPDF(resumeData) {
    const result = await generateAndCachePDF(resumeData);
    if (result instanceof Blob) {
        showStatus("PDF Ready. Downloading...", "success");

        // Auto download
        const url = URL.createObjectURL(result);
        const a = document.createElement('a');
        a.href = url;
        a.download = generateFilename(resumeData);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => { URL.revokeObjectURL(url); }, 60000);
    }
}





// Job Detection
async function detectJobDescription() {
    if (isScanning) return null;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return null;

    const url = tab.url || '';
    if (url.startsWith('chrome://') || url.startsWith('about:') || url.startsWith('chrome-extension://')) {
        updateJdStatus();
        return null;
    }

    isScanning = true;
    let finalResult = null;

    try {
        // Step 1: Try client-side extraction (fast, no API cost)
        const results = await Promise.race([
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: extractJobDescription
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]);

        let bestText = '';
        let bestTitle = '';
        let bestCompany = '';

        if (results && results[0] && results[0].result) {
            const data = results[0].result;
            bestText = data.text || '';
            bestTitle = data.title || '';
            bestCompany = data.company || '';
        }

        if (bestText.length > 200) {
            // Good extraction — use it directly
            const updates = {
                currentJdText: bestText,
                detectedJobTitle: bestTitle,
                detectedCompany: bestCompany,
                detectedPageUrl: tab.url || '',
                jdExtractionMethod: 'auto'
            };
            updateState(updates);
            await chrome.storage.local.set({
                current_jd_text: bestText,
                detected_job_title: bestTitle,
                detected_company: bestCompany,
                detected_page_url: tab.url || '',
                jd_extraction_method: 'auto'
            });
            finalResult = updates;
            return updates;
        }

        // Step 2: Client-side extraction got too little text — try LLM fallback
        if (!checkCurrentProviderKey()) {
            if (bestText.length > 50) {
                const updates = {
                    currentJdText: bestText,
                    detectedJobTitle: bestTitle,
                    detectedCompany: bestCompany,
                    detectedPageUrl: tab.url || '',
                    jdExtractionMethod: 'auto-partial'
                };
                updateState(updates);
                await chrome.storage.local.set({
                    current_jd_text: bestText,
                    detected_job_title: bestTitle,
                    detected_company: bestCompany,
                    detected_page_url: tab.url || '',
                    jd_extraction_method: 'auto-partial'
                });
                finalResult = updates;
                return updates;
            }
            return null;
        }

        console.log("Client-side extraction insufficient. Trying AI fallback...");

        const rawResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => document.body.innerText.substring(0, 15000)
        });

        const rawText = rawResults?.[0]?.result || '';
        if (rawText.length < 100) return null;

        const activeKey = state.currentProvider === 'groq' ? state.currentGroqKey : state.currentApiKey;
        const aiResult = await extractJDWithAI(rawText, activeKey, state.currentProvider);

        if (aiResult.error) {
            console.log("AI JD extraction failed:", aiResult.error);
            if (bestText.length > 50) {
                const updates = {
                    currentJdText: bestText,
                    detectedJobTitle: bestTitle,
                    detectedCompany: bestCompany,
                    detectedPageUrl: tab.url || '',
                    jdExtractionMethod: 'auto-partial'
                };
                updateState(updates);
                await chrome.storage.local.set({
                    current_jd_text: bestText,
                    detected_job_title: bestTitle,
                    detected_company: bestCompany,
                    detected_page_url: tab.url || '',
                    jd_extraction_method: 'auto-partial'
                });
                finalResult = updates;
                return updates;
            }
            return null;
        }

        const updates = {
            currentJdText: aiResult.text,
            detectedJobTitle: aiResult.title,
            detectedCompany: aiResult.company,
            detectedCompanyDescription: aiResult.companyDescription || '',
            detectedPageUrl: tab.url || '',
            jdExtractionMethod: 'ai'
        };
        updateState(updates);
        await chrome.storage.local.set({
            current_jd_text: aiResult.text,
            detected_job_title: aiResult.title,
            detected_company: aiResult.company,
            detected_company_description: aiResult.companyDescription || '',
            detected_page_url: tab.url || '',
            jd_extraction_method: 'ai'
        });
        finalResult = updates;
        return updates;

    } catch (e) {
        console.log("JD scan failed:", e.message);
        return null;
    } finally {
        isScanning = false;
        updateJdStatus();
        updateActiveTabLabel();
    }
}

async function updateActiveTabLabel() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const label = document.getElementById('activeTabUrl');
        if (label && tab) {
            const url = tab.url || '';
            if (url.startsWith('chrome://') || url.startsWith('about:')) {
                label.textContent = 'Browser page (cannot scan)';
                label.style.color = '#ef4444';
            } else {
                // Show shortened URL
                try {
                    const parsed = new URL(url);
                    label.textContent = parsed.hostname + parsed.pathname.substring(0, 40);
                } catch {
                    label.textContent = url.substring(0, 50);
                }
                label.style.color = 'var(--text-muted)';
            }
            label.title = url;
        }
    } catch (e) { /* ignore */ }
}

// Helper function to hide ATS analysis UI when JD changes
function hideAtsAnalysisUI() {
    const analysisResults = document.getElementById('analysisResults');
    if (analysisResults) {
        analysisResults.classList.add('hidden');
        analysisResults.style.display = 'none';
    }
}

function updateJdStatus() {
    const dot = document.getElementById('jdStatusDot');
    const text = document.getElementById('jdStatusText');
    const url = document.getElementById('jdSourceUrl');
    const previewContainer = document.getElementById('jdPreviewContainer');
    const previewText = document.getElementById('jdPreviewText');
    if (!dot || !text) return;

    if (state.currentJdText && state.currentJdText.length > 50) {
        dot.style.background = '#10b981';
        const title = state.detectedJobTitle || 'Job detected';
        const company = state.detectedCompany || '';
        text.textContent = company ? `${title} @ ${company}` : title;

        // Show source method
        if (url) {
            const method = state.jdExtractionMethod || 'auto';
            const methodLabel = {
                'auto': '✅ Auto-detected from page',
                'auto-partial': '⚠️ Partial detection — consider manual paste for better results',
                'ai': '🤖 AI-extracted from page content',
                'manual': '📝 Manually provided'
            }[method] || '';

            const pageUrl = state.detectedPageUrl || '';
            let displayUrl = '';
            if (pageUrl) {
                try {
                    displayUrl = new URL(pageUrl).hostname;
                } catch (e) {
                    displayUrl = pageUrl.substring(0, 30);
                }
            }
            url.textContent = methodLabel + (displayUrl ? ` · ${displayUrl}` : '');
            url.title = pageUrl;
        }

        // Update JD Preview
        if (previewContainer && previewText) {
            previewContainer.style.display = 'block';
            previewText.value = state.currentJdText;

            // Sync expansion state UI
            if (previewText.classList.contains('expanded')) {
                previewText.style.maxHeight = '400px';
                previewText.style.overflowY = 'auto';
                const toggleBtn = document.getElementById('toggleJdPreviewBtn');
                if (toggleBtn) toggleBtn.textContent = 'Collapse View';
            } else {
                previewText.style.maxHeight = '48px';
                previewText.style.overflowY = 'hidden';
                const toggleBtn = document.getElementById('toggleJdPreviewBtn');
                if (toggleBtn) toggleBtn.textContent = 'Expand View';
            }

            const jdEditSaveContainer = document.getElementById('jdEditSaveContainer');
            if (jdEditSaveContainer) jdEditSaveContainer.style.display = 'none';
        }

        // Hide ATS analysis UI when JD changes
        hideAtsAnalysisUI();
    } else {
        dot.style.background = '#9ca3af';
        text.textContent = 'No job description loaded';
        if (url) url.textContent = 'Navigate to a job posting and click "Fetch from Page" or paste manually';
        if (previewContainer) previewContainer.style.display = 'none';
    }
}


