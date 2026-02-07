import { state, updateState } from './state.js';
import { showStatus } from './ui.js';
import { renderProfileEditor } from './editor.js';

export async function saveVersion(resumeData, jdTitle) {
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

export async function renderHistoryList() {
    const list = document.getElementById('historyList');
    if (!list) return;

    list.innerHTML = '<div style="padding:16px;text-align:center;color:#999; font-size: 12px;">No forges yet. Generate your first resume! 🔨</div>';

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

export function setupHistoryUI() {
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
