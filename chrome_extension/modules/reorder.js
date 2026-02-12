import { state, updateState } from './state.js';
import { hasData, formatSectionName } from './utils.js';
import { showStatus } from './ui.js';
import { saveProfileChanges, updateEditorResume } from './editor.js';

// Local helper to invalidate PDF cache (drag and drop removed)
function invalidatePdfCache() {
    updateState({ latestPdfBlob: null });
}

let dragSrcEl = null;

export function renderReorderList() {
    const sortableSections = document.getElementById('sortableSections');
    if (!sortableSections) return;

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
        // Handle
        const handle = document.createElement('span');
        handle.className = 'handle';
        handle.textContent = '☰';

        // Section Name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'section-name';
        nameSpan.textContent = formatSectionName(section);

        const wrapper = document.createElement('div');
        wrapper.style.cssText = "display:flex; align-items:center;";
        wrapper.appendChild(handle);
        wrapper.appendChild(nameSpan);

        li.appendChild(wrapper);

        li.addEventListener('dragstart', handleDragStart);
        li.addEventListener('dragover', handleDragOver);
        li.addEventListener('drop', handleDrop);
        li.addEventListener('dragenter', handleDragEnter);
        li.addEventListener('dragleave', handleDragLeave);
        li.addEventListener('dragend', handleDragEnd);

        sortableSections.appendChild(li);
    });
}

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
    const sortableSections = document.getElementById('sortableSections');
    if (sortableSections) {
        sortableSections.querySelectorAll('.sortable-item').forEach(item => item.classList.remove('over'));
    }
}

export function setupReorderUI(generateAndCachePDFCallback) {
    const reorderBtn = document.getElementById('reorderBtn');
    const reorderUI = document.getElementById('reorderUI');
    const cancelOrderBtn = document.getElementById('cancelOrderBtn');
    const saveOrderBtn = document.getElementById('saveOrderBtn');
    const sortableSections = document.getElementById('sortableSections');

    if (reorderBtn) {
        reorderBtn.addEventListener('click', async () => {
            const isVisible = reorderUI.style.display === 'block';
            if (!isVisible) {
                const activeSection = document.getElementById('sectionSelect').value;
                await saveProfileChanges(activeSection, 'formContainer');
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

            if (state.tailoredResume) {
                const updated = JSON.parse(JSON.stringify(state.tailoredResume));
                updated.section_order = newOrder;
                updateState({ tailoredResume: updated });
                // NEW: Sync editor state so preview picks up the change
                updateEditorResume(updated, 'formContainer');

                await chrome.storage.local.set({ tailored_resume: updated });

                saveOrderBtn.textContent = "Updating PDF...";
                saveOrderBtn.disabled = true;

                if (generateAndCachePDFCallback) {
                    await generateAndCachePDFCallback(updated);
                }

                saveOrderBtn.textContent = "Save Order";
                saveOrderBtn.disabled = false;
                reorderUI.style.display = 'none';
                showStatus("Order updated!", "success");
            }
        });
    }
}
