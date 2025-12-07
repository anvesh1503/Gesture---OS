/* =========================================================
   DESKTOP ENGINE
   Handles Icons, Start Menu, Taskbar, and Virtual Desktops.
   ========================================================= */
import { openApp, bringToFront } from './windowManager.js';

/* ---- State ---- */
let desktops = [{ id: 1, name: 'Desktop 1' }];
let activeDesktopIndex = 0;
let windowWorkspaceMap = {};

/* ---- Boot Screen ---- */
export function runBootSequence() {
    if (document.getElementById('pine-boot-screen')) return;

    const bootHTML = `
        <div class="pine-boot-content">
            <span class="pine-boot-logo">🍍</span>
            <div class="pine-boot-title">Gesture OS</div>
            <div class="pine-boot-bar-container">
                <div class="pine-boot-bar"></div>
            </div>
            <div class="pine-boot-subtext">Powered by Gesture AI</div>
        </div>
    `;

    const overlay = document.createElement('div');
    overlay.id = 'pine-boot-screen';
    overlay.innerHTML = bootHTML;
    document.body.appendChild(overlay);

    const cleanup = () => {
        if (!overlay) return;
        overlay.classList.add('fade-out');
        document.removeEventListener('keydown', cleanup);
        document.removeEventListener('pointerdown', cleanup);
        setTimeout(() => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 300);
    };

    setTimeout(cleanup, 3500);
    document.addEventListener('keydown', cleanup);
    document.addEventListener('pointerdown', cleanup);
}

/* ---- Desktop & Taskbar ---- */
export function initDesktop() {
    // Icons
    document.querySelectorAll(".desktop-icon, .taskbar-icon, .start-app").forEach(icon => {
        icon.addEventListener("click", () => {
            const app = icon.getAttribute("data-app");
            if (app) openApp(app);
        });
    });

    // Start Menu
    const startBtn = document.getElementById("start-btn");
    if (startBtn) startBtn.addEventListener("click", toggleStartMenu);

    document.addEventListener('click', (e) => {
        const menu = document.getElementById("start-menu");
        const btn = document.getElementById("start-btn");
        if (menu && menu.style.display === 'flex' && !menu.contains(e.target) && !btn.contains(e.target)) {
            menu.style.display = 'none';
        }
    });

    initVirtualDesktops();
}

export function toggleStartMenu() {
    const menu = document.getElementById("start-menu");
    if (!menu) return;
    if (menu.style.display === "flex") {
        menu.style.display = "none";
    } else {
        menu.style.display = "flex";
        bringToFront(menu);
    }
}

/* ---- Virtual Desktops (Task View) ---- */
function initVirtualDesktops() {
    const taskViewBtn = document.getElementById('task-view-btn');
    const overlay = document.createElement('div');
    overlay.id = 'task-view-overlay';
    overlay.innerHTML = `
        <div class="tv-title">Task View</div>
        <div class="desktop-list" id="tv-list"></div>
    `;
    document.body.appendChild(overlay);

    if (taskViewBtn) taskViewBtn.onclick = () => toggleTaskView();
    overlay.onclick = (e) => { if (e.target === overlay) toggleTaskView(false); };

    // Init Map
    document.querySelectorAll('.window').forEach(w => windowWorkspaceMap[w.id] = 0);

    // Observer for new windows
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(m => {
            if (m.type === 'attributes' && (m.attributeName === 'style')) {
                const win = m.target;
                if (!win.classList.contains('window')) return;

                if (win.style.display !== 'none' && !win.classList.contains('hidden-by-workspace')) {
                    // If window opens/becomes visible, ensure it's on this desktop
                    if (windowWorkspaceMap[win.id] !== activeDesktopIndex) {
                        // Move to current
                        windowWorkspaceMap[win.id] = activeDesktopIndex;
                    }
                }
            }
        });
    });
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style'] });
}

function toggleTaskView(force) {
    const overlay = document.getElementById('task-view-overlay');
    const isVisible = overlay.classList.contains('visible');
    const show = force !== undefined ? force : !isVisible;

    if (show) {
        overlay.style.display = 'flex';
        void overlay.offsetWidth;
        overlay.classList.add('visible');
        overlay.style.pointerEvents = 'auto';
        renderTaskView(overlay);
    } else {
        overlay.classList.remove('visible');
        overlay.style.pointerEvents = 'none';
        setTimeout(() => { if (!overlay.classList.contains('visible')) overlay.style.display = 'none'; }, 300);
    }
}

function renderTaskView(overlay) {
    const tvList = overlay.querySelector('#tv-list');
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
                desktops.splice(i, 1);
                if (activeDesktopIndex >= i) activeDesktopIndex = Math.max(0, activeDesktopIndex - 1);
                // Reassign windows
                for (const w in windowWorkspaceMap) {
                    if (windowWorkspaceMap[w] === i) windowWorkspaceMap[w] = 0;
                    else if (windowWorkspaceMap[w] > i) windowWorkspaceMap[w]--;
                }
                switchDesktop(activeDesktopIndex);
            } else {
                switchDesktop(i);
                toggleTaskView(false);
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
            toggleTaskView(false); // Optional: close on new desktop creation? maybe stay open
            renderTaskView(overlay); // re-render
        };
        tvList.appendChild(addBtn);
    }
}

function switchDesktop(index) {
    if (index < 0 || index >= desktops.length) return;
    activeDesktopIndex = index;

    document.querySelectorAll('.window').forEach(win => {
        if (!win.id) return;
        if (windowWorkspaceMap[win.id] === undefined) {
            // If unassigned, assume current (safety)
            if (win.style.display !== 'none') {
                windowWorkspaceMap[win.id] = activeDesktopIndex;
            } else {
                windowWorkspaceMap[win.id] = 0; // Default to Desktop 1
            }
        }

        if (windowWorkspaceMap[win.id] === activeDesktopIndex) {
            win.classList.remove('hidden-by-workspace');
        } else {
            win.classList.add('hidden-by-workspace');
            win.classList.remove('active-focus');
        }
    });
}

// Global API for Gestures
export function cycleDesktop(direction) {
    // direction: 1 (Next), -1 (Prev)
    let newIndex = activeDesktopIndex + direction;
    // Circular? Or bounded? Let's do Bounded.
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= desktops.length) newIndex = desktops.length - 1;

    if (newIndex !== activeDesktopIndex) {
        switchDesktop(newIndex);
        // Show a brief toast or indicator?
        // showNotification('Desktop', `Switched to Desktop ${newIndex + 1}`);
        return true;
    }
    return false;
}
