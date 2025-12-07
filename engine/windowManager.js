/* =========================================================
   WINDOW MANAGER
   Handles opening, closing, focusing, and resizing windows.
   ========================================================= */

const windows = {
    notepad: () => document.getElementById("win-notepad"),
    calculator: () => document.getElementById("win-calculator"),
    settings: () => document.getElementById("win-settings"),
    browser: () => document.getElementById("win-browser")
};

let zIndexCounter = 100;

export function initWindowManager() {
    setupEventListeners();
    initResizer();
    initFocusManager();
}

/* ---- Core Actions ---- */
export function openApp(appName) {
    const getWin = windows[appName];
    if (!getWin) return;
    const win = getWin();
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

export function hideAllWins() {
    document.querySelectorAll('.window').forEach(w => w.style.display = 'none');
}

export function focusWin(id) {
    const win = document.getElementById(id);
    if (win && win.style.display !== 'none') {
        bringToFront(win);
    }
}

export function bringToFront(el) {
    zIndexCounter++;
    el.style.zIndex = zIndexCounter;
}

function closeStartMenu() {
    const menu = document.getElementById("start-menu");
    if (menu) menu.style.display = "none";
}

/* ---- Event Listeners ---- */
function setupEventListeners() {
    // Window Close Buttons
    document.querySelectorAll(".close").forEach(btn => {
        btn.onclick = (e) => { // Use onclick to replace listeners
            e.target.closest(".window").style.display = "none";
        };
    });

    // Minimize Buttons
    document.querySelectorAll(".minimize").forEach(btn => {
        btn.onclick = (e) => {
            e.target.closest(".window").style.display = "none";
        };
    });

    // Click to Focus
    document.querySelectorAll(".window").forEach(win => {
        win.addEventListener("mousedown", () => bringToFront(win));
    });
}

/* ---- Resizer Engine ---- */
const Resizer = {
    minWidth: 250,
    minHeight: 200,
    isResizing: false,
    currentWindow: null,
    resizeDir: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    rafId: null,

    init: function () {
        document.querySelectorAll('.window').forEach(win => {
            if (win.querySelector('.resize-handle')) return;

            const right = document.createElement('div');
            right.className = 'resize-handle resize-handle-right';
            right.addEventListener('mousedown', (e) => this.startResize(e, 'right', win));

            const bottom = document.createElement('div');
            bottom.className = 'resize-handle resize-handle-bottom';
            bottom.addEventListener('mousedown', (e) => this.startResize(e, 'bottom', win));

            const corner = document.createElement('div');
            corner.className = 'resize-handle resize-handle-corner';
            corner.addEventListener('mousedown', (e) => this.startResize(e, 'corner', win));

            win.appendChild(right);
            win.appendChild(bottom);
            win.appendChild(corner);
        });

        document.addEventListener('mousemove', (e) => this.resize(e.clientX, e.clientY));
        document.addEventListener('mouseup', () => this.stopResize());
    },

    startResize: function (e, dir, win) {
        e.preventDefault();
        e.stopPropagation();

        this.isResizing = true;
        this.currentWindow = win;
        this.resizeDir = dir;
        this.startX = e.clientX;
        this.startY = e.clientY;

        const rect = win.getBoundingClientRect();
        this.startWidth = rect.width;
        this.startHeight = rect.height;

        bringToFront(win);
        win.classList.add('resizing');
        this.pollGesture();
    },

    pollGesture: function () {
        if (!this.isResizing) return;
        const cursor = document.getElementById('custom-cursor');
        if (cursor) {
            const x = parseFloat(cursor.style.left);
            const y = parseFloat(cursor.style.top);
            if (!isNaN(x) && !isNaN(y)) {
                this.resize(x, y);
            }
        }
        this.rafId = requestAnimationFrame(() => this.pollGesture());
    },

    resize: function (clientX, clientY) {
        if (!this.isResizing || !this.currentWindow) return;

        const dx = clientX - this.startX;
        const dy = clientY - this.startY;

        if (this.resizeDir === 'right' || this.resizeDir === 'corner') {
            const newWidth = Math.max(this.minWidth, this.startWidth + dx);
            this.currentWindow.style.width = newWidth + 'px';
        }

        if (this.resizeDir === 'bottom' || this.resizeDir === 'corner') {
            const newHeight = Math.max(this.minHeight, this.startHeight + dy);
            this.currentWindow.style.height = newHeight + 'px';
        }
    },

    stopResize: function () {
        if (this.currentWindow) {
            this.currentWindow.classList.remove('resizing');
        }
        this.isResizing = false;
        this.currentWindow = null;
        this.resizeDir = null;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }
};

function initResizer() {
    Resizer.init();
}

/* ---- Focus Manager ---- */
function initFocusManager() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'style') {
                updateFocusBasedOnZIndex();
            }
        });
    });

    document.querySelectorAll('.window').forEach(win => {
        observer.observe(win, { attributes: true, attributeFilter: ['style'] });
        win.addEventListener('mousedown', () => setFocus(win));
    });
}

function setFocus(activeWin) {
    document.querySelectorAll('.window').forEach(win => {
        if (win === activeWin) {
            win.classList.add('active-focus');
        } else {
            win.classList.remove('active-focus');
        }
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

    if (topWindow) {
        setFocus(topWindow);
    }
}
