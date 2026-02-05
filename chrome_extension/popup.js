import { state, updateState } from './modules/state.js';
import { checkCurrentProviderKey, updateStrategyDescription, formatSectionName, hasData } from './modules/utils.js';
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
import { renderProfileEditor, saveProfileChanges, collectBulletCounts } from './modules/editor.js';
import { extractJobDescription } from './modules/jd_extractor.js';

// DOM Elements
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

// Reorder Elements
const reorderBtn = document.getElementById('reorderBtn');
const reorderUI = document.getElementById('reorderUI');
const sortableSections = document.getElementById('sortableSections');
const saveOrderBtn = document.getElementById('saveOrderBtn');
const cancelOrderBtn = document.getElementById('cancelOrderBtn');

async function init() {
    try {
        // 1. Initialization
        await loadState();

        // 2. Event Listeners
        setupEventListeners();

        // 3. Auto-detect Job Description
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
    const data = await chrome.storage.local.get(['gemini_api_key', 'groq_api_key', 'provider', 'base_resume', 'tailored_resume', 'user_profile_name', 'tailoring_strategy', 'last_analysis']);

    // Update State Module
    updateState({
        currentApiKey: data.gemini_api_key || "",
        currentGroqKey: data.groq_api_key || "",
        currentProvider: data.provider || "gemini",
        baseResume: data.base_resume || null,
        tailoredResume: data.tailored_resume || null,
        tailoringStrategy: data.tailoring_strategy || "balanced",
        lastAnalysis: data.last_analysis || null
    });

    // Keys UI
    if (state.currentApiKey) apiKeyInput.value = state.currentApiKey;
    if (state.currentGroqKey) document.getElementById('groqApiKey').value = state.currentGroqKey;
    if (state.currentProvider) document.getElementById('providerSelect').value = state.currentProvider;

    toggleProviderUI(state.currentProvider);

    // Profile UI
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

    // Slider UI
    if (tailoringSlider) {
        const sliderValue = state.tailoringStrategy === 'profile_focus' ? 0 : state.tailoringStrategy === 'balanced' ? 1 : 2;
        tailoringSlider.value = sliderValue;
        updateStrategyDescription(sliderValue, strategyDescription);
    }

    const backFromSetup = document.getElementById('backFromSetup');
    if (backFromSetup) {
        backFromSetup.style.display = state.baseResume ? 'inline-block' : 'none';
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
    document.getElementById('profileToggle').addEventListener('click', () => {
        showProfileUI();
        renderProfileEditor('contact', state.baseResume); // Edit base resume in profile screen
    });

    // Profile Section Change
    document.getElementById('profileSectionSelect').addEventListener('change', (e) => {
        // Warning: This selector is used in TWO places (Popup Edit & Profile Edit) 
        // We need to know which context we are in.
        // For simplicity, renderProfileEditor uses currentEditingResume global in editor.js
        // We should probably explicitly pass data if we want to be safe, but editor.js logic handles defaults.
        // Ideally we check if 'editorUI' is visible or 'profileUI' is visible.

        const section = e.target.value;
        const profileVisible = document.getElementById('profileUI').style.display === 'block';
        if (profileVisible) {
            renderProfileEditor(section, state.baseResume);
        } else {
            renderProfileEditor(section); // Uses currently set resume (tailored)
        }
    });

    // Save Profile (Base)
    document.getElementById('saveProfileBtn').addEventListener('click', async () => {
        await saveProfileChanges(document.getElementById('profileSectionSelect').value);
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

        showStatus("Extracting resume info...", "info", "uploadStatus");
        uploadBtn.disabled = true;

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
            updateState({ baseResume: profileData });

            if (profileNameDisplay) profileNameDisplay.textContent = profileData.name;
            showStatus("Profile created!", "success", "uploadStatus");
            setTimeout(showMainUI, 1500);

        } catch (e) {
            showStatus(`Error: ${e.message}`, "error", "uploadStatus");
        } finally {
            uploadBtn.disabled = false;
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
            updateState({ baseResume: profileData });
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
            updateState({ baseResume: profileData });
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

            generateBaseBtn.disabled = true;
            showStatus("Preparing base resume...", "info");

            try {
                // Set the current 'active' result to the base resume
                updateState({ tailoredResume: state.baseResume });

                // Persist this choice so reload works
                await chrome.storage.local.set({ tailored_resume: state.baseResume });

                showStatus("Base resume ready! output loaded below.", "success");

                // Show actions
                if (actionsDiv) actionsDiv.style.display = 'block';

            } catch (e) {
                console.error("Base Resume Error:", e);
                showStatus(`Error preparing resume: ${e.message}`, "error");
            } finally {
                setTimeout(() => { generateBaseBtn.disabled = false; }, 500);
            }
        });
    }

    // Generate Button
    generateBtn.addEventListener('click', async () => {
        console.log("Generate (AI) clicked");
        if (!state.currentJdText || state.currentJdText.length < 50) {
            console.warn("No JD detected");
            showStatus("No valid job description detected. Navigate to a job post.", "error");
            return;
        }

        generateBtn.disabled = true;
        showStatus(`Tailoring with ${state.currentProvider === 'groq' ? 'Groq' : 'Gemini'}...`, "info");

        const activeKey = state.currentProvider === 'groq' ? state.currentGroqKey : state.currentApiKey;

        try {
            console.log("Calling tailorResume...");
            const data = await tailorResume(state.baseResume, state.currentJdText, activeKey, state.currentProvider, state.tailoringStrategy);
            if (data.error) throw new Error(data.error);

            console.log("Tailoring success", data);

            // Logic for handling tailored resume
            const newResume = data.tailored_resume;
            const analysis = data.jd_analysis;

            updateState({ tailoredResume: newResume });
            await chrome.storage.local.set({
                tailored_resume: newResume,
                last_analysis: analysis
            });

            showStatus("Resume generated successfully!", "success");

            if (analysis) {
                renderAnalysis(analysis);
            }

            if (actionsDiv) actionsDiv.style.display = 'block';

        } catch (e) {
            console.error("Tailoring Error:", e);
            showStatus(`Error: ${e.message}`, "error");
        } finally {
            generateBtn.disabled = false;
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
            previewBtn.disabled = true;
            showStatus("Generating Preview...", "info");
            try {
                const result = await generatePdf(state.tailoredResume);
                if (result instanceof Blob) {
                    const url = URL.createObjectURL(result);
                    chrome.tabs.create({ url: url });
                    showStatus("Preview opened in new tab", "success");
                } else if (result.error) {
                    throw new Error(result.error);
                }
            } catch (e) {
                console.error("Preview Error:", e);
                showStatus(`Error: ${e.message}`, "error");
            } finally {
                previewBtn.disabled = false;
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

            askBtn.disabled = true;
            answerOutput.style.display = 'block';
            answerOutput.textContent = "Generating answer...";

            try {
                const activeKey = state.currentProvider === 'groq' ? state.currentGroqKey : state.currentApiKey;
                const resumeToUse = state.tailoredResume || state.baseResume;

                const res = await askQuestion(question, resumeToUse, state.currentJdText || "", activeKey, state.currentProvider);

                if (res.error) throw new Error(res.error);

                answerOutput.textContent = res.answer || "No answer generated.";
            } catch (e) {
                console.error("Ask Error:", e);
                answerOutput.textContent = `Error: ${e.message}`;
            } finally {
                askBtn.disabled = false;
            }
        });
    }

    // Edit Tailored Resume
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            console.log("Edit clicked");
            if (!state.tailoredResume) return;
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
            renderProfileEditor(e.target.value, state.tailoredResume, 'formContainer');
        });
    }

    // Cancel Edit (Tailored)
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            document.getElementById('editorUI').style.display = 'none';
            document.getElementById('actions').style.display = 'block';
        });
    }

    // Save Manual Changes (Tailored)
    if (saveManualBtn) {
        saveManualBtn.addEventListener('click', async () => {
            console.log("Save Manual clicked");
            const activeSection = document.getElementById('sectionSelect').value;
            // parse current DOM to update object
            await saveProfileChanges(activeSection, 'formContainer');

            // Generate PDF logic immediately
            await generateAndDisplayPDF(state.tailoredResume);

            document.getElementById('editorUI').style.display = 'none';
            document.getElementById('actions').style.display = 'block';
        });
    }

    // Save & Regenerate (Tailored)
    if (saveRegenBtn) {
        saveRegenBtn.addEventListener('click', async () => {
            console.log("Save & Regenerate clicked");
            // 1. Save current section modifications
            const activeSection = document.getElementById('sectionSelect').value;
            await saveProfileChanges(activeSection, 'formContainer');

            saveRegenBtn.disabled = true;
            saveRegenBtn.textContent = "Adjusting...";

            try {
                // 2. Collect Bullet Counts
                const bulletCounts = collectBulletCounts(activeSection, 'formContainer');

                // 3. Call API
                const activeKey = state.currentProvider === 'groq' ? state.currentGroqKey : state.currentApiKey;

                // We need the JD analysis to be present for regeneration context
                // It should be in state from initial generation. If not, we might need to re-extract or warn.
                let jdAnalysis = state.lastAnalysis; // Might need to ensure this is loaded
                if (!jdAnalysis) {
                    // Attempt to recover from storage if not in state
                    const data = await chrome.storage.local.get('last_analysis');
                    jdAnalysis = data.last_analysis;
                }

                // If still no analysis, maybe just proceed with basic tailoring or warn?
                // For now, if no analysis, we skip regeneration and just save/pdf
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

                    // Update state with regenerated resume
                    const finalResume = regenData.resume;
                    updateState({ tailoredResume: finalResume });
                    await chrome.storage.local.set({ tailored_resume: finalResume });

                    // Generate PDF
                    await generateAndDisplayPDF(finalResume);
                }

                document.getElementById('editorUI').style.display = 'none';
                document.getElementById('actions').style.display = 'block';

            } catch (e) {
                console.error("Regeneration Error:", e);
                showStatus("Error regenerating: " + e.message, "error");
            } finally {
                saveRegenBtn.disabled = false;
                saveRegenBtn.textContent = "Save & Regenerate";
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
            showStatus(statusMessage, "info");

            const activeKey = state.currentProvider === 'groq' ? state.currentGroqKey : state.currentApiKey;

            try {
                const start = Date.now();
                const data = await analyzeResume(resumeToAnalyze, state.currentJdText, activeKey, state.currentProvider);
                if (data.error) throw new Error(data.error);

                renderAnalysis(data);
                updateState({ hasAnalyzed: true });
                showStatus(`Analysis Complete! (${((Date.now() - start) / 1000).toFixed(1)}s)`, "success");
                setTimeout(() => showStatus("", ""), 3000);

            } catch (e) {
                showStatus("Analysis Failed: " + e.message, "error");
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
            showStatus("PDF Ready. Downloading...", "success");

            // Auto download
            const url = URL.createObjectURL(result);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Tailored_Resume_${state.baseResume?.name || 'User'}.pdf`;
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
