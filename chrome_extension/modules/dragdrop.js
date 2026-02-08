import { state, updateState } from './state.js';
import { generateFilename } from './utils.js';
import { showStatus } from './ui.js';

export function updateDragCard(resumeData) {
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

export function setupDragAndDrop() {
    const dragHandle = document.getElementById('dragHandle');
    if (!dragHandle) return;

    // Instead of dragging from side panel, clicking the drag card injects
    // a draggable element into the active web page
    dragHandle.addEventListener('click', async () => {
        if (!state.latestPdfBlob) {
            showStatus("No PDF generated yet.", "error");
            return;
        }

        const resumeData = state.tailoredResume || state.baseResume;
        const filename = generateFilename(resumeData);

        try {
            // Convert blob to base64 for message passing
            const reader = new FileReader();
            const base64 = await new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(state.latestPdfBlob);
            });

            // Get active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
                showStatus("No active tab found.", "error");
                return;
            }

            // Inject the content script (only injects once due to duplicate check)
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['inject_drag.js']
            });

            // Send PDF data to the injected script via message
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (base64Data, fname) => {
                    window.postMessage({
                        type: 'FORGECV_PDF_DATA',
                        base64: base64Data,
                        filename: fname
                    }, '*');
                },
                args: [base64, filename]
            });

            showStatus("📄 Drag pill injected into the page! Drag it into any upload field.", "success");

        } catch (e) {
            console.error("Drag injection failed:", e);
            showStatus("Could not inject drag element. Try downloading instead.", "error");
        }
    });

    // Remove draggable from the handle since we no longer drag from side panel
    dragHandle.removeAttribute('draggable');
}

export function invalidatePdfCache() {
    updateState({ latestPdfBlob: null });
    const dragCard = document.getElementById('dragCard');
    if (dragCard) dragCard.style.display = 'none';
}
