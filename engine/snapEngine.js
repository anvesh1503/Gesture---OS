/* =========================================================
   SNAP ENGINE
   Handles Aero Snap-like window docking behaviors.
   ========================================================= */

export function initSnap() {
    const overlay = document.createElement('div');
    overlay.id = 'pine-snap-overlay';

    const preview = document.createElement('div');
    preview.className = 'snap-preview';
    overlay.appendChild(preview);
    document.body.appendChild(overlay);

    let activeWindow = null;
    let snapTarget = null;
    let isDragging = false;

    // Observe style changes to detect dragging
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
            if (m.type === 'attributes' && m.attributeName === 'style') {
                const win = m.target;
                if (win.classList.contains('window') && win.style.display !== 'none') {
                    // Check if dragging (interacting) logic is needed? 
                    // script.js just assumed movement meant potential interaction.
                    // We verify it's not a snap animation itself
                    if (!win.classList.contains('snapping')) {
                        handleDrag(win);
                    }
                }
            }
        });
    });

    observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ['style']
    });

    function handleDrag(win) {
        const rect = win.getBoundingClientRect();
        const screenW = window.innerWidth;
        const taskbarH = 60;
        const threshold = 30;

        snapTarget = null;
        let previewRect = null;

        if (rect.top < threshold) {
            snapTarget = 'maximize';
            previewRect = { top: 0, left: 0, width: '100%', height: `calc(100% - ${taskbarH}px)` };
        } else if (rect.left < threshold) {
            snapTarget = 'left';
            previewRect = { top: 0, left: 0, width: '50%', height: `calc(100% - ${taskbarH}px)` };
        } else if (rect.right > screenW - threshold) {
            snapTarget = 'right';
            previewRect = { top: 0, left: '50%', width: '50%', height: `calc(100% - ${taskbarH}px)` };
        }

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

    function onDrop() {
        if (!activeWindow || !snapTarget) return;

        const win = activeWindow;

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

        overlay.classList.remove('active');
        activeWindow = null;
        snapTarget = null;
    }

    window.addEventListener('mouseup', onDrop);
    window.addEventListener('pointerup', onDrop);
    window.addEventListener('touchend', onDrop);
}
