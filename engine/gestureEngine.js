/* =========================================================
   GESTURE ENGINE
   Handles MediaPipe, cursor movement, and gestures
========================================================= */

import { elementAt, toScreenCoords } from './utils.js';
import { bringToFront } from './windowManager.js';

// Config
const CAMERA_MARGIN = 0.15;
const PINCH_THRESHOLD = 0.06;
const FIST_DEBOUNCE_MS = 800;

// State
let wasPinching = false;
let isDragging = false;
let dragTarget = null;
let dragOffset = { x: 0, y: 0 };
let lastFistTime = 0;

// DOM
const videoElement = document.getElementById("camera");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const cursorEl = document.getElementById("custom-cursor");
const statusEl = document.getElementById("gesture-status");

/* ---- Helpers ---- */
function findDraggableWindow(el) {
    while (el) {
        if (el.classList && el.classList.contains("window")) return el;
        el = el.parentElement;
    }
    return null;
}

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

/* ---- Main Logic ---- */
export function initGestures() {
    // Check dependencies
    if (!window.Hands || !window.Camera) {
        console.error("MediaPipe Hands/Camera libraries not loaded.");
        return;
    }

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
            // Basic error check for video state
            if (videoElement.videoWidth) {
                await hands.send({ image: videoElement });
            }
        },
        width: 640,
        height: 480
    });

    camera.start();
}

// Camera Box State
let isCamDragging = false;
let camDragOffset = { x: 0, y: 0 };
let camPinchStart = 0;
let camInteractLocked = false; // Is locked via button?

function isCursorInCameraNav(x, y) {
    const nav = document.getElementById('camera-nav');
    if (!nav) return false;
    // Visually it's opacity 0 usually, but we should interact if hovering container?
    // CSS hover reveals it.
    // Check nav rect
    const rect = nav.getBoundingClientRect();
    return (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
}

function handleCameraInteraction(x, y, isPinching) {
    const overlay = document.getElementById('gesture-overlay');

    // 1. Pinch Start
    if (isPinching && !wasPinching) {
        camPinchStart = Date.now();

        // Check buttons
        const el = document.elementFromPoint(x, y);
        if (el && el.classList.contains('cam-btn')) {
            // Click button immediately or on release? 
            // Better on release for safety, or immediate tag.
            // Let's do click on pinch start for responsiveness in this context
            el.click();
            return; // Don't start drag if clicked button
        }

        // Start Drag ?
        if (overlay.classList.contains('locked')) {
            // Locked, can't drag
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

// Helper for Camera Buttons
function initCameraButtons() {
    const overlay = document.getElementById('gesture-overlay');

    document.getElementById('btn-minimize').onclick = () => {
        overlay.classList.toggle('minimized');
    };
    document.getElementById('btn-size').onclick = () => {
        overlay.classList.toggle('large');
    };
    document.getElementById('btn-opacity').onclick = () => {
        overlay.classList.toggle('transparent');
    };
    document.getElementById('btn-lock').onclick = () => {
        overlay.classList.toggle('locked');
        const btn = document.getElementById('btn-lock');
        btn.classList.toggle('active');
        btn.innerText = overlay.classList.contains('locked') ? '🔒' : '🔓';
    };
}
// Run once
setTimeout(initCameraButtons, 1000);

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
        if (window.drawConnectors && window.drawLandmarks) {
            drawConnectors(canvasCtx, lm, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
            drawLandmarks(canvasCtx, lm, { color: '#FF0000', lineWidth: 1 });
        }

        // 1. Move Cursor
        const indexTip = lm[8];
        const pos = toScreenCoords(indexTip, CAMERA_MARGIN);
        cursorEl.style.left = pos.x + "px";
        cursorEl.style.top = pos.y + "px";

        // 2. Detect Pinch
        const thumbTip = lm[4];
        const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
        const isPinching = pinchDist < PINCH_THRESHOLD;

        // 3. Detect Fist (Right Click)
        let extended = 0;
        if (lm[8].y < lm[6].y) extended++;
        if (lm[12].y < lm[10].y) extended++;
        if (lm[16].y < lm[14].y) extended++;
        if (lm[20].y < lm[18].y) extended++;
        const isFist = (extended === 0);

        // ---- NEW INTERACTION LAYER ----
        // Prioritize Camera Nav interaction
        if (isCursorInCameraNav(pos.x, pos.y) || isCamDragging) {
            // Hover effect
            const nav = document.getElementById('camera-nav');
            if (nav) nav.style.opacity = 1;

            handleCameraInteraction(pos.x, pos.y, isPinching);

            // UI Feedback
            cursorEl.classList.add("active");
            if (!isCamDragging) statusEl.innerText = "CAM CONTROLS";

        } else {
            // NORMAL OS INTERACTION

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
                    if (win && el.closest(".title-bar")) {
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
        // -------------------------------

        wasPinching = isPinching;

    } else {
        statusEl.innerText = "NO HAND";
    }

    canvasCtx.restore();
}
