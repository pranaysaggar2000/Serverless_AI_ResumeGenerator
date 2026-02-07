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
        try {
            e.dataTransfer.items.add(file);
            e.dataTransfer.effectAllowed = 'copy';
        } catch (err) {
            const url = URL.createObjectURL(state.latestPdfBlob);
            e.dataTransfer.setData('DownloadURL', "application/pdf:" + filename + ":" + url);
            dragHandle.addEventListener('dragend', () => URL.revokeObjectURL(url), { once: true });
        }

        dragHandle.classList.add('dragging');

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

export function invalidatePdfCache() {
    updateState({ latestPdfBlob: null });
    const dragCard = document.getElementById('dragCard');
    if (dragCard) dragCard.style.display = 'none';
}
