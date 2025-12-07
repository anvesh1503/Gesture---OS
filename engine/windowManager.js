/* =========================================================
   WINDOW MANAGER MODULE
   Opens, closes, and manages window focus/z-index
========================================================= */

// State
let zIndexCounter = 100;

// DOM Cache
const windows = {
    notepad: document.getElementById("win-notepad"),
    calculator: document.getElementById("win-calculator"),
    settings: document.getElementById("win-settings"),
    browser: document.getElementById("win-browser")
};

// Re-query windows dynamically if needed (e.g. if they are recreated), 
// but for this static OS structure, caching is fine. 
// However, to be robust against DOM changes potentially caused by virtual desktops (though we just hide them), we keep it simple.

export function openApp(appName) {
    // If elements are lost/recreated, re-get them
    let win = windows[appName];
    if (!win) {
        win = document.getElementById(`win-${appName}`);
        if (win) windows[appName] = win;
    }

    if (win) {
        win.style.display = "flex";
        bringToFront(win);
        closeStartMenu();
    }
}

export function closeWin(id) {
    const win = document.getElementById(id);
    if (win) win.style.display = "none";
}

export function bringToFront(el) {
    if (!el) return;
    zIndexCounter++;
    el.style.zIndex = zIndexCounter;
}

export function closeStartMenu() {
    const startMenu = document.getElementById("start-menu");
    if (startMenu) startMenu.style.display = "none";
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

export function hideAllWins() {
    document.querySelectorAll('.window').forEach(w => w.style.display = 'none');
}

export function initWindowManager() {
    // Event Listeners for standard UI tasks

    // 1. Taskbar & Desktop Icons
    document.querySelectorAll(".desktop-icon, .taskbar-icon, .start-app").forEach(icon => {
        // Remove old listeners to be safe? No, we are reloading script.
        icon.onclick = () => { // Using onclick property to overwrite any existing
            const app = icon.getAttribute("data-app");
            if (app) openApp(app);
        };
    });

    // 2. Start Button
    const startBtn = document.getElementById("start-btn");
    if (startBtn) startBtn.onclick = toggleStartMenu;

    // 3. Window Controls (Close/Minimize)
    document.querySelectorAll(".close").forEach(btn => {
        btn.onclick = (e) => {
            const win = e.target.closest(".window");
            if (win) win.style.display = "none";
        };
    });

    document.querySelectorAll(".minimize").forEach(btn => {
        btn.onclick = (e) => {
            const win = e.target.closest(".window");
            if (win) win.style.display = "none";
        };
    });

    // 4. Click to focus
    document.querySelectorAll(".window").forEach(win => {
        win.addEventListener("mousedown", () => bringToFront(win));
    });

    // 5. Settings Toggles
    document.querySelectorAll(".toggle").forEach(toggle => {
        toggle.onclick = () => {
            toggle.classList.toggle("active");
        };
    });

    // 6. Focus Manager Logic (Visual Highlight)
    initFocusManager();
}

function initFocusManager() {
    // Setup MutationObserver for z-index changes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'style') {
                updateFocusBasedOnZIndex();
            }
        });
    });

    document.querySelectorAll('.window').forEach(win => {
        observer.observe(win, { attributes: true, attributeFilter: ['style'] });
    });
}

function updateFocusBasedOnZIndex() {
    let maxZ = -1;
    let topWindow = null;

    document.querySelectorAll('.window').forEach(win => {
        if (win.style.display !== 'none') {
            const z = parseInt(win.style.zIndex || 0);
            if (z > maxZ) {
                maxZ = z;
                topWindow = win;
            }
        }
    });

    document.querySelectorAll('.window').forEach(win => {
        if (win === topWindow) {
            win.classList.add('active-focus');
        } else {
            win.classList.remove('active-focus');
        }
    });
}
