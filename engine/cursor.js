/* =========================================================
   CURSOR ENGINE
   Handles smooth cursor detection and visual states.
   Decouples visual updates from gesture detection rate.
   ========================================================= */

let cursorEl = null;

// State
let targetX = 0;
let targetY = 0;
let currentX = 0;
let currentY = 0;
let isMoving = false;

// Config
const SMOOTHING_FACTOR = 0.15; // Lower = smoother but more lag (0.1 - 0.3 is good)
const STOP_THRESHOLD = 0.5;    // Pixels

export function initCursor() {
    cursorEl = document.getElementById("custom-cursor");
    if (!cursorEl) {
        console.error("❌ Cursor element #custom-cursor not found!");
        return;
    }

    // Set initial position to center or off-screen
    currentX = window.innerWidth / 2;
    currentY = window.innerHeight / 2;
    targetX = currentX;
    targetY = currentY;

    // Start the animation loop
    requestAnimationFrame(loop);
    console.log("🖱️ Cursor Engine Initialized");
}

export function updateCursor(x, y) {
    if (isNaN(x) || isNaN(y)) return;
    targetX = x;
    targetY = y;
    isMoving = true;
}

export function setCursorState(state) {
    if (!cursorEl) return;

    // Reset classes
    cursorEl.classList.remove("active", "fist", "hover");

    if (state === "pinch") {
        cursorEl.classList.add("active");
    } else if (state === "fist") {
        cursorEl.classList.add("fist");
    } else if (state === "hover") {
        cursorEl.classList.add("hover");
    }
}

function loop() {
    if (cursorEl) {
        // Linear Interpolation (Lerp)
        const dx = targetX - currentX;
        const dy = targetY - currentY;

        // Apply smoothing
        currentX += dx * SMOOTHING_FACTOR;
        currentY += dy * SMOOTHING_FACTOR;

        // Snap to target if very close (avoids micro-jittering)
        if (Math.abs(dx) < STOP_THRESHOLD && Math.abs(dy) < STOP_THRESHOLD) {
            currentX = targetX;
            currentY = targetY;
        }

        cursorEl.style.transform = `translate(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px)`;
    }

    requestAnimationFrame(loop);
}
