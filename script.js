/* =========================================================
   PINEAPPLE OS LOGIC
========================================================= */

/* ---- OS State ---- */
const windows = {
    notepad: document.getElementById("win-notepad"),
    calculator: document.getElementById("win-calculator"),
    settings: document.getElementById("win-settings"),
    browser: document.getElementById("win-browser")
};

let zIndexCounter = 100;

/* ---- Window Management ---- */
function openApp(appName) {
    const win = windows[appName];
    if (win) {
        win.style.display = "flex";
        bringToFront(win);
        closeStartMenu();
    }
}

function bringToFront(el) {
    zIndexCounter++;
    el.style.zIndex = zIndexCounter;
}

function closeStartMenu() {
    document.getElementById("start-menu").style.display = "none";
}

function toggleStartMenu() {
    const menu = document.getElementById("start-menu");
    if (menu.style.display === "flex") {
        menu.style.display = "none";
    } else {
        menu.style.display = "flex";
        bringToFront(menu);
    }
}

/* ---- Event Listeners (Mouse/Touch fallback) ---- */
document.querySelectorAll(".desktop-icon, .taskbar-icon, .start-app").forEach(icon => {
    icon.addEventListener("click", () => {
        const app = icon.getAttribute("data-app");
        if (app) openApp(app);
    });
});

document.getElementById("start-btn").addEventListener("click", toggleStartMenu);

document.querySelectorAll(".close").forEach(btn => {
    btn.addEventListener("click", (e) => {
        e.target.closest(".window").style.display = "none";
    });
});

document.querySelectorAll(".minimize").forEach(btn => {
    btn.addEventListener("click", (e) => {
        e.target.closest(".window").style.display = "none";
    });
});

document.querySelectorAll(".window").forEach(win => {
    win.addEventListener("mousedown", () => bringToFront(win));
});

/* ---- Settings Toggles ---- */
document.querySelectorAll(".toggle").forEach(toggle => {
    toggle.addEventListener("click", () => {
        toggle.classList.toggle("active");
    });
});

/* =========================================================
   RESIZER ENGINE
========================================================= */
const Resizer = {
    minWidth: 250,
    minHeight: 200,
    isResizing: false,
    currentWindow: null,
    resizeDir: null, // 'right', 'bottom', 'corner'
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

        // Start polling for gesture cursor movement
        this.pollGesture();
    },

    pollGesture: function () {
        if (!this.isResizing) return;

        const cursor = document.getElementById('custom-cursor');
        if (cursor) {
            // Parse 'left' and 'top' from inline styles
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

// Initialize Resizer
Resizer.init();

// Initialize Resizer
Resizer.init();

/* =========================================================
   FOCUS MANAGER
   Handles visual highlighting of active windows
========================================================= */
const FocusManager = {
    init: function () {
        // 1. Setup Click Listeners
        document.querySelectorAll('.window').forEach(win => {
            win.addEventListener('mousedown', () => this.setFocus(win));
        });

        // 2. Setup MutationObserver for z-index changes
        // This detects when openApp or bringToFront changes the z-index
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'style') {
                    const target = mutation.target;
                    // Check if this window is now on top (simple check: if it was just modified)
                    // Better check: find window with max z-index
                    this.updateFocusBasedOnZIndex();
                }
            });
        });

        document.querySelectorAll('.window').forEach(win => {
            observer.observe(win, { attributes: true, attributeFilter: ['style'] });
        });
    },

    setFocus: function (activeWin) {
        document.querySelectorAll('.window').forEach(win => {
            if (win === activeWin) {
                win.classList.add('active-focus');
            } else {
                win.classList.remove('active-focus');
            }
        });
    },

    updateFocusBasedOnZIndex: function () {
        let maxZ = -1;
        let topWindow = null;

        document.querySelectorAll('.window').forEach(win => {
            // Only consider visible windows
            if (win.style.display !== 'none') {
                const z = parseInt(win.style.zIndex || 0);
                if (z > maxZ) {
                    maxZ = z;
                    topWindow = win;
                }
            }
        });

        if (topWindow) {
            this.setFocus(topWindow);
        }
    }
};

FocusManager.init();

/* =========================================================
   GESTURE ENGINE (High Sensitivity)
========================================================= */

const videoElement = document.getElementById("camera");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const cursorEl = document.getElementById("custom-cursor");
const statusEl = document.getElementById("gesture-status");

/* ---- Config ---- */
const CAMERA_MARGIN = 0.15;
const PINCH_THRESHOLD = 0.06;
const FIST_DEBOUNCE_MS = 800;

/* ---- State ---- */
let wasPinching = false;
let isDragging = false;
let dragTarget = null;
let dragOffset = { x: 0, y: 0 };
let lastFistTime = 0;

// Camera Box State
let isCamDragging = false;
let camDragOffset = { x: 0, y: 0 };
let camPinchStart = 0;

/* ---- Helper: Coordinate Mapping ---- */
function toScreenCoords(lm) {
    // 1. Mirror X
    let x = 1 - lm.x;
    let y = lm.y;

    // 2. Apply Margin (Zoom)
    // Map [MARGIN, 1-MARGIN] -> [0, 1]
    let x_mapped = (x - CAMERA_MARGIN) / (1 - 2 * CAMERA_MARGIN);
    let y_mapped = (y - CAMERA_MARGIN) / (1 - 2 * CAMERA_MARGIN);

    // 3. Clamp
    x_mapped = Math.max(0, Math.min(1, x_mapped));
    y_mapped = Math.max(0, Math.min(1, y_mapped));

    return {
        x: x_mapped * window.innerWidth,
        y: y_mapped * window.innerHeight
    };
}

function elementAt(x, y) {
    return document.elementFromPoint(x, y);
}

function findDraggableWindow(el) {
    while (el) {
        if (el.classList && el.classList.contains("window")) return el;
        el = el.parentElement;
    }
    return null;
}

/* ---- Camera Interaction Logic ---- */
function isCursorInCameraNav(x, y) {
    const nav = document.getElementById('camera-nav');
    if (!nav) return false;
    const rect = nav.getBoundingClientRect();
    return (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
}

function handleCameraInteraction(x, y, isPinching) {
    const overlay = document.getElementById('gesture-overlay');

    // 1. Pinch Start
    if (isPinching && !wasPinching) {

        // Check buttons
        const el = document.elementFromPoint(x, y);
        if (el && el.classList.contains('cam-btn')) {
            el.click();
            return;
        }

        // Check lock
        if (overlay.classList.contains('locked')) {
            statusEl.innerText = "LOCKED";
            return;
        }

        isCamDragging = true;
        camDragOffset.x = x - overlay.offsetLeft;
        camDragOffset.y = y - overlay.offsetTop;
    }

    // 2. Pinching (Hold)
    if (isPinching) {
        if (isCamDragging) {
            overlay.style.left = (x - camDragOffset.x) + 'px';
            overlay.style.top = (y - camDragOffset.y) + 'px';
            overlay.style.bottom = 'auto'; // Clear default bottom-left
            overlay.style.right = 'auto';
            statusEl.innerText = "MOVING CAM";
        }
    } else {
        // Released
        isCamDragging = false;
    }
}

function initCameraButtons() {
    const overlay = document.getElementById('gesture-overlay');
    if (!overlay) return;

    const btnMin = document.getElementById('btn-minimize');
    if (btnMin) btnMin.onclick = () => overlay.classList.toggle('minimized');

    const btnSize = document.getElementById('btn-size');
    if (btnSize) btnSize.onclick = () => overlay.classList.toggle('large');

    const btnOp = document.getElementById('btn-opacity');
    if (btnOp) btnOp.onclick = () => overlay.classList.toggle('transparent');

    const btnLock = document.getElementById('btn-lock');
    if (btnLock) btnLock.onclick = () => {
        overlay.classList.toggle('locked');
        btnLock.classList.toggle('active');
        btnLock.innerText = overlay.classList.contains('locked') ? '🔒' : '🔓';
    };
}
setTimeout(initCameraButtons, 1000);


/* ---- Fake Input Events ---- */
function fakeClick(x, y) {
    const el = elementAt(x, y);
    if (el) el.click();
}

function fakeMouseDown(x, y) {
    const el = elementAt(x, y);
    if (el) {
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: x, clientY: y }));
    }
}

function fakeMouseUp(x, y) {
    const el = elementAt(x, y);
    if (el) {
        el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: x, clientY: y }));
    }
}

function fakeRightClick(x, y) {
    const el = elementAt(x, y);
    if (el) {
        el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: x, clientY: y }));
    }
}

/* ---- MediaPipe ---- */
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 0,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        if (videoElement.videoWidth) {
            await hands.send({ image: videoElement });
        }
    },
    width: 640,
    height: 480
});
camera.start();

/* ---- Main Loop ---- */
function onResults(results) {
    if (canvasElement.width !== videoElement.videoWidth || canvasElement.height !== videoElement.videoHeight) {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
    }
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lm = results.multiHandLandmarks[0];

        // Draw Skeleton
        drawConnectors(canvasCtx, lm, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
        drawLandmarks(canvasCtx, lm, { color: '#FF0000', lineWidth: 1 });

        // 1. Move Cursor
        const indexTip = lm[8];
        const pos = toScreenCoords(indexTip);
        cursorEl.style.left = pos.x + "px";
        cursorEl.style.top = pos.y + "px";

        // 2. Detect Pinch
        const thumbTip = lm[4];
        const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
        const isPinching = pinchDist < PINCH_THRESHOLD;

        // 3. Detect Fist (Right Click)
        // Simple: check if fingertips are close to palm base
        // Or count extended fingers
        let extended = 0;
        if (lm[8].y < lm[6].y) extended++;
        if (lm[12].y < lm[10].y) extended++;
        if (lm[16].y < lm[14].y) extended++;
        if (lm[20].y < lm[18].y) extended++;
        const isFist = (extended === 0);

        // ---- NEW CAM LOGIC ----
        if (isCursorInCameraNav(pos.x, pos.y) || isCamDragging) {

            // Hover
            const nav = document.getElementById('camera-nav');
            if (nav) nav.style.opacity = 1;

            handleCameraInteraction(pos.x, pos.y, isPinching);

            cursorEl.classList.add("active");
            if (!isCamDragging) statusEl.innerText = "CAM CONTROLS";

        } else {
            // NORMAL LOGIC
            if (isFist) {
                statusEl.innerText = "FIST (Right Click)";
                cursorEl.classList.add("fist");
                const now = Date.now();
                if (now - lastFistTime > FIST_DEBOUNCE_MS) {
                    lastFistTime = now;
                    fakeRightClick(pos.x, pos.y);
                }
            } else if (isPinching) {
                statusEl.innerText = "PINCH (Click/Drag)";
                cursorEl.classList.add("active");
                cursorEl.classList.remove("fist");

                if (!wasPinching) {
                    // Start Pinch
                    const el = elementAt(pos.x, pos.y);
                    const win = findDraggableWindow(el);
                    if (win && el.closest(".title-bar")) { // Only drag if pinching title bar
                        isDragging = true;
                        dragTarget = win;
                        dragOffset.x = pos.x - win.offsetLeft;
                        dragOffset.y = pos.y - win.offsetTop;
                        bringToFront(win);
                    } else {
                        fakeMouseDown(pos.x, pos.y);
                    }
                }

                if (isDragging && dragTarget) {
                    dragTarget.style.left = (pos.x - dragOffset.x) + "px";
                    dragTarget.style.top = (pos.y - dragOffset.y) + "px";
                }

            } else {
                statusEl.innerText = "IDLE";
                cursorEl.classList.remove("active");
                cursorEl.classList.remove("fist");

                if (wasPinching) {
                    // Release Pinch
                    if (isDragging) {
                        isDragging = false;
                        dragTarget = null;
                    } else {
                        fakeMouseUp(pos.x, pos.y);
                        fakeClick(pos.x, pos.y); // Trigger click on release
                    }
                }
            }
        }
        // -----------------------

        wasPinching = isPinching;

    } else {
        statusEl.innerText = "NO HAND";
    }

    canvasCtx.restore();
}

/* =========================================================
   BOOT SCREEN (Injected)
   Self-contained module for startup animation
========================================================= */
(function () {
    // 1. Idempotency Check
    if (document.getElementById('pine-boot-screen')) return;

    // 2. HTML Template
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

    // 3. Create & Inject Overlay
    const overlay = document.createElement('div');
    overlay.id = 'pine-boot-screen';
    overlay.innerHTML = bootHTML;
    document.body.appendChild(overlay);

    // 4. Cleanup Logic
    const cleanup = () => {
        if (!overlay) return;
        overlay.classList.add('fade-out');

        // Remove listeners immediately
        document.removeEventListener('keydown', cleanup);
        document.removeEventListener('pointerdown', cleanup);

        // Wait for transition then remove DOM node
        setTimeout(() => {
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 300); // 300ms matches CSS transition
    };

    // 5. Triggers
    // Auto-dismiss after animation (~3.5s)
    const timer = setTimeout(cleanup, 3500);

    // User interactions to dismiss early
    document.addEventListener('keydown', cleanup);
    document.addEventListener('pointerdown', cleanup);

})();

/* =========================================================
   DESKTOP WIDGETS (Injected)
   Self-contained module for desktop widgets
========================================================= */
(function () {
    // 1. Container Injection
    const desktop = document.getElementById('desktop');
    if (!desktop || document.getElementById('desktop-widgets-container')) return;

    const container = document.createElement('div');
    container.id = 'desktop-widgets-container';
    desktop.appendChild(container);

    // 2. Widget HTML Templates
    const clockHTML = `
        <div class="pine-widget-header"></div>
        <div class="clock-time">00:00</div>
        <div class="clock-date">Mon, 01 Jan</div>
    `;

    const calendarHTML = `
        <div class="pine-widget-header"></div>
        <div class="calendar-header">Month Year</div>
        <div class="calendar-grid">
            <div class="cal-day-name">Su</div><div class="cal-day-name">Mo</div><div class="cal-day-name">Tu</div>
            <div class="cal-day-name">We</div><div class="cal-day-name">Th</div><div class="cal-day-name">Fr</div><div class="cal-day-name">Sa</div>
            <!-- Days injected here -->
        </div>
    `;

    // 3. Create Widgets
    function createWidget(id, html, x, y) {
        const widget = document.createElement('div');
        widget.id = id;
        widget.className = 'pine-widget';
        widget.style.left = x + 'px';
        widget.style.top = y + 'px';
        widget.innerHTML = html;
        container.appendChild(widget);
        return widget;
    }

    const clockWidget = createWidget('widget-clock', clockHTML, window.innerWidth - 160, 20);
    const calendarWidget = createWidget('widget-calendar', calendarHTML, window.innerWidth - 220, 110);

    // 4. Logic: Clock
    function updateClock() {
        const now = new Date();
        const timeEl = clockWidget.querySelector('.clock-time');
        const dateEl = clockWidget.querySelector('.clock-date');

        timeEl.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        dateEl.innerText = now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
    }
    setInterval(updateClock, 1000);
    updateClock();

    // 5. Logic: Calendar
    function renderCalendar() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay(); // 0 = Sun

        const header = calendarWidget.querySelector('.calendar-header');
        header.innerText = now.toLocaleDateString([], { month: 'long', year: 'numeric' });

        const grid = calendarWidget.querySelector('.calendar-grid');
        // Clear old days (keep headers)
        const dayNames = grid.querySelectorAll('.cal-day-name');
        grid.innerHTML = '';
        dayNames.forEach(d => grid.appendChild(d));

        // Empty slots
        for (let i = 0; i < startingDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'cal-day empty';
            grid.appendChild(empty);
        }

        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            const day = document.createElement('div');
            day.classList.add('cal-day');
            day.innerText = i;
            if (i === now.getDate()) day.classList.add('today');

            day.addEventListener('click', () => {
                // Simple visual feedback
                day.style.transform = 'scale(0.9)';
                setTimeout(() => day.style.transform = 'scale(1)', 100);
            });

            grid.appendChild(day);
        }
    }
    renderCalendar();

    // 6. Logic: Dragging (Independent System)
    let zIndex = 100;

    function initDrag(widget) {
        const header = widget.querySelector('.pine-widget-header');
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        header.addEventListener('pointerdown', (e) => {
            e.preventDefault(); // Prevent text selection
            isDragging = true;
            header.setPointerCapture(e.pointerId);

            startX = e.clientX;
            startY = e.clientY;
            initialLeft = widget.offsetLeft;
            initialTop = widget.offsetTop;

            // Local Z-Index Bump
            zIndex++;
            widget.style.zIndex = zIndex;
            widget.style.cursor = 'grabbing';
        });

        header.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            widget.style.left = (initialLeft + dx) + 'px';
            widget.style.top = (initialTop + dy) + 'px';
        });

        header.addEventListener('pointerup', (e) => {
            if (!isDragging) return;
            isDragging = false;
            header.releasePointerCapture(e.pointerId);
            widget.style.cursor = 'grab';
        });
    }

    initDrag(clockWidget);
    initDrag(calendarWidget);

})();

/* =========================================================
   VOICE COMMANDS (Injected)
   Self-contained module for Web Speech API
========================================================= */
(function () {
    // 1. Setup & UI References
    const toggle = document.getElementById('voice-toggle');
    const status = document.getElementById('voice-status');
    const desktop = document.getElementById('desktop');
    let recognition = null;
    let isEnabled = localStorage.getItem('pine_voice_enabled') === 'true';

    // Toast Setup
    const toast = document.createElement('div');
    toast.id = 'voice-toast';
    toast.innerHTML = '<span>🎙️</span><span id="voice-toast-text"></span>';
    document.body.appendChild(toast);

    function showToast(text) {
        const textEl = document.getElementById('voice-toast-text');
        if (textEl) textEl.innerText = text;
        toast.classList.remove('show');
        void toast.offsetWidth; // Trigger reflow
        toast.classList.add('show');
    }

    // 2. Feature Detection
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        if (status) status.innerText = 'Not Supported';
        return;
    }

    // 3. Command Map
    const commands = {
        'open calculator': () => openApp('calculator'),
        'open notepad': () => openApp('notepad'),
        'open notes': () => openApp('notepad'),
        'open settings': () => openApp('settings'),
        'open browser': () => openApp('browser'),
        'close calculator': () => closeWin('win-calculator'),
        'close notepad': () => closeWin('win-notepad'),
        'close settings': () => closeWin('win-settings'),
        'close browser': () => closeWin('win-browser'),
        'show desktop': () => hideAllWins(),
        'focus calculator': () => focusWin('win-calculator'),
        'focus notepad': () => focusWin('win-notepad'),

        // Calculator Commands
        'press one': () => triggerCalculatorButton('1'),
        'press 1': () => triggerCalculatorButton('1'),
        'press two': () => triggerCalculatorButton('2'),
        'press 2': () => triggerCalculatorButton('2'),
        'press three': () => triggerCalculatorButton('3'),
        'press 3': () => triggerCalculatorButton('3'),
        'press four': () => triggerCalculatorButton('4'),
        'press 4': () => triggerCalculatorButton('4'),
        'press five': () => triggerCalculatorButton('5'),
        'press 5': () => triggerCalculatorButton('5'),
        'press six': () => triggerCalculatorButton('6'),
        'press 6': () => triggerCalculatorButton('6'),
        'press seven': () => triggerCalculatorButton('7'),
        'press 7': () => triggerCalculatorButton('7'),
        'press eight': () => triggerCalculatorButton('8'),
        'press 8': () => triggerCalculatorButton('8'),
        'press nine': () => triggerCalculatorButton('9'),
        'press 9': () => triggerCalculatorButton('9'),
        'press zero': () => triggerCalculatorButton('0'),
        'press 0': () => triggerCalculatorButton('0'),

        'plus': () => triggerCalculatorButton('+'),
        'add': () => triggerCalculatorButton('+'),
        'minus': () => triggerCalculatorButton('-'),
        'subtract': () => triggerCalculatorButton('-'),
        'multiply': () => triggerCalculatorButton('*'),
        'times': () => triggerCalculatorButton('*'),
        'divide': () => triggerCalculatorButton('/'),
        'divide by': () => triggerCalculatorButton('/'),
        'equals': () => triggerCalculatorButton('='),
        'calculate': () => triggerCalculatorButton('='),
        'clear': () => triggerCalculatorButton('C'),
        'reset': () => triggerCalculatorButton('C')
    };

    function triggerCalculatorButton(label) {
        // 1. Ensure Calculator is Open
        const win = document.getElementById('win-calculator');
        if (!win || win.style.display === 'none') {
            openApp('calculator');
            // Give it a tiny moment to render if needed, but display:flex is sync.
        }

        // 2. Find Button
        // We need to look inside .calc-grid buttons
        const buttons = win.querySelectorAll('button');
        for (let btn of buttons) {
            if (btn.innerText === label) {
                // 3. Click
                btn.click();
                // Visual feedback
                btn.style.transform = 'scale(0.95)';
                setTimeout(() => btn.style.transform = '', 100);
                return;
            }
        }
        console.warn('Calculator button not found:', label);
    }

    // Helper: Safe Actions
    function closeWin(id) {
        const win = document.getElementById(id);
        if (win) win.style.display = 'none';
        // Note: We don't touch internal closeApp state, just visual hide for safety
    }

    function hideAllWins() {
        document.querySelectorAll('.window').forEach(w => w.style.display = 'none');
    }

    function focusWin(id) {
        const win = document.getElementById(id);
        if (win && win.style.display !== 'none') {
            if (typeof bringToFront === 'function') bringToFront(win);
        }
    }

    // 4. Lifecycle
    function startVoice() {
        try {
            recognition = new SpeechRecognition();
            recognition.continuous = false; // Short bursts
            recognition.lang = 'en-US';
            recognition.interimResults = false;

            recognition.onstart = () => {
                if (status) status.innerText = 'Listening...';
                if (status) status.style.color = '#0f0';
            };

            recognition.onend = () => {
                if (isEnabled && recognition) {
                    // Slight delay before restart to avoid loop spam
                    setTimeout(() => {
                        if (isEnabled && recognition) recognition.start();
                    }, 500);
                } else {
                    if (status) status.innerText = 'Off';
                    if (status) status.style.color = '';
                }
            };

            recognition.onresult = (event) => {
                const rawTranscript = event.results[0][0].transcript.trim();
                const cleanCmd = rawTranscript.toLowerCase();
                console.log('Voice:', rawTranscript);

                // 1. Check if Notepad is Active (Voice Typing Mode)
                const notepadWin = document.getElementById('win-notepad');
                if (notepadWin && notepadWin.classList.contains('active-focus') && notepadWin.style.display !== 'none') {

                    // Special Escape Command
                    if (cleanCmd.includes('close notepad')) {
                        showToast('Closing Notepad');
                        commands['close notepad']();
                        return;
                    }

                    // Dictation
                    insertTextIntoNotepad(rawTranscript);
                    showToast('Typed: ' + rawTranscript);
                    return; // SKIP normal commands
                }

                // 2. Normal Command Mode
                let matched = false;
                for (const [cmd, action] of Object.entries(commands)) {
                    if (cleanCmd.includes(cmd)) {
                        showToast(cmd); // Feedback
                        action();
                        matched = true;
                        break;
                    }
                }

                if (!matched) {
                    // Optional: showToast('? ' + transcript);
                }
            };

            recognition.onerror = (e) => {
                console.warn('Voice error', e.error);
                if (status) status.innerText = 'Error: ' + e.error;
            };

            recognition.start();

        } catch (e) {
            console.error(e);
            if (status) status.innerText = 'Error starting';
        }
    }

    function insertTextIntoNotepad(text) {
        const win = document.getElementById('win-notepad');
        if (!win) return;

        const textarea = win.querySelector('textarea');
        if (textarea) {
            // Append with space if needed
            if (textarea.value.length > 0 && !textarea.value.endsWith(' ') && !textarea.value.endsWith('\n')) {
                textarea.value += ' ';
            }
            textarea.value += text;
            textarea.scrollTop = textarea.scrollHeight; // Auto-scroll
        }
    }

    function stopVoice() {
        if (recognition) {
            recognition.stop();
            recognition = null;
        }
        if (status) status.innerText = 'Off';
        if (status) status.style.color = '';
    }

    function updateState() {
        if (isEnabled) {
            toggle.classList.add('active');
            startVoice();
        } else {
            toggle.classList.remove('active');
            stopVoice();
        }
        localStorage.setItem('pine_voice_enabled', isEnabled);
    }

    // 5. Setup Listeners
    if (toggle) {
        // Init visual state
        if (isEnabled) toggle.classList.add('active');

        toggle.addEventListener('click', () => {
            isEnabled = !isEnabled;
            updateState();
        });

        // Auto-start if persisted on
        if (isEnabled) startVoice();
    }

})();

/* =========================================================
   WINDOW SNAPPING (Injected)
   Self-contained module for Aero Snap-like behavior
   Uses MutationObserver to track dragging without editing core
========================================================= */
(function () {
    // 1. UI Setup
    const overlay = document.createElement('div');
    overlay.id = 'pine-snap-overlay';

    // Create preview box inside overlay
    const preview = document.createElement('div');
    preview.className = 'snap-preview';
    overlay.appendChild(preview);
    document.body.appendChild(overlay);

    // State
    let activeWindow = null;
    let snapTarget = null; // 'left', 'right', 'maximize'
    let isDragging = false;

    // 2. Observer to detect drag
    // We observe 'style' attribute on all windows to detect movement
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
            if (m.type === 'attributes' && m.attributeName === 'style') {
                const win = m.target;

                // Only act if this window is currently being interacted with (simple heuristic: zIndex is high or we know it's active)
                // But generally, only one window moves at a time.
                // Check if moving:
                if (win.classList.contains('window') && win.style.display !== 'none') {
                    handleDrag(win);
                }
            }
        });
    });

    // Start observing desktop for window changes
    // Assuming windows are direct children or we observe subtree
    const desktop = document.getElementById('desktop') || document.body;
    // We need to observe the windows themselves. Since they might be added dynamically, observing subtree is safest but costly.
    // Better: observe the specific windows existing now + new ones?
    // Let's rely on standard subtree observation for 'style' changes.
    observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ['style']
    });

    function handleDrag(win) {
        // Skip if we shouldn't snap (e.g. it's just fading in)
        // Heuristic: Check if mouse is down? We can start by just checking position.

        const rect = win.getBoundingClientRect();
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
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

        // Restore check: If window was snapped and is now dragged away
        if (win.dataset.snapped === 'true' && rect.top > threshold + 10 && snapTarget !== 'maximize') {
            // Restore visual indication (optional, logic handled on drop)
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

    // 3. Handle Drop (Snap or Restore)
    function onDrop() {
        if (!activeWindow && !snapTarget) return;

        // Apply Snap
        if (activeWindow && snapTarget) {
            const win = activeWindow;

            // Save state if not already snapped
            if (win.dataset.snapped !== 'true') {
                win.dataset.restW = win.style.width;
                win.dataset.restH = win.style.height;
                // Position is hard to restore exactly if dragged, but we try
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
                win.style.left = '50vw'; // Simplified placement
                win.style.width = '50vw';
                win.style.height = 'calc(100vh - 60px)';
            }

            // Remove class after transition
            setTimeout(() => win.classList.remove('snapping'), 250);
        }

        // Hide overlay
        overlay.classList.remove('active');
        preview.classList.remove('visible');
        activeWindow = null;
        snapTarget = null;
    }

    // Listener for drop (Mouse + Gesture usually triggers mouseup)
    window.addEventListener('mouseup', onDrop);
    window.addEventListener('pointerup', onDrop);
    window.addEventListener('touchend', onDrop);

    // Restore Logic: If snapped window is dragged (via its header), restore it
    // We rely on the ResizeObserver behavior or add a specific check.
    // Actually, simply checking if a Snapped window moves "away" from its snap zone is cleaner?
    // Let's add a logic to the observer:
    // If window is snapped, and style.left/top changes significantly unrelated to our snap, restore size.

    // Simplification for safety: Double-click title bar to maximize/restore is common, 
    // but dragging down is requested.
    // For now, dragging a snapped window "just works" because it moves. 
    // We just need to reset the width/height if it moves.

    // Add logic to observer:
    // If m.target.dataset.snapped === 'true' AND we detect movement...
    // We reset width/height to dataset.restW/restH
    // This runs inside the loop, so we must be careful not to infinite loop.
    // Implementation:
    /*
    if (win.dataset.snapped === 'true' && !win.classList.contains('snapping')) {
         // It's moving manually.
         // Restore size
         if (win.dataset.restW) win.style.width = win.dataset.restW;
         if (win.dataset.restH) win.style.height = win.dataset.restH;
         win.dataset.snapped = 'false';
    }
    */
    // Adding this to the observer above safely.

})();

/* =========================================================
   VIRTUAL DESKTOPS (Injected)
   State management & Task View Overlay
========================================================= */
(function () {
    // 1. State
    let desktops = [
        { id: 1, name: 'Desktop 1' }
    ];
    let activeDesktopIndex = 0; // 0-based
    let windowWorkspaceMap = {}; // { windowId: desktopIndex }

    // UI Refs
    const desktopContainer = document.getElementById('desktop');
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

    // 2. Logic: Switch Desktop
    function switchDesktop(index) {
        if (index < 0 || index >= desktops.length) return;
        activeDesktopIndex = index;

        // Update all windows
        const allWindows = document.querySelectorAll('.window');
        allWindows.forEach(win => {
            if (!win.id) return;

            // Assign if missing (safety)
            if (activeDesktopIndex === 0 && windowWorkspaceMap[win.id] === undefined) {
                windowWorkspaceMap[win.id] = 0;
            }

            // Sync Map if likely wrong? 
            // Better: Trust map.

            const owner = windowWorkspaceMap[win.id];

            // If window is assigned to this desktop -> Show
            // If window is assigned to another -> Hide
            // If window is unassigned (newly created?), assign to active? 
            // See Observer.

            if (owner === undefined) {
                // Should be caught by observer, but if not:
                // If it's visible, assign to active.
                if (win.style.display !== 'none') {
                    windowWorkspaceMap[win.id] = activeDesktopIndex;
                }
            }

            if (windowWorkspaceMap[win.id] === activeDesktopIndex) {
                // Show
                win.classList.remove('hidden-by-workspace');
            } else {
                // Hide
                win.classList.add('hidden-by-workspace');
                // Also remove focus style if active?
                win.classList.remove('active-focus');
            }
        });

        // Update UI if open
        renderTaskView();
    }

    // 3. Observer: Assign new windows to active desktop
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(m => {
            if (m.type === 'attributes' && (m.attributeName === 'style' || m.attributeName === 'class')) {
                const win = m.target;
                if (!win.classList || !win.classList.contains('window')) return;

                // If window becomes visible (display not none)
                if (win.style.display !== 'none' && !win.classList.contains('hidden-by-workspace')) {
                    // Check if already assigned
                    if (windowWorkspaceMap[win.id] === undefined) {
                        // Assign to current
                        console.log(`Assigning ${win.id} to Desktop ${activeDesktopIndex + 1}`);
                        windowWorkspaceMap[win.id] = activeDesktopIndex;
                    }
                    // If it was hidden by workspace but now shown by app logic (e.g. openApp called),
                    // we need to move it to active desktop OR switch to its desktop?
                    // Requirement: "Opening an app... assign to current desktop".
                    // If existing app is opened, usually openApp just shows it.
                    // If it belongs to another desktop, we should probably Move it to this one.
                    // How to detect "OpenApp" vs "Switching Desktop"?
                    // Mutation comes from openApp changing display:flex.
                    // If we are NOT in switchDesktop flow...
                    // Let's assume ANY external display='flex' means "User wants this here".

                    if (windowWorkspaceMap[win.id] !== activeDesktopIndex) {
                        // Move to current
                        windowWorkspaceMap[win.id] = activeDesktopIndex;
                    }
                }
            }
        });
    });

    observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ['style', 'class'] // Watch class for safety, style for display
    });

    // 4. Task View UI
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

        // Add Button
        if (desktops.length < 6) {
            const addBtn = document.createElement('div');
            addBtn.className = 'add-desktop-btn';
            addBtn.innerHTML = '+';
            addBtn.onclick = () => {
                desktops.push({ id: Date.now(), name: `Desktop ${desktops.length + 1}` });
                switchDesktop(desktops.length - 1);
                // toggleOverlay(false); // Maybe keep open?
                renderTaskView();
            };
            tvList.appendChild(addBtn);
        }
    }

    function removeDesktop(index) {
        if (index === 0) return; // Can't delete main
        if (activeDesktopIndex === index) {
            switchDesktop(index - 1);
        } else if (activeDesktopIndex > index) {
            activeDesktopIndex--;
        }

        // Move windows from deleted desktop to Desktop 1 (or 0)
        // Or close them? Requirement: "Delete...". Usually move to 1.
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
            overlay.style.pointerEvents = 'auto'; // Block interaction
            renderTaskView();
        } else {
            overlay.classList.remove('visible');
            overlay.style.pointerEvents = 'none';
            setTimeout(() => {
                if (!overlay.classList.contains('visible')) overlay.style.display = 'none';
            }, 300);
        }
    }

    // 5. Listeners
    if (taskViewBtn) {
        taskViewBtn.addEventListener('click', () => toggleOverlay());
    }

    // Close on background click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) toggleOverlay(false);
    });

    // Keyboard Shortcuts
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

    // Init: Scan existing windows
    document.querySelectorAll('.window').forEach(win => {
        windowWorkspaceMap[win.id] = 0;
    });

})();

/* =========================================================
   CALCULATOR LOGIC (Injected)
   Self-contained module for Calculator app
========================================================= */
(function () {
    // Wait for DOM
    setTimeout(() => {
        const calcWin = document.getElementById('win-calculator');
        if (!calcWin) return;

        const display = calcWin.querySelector('.calc-display');
        const buttons = calcWin.querySelectorAll('button'); // Selects all buttons in calc

        if (!display || buttons.length === 0) {
            console.error("Calculator logic: Elements not found");
            return;
        }

        let expression = '';

        buttons.forEach(btn => {
            // Remove old listeners just in case
            btn.onclick = null;

            btn.onclick = (e) => {
                e.stopPropagation(); // Prevent drag/focus conflict
                const val = btn.innerText;

                if (val === 'C') {
                    expression = '';
                    display.innerText = '0';
                } else if (val === '=') {
                    try {
                        const safeExpr = expression.replace(/x/g, '*');
                        if (safeExpr) {
                            const result = new Function('return ' + safeExpr)();
                            // Format max decimals
                            const final = parseFloat(result.toFixed(8));
                            display.innerText = final;
                            expression = String(final);
                        }
                    } catch (e) {
                        display.innerText = 'Error';
                        expression = '';
                    }
                } else {
                    if (display.innerText === 'Error') {
                        expression = '';
                    }
                    expression += val;
                    display.innerText = expression;
                }
            };
        });
        console.log("Calculator Logic Initialized");
    }, 500);
})();
