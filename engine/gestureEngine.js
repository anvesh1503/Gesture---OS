/* =========================================================
   GESTURE ENGINE
   Handles MediaPipe Hands integration, cursor control, and gesture recognition.
   ========================================================= */
import { bringToFront } from './windowManager.js';

const videoElement = document.getElementById("camera");
const canvasElement = document.getElementById("output_canvas");
const cursorEl = document.getElementById("custom-cursor");
const statusEl = document.getElementById("gesture-status");

/* ---- Config ---- */
const CAMERA_MARGIN = 0.15;
const PINCH_THRESHOLD = 0.06;
const FIST_DEBOUNCE_MS = 800;
const THROTTLE_MS = 30; // ~33 FPS

/* ---- State ---- */
let wasPinching = false;
let isDragging = false;
let dragTarget = null;
let dragOffset = { x: 0, y: 0 };
let lastFistTime = 0;
let lastFrameTime = 0;

// Camera Box State
let isCamDragging = false;
let camDragOffset = { x: 0, y: 0 };

export function initGestures() {
    if (!videoElement || !canvasElement) return;

    const canvasCtx = canvasElement.getContext("2d");

    const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6
    });

    hands.onResults((results) => {
        const now = Date.now();
        if (now - lastFrameTime < THROTTLE_MS) return;
        lastFrameTime = now;
        onResults(results, canvasCtx);
    });

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

    initCameraButtons();
}

function onResults(results, canvasCtx) {
    if (canvasElement.width !== videoElement.videoWidth || canvasElement.height !== videoElement.videoHeight) {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
    }
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lm = results.multiHandLandmarks[0];

        // Draw Skeleton
        if (window.drawConnectors && window.HAND_CONNECTIONS) {
            drawConnectors(canvasCtx, lm, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
            drawLandmarks(canvasCtx, lm, { color: '#FF0000', lineWidth: 1 });
        }

        // 1. Move Cursor
        const indexTip = lm[8];
        const pos = toScreenCoords(indexTip);
        if (cursorEl) {
            cursorEl.style.left = pos.x + "px";
            cursorEl.style.top = pos.y + "px";
        }

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

        // ---- NEW CAM LOGIC ----
        if (isCursorInCameraNav(pos.x, pos.y) || isCamDragging) {
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
                        // Trigger synthetic mouseup for snap/drop logic
                        window.dispatchEvent(new MouseEvent('mouseup', { clientX: pos.x, clientY: pos.y }));
                    } else {
                        fakeMouseUp(pos.x, pos.y);
                        fakeClick(pos.x, pos.y);
                    }
                }
            }
        }

        wasPinching = isPinching;

    } else {
        statusEl.innerText = "NO HAND";
    }

    canvasCtx.restore();
}

/* ---- Helpers ---- */
function toScreenCoords(lm) {
    let x = 1 - lm.x;
    let y = lm.y;
    let x_mapped = (x - CAMERA_MARGIN) / (1 - 2 * CAMERA_MARGIN);
    let y_mapped = (y - CAMERA_MARGIN) / (1 - 2 * CAMERA_MARGIN);
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

function fakeClick(x, y) {
    const el = elementAt(x, y);
    if (el) el.click();
}

function fakeMouseDown(x, y) {
    const el = elementAt(x, y);
    if (el) el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: x, clientY: y }));
}

function fakeMouseUp(x, y) {
    const el = elementAt(x, y);
    if (el) el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: x, clientY: y }));
}

function fakeRightClick(x, y) {
    const el = elementAt(x, y);
    if (el) el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: x, clientY: y }));
}

/* ---- Camera Overlay Logic ---- */
function isCursorInCameraNav(x, y) {
    const nav = document.getElementById('camera-nav');
    if (!nav) return false;
    const rect = nav.getBoundingClientRect();
    return (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
}

function handleCameraInteraction(x, y, isPinching) {
    const overlay = document.getElementById('gesture-overlay');

    if (isPinching && !wasPinching) {
        const el = document.elementFromPoint(x, y);
        if (el && el.classList.contains('cam-btn')) {
            el.click();
            return;
        }
        if (overlay.classList.contains('locked')) {
            statusEl.innerText = "LOCKED";
            return;
        }
        isCamDragging = true;
        camDragOffset.x = x - overlay.offsetLeft;
        camDragOffset.y = y - overlay.offsetTop;
    }

    if (isPinching) {
        if (isCamDragging) {
            overlay.style.left = (x - camDragOffset.x) + 'px';
            overlay.style.top = (y - camDragOffset.y) + 'px';
        }
    } else {
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
