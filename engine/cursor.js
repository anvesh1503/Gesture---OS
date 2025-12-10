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

    // Set initial position to center
    currentX = window.innerWidth / 2;
    currentY = window.innerHeight / 2;
    targetX = currentX;
    targetY = currentY;

    // Make cursor fully visible and opaque
    cursorEl.style.opacity = "1";
    cursorEl.style.display = "block";

    // Start the animation loop
    requestAnimationFrame(loop);
    console.log("🖱️ Cursor Engine Initialized - Fully Visible");
}

export function updateCursor(x, y) {
    if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) return;
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

        // Apply position using left/top (CSS handles centering via transform)
        cursorEl.style.left = `${currentX.toFixed(2)}px`;
        cursorEl.style.top = `${currentY.toFixed(2)}px`;
    }

    requestAnimationFrame(loop);
}
