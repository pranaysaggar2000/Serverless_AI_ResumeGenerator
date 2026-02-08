// inject_drag.js — Injected into web pages to enable file drag from extension

(function () {
    // Prevent double injection
    if (document.getElementById('forgecv-drag-pill')) return;

    // Receive the PDF data from the extension via message
    let pdfData = null;
    let filename = 'Resume.pdf';

    // Listen for PDF data from extension
    window.addEventListener('message', (event) => {
        if (event.data?.type === 'FORGECV_PDF_DATA') {
            // Convert base64 back to blob
            const byteString = atob(event.data.base64);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            pdfData = new Blob([ab], { type: 'application/pdf' });
            filename = event.data.filename || 'Resume.pdf';
            pill.style.display = 'flex';
            pillName.textContent = filename;

            // Auto-hide after 30 seconds
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                pill.style.display = 'none';
            }, 30000);
        }

        if (event.data?.type === 'FORGECV_HIDE_DRAG') {
            pill.style.display = 'none';
        }
    });

    let hideTimer = null;

    // Create floating pill
    const pill = document.createElement('div');
    pill.id = 'forgecv-drag-pill';
    pill.draggable = true;
    pill.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        display: none;
        align-items: center;
        gap: 10px;
        padding: 12px 18px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        font-weight: 600;
        cursor: grab;
        box-shadow: 0 8px 32px rgba(102, 126, 234, 0.4), 0 2px 8px rgba(0,0,0,0.15);
        user-select: none;
        transition: transform 0.15s, box-shadow 0.15s;
        pointer-events: auto;
    `;

    pill.innerHTML = `
        <span style="font-size:18px;">📄</span>
        <div>
            <div id="forgecv-drag-filename" style="font-size:12px; font-weight:600;">Resume.pdf</div>
            <div style="font-size:10px; opacity:0.85; font-weight:400;">Drag into upload field</div>
        </div>
        <button id="forgecv-drag-close" style="background:none; border:none; color:white; font-size:16px; cursor:pointer; padding:0 0 0 8px; opacity:0.7;">✕</button>
    `;

    const pillName = pill.querySelector('#forgecv-drag-filename');

    // Hover effect
    pill.addEventListener('mouseenter', () => {
        pill.style.transform = 'translateY(-2px)';
        pill.style.boxShadow = '0 12px 40px rgba(102, 126, 234, 0.5), 0 4px 12px rgba(0,0,0,0.2)';
    });
    pill.addEventListener('mouseleave', () => {
        pill.style.transform = 'translateY(0)';
        pill.style.boxShadow = '0 8px 32px rgba(102, 126, 234, 0.4), 0 2px 8px rgba(0,0,0,0.15)';
    });

    // Close button
    pill.querySelector('#forgecv-drag-close').addEventListener('click', (e) => {
        e.stopPropagation();
        pill.style.display = 'none';
    });

    // THE KEY: dragstart in page context — DataTransfer works natively
    pill.addEventListener('dragstart', (e) => {
        if (!pdfData) {
            e.preventDefault();
            return;
        }

        const file = new File([pdfData], filename, {
            type: 'application/pdf',
            lastModified: Date.now()
        });

        e.dataTransfer.items.add(file);
        e.dataTransfer.effectAllowed = 'copy';
        pill.style.opacity = '0.6';
        pill.style.cursor = 'grabbing';
    });

    pill.addEventListener('dragend', () => {
        pill.style.opacity = '1';
        pill.style.cursor = 'grab';
    });

    document.body.appendChild(pill);
})();
