export function showProgress(step, detail = '') {
    const container = document.getElementById('generationProgress');
    const stepText = document.getElementById('progressStepText');
    const fill = document.getElementById('progressFill');
    const detailEl = document.getElementById('progressDetail');
    const spinner = document.getElementById('progressSpinner');

    if (!container || !stepText || !fill || !detailEl) return;

    container.classList.remove('hidden');
    container.style.display = 'block';

    const steps = {
        'detecting': { text: '🔍 Reading job description...', progress: 10 },
        'analyzing': { text: '📊 Analyzing job requirements...', progress: 30 },
        'tailoring': { text: '✨ Tailoring your resume...', progress: 60 },
        'processing': { text: '🔧 Post-processing...', progress: 85 },
        'complete': { text: '✅ Resume ready!', progress: 100 },
        'error': { text: '❌ Error occurred', progress: 0 }
    };

    const s = steps[step] || { text: step, progress: 50 };
    stepText.textContent = s.text;
    fill.style.width = s.progress + '%';
    detailEl.textContent = detail;

    // Stop spinner on complete/error if desired, though spinning finishes the "action"
    if (step === 'complete' || step === 'error') {
        spinner.style.borderTopColor = step === 'complete' ? '#10b981' : '#ef4444';
        spinner.style.animation = 'none';
        spinner.style.borderColor = step === 'complete' ? '#10b981' : '#ef4444';
    } else {
        // Reset spinner style
        spinner.style.width = '18px';
        spinner.style.border = '2px solid #e5e7eb';
        spinner.style.borderTopColor = '#667eea';
        spinner.style.animation = 'spin 0.8s linear infinite';
    }
}

export function hideProgress() {
    const container = document.getElementById('generationProgress');
    if (container) {
        container.style.display = 'none';
        container.classList.add('hidden');
    }
}
