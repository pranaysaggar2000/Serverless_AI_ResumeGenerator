import { generateResumePdf } from './pdf_builder.js';
import { DEFAULT_FORMAT } from './defaults.js';
import { escapeHtml } from './security.js';

export function createPdfPreview(containerEl, statusEl, pageCountEl) {
    let currentBlobUrl = null;
    let currentZoom = 100;
    let regenerateTimer = null;
    let lastPageCount = 1; // Bug 12 Fix
    const blobUrlHistory = [];

    // Step 58 (Optimized): Add cleanup listener once per instance
    window.addEventListener('beforeunload', () => {
        blobUrlHistory.forEach(url => URL.revokeObjectURL(url));
    });

    // Zoom Consts
    const ZOOM_STEP = 10;
    const ZOOM_MIN = 50;
    const ZOOM_MAX = 200;

    function regenerate(resume, format, immediate = false) {
        if (!resume) return;

        // Clear previous timer
        clearTimeout(regenerateTimer);

        const run = async () => {
            try {
                if (statusEl) statusEl.textContent = "Updating...";

                // Check dependencies
                if (typeof window.jspdf === 'undefined') {
                    throw new Error("jsPDF library not loaded");
                }

                const mergedFormat = { ...DEFAULT_FORMAT, ...format };

                // Generate
                const doc = generateResumePdf(resume, mergedFormat);

                // Double Buffer approach
                const blob = doc.output('blob');
                const newUrl = URL.createObjectURL(blob);

                // Track for cleanup
                blobUrlHistory.push(newUrl);

                // Cleanup old blobs to prevent memory leaks (keep last 2 for smooth transition)
                // Clean up old blob
                if (blobUrlHistory.length > 0) {
                    // Keep only top 2, revoke others
                    while (blobUrlHistory.length > 2) {
                        const old = blobUrlHistory.shift();
                        URL.revokeObjectURL(old);
                    }
                }

                // Step 58: Listener moved to factory scope to prevent duplicates


                // Render
                displayPdf(newUrl, doc);

                if (statusEl) statusEl.textContent = "Ready";
                if (statusEl) statusEl.style.color = "#059669"; // Green

                // Bug 12 Fix: Update page count
                lastPageCount = doc.getNumberOfPages();

                return doc;
            } catch (e) {
                console.error("PDF Gen Error:", e);
                console.error("Params:", { format: format, resumeKeys: Object.keys(resume) });

                if (statusEl) {
                    statusEl.textContent = "Error";
                    statusEl.style.color = "#dc2626"; // Red
                }

                if (containerEl) {
                    containerEl.innerHTML = `
                        <div style="color:#b91c1c; background:#fef2f2; border:1px solid #fca5a5; padding:16px; border-radius:8px; margin:20px; font-family:sans-serif; max-width:400px;">
                            <strong style="display:block; margin-bottom:4px;">PDF Generation Failed</strong>
                            <span style="font-size:12px; display:block; margin-bottom:8px;">${escapeHtml(e.message)}</span>
                            <small id="pdfGenReloadBtn" style="color:#7f1d1d; cursor:pointer; text-decoration:underline;">Click to Reload Editor</small>
                        </div>`;

                    const reloadBtn = containerEl.querySelector('#pdfGenReloadBtn');
                    if (reloadBtn) reloadBtn.addEventListener('click', () => location.reload());
                }
            }
        };

        if (immediate) {
            return run();
        } else {
            regenerateTimer = setTimeout(run, 500); // 500ms debounce
        }
    }

    function displayPdf(url, doc) {
        if (!containerEl) return;

        // Verify container exists
        if (!document.body.contains(containerEl)) return;

        // Recreating iframe is the most reliable way to refresh PDF
        containerEl.innerHTML = '';

        const iframe = document.createElement('iframe');
        iframe.src = url;

        // Style
        iframe.style.border = 'none';
        iframe.style.transition = 'width 0.2s ease';

        if (currentZoom < 100) {
            iframe.style.margin = "0 auto";
            containerEl.style.display = "flex";
            containerEl.style.justifyContent = "center";
            // Set explicit height to prevent collapse
            const h = containerEl.clientHeight > 0 ? containerEl.clientHeight : 800;
            iframe.style.width = `${currentZoom}% `;
            iframe.style.height = (h - 40) + 'px';
        } else {
            containerEl.style.display = "block";
            iframe.style.margin = "0";

            // Calculate available height
            const availableHeight = containerEl.clientHeight || 700;
            iframe.style.width = '100%';
            iframe.style.height = Math.max(availableHeight - 40, 600) + 'px';
            iframe.style.minHeight = "600px";
        }

        containerEl.appendChild(iframe);
        currentBlobUrl = url;

        if (pageCountEl && doc) {
            const pages = doc.getNumberOfPages();
            pageCountEl.textContent = `${pages} page${pages !== 1 ? 's' : ''} `;
            pageCountEl.style.color = pages > 1 ? '#d97706' : '#6b7280';
        }
    }

    function setZoom(percent) {
        if (percent < ZOOM_MIN) percent = ZOOM_MIN;
        if (percent > ZOOM_MAX) percent = ZOOM_MAX;
        currentZoom = percent;

        const iframe = containerEl.querySelector('iframe');
        if (iframe) {
            iframe.style.width = `${currentZoom}% `;
            if (currentZoom < 100) {
                iframe.style.margin = "0 auto";
                containerEl.style.display = "flex";
                containerEl.style.justifyContent = "center";
            } else {
                iframe.style.margin = "0";
                containerEl.style.display = "block";
            }
        }
        return currentZoom;
    }

    function fitWidth() {
        return setZoom(100);
    }

    function download(resume, format) {
        if (!resume) return;
        try {
            const mergedFormat = { ...DEFAULT_FORMAT, ...format };
            const doc = generateResumePdf(resume, mergedFormat);
            const filename = (resume.name || 'Resume').replace(/[^a-z0-9]/gi, '_');
            doc.save(`${filename}.pdf`);
        } catch (e) {
            console.error("Download Error:", e);
            alert("Failed to download PDF. See console.");
        }
    }

    function print(resume, format) {
        if (!resume) return;
        try {
            const mergedFormat = { ...DEFAULT_FORMAT, ...format };
            // Bug 12 Fix: Create doc to print
            const doc = generateResumePdf(resume, mergedFormat);
            const blobUrl = doc.output('bloburl');
            // Open in new window for printing
            const printWin = window.open(blobUrl, '_blank');
            if (printWin) {
                printWin.onload = function () {
                    printWin.print();
                };
            }
        } catch (e) {
            console.error("Print Error:", e);
            alert("Failed to print PDF.");
        }
    }

    // Bug 12 Fix: Expose page count
    function getPageCount() {
        // We need to track the last generated doc's page count.
        // Since regenerate is async, we might not have it immediately.
        // We can store it in a closure variable.
        return lastPageCount;
    }

    return {
        regenerate,
        setZoom,
        fitWidth,
        download,
        print,
        getPageCount
    };
}

