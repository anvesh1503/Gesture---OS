/* =========================================================
   DESKTOP ENGINE
   Handles Virtual Desktops (Workspaces)
========================================================= */

export function initDesktops() {
    // 1. State
    let desktops = [
        { id: 1, name: 'Desktop 1' }
    ];
    let activeDesktopIndex = 0; // 0-based
    let windowWorkspaceMap = {}; // { windowId: desktopIndex }

    // UI Refs
    const taskViewBtn = document.getElementById('task-view-btn');

    // Create Overlay
    const overlay = document.createElement('div');
    overlay.id = 'task-view-overlay';
    overlay.innerHTML = `
        <div class="tv-title">Task View</div>
        <div class="desktop-list" id="tv-list"></div>
    `;
    document.body.appendChild(overlay);

    const tvList = overlay.querySelector('#tv-list');

    // Help Function: Switch
    function switchDesktop(index) {
        if (index < 0 || index >= desktops.length) return;
        activeDesktopIndex = index;

        // Update all windows
        const allWindows = document.querySelectorAll('.window');
        allWindows.forEach(win => {
            if (!win.id) return;

            // Safe init
            if (activeDesktopIndex === 0 && windowWorkspaceMap[win.id] === undefined) {
                windowWorkspaceMap[win.id] = 0;
            }

            const owner = windowWorkspaceMap[win.id];

            // If owner undefined, assume current desktop if visible
            if (owner === undefined && win.style.display !== 'none') {
                windowWorkspaceMap[win.id] = activeDesktopIndex;
            }

            if (windowWorkspaceMap[win.id] === activeDesktopIndex) {
                win.classList.remove('hidden-by-workspace');
            } else {
                win.classList.add('hidden-by-workspace');
                win.classList.remove('active-focus');
            }
        });

        renderTaskView();
    }

    // Observer
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(m => {
            if (m.type === 'attributes' && (m.attributeName === 'style' || m.attributeName === 'class')) {
                const win = m.target;
                if (!win.classList || !win.classList.contains('window')) return;

                if (win.style.display !== 'none' && !win.classList.contains('hidden-by-workspace')) {
                    if (windowWorkspaceMap[win.id] === undefined) {
                        windowWorkspaceMap[win.id] = activeDesktopIndex;
                    }
                    if (windowWorkspaceMap[win.id] !== activeDesktopIndex) {
                        // Moved to current by user action (showing it)
                        windowWorkspaceMap[win.id] = activeDesktopIndex;
                    }
                }
            }
        });
    });

    observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ['style', 'class']
    });

    // Render UI
    function renderTaskView() {
        tvList.innerHTML = '';

        desktops.forEach((d, i) => {
            const el = document.createElement('div');
            el.className = `desktop-thumbnail ${i === activeDesktopIndex ? 'active' : ''}`;
            el.innerHTML = `
                <div class="desktop-preview-box"></div>
                <div class="desktop-name">${d.name}</div>
                ${i > 0 ? '<div class="close-desktop-btn">✕</div>' : ''}
            `;

            el.onclick = (e) => {
                if (e.target.classList.contains('close-desktop-btn')) {
                    e.stopPropagation();
                    removeDesktop(i);
                } else {
                    switchDesktop(i);
                    toggleOverlay(false);
                }
            };

            tvList.appendChild(el);
        });

        if (desktops.length < 6) {
            const addBtn = document.createElement('div');
            addBtn.className = 'add-desktop-btn';
            addBtn.innerHTML = '+';
            addBtn.onclick = () => {
                desktops.push({ id: Date.now(), name: `Desktop ${desktops.length + 1}` });
                switchDesktop(desktops.length - 1);
                renderTaskView();
            };
            tvList.appendChild(addBtn);
        }
    }

    function removeDesktop(index) {
        if (index === 0) return;
        if (activeDesktopIndex === index) {
            switchDesktop(index - 1);
        } else if (activeDesktopIndex > index) {
            activeDesktopIndex--;
        }

        // Move windows to 0
        for (const wid in windowWorkspaceMap) {
            if (windowWorkspaceMap[wid] === index) {
                windowWorkspaceMap[wid] = 0;
            } else if (windowWorkspaceMap[wid] > index) {
                windowWorkspaceMap[wid]--;
            }
        }

        desktops.splice(index, 1);
        renderTaskView();
    }

    function toggleOverlay(forceState) {
        const isVisible = overlay.classList.contains('visible');
        const show = forceState !== undefined ? forceState : !isVisible;

        if (show) {
            overlay.style.display = 'flex';
            // Trigger reflow
            void overlay.offsetWidth;
            overlay.classList.add('visible');
            overlay.style.pointerEvents = 'auto';
            renderTaskView();
        } else {
            overlay.classList.remove('visible');
            overlay.style.pointerEvents = 'none';
            setTimeout(() => {
                if (!overlay.classList.contains('visible')) overlay.style.display = 'none';
            }, 300);
        }
    }

    if (taskViewBtn) {
        taskViewBtn.addEventListener('click', () => toggleOverlay());
    }

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) toggleOverlay(false);
    });

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey) {
            if (e.key === 'ArrowRight') {
                if (activeDesktopIndex < desktops.length - 1) switchDesktop(activeDesktopIndex + 1);
            } else if (e.key === 'ArrowLeft') {
                if (activeDesktopIndex > 0) switchDesktop(activeDesktopIndex - 1);
            }
        }
        if (e.key === 'Escape' && overlay.classList.contains('visible')) {
            toggleOverlay(false);
        }
    });

    // Init Map
    document.querySelectorAll('.window').forEach(win => {
        windowWorkspaceMap[win.id] = 0;
    });
}
