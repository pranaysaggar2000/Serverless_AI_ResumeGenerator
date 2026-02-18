import { state, updateState, DEBUG } from './modules/state.js';
import { checkCurrentProviderKey, getApiKeyForProvider, updateStrategyDescription, generateFilename, setButtonLoading, generateDiffSummary, showConfirmDialog, debugLog } from './modules/utils.js';
import {
    showStatus,
    toggleProviderUI,
    showMainUI,
    showSetupUI,
    showSettings,
    showProfileUI,
    renderAnalysis,
    renderCopyList,
    updateUsageDisplay,
    renderAuthSection,
    renderQuickStatus
} from './modules/ui.js';
import { loginWithGoogle, logout, fetchUsageStatus } from './modules/auth.js';
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
import { logError, logWarn, sendFeedback } from './modules/logger.js';

// --- Live Preview Connection ---
import { initLivePreview, openLivePreview, sendPreviewUpdate, onLiveStateUpdate } from './modules/live_preview.js';
// Initialize immediately
initLivePreview();
// CSP COMPLIANCE: Delegate clicks for dynamically injected links
document.addEventListener('click', (e) => {
    if (e.target && (e.target.classList.contains('settings-redirect') || e.target.classList.contains('settings-link'))) {
        e.preventDefault();
        showSettings();
    }
});

let isScanning = false;
let tabDetectionTimer = null;
let lastProfileSection = 'summary';
let lastEditorSection = 'summary';

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
    const cloneForBase = JSON.parse(JSON.stringify(profileData));
    const cloneForProfiles = JSON.parse(JSON.stringify(profileData));

    // Read what we need first
    const pData = await chrome.storage.local.get(['profiles', 'active_profile']);
    const profiles = pData.profiles || {};
    profiles[pData.active_profile || 'default'] = cloneForProfiles;

    // Write everything in one call + one remove (parallel)
    await Promise.all([
        chrome.storage.local.set({
            base_resume: cloneForBase,
            user_profile_name: profileData.name || "User",
            profiles: profiles
        }),
        chrome.storage.local.remove(['tailored_resume', 'jd_analysis', 'ats_analysis'])
    ]);

    // Update in-memory state
    updateState({
        baseResume: JSON.parse(JSON.stringify(cloneForBase)),
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
        const isDefault = name === 'default';

        // Left side: Indicator + Name
        const leftDiv = document.createElement('div');
        leftDiv.style.cssText = "display:flex; align-items:center; gap:6px;";

        const indicator = document.createElement('span');
        indicator.style.cssText = `width:8px; height:8px; border-radius:50%; background:${isActive ? '#6366f1' : '#d1d5db'};`;

        const nameSpan = document.createElement('span');
        nameSpan.style.cssText = `font-weight:${isActive ? '600' : '400'}; line-height: 1.2;`;
        nameSpan.textContent = name;

        if (isDefault) {
            const defaultTag = document.createElement('span');
            defaultTag.style.cssText = "color:#6366f1; font-weight: normal; margin-left: 2px;";
            defaultTag.textContent = "(Initial)";
            nameSpan.appendChild(defaultTag);
        }

        leftDiv.appendChild(indicator);
        leftDiv.appendChild(nameSpan);

        // Right side: Buttons
        const rightDiv = document.createElement('div');
        rightDiv.style.cssText = "display:flex; gap:4px; align-items:center;";

        if (!isActive) {
            const switchBtn = document.createElement('button');
            switchBtn.className = 'profile-switch-btn';
            switchBtn.dataset.name = name;
            switchBtn.style.cssText = "font-size:10px; padding:2px 8px; cursor:pointer; border:1px solid #d1d5db; border-radius:4px; background:white;";
            switchBtn.textContent = 'Switch';
            rightDiv.appendChild(switchBtn);
        } else {
            const activeLabel = document.createElement('span');
            activeLabel.style.cssText = "font-size:10px; color:#6366f1; font-weight:600;";
            activeLabel.textContent = 'Active';
            rightDiv.appendChild(activeLabel);
        }

        if (!isDefault) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'profile-delete-btn';
            deleteBtn.dataset.name = name;
            deleteBtn.style.cssText = "font-size:10px; width:20px; height:20px; display:flex; align-items:center; justify-content:center; cursor:pointer; border:none; background:none; color:#ef4444; border-radius: 4px;";
            deleteBtn.textContent = '✕';

            // Hover effect logic handled by CSS or leave simple for now
            rightDiv.appendChild(deleteBtn);
        } else {
            const spacer = document.createElement('div');
            spacer.style.width = '20px';
            rightDiv.appendChild(spacer);
        }

        div.appendChild(leftDiv);
        div.appendChild(rightDiv);
        list.appendChild(div);
    });

    // Attach event listeners
    list.querySelectorAll('.profile-switch-btn').forEach(btn => {
        btn.onclick = async () => {
            const name = btn.dataset.name;
            const data = await chrome.storage.local.get(['profiles', 'active_profile']);
            const profiles = data.profiles || {};
            const currentName = data.active_profile || 'default';

            if (profiles[name]) {
                // Save current profile state before switching
                profiles[currentName] = JSON.parse(JSON.stringify(state.baseResume));

                const newResume = JSON.parse(JSON.stringify(profiles[name]));
                updateState({ baseResume: JSON.parse(JSON.stringify(newResume)), activeProfile: name });
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
                const section = document.getElementById('profileSectionSelect')?.value || 'Experience';
                renderProfileEditor(section, newResume);
            }
        };
    });

    list.querySelectorAll('.profile-delete-btn').forEach(btn => {
        btn.onclick = async () => {
            const name = btn.dataset.name;
            if (name === 'default') return; // Protective check

            const confirmed = await showConfirmDialog(`Delete profile "${name}"? This cannot be undone.`);
            if (!confirmed) return;

            const data = await chrome.storage.local.get(['profiles', 'active_profile']);
            const profiles = data.profiles || {};
            const activeProfile = data.active_profile || 'default';

            delete profiles[name];

            // If deleted the active profile, switch back to 'default'
            if (name === activeProfile) {
                const defaultResume = profiles['default'];
                updateState({ baseResume: defaultResume, activeProfile: 'default' });
                await chrome.storage.local.set({
                    profiles,
                    active_profile: 'default',
                    base_resume: defaultResume,
                    user_profile_name: defaultResume.name || 'User'
                });
                if (profileNameDisplay) profileNameDisplay.textContent = defaultResume.name || 'User';
                updateActiveProfileLabel('default');
                renderProfileList(profiles, 'default');
            } else {
                await chrome.storage.local.set({ profiles });
                renderProfileList(profiles, activeProfile);
            }

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
        setupProfileManagement();
        setupFormatUI();

        // Listen for real-time updates from Full Editor
        onLiveStateUpdate((newResume) => {
            const copyUI = document.getElementById('copyUI');
            if (copyUI && copyUI.style.display === 'block') {
                renderCopyList(newResume);
            }
        });

        // Refresh usage if logged in
        if (state.isLoggedIn && state.authMode === 'free') {
            const { fetchUsageStatus } = await import('./modules/auth.js');
            fetchUsageStatus().catch(e => { });
        }

        renderQuickStatus();

        // Route to correct screen
        const isSetTypeA = state.isLoggedIn;
        const isSetTypeB = checkCurrentProviderKey();

        if (!isSetTypeA && !isSetTypeB && !state.baseResume) {
            // New user, show onboarding in Settings
            showSettings();
        } else if (!state.baseResume) {
            showSetupUI();
        } else {
            showMainUI();
        }
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
        'cerebras_api_key',
        'openrouter_api_key',
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
        'detected_company_description',
        'last_parsed_jd_text',
        'auth_mode',
        'page_mode',
        'excluded_items',
        'must_include_items',
        'jd_keywords',
        'merge_research_projects'
    ]);

    // Backward compatibility: use last_analysis as fallback for jd_analysis
    const jdAnalysis = data.jd_analysis || data.last_analysis || null;

    updateState({
        currentApiKey: data.gemini_api_key || "",
        currentGroqKey: data.groq_api_key || "",
        currentCerebrasKey: data.cerebras_api_key || "",
        currentOpenRouterKey: data.openrouter_api_key || "",
        currentProvider: data.provider || "gemini",
        baseResume: data.base_resume || null,
        tailoredResume: data.tailored_resume || null,
        tailoringStrategy: data.tailoring_strategy || "balanced",
        lastAnalysis: data.ats_analysis || null,
        currentJdAnalysis: jdAnalysis,
        lastParsedJdText: data.last_parsed_jd_text || "",
        jdKeywords: jdAnalysis ? [
            ...(jdAnalysis.mandatory_keywords || []),
            ...(jdAnalysis.preferred_keywords || []),
            ...(jdAnalysis.industry_terms || [])
        ].map(k => k.toLowerCase()) : (data.jd_keywords || []),
        excludedItems: data.excluded_items || null,
        mustIncludeItems: data.must_include_items || null,
        activeProfile: data.active_profile || 'default',
        currentJdText: data.current_jd_text || "",
        detectedJobTitle: data.detected_job_title || null,
        detectedCompany: data.detected_company || null,
        detectedPageUrl: data.detected_page_url || "",
        jdExtractionMethod: data.jd_extraction_method || 'none',
        detectedCompanyDescription: data.detected_company_description || "",
        mergeResearchIntoProjects: data.merge_research_projects || false
        // DO NOT set authMode here - wait until after loadAuthState()
    });

    // Load Cerebras key on init
    const cerebrasInput = document.getElementById('cerebrasApiKey');
    if (cerebrasInput) cerebrasInput.value = data.cerebras_api_key || '';

    const badge = document.getElementById('agentModeBadge');
    if (badge && (data.cerebras_api_key) && (data.groq_api_key)) badge.style.display = 'block';

    // Load authentication state first, which will set isLoggedIn and authMode if tokens exist
    const { loadAuthState } = await import('./modules/auth.js');
    await loadAuthState();

    // NOW determine authMode based on the loaded auth state
    // Priority: 1) Stored auth_mode preference, 2) If logged in, use 'free', 3) If has BYOK keys, use 'byok', 4) Default to 'free'
    let finalAuthMode = data.auth_mode; // Respect user's explicit choice if stored
    if (!finalAuthMode) {
        // If no explicit choice, auto-determine
        if (state.isLoggedIn) {
            finalAuthMode = 'free';
        } else if (data.gemini_api_key || data.groq_api_key || data.cerebras_api_key || data.openrouter_api_key) {
            finalAuthMode = 'byok';
        } else {
            finalAuthMode = 'free'; // Default to free tier (user will need to login)
        }
    }
    updateState({ authMode: finalAuthMode });

    // Restore page mode
    const pageMode = data.page_mode || '1page';
    updateState({ pageMode });
    // Update toggle UI
    setTimeout(() => {
        document.querySelectorAll('.page-mode-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === pageMode);
        });
    }, 100);

    updateMergeResearchVisibility();

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
        }).catch(e => { });
    }
    updateJdStatus();

    // Setup Badge
    if (!checkCurrentProviderKey()) {
        const toggle = document.getElementById('settingsToggle');
        if (toggle && !toggle.querySelector('.dot-badge')) {
            const badge = document.createElement('div');
            badge.className = 'dot-badge';
            toggle.style.position = 'relative';
            toggle.appendChild(badge);
        }
    }
}

function setupSettings() {
    const apiKeyInput = document.getElementById('apiKey');
    const groqApiKeyInput = document.getElementById('groqApiKey');
    const cerebrasApiKeyInput = document.getElementById('cerebrasApiKey');
    const openrouterApiKeyInput = document.getElementById('openrouterApiKey');
    const providerSelect = document.getElementById('providerSelect');

    // Pre-fill
    if (apiKeyInput) apiKeyInput.value = state.currentApiKey;
    if (groqApiKeyInput) groqApiKeyInput.value = state.currentGroqKey;
    if (cerebrasApiKeyInput) cerebrasApiKeyInput.value = state.currentCerebrasKey || "";
    if (openrouterApiKeyInput) openrouterApiKeyInput.value = state.currentOpenRouterKey || "";
    if (providerSelect) {
        providerSelect.value = state.currentProvider;
        toggleProviderUI(state.currentProvider);
    }

    // Auth Mode UI
    const mode = state.authMode;
    const modeFreeBtn = document.getElementById('modeFreeBtn');
    const modeByokBtn = document.getElementById('modeByokBtn');
    const freeModeInfo = document.getElementById('freeModeInfo');
    const byokSettings = document.getElementById('byokSettings');

    if (mode === 'free') {
        modeFreeBtn?.classList.add('active');
        modeByokBtn?.classList.remove('active');
        freeModeInfo?.classList.remove('hidden');
        byokSettings?.classList.add('hidden');
    } else {
        modeFreeBtn?.classList.remove('active');
        modeByokBtn?.classList.add('active');
        freeModeInfo?.classList.add('hidden');
        byokSettings?.classList.remove('hidden');
    }

    renderAuthSection();
}

function setupEventListeners() {
    // Resume Upload Trigger (Hero section)
    if (uploadBtn) {
        uploadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resumeFile.click();
        });
    }

    // Auto-process on file selection
    if (resumeFile) {
        resumeFile.addEventListener('change', async () => {
            const file = resumeFile.files[0];
            if (!file) return;

            // Re-use logic from lines below (referenced by ID)
            processResumeUpload(file);
        });
    }

    // Drag and drop for hero zone
    const dropZone = document.getElementById('uploadDropZone');
    if (dropZone) {
        dropZone.addEventListener('click', () => resumeFile.click());
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'application/pdf') {
                processResumeUpload(file);
            } else {
                showStatus("Please drop a valid PDF file.", "error", "uploadStatus");
            }
        });
    }



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
            const profileData = await extractBaseProfile(pageText, getApiKeyForProvider(), state.currentProvider);
            if (profileData.error) throw new Error(profileData.error);

            await saveNewProfile(profileData);

            showStatus('✅ LinkedIn profile imported! Some fields may be incomplete — review in Profile editor.', 'success', 'linkedinUrlStatus');
            setTimeout(showMainUI, 2000);
        } catch (e) {
            if (e.message === 'SERVER_UNAVAILABLE') {
                showStatus('Server unavailable. <a class="settings-redirect" style="text-decoration:underline;cursor:pointer;">Add your own API key</a> for uninterrupted access.', 'warning', 'linkedinUrlStatus');
            } else {
                showStatus(`LinkedIn import failed: ${e.message}`, 'error', 'linkedinUrlStatus');
            }
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



    // Mode Toggles
    const modeFreeBtn = document.getElementById('modeFreeBtn');
    const modeByokBtn = document.getElementById('modeByokBtn');
    const freeModeInfo = document.getElementById('freeModeInfo');
    const byokSettings = document.getElementById('byokSettings');

    const updateModeUI = (mode) => {
        if (mode === 'free') {
            modeFreeBtn.classList.add('active');
            modeByokBtn.classList.remove('active');
            freeModeInfo.classList.remove('hidden');
            byokSettings.classList.add('hidden');
        } else {
            modeFreeBtn.classList.remove('active');
            modeByokBtn.classList.add('active');
            freeModeInfo.classList.add('hidden');
            byokSettings.classList.remove('hidden');
        }
        updateState({ authMode: mode });
        chrome.storage.local.set({ auth_mode: mode });
        renderAuthSection(); // Refresh login prompt visibility
    };

    if (modeFreeBtn) {
        modeFreeBtn.addEventListener('click', () => updateModeUI('free'));
    }
    if (modeByokBtn) {
        modeByokBtn.addEventListener('click', () => updateModeUI('byok'));
    }

    // Merge Research Toggle
    const mergeToggle = document.getElementById('mergeResearchToggle');
    if (mergeToggle) {
        mergeToggle.addEventListener('change', async (e) => {
            updateState({ mergeResearchIntoProjects: e.target.checked });
            await chrome.storage.local.set({ merge_research_projects: e.target.checked });

            if (state.tailoredResume) {
                showStatus(`🔄 ${e.target.checked ? 'Sections will be merged' : 'Sections will be separate'} on next Forge.`, 'info');
            }
        });
    }

    // Google Login — use delegation because renderAuthSection() recreates this button dynamically
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('#googleLoginBtn');
        if (!btn) return;
        try {
            showStatus('Opening Google Login...', 'info', 'settingsStatus');
            await loginWithGoogle();
            showStatus('Login successful!', 'success', 'settingsStatus');

            // Auto-switch to free mode and move to main UI
            updateModeUI('free');
            renderAuthSection();
            updateUsageDisplay();

            // Auto-redirection logic
            setTimeout(() => {
                if (state.baseResume) {
                    showMainUI();
                } else {
                    showSetupUI();
                }
            }, 800);
        } catch (e) {
            showStatus('Login failed: ' + e.message, 'error', 'settingsStatus');
        }
    });

    // Auth Section Delegation (for Logout)
    if (authSection) {
        authSection.addEventListener('click', async (e) => {
            if (e.target.id === 'logoutBtn') {
                await logout();
                showStatus('Signed out', 'info', 'settingsStatus');
                renderAuthSection();
                updateUsageDisplay();
            }
        });
    }

    // Page Mode Toggle
    document.querySelectorAll('.page-mode-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            document.querySelectorAll('.page-mode-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const mode = e.target.dataset.mode;
            updateState({ pageMode: mode });
            await chrome.storage.local.set({ page_mode: mode });

            // When switching to 2-page, clear excluded items since they'll all be included
            if (mode === '2page') {
                updateState({ excludedItems: null, mustIncludeItems: null });
                await chrome.storage.local.remove(['excluded_items', 'must_include_items']);
            }

            // Warn if a tailored resume already exists
            if (state.tailoredResume) {
                const modeLabel = mode === '1page' ? '1-page' : '2-page';
                showStatus(`📄 Switched to ${modeLabel} mode. Click "Forge My Resume" again to regenerate with the new page setting.`, 'info');
            }
        });
    });

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
                if (result && result.currentJdText && result.currentJdText.length > 50) {
                    const method = result.jdExtractionMethod || state.jdExtractionMethod;
                    if (method === 'ai') {
                        showStatus("🤖 JD extracted using AI — review for accuracy", "success");
                    } else {
                        showStatus("Job description fetched successfully!", "success");
                    }
                } else if (result === null) {
                    // Null result after reload timeout or failure
                    showStatus("⚠️ Could not extract job description after reload. Try pasting manually.", "error");
                } else {
                    showStatus("❌ Could not detect a job description on this page. Try pasting it manually.", "error");
                }

            } catch (e) {
                if (e.message === 'PERMISSION_DENIED') {
                    showStatus("❌ Permission denied. Please allow the extension to access this page.", "error");
                } else if (e.message === 'PAGE_RELOADED') {
                    showStatus("🔄 Page reloaded. Click 'Fetch from Page' again to extract the job description.", "info");
                } else if (e.message === 'MANUAL_PASTE_REQUESTED') {
                    showStatus("📝 Paste your job description in the text area below", "info");
                } else if (e.message === 'SERVER_UNAVAILABLE') {
                    showStatus('Server unavailable. <a class="settings-redirect" style="text-decoration:underline;cursor:pointer;">Add your own API key</a> for uninterrupted access.', 'warning');
                } else {
                    showStatus("Scan failed: " + e.message, "error");
                }
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
            await chrome.storage.local.set({
                current_jd_text: jdText,
                detected_job_title: 'Manual JD',
                detected_company: 'Pasted',
                detected_page_url: '',
                jd_extraction_method: 'manual'
            });
            updateJdStatus();
            document.getElementById('manualJdInput').style.display = 'none';

            // Hide ATS analysis UI when JD is updated
            hideAtsAnalysisUI();

            showStatus("Job description loaded!", "success");
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
            updateJdStatus();
        });
    }


    // Tab change listeners for JD card context
    chrome.tabs.onActivated.addListener(() => {
        updateActiveTabLabel();
        // Auto-detection disabled - user must click 'Fetch from Page' button
        // clearTimeout(tabDetectionTimer);
        // tabDetectionTimer = setTimeout(() => {
        //     detectJobDescription().catch(() => { });
        // }, 500);
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete') {
            updateActiveTabLabel();
            // Auto-detection disabled - user must click 'Fetch from Page' button
            // clearTimeout(tabDetectionTimer);
            // tabDetectionTimer = setTimeout(() => {
            //     detectJobDescription().catch(() => { });
            // }, 500);
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
    document.getElementById('backFromProfile').addEventListener('click', () => {
        showMainUI();
        if (state.tailoredResume) {
            sendPreviewUpdate(state.tailoredResume);
        }
    });

    // Profile Toggle
    document.getElementById('profileToggle').addEventListener('click', async () => {
        resetEditorState('profile'); // Clear only profile editor state, keep tailored edits
        showProfileUI();
        const profiles = await loadProfiles();
        renderProfileList(profiles, state.activeProfile);
        const section = document.getElementById('profileSectionSelect')?.value || 'summary';
        renderProfileEditor(section, state.baseResume, 'profileFormContainer');
    });

    // Profile Section Change
    document.getElementById('profileSectionSelect').addEventListener('change', async (e) => {
        // Auto-save current section before switching
        await saveProfileChanges(lastProfileSection, 'profileFormContainer');
        lastProfileSection = e.target.value;
        renderProfileEditor(e.target.value, null, 'profileFormContainer');
    });

    // Save Profile (Base)
    document.getElementById('saveProfileBtn').addEventListener('click', async () => {
        await saveProfileChanges(document.getElementById('profileSectionSelect').value);

        // Also update in profiles collection
        const pData = await chrome.storage.local.get(['profiles', 'active_profile']);
        const profiles = pData.profiles || {};
        // Use clone to prevent reference sharing bugs
        profiles[pData.active_profile || 'default'] = JSON.parse(JSON.stringify(state.baseResume));
        await chrome.storage.local.set({ profiles });

        // Close profile section and return to main UI
        showMainUI();
    });
    document.getElementById('cancelProfileEditBtn').addEventListener('click', () => {
        showMainUI();
        // Only revert preview if we DON'T have a tailored resume to show
        if (!state.tailoredResume) {
            sendPreviewUpdate();
        }
    });

    // Save Settings
    saveSettingsBtn.addEventListener('click', async () => {
        const geminiKey = apiKeyInput.value.trim();
        const groqKey = document.getElementById('groqApiKey').value.trim();
        const cerebrasKey = document.getElementById('cerebrasApiKey').value.trim();
        const openrouterKey = document.getElementById('openrouterApiKey').value.trim();
        const provider = document.getElementById('providerSelect').value;

        // Only validate keys if NOT in free mode
        if (state.authMode !== 'free') {
            if (provider === 'gemini' && !geminiKey) {
                showStatus("Please enter a Gemini API key.", "error", "settingsStatus");
                return;
            }
            if (provider === 'groq' && !groqKey) {
                showStatus("Please enter a Groq API key.", "error", "settingsStatus");
                return;
            }
            if (provider === 'cerebras' && !cerebrasKey) {
                showStatus("Please enter a Cerebras API key.", "error", "settingsStatus");
                return;
            }
            if (provider === 'openrouter' && !openrouterKey) {
                showStatus("Please enter an OpenRouter API key.", "error", "settingsStatus");
                return;
            }
        }

        await chrome.storage.local.set({
            gemini_api_key: geminiKey,
            groq_api_key: groqKey,
            cerebras_api_key: cerebrasKey,
            openrouter_api_key: openrouterKey,
            provider: provider
        });

        updateState({
            currentApiKey: geminiKey,
            currentGroqKey: groqKey,
            currentCerebrasKey: cerebrasKey,
            currentOpenRouterKey: openrouterKey,
            currentProvider: provider
        });

        const badge = document.getElementById('agentModeBadge');
        if (badge) badge.style.display = (cerebrasKey && groqKey) ? 'block' : 'none';

        showStatus("Settings saved!", "success", "settingsStatus");
        setTimeout(() => {
            if (state.baseResume) showMainUI();
            else showSetupUI();
        }, 1000);
    });



    // Logic for Resume Upload (shared by button and drop zone)
    async function processResumeUpload(file) {
        if (!checkCurrentProviderKey()) {
            showStatus("API Key required. Please go to Settings to add it.", "error", "uploadStatus");
            setTimeout(showSettings, 2000);
            return;
        }

        const processBtn = document.getElementById('uploadBtn');
        setButtonLoading(processBtn, true);
        showStatus("Extracting resume info...", "info", "uploadStatus");

        try {
            const textData = await extractText(file);
            if (textData.error) throw new Error(textData.error);

            const profileData = await extractBaseProfile(textData.text, getApiKeyForProvider(), state.currentProvider);
            if (profileData.error) throw new Error(profileData.error);

            await saveNewProfile(profileData);

            showStatus("Profile created!", "success", "uploadStatus");
            setTimeout(showMainUI, 1500);

        } catch (e) {
            showStatus(`Error: ${e.message}`, "error", "uploadStatus");
        } finally {
            setButtonLoading(processBtn, false, "Upload & Create Profile");
        }
    }

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
            const profileData = await extractBaseProfile(text, getApiKeyForProvider(), state.currentProvider);
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
            const profileData = await extractBaseProfile(textData.text, getApiKeyForProvider(), state.currentProvider);
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
            const profileData = await extractBaseProfile(textData.text, getApiKeyForProvider(), state.currentProvider);
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
            const profileData = await extractBaseProfile(pageText, getApiKeyForProvider(), state.currentProvider);
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
            if (!state.baseResume) {
                showStatus("No base resume profile loaded.", "error");
                return;
            }

            setButtonLoading(generateBaseBtn, true);
            showStatus("Preparing base resume...", "info");

            try {
                // Set the current 'active' result to a DEEP CLONE of the base resume
                // This prevents edits to the "tailored" resume from contaminating the base state
                let baseClone = JSON.parse(JSON.stringify(state.baseResume));

                // Apply merge if toggle is on (consistent with AI forge behavior)
                if (state.mergeResearchIntoProjects) {
                    const { mergeResearchIntoProjects } = await import('./modules/ai_prompts.js');
                    baseClone = mergeResearchIntoProjects(baseClone);
                }

                updateState({ tailoredResume: baseClone });

                // Persist this choice so reload works
                await chrome.storage.local.set({ tailored_resume: baseClone });

                showStatus("Base resume ready! output loaded below.", "success");
                await saveVersion(baseClone, 'Base Resume (No AI)');

                document.getElementById('actions').style.display = 'block';
                document.getElementById('actions').classList.remove('hidden');

            } catch (error) {
                console.error("Base Resume Error:", error);
                logError('generate_base_resume_error', error);
                showStatus(`Error preparing resume: ${error.message}`, "error");
            } finally {
                setTimeout(() => { setButtonLoading(generateBaseBtn, false, "📄 Export Base Resume (No AI)"); }, 500);
            }
        });
    }


    // Generate Button
    let isForging = false;
    generateBtn.addEventListener('click', async () => {
        if (isForging) return;
        isForging = true;
        // Drag and drop removed

        if (!checkCurrentProviderKey()) {
            showStatus("API Key missing! Cannot generate AI resume.", "error");
            setTimeout(showSettings, 2000);
            return;
        }

        if (state.authMode === 'free' && state.freeUsage.remaining <= 0) {
            showStatus("Daily limit reached! Switch to your own API key or try again tomorrow.", "error");
            return;
        }

        if (!state.currentJdText || state.currentJdText.length < 50) {
            showStatus("No valid job description detected. Navigate to a job post.", "error");
            return;
        }

        // Disable UI
        setButtonLoading(generateBtn, true);
        const buttonsToDisable = [generateBaseBtn, editBtn, downloadBtn, previewBtn, analyzeBtn];
        buttonsToDisable.forEach(b => { if (b) b.disabled = true; });

        // Clear stale state from previous forge
        updateState({ mustIncludeItems: null });

        showProgress('detecting');

        const activeKey = getApiKeyForProvider();

        try {
            showProgress('analyzing', `Using ${state.currentProvider === 'groq' ? 'Groq' : 'Gemini'}...`);
            showProgress('tailoring', 'This may take 10-15 seconds...');

            const result = await tailorResume(state.baseResume, state.currentJdText, activeKey, state.currentProvider, state.tailoringStrategy);
            if (result.error) throw new Error(result.error);

            showProgress('processing');

            const { tailored_resume, jd_analysis, excluded_items } = result;
            const newResume = tailored_resume;
            const analysis = jd_analysis;

            // Store excluded items
            updateState({ excludedItems: excluded_items || null, mustIncludeItems: null });
            await chrome.storage.local.remove('must_include_items');

            const keywords = analysis ? [
                ...(analysis.mandatory_keywords || []),
                ...(analysis.preferred_keywords || []),
                ...(analysis.industry_terms || [])
            ].map(k => k.toLowerCase()) : [];

            updateState({ tailoredResume: newResume, currentJdAnalysis: analysis, jdKeywords: keywords });
            if (state.authMode === 'free') updateUsageDisplay();
            await chrome.storage.local.set({
                tailored_resume: newResume,
                jd_analysis: analysis,
                jd_keywords: keywords
            });

            // Show notification if items were excluded
            if (excluded_items) {
                const totalExcluded = Object.values(excluded_items).reduce((sum, arr) => sum + arr.length, 0);
                if (totalExcluded > 0) {
                    showStatus(`✅ Resume forged! ${totalExcluded} item(s) excluded to fit 1 page. Check Fine-Tune to review.`, "success");
                }
            }

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

                // Show Feedback UI
                const diffContainer = document.getElementById('diffSummaryContainer');
                if (diffContainer) {
                    const feedbackDiv = document.createElement('div');
                    feedbackDiv.id = 'forgeFeedback';
                    feedbackDiv.style.textAlign = 'center';
                    feedbackDiv.style.marginTop = '12px';
                    feedbackDiv.style.padding = '8px';
                    feedbackDiv.style.borderTop = '1px dashed #e2e8f0';
                    feedbackDiv.innerHTML = `
                        <span style="font-size:11px; color:#666; margin-right:8px;">How was this forge?</span>
                        <button id="fbUp" style="border:none;background:none;cursor:pointer;font-size:16px; transition: transform 0.2s;" title="Good">👍</button>
                        <button id="fbDown" style="border:none;background:none;cursor:pointer;font-size:16px; transition: transform 0.2s;" title="Bad">👎</button>
                    `;

                    // Remove existing if any
                    const existing = document.getElementById('forgeFeedback');
                    if (existing) existing.remove();

                    diffContainer.after(feedbackDiv);

                    document.getElementById('fbUp')?.addEventListener('click', () => {
                        sendFeedback(1);
                        feedbackDiv.innerHTML = '<span style="font-size:11px;color:#10b981;font-weight:600;">Glad it helped! ✓</span>';
                        setTimeout(() => feedbackDiv.remove(), 3000);
                    });

                    document.getElementById('fbDown')?.addEventListener('click', () => {
                        const reason = prompt('What went wrong? (Optional, helps us improve)');
                        sendFeedback(-1, reason || '');
                        feedbackDiv.innerHTML = '<span style="font-size:11px;color:#666;">Thanks for the feedback! We\'ll work on it.</span>';
                        setTimeout(() => feedbackDiv.remove(), 3000);
                    });

                    // Avoid inline handlers for hover effect
                    ['fbUp', 'fbDown'].forEach(id => {
                        const btn = document.getElementById(id);
                        if (btn) {
                            btn.addEventListener('mouseover', () => btn.style.transform = 'scale(1.2)');
                            btn.addEventListener('mouseout', () => btn.style.transform = 'scale(1)');
                        }
                    });
                }

                // Save Version
                saveVersion(newResume, analysis ? (analysis.title || analysis.job_title || "New Role") : "Tailored Resume");

                const diff = generateDiffSummary(state.baseResume, newResume);
                let diffCont = document.getElementById('diffSummaryContainer');
                if (diff && diffCont) {
                    const parts = [];
                    if (diff.bulletsChanged > 0) parts.push(`${diff.bulletsChanged} bullets tailored`);
                    if (diff.summaryChanged) parts.push('summary rewritten');
                    if (diff.skillsAdded > 0) parts.push(`${diff.skillsAdded} skills added`);
                    if (diff.skillsRemoved > 0) parts.push(`${diff.skillsRemoved} skills removed`);

                    if (parts.length > 0) {
                        diffCont.innerHTML = `<div class="card" style="font-size:11px; padding:10px; margin-top:8px; background:#f0fdf4; border:1px solid #a7f3d0;">
                            ✨ AI changes: ${parts.join(' · ')}
                        </div>`;
                        setTimeout(() => { diffCont.innerHTML = ''; }, 10000);
                    }
                }
            }, 1000);

            // Hide the ATS analysis UI if it was previously shown
            hideAtsAnalysisUI();

            // REMOVED automatic download - user will click download button manually
            // await generateAndDownloadPDF(newResume);

        } catch (e) {
            console.error("Tailoring Error:", e);
            showProgress('error', e.message);
            if (e.message === 'SERVER_UNAVAILABLE') {
                showStatus('Server unavailable. <a class="settings-redirect" style="text-decoration:underline;cursor:pointer;">Add your own API key</a> for uninterrupted access.', 'warning');
            } else {
                showStatus(`Error: ${e.message}`, "error");
            }
            setTimeout(hideProgress, 3000);
        } finally {
            isForging = false;
            setButtonLoading(generateBtn, false, "🔥 Forge My Resume");
            buttonsToDisable.forEach(b => { if (b) b.disabled = false; });
        }
    });

    if (downloadBtn) {
        downloadBtn.addEventListener('click', async () => {
            await generateAndDownloadPDF(state.tailoredResume);
        });
    }

    if (previewBtn) {
        previewBtn.addEventListener('click', async () => {
            openLivePreview();
        });
    }

    const livePreviewBtn = document.getElementById('livePreviewBtn');
    if (livePreviewBtn) {
        livePreviewBtn.addEventListener('click', () => {
            // If we have no resume, warn
            if (!state.tailoredResume && !state.baseResume) {
                showStatus("No resume loaded.", "error");
                return;
            }
            openLivePreview();
        });
    }

    if (askBtn) {
        askBtn.addEventListener('click', async () => {
            const question = questionInput.value.trim();
            if (!question) {
                showStatus("Please enter a question.", "error");
                return;
            }
            if (state.authMode === 'free' && state.freeUsage.remaining <= 0) {
                showStatus("Daily limit reached! Switch to your own API key or try again tomorrow.", "error");
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
                const activeKey = getApiKeyForProvider();
                const resumeToUse = state.tailoredResume || state.baseResume;

                const res = await askQuestion(question, resumeToUse, state.currentJdText || "", activeKey, state.currentProvider);

                if (res.error) throw new Error(res.error);
                if (state.authMode === 'free') updateUsageDisplay();
                answerOutput.textContent = res.answer || "No answer generated.";
            } catch (e) {
                if (e.message === 'SERVER_UNAVAILABLE') {
                    showStatus('Server unavailable. <a class="settings-redirect" style="text-decoration:underline;cursor:pointer;">Add your own API key</a> for uninterrupted access.', 'warning');
                    answerOutput.textContent = "Server unavailable. Please add your own API key in settings.";
                } else {
                    answerOutput.textContent = `Error: ${e.message}`;
                }
            } finally {
                setButtonLoading(askBtn, false, "Ask AI");
            }
        });
    }



    // Popout Editor
    const popoutBtn = document.getElementById('popoutEditorBtn');
    if (popoutBtn) {
        popoutBtn.addEventListener('click', () => {
            openLivePreview();
        });
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        const editorUI = document.getElementById('editorUI');
        if (!editorUI || editorUI.style.display !== 'block') return;

        // Ctrl+S or Cmd+S to Save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            const saveBtn = document.getElementById('saveManualBtn');
            if (saveBtn) saveBtn.click();
        }
        // Escape to Cancel
        if (e.key === 'Escape') {
            const cancelBtn = document.getElementById('cancelEditBtn');
            if (cancelBtn) cancelBtn.click();
        }
    });

    // Edit Tailored Resume
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            if (!state.tailoredResume) return;
            resetEditorState('tailored'); // Clear only tailored editor state
            document.getElementById('editorUI').style.display = 'block';
            document.getElementById('actions').style.display = 'none';
            // Default to summary or first available
            lastEditorSection = 'summary';
            document.getElementById('sectionSelect').value = 'summary';
            renderProfileEditor('summary', state.tailoredResume, 'formContainer');
        });
    }

    const sectionSelect = document.getElementById('sectionSelect');
    if (sectionSelect) {
        sectionSelect.addEventListener('change', async (e) => {
            // Auto-save current section before switching
            await saveProfileChanges(lastEditorSection, 'formContainer');
            lastEditorSection = e.target.value;
            renderProfileEditor(e.target.value, null, 'formContainer');
        });
    }

    // Cancel Edit (Tailored)
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', async () => {
            const confirmed = await showConfirmDialog("Discard unsaved changes?");
            if (confirmed) {
                document.getElementById('editorUI').style.display = 'none';
                document.getElementById('actions').style.display = 'block';
                // Only revert preview if we DON'T have a tailored resume to show
                if (!state.tailoredResume) {
                    sendPreviewUpdate();
                }
            }
        });
    }

    // Save Manual Changes (Tailored)
    if (saveManualBtn) {
        saveManualBtn.addEventListener('click', async () => {
            // Drag and drop removed
            setButtonLoading(saveManualBtn, true);
            try {
                const activeSection = document.getElementById('sectionSelect').value;
                // parse current DOM to update object
                await saveProfileChanges(activeSection, 'formContainer');
                sendPreviewUpdate();

                // === NEW: Merge must-include items directly into tailored resume ===
                if (state.mustIncludeItems && state.baseResume) {
                    let resumeModified = false;
                    const tailored = JSON.parse(JSON.stringify(state.tailoredResume));

                    for (const [section, itemIds] of Object.entries(state.mustIncludeItems)) {
                        if (!itemIds || itemIds.length === 0) continue;
                        if (!state.baseResume[section]) continue;
                        if (!tailored[section]) tailored[section] = [];

                        for (const itemId of itemIds) {
                            // Find the item in baseResume by identifier
                            const baseItem = state.baseResume[section].find(item => {
                                const id = (item.company || item.name || item.organization || item.title || '').toLowerCase().trim();
                                const targetId = String(itemId).toLowerCase().trim();
                                return id === targetId || id.includes(targetId) || targetId.includes(id);
                            });

                            if (!baseItem) continue;

                            // Check if already present in tailored resume
                            const alreadyPresent = tailored[section].some(t => {
                                const tId = (t.company || t.name || t.organization || t.title || '').toLowerCase().trim();
                                const baseId = (baseItem.company || baseItem.name || baseItem.organization || baseItem.title || '').toLowerCase().trim();
                                return tId === baseId || tId.includes(baseId) || baseId.includes(tId);
                            });

                            if (!alreadyPresent) {
                                // Deep clone and add to tailored resume
                                tailored[section].push(JSON.parse(JSON.stringify(baseItem)));
                                resumeModified = true;
                            }
                        }
                    }

                    if (resumeModified) {
                        // Update state and storage
                        updateState({ tailoredResume: tailored });
                        await chrome.storage.local.set({ tailored_resume: tailored });

                        // Remove the included items from excluded list
                        const updatedExcluded = { ...(state.excludedItems || {}) };
                        for (const [section, itemIds] of Object.entries(state.mustIncludeItems)) {
                            if (updatedExcluded[section]) {
                                updatedExcluded[section] = updatedExcluded[section].filter(exId => {
                                    const exLower = String(exId).toLowerCase().trim();
                                    return !itemIds.some(incId => {
                                        const incLower = String(incId).toLowerCase().trim();
                                        return exLower === incLower || exLower.includes(incLower) || incLower.includes(exLower);
                                    });
                                });
                            }
                        }
                        updateState({ excludedItems: updatedExcluded, mustIncludeItems: null });
                        await chrome.storage.local.set({ excluded_items: updatedExcluded });
                        await chrome.storage.local.remove('must_include_items');

                        showStatus(`✅ Saved! Included items added directly (no AI tailoring applied to them). Run "Save & Regenerate" to tailor their bullets.`, 'success');
                    }
                }
                // === END NEW ===

                // Generate PDF logic immediately (cache only)
                await generateAndCachePDF(state.tailoredResume);

                showMainUI();
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
            if (state.authMode === 'free' && state.freeUsage.remaining <= 0) {
                showStatus("Daily limit reached! Switch to your own API key or try again tomorrow.", "error");
                return;
            }
            // Drag and drop removed
            setButtonLoading(saveRegenBtn, true);

            try {
                const activeSection = document.getElementById('sectionSelect').value;
                await saveProfileChanges(activeSection, 'formContainer');

                // 2. Collect Bullet Counts
                const bulletCounts = collectBulletCounts(activeSection, 'formContainer');

                // 3. Call API
                const activeKey = getApiKeyForProvider();

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
                    // Warn if user has manual edits (Bug/Feature: re-tailoring from base)
                    const hasManualEdits = state.tailoredResume?.summary !== state.baseResume?.summary;
                    // Note: Comparing all bullets is expensive, summary is the most common manual edit.
                    if (hasManualEdits) {
                        const proceed = await showConfirmDialog(
                            "Regenerating re-tailors from your original profile. Manual edits to bullets/summary will be replaced with AI-generated content. Continue?"
                        );
                        if (!proceed) {
                            setButtonLoading(saveRegenBtn, false, "Save & Regenerate");
                            return;
                        }
                    }

                    // Use latest in-memory resume (Bug 4)
                    const resumeToRegen = getCurrentEditingResume('formContainer') || state.tailoredResume;
                    const regenData = await regenerateResume(
                        resumeToRegen,
                        bulletCounts,
                        jdAnalysis,
                        activeKey,
                        state.currentProvider,
                        state.tailoringStrategy,
                        state.pageMode || '1page',
                        state.mustIncludeItems
                    );

                    if (regenData.error) throw new Error(regenData.error);

                    const finalResume = regenData;

                    updateState({ tailoredResume: finalResume, mustIncludeItems: null });
                    if (state.authMode === 'free') updateUsageDisplay();
                    await chrome.storage.local.set({ tailored_resume: finalResume });
                    await chrome.storage.local.remove('must_include_items');

                    showStatus("Resume updated & re-tailored!", "success");

                    // Generate PDF (cache only for regeneration)
                    await generateAndCachePDF(finalResume);

                    // Save Version
                    await saveVersion(finalResume, jdAnalysis.title || jdAnalysis.job_title || "Edited Role");
                }

                showMainUI();

            } catch (e) {
                console.error("Regeneration Error:", e);
                if (e.message === 'SERVER_UNAVAILABLE') {
                    showStatus('Server unavailable. <a class="settings-redirect" style="text-decoration:underline;cursor:pointer;">Add your own API key</a> for uninterrupted access.', 'warning');
                } else {
                    showStatus("Error regenerating: " + e.message, "error");
                }
            } finally {
                setButtonLoading(saveRegenBtn, false, "Save & Regenerate");
            }
        });
    }

    // Editor Preview
    if (editorPreviewBtn) {
        editorPreviewBtn.addEventListener('click', async () => {
            // Get the REAL current resume being acted on inside the module
            const editingResume = getCurrentEditingResume('formContainer');

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
                    setTimeout(() => URL.revokeObjectURL(url), 300000); // 5 mins
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
            if (state.authMode === 'free' && state.freeUsage.remaining <= 0) {
                showStatus("Daily limit reached! Switch to your own API key or try again tomorrow.", "error");
                return;
            }

            const statusMessage = state.hasAnalyzed ? "Re-analyzing ATS Score..." : "Analyzing ATS Score...";
            setButtonLoading(analyzeBtn, true);
            showStatus(statusMessage, "info");

            const activeKey = getApiKeyForProvider();

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
                if (state.authMode === 'free') updateUsageDisplay();
                updateState({ lastAnalysis: data, hasAnalyzed: true });
                await chrome.storage.local.set({ ats_analysis: data });
                showStatus(`Analysis Complete! (${((Date.now() - start) / 1000).toFixed(1)}s)`, "success");
                setTimeout(() => showStatus("", ""), 3000);

            } catch (e) {
                logError('score_failed', e, { taskType: 'score' });
                if (e.message === 'SERVER_UNAVAILABLE') {
                    showStatus('Server unavailable. <a class="settings-redirect" style="text-decoration:underline;cursor:pointer;">Add your own API key</a> for uninterrupted access.', 'warning');
                } else {
                    showStatus("Analysis Failed: " + e.message, "error");
                }
                // Hide the skeleton UI on error/timeout
                hideAtsAnalysisUI();
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

        setTimeout(() => { URL.revokeObjectURL(url); }, 300000); // 5 mins
    }
}





// Job Detection
async function detectJobDescription() {
    if (isScanning) return null;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Debug: Log which tab we're scanning

    if (!tab || !tab.id) return null;

    const url = tab.url || '';
    if (url.startsWith('chrome://') || url.startsWith('about:') || url.startsWith('chrome-extension://')) {
        updateJdStatus();
        return null;
    }

    isScanning = true;
    let finalResult = null;

    try {
        // Step 1: Request permission for the current tab's origin
        // This uses optional_host_permissions to request access to any job board site
        // Step 1: Permission request Block Removed (Relying on activeTab)

        // Step 2: Try client-side extraction (fast, no API cost)
        let results;
        try {
            results = await Promise.race([
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: extractJobDescription,
                    args: [DEBUG]
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
            ]);
        } catch (scriptError) {
            // Content script injection failed (likely no permission due to Side Panel navigation).
            // Silently proceed to server-side fetch fallback.
            // console.debug('Content script injection failed, falling back:', scriptError.message);
        }

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
        // Step 2: Client-side extraction weak? Try Server-Side Fetch
        // This is safer and more robust than injecting scripts
        if (bestText.length < 200) {
            try {
                // Use the API endpoint we just created
                const API_BASE = 'https://serverless-ai-resume-generator-api.vercel.app/api';
                // For local testing, you might toggle this to localhost:3000

                const fetchUrl = `${API_BASE}/fetch-jd?url=${encodeURIComponent(tab.url)}`;
                const response = await fetch(fetchUrl);

                if (response.ok) {
                    const data = await response.json();
                    if (data.text && data.text.length > 200) {
                        const updates = {
                            currentJdText: data.text,
                            detectedJobTitle: data.title || bestTitle, // Use server title if better
                            detectedCompany: data.company || bestCompany,
                            detectedPageUrl: tab.url,
                            jdExtractionMethod: 'server-fetch'
                        };
                        updateState(updates);
                        await chrome.storage.local.set({
                            current_jd_text: data.text,
                            detected_job_title: updates.detectedJobTitle,
                            detected_company: updates.detectedCompany,
                            detected_page_url: tab.url,
                            jd_extraction_method: 'server-fetch'
                        });
                        return updates;
                    }
                } else {
                    console.warn("Server-side fetch failed:", response.status);
                }
            } catch (fetchErr) {
                console.warn("Server-side fetch error:", fetchErr);
            }
        }

        // Step 3: Last Resort - AI Extraction (Costly but powerful)
        if (!checkCurrentProviderKey()) {
            // If no API key, and we have *some* text from client/server, use it
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


        const rawResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => document.body.innerText.substring(0, 15000)
        });

        const rawText = rawResults?.[0]?.result || '';
        if (rawText.length < 100) return null;

        const activeKey = getApiKeyForProvider();
        const aiResult = await extractJDWithAI(rawText, activeKey, state.currentProvider);

        if (aiResult.error) {
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
        if (e.message === 'SERVER_UNAVAILABLE') throw e;
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


function updateMergeResearchVisibility() {
    const opt = document.getElementById('mergeResearchOption');
    const toggle = document.getElementById('mergeResearchToggle');
    if (!opt || !toggle) return;

    const base = state.baseResume;
    const hasResearch = base?.research?.length > 0;
    const hasProjects = base?.projects?.length > 0;

    // Only show when BOTH sections have content
    opt.style.display = (hasResearch && hasProjects) ? 'block' : 'none';
    toggle.checked = state.mergeResearchIntoProjects || false;
}

// ... existing code ...
