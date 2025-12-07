/* =========================================================
   SNAP ENGINE
   Handles window snapping (Aero Snap)
========================================================= */

export function initSnap() {
    // 1. UI Setup
    const overlay = document.createElement('div');
    overlay.id = 'pine-snap-overlay';
    const preview = document.createElement('div');
    preview.className = 'snap-preview';
    overlay.appendChild(preview);
    document.body.appendChild(overlay);

    // State
    let activeWindow = null;
    let snapTarget = null; // 'left', 'right', 'maximize'

    // 2. Observer
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
            if (m.type === 'attributes' && m.attributeName === 'style') {
                const win = m.target;
                if (win.classList.contains('window') && win.style.display !== 'none') {
                    handleDrag(win, overlay, preview);
                }
            }
        });
    });

    observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ['style']
    });

    function handleDrag(win, overlay, preview) {
        const rect = win.getBoundingClientRect();
        const screenW = window.innerWidth;
        const taskbarH = 60; // Approx
        const threshold = 30; // px from edge

        // Reset
        snapTarget = null;
        let previewRect = null;

        // 1. Maximize (Top)
        if (rect.top < threshold) {
            snapTarget = 'maximize';
            previewRect = { top: 0, left: 0, width: '100%', height: `calc(100% - ${taskbarH}px)` };
        }
        // 2. Left Snap
        else if (rect.left < threshold) {
            snapTarget = 'left';
            previewRect = { top: 0, left: 0, width: '50%', height: `calc(100% - ${taskbarH}px)` };
        }
        // 3. Right Snap
        else if (rect.right > screenW - threshold) {
            snapTarget = 'right';
            previewRect = { top: 0, left: '50%', width: '50%', height: `calc(100% - ${taskbarH}px)` };
        }

        // Update UI
        if (snapTarget) {
            overlay.classList.add('active');
            preview.classList.add('visible');
            Object.assign(preview.style, previewRect);
            activeWindow = win;
        } else {
            overlay.classList.remove('active');
            preview.classList.remove('visible');
            activeWindow = null;
        }
    }

    // 3. Handle Drop
    function onDrop() {
        if (!activeWindow || !snapTarget) return;

        const win = activeWindow;

        // Save restoration state if not snapped
        if (win.dataset.snapped !== 'true') {
            win.dataset.restW = win.style.width;
            win.dataset.restH = win.style.height;
        }

        win.classList.add('snapping');
        win.dataset.snapped = 'true';

        if (snapTarget === 'maximize') {
            win.style.top = '0px';
            win.style.left = '0px';
            win.style.width = '100vw';
            win.style.height = 'calc(100vh - 60px)';
        } else if (snapTarget === 'left') {
            win.style.top = '0px';
            win.style.left = '0px';
            win.style.width = '50vw';
            win.style.height = 'calc(100vh - 60px)';
        } else if (snapTarget === 'right') {
            win.style.top = '0px';
            win.style.left = '50vw';
            win.style.width = '50vw';
            win.style.height = 'calc(100vh - 60px)';
        }

        setTimeout(() => win.classList.remove('snapping'), 250);

        // Reset
        overlay.classList.remove('active');
        preview.classList.remove('visible');
        activeWindow = null;
        snapTarget = null;
    }

    window.addEventListener('mouseup', onDrop);
    window.addEventListener('pointerup', onDrop);
    window.addEventListener('touchend', onDrop);
}
