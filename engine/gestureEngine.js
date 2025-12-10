/* =========================================================
   GESTURE ENGINE - OPTIMIZED FOR PERFORMANCE
   Handles MediaPipe Hands integration, cursor control, and gesture recognition.
   ⚡ Optimized for <200ms latency, 60 FPS, reduced CPU usage
   ========================================================= */
import { bringToFront } from './windowManager.js';
import { updateCursor, setCursorState } from './cursor.js';

const videoElement = document.getElementById("camera");
const canvasElement = document.getElementById("output_canvas");
// cursorEl is now managed by cursor.js, preventing conflict
const statusEl = document.getElementById("gesture-status");

/* ---- Config ---- */
const CAMERA_MARGIN = 0.15;
const PINCH_THRESHOLD = 0.06;
const FIST_DEBOUNCE_MS = 800;
const THROTTLE_MS = 16; // 60 FPS (optimized from 30ms)
const CLICK_DEBOUNCE_MS = 100; // Prevent double-clicks
const PINCH_DEBOUNCE_MS = 50; // Smoother drag start

/* ---- State ---- */
let wasPinching = false;
let isDragging = false;
let dragTarget = null;
let dragOffset = { x: 0, y: 0 };
let lastFistTime = 0;
let lastFrameTime = 0;
let lastClickTime = 0;
let lastPinchStartTime = 0;

// Camera Box State
let isCamDragging = false;
let camDragOffset = { x: 0, y: 0 };

/* ---- Performance Monitoring ---- */
let frameCount = 0;
let fpsStartTime = Date.now();
let totalProcessingTime = 0;
let gestureDetectionCount = 0;

/* ---- Cached DOM Elements (Performance Optimization) ---- */
let cachedCameraNav = null;
let cachedGestureOverlay = null;
let cachedCameraNavBounds = null;
let cameraNavBoundsUpdateNeeded = true;

/* ---- Cached Screen Dimensions (Performance Optimization) ---- */
let cachedScreenWidth = window.innerWidth;
let cachedScreenHeight = window.innerHeight;

// Pre-calculated constants for coordinate mapping
let invMargin = 1 / (1 - 2 * CAMERA_MARGIN);

// Update cache on resize
window.addEventListener('resize', () => {
    cachedScreenWidth = window.innerWidth;
    cachedScreenHeight = window.innerHeight;
    cameraNavBoundsUpdateNeeded = true;
});

export function initGestures() {
    console.log("🎮 Gesture Engine Loaded (Performance Optimized)");
    const initStartTime = performance.now();

    if (!videoElement || !canvasElement) {
        console.error("❌ Camera or canvas element not found");
        return;
    }

    // Cache DOM elements
    cachedCameraNav = document.getElementById('camera-nav');
    cachedGestureOverlay = document.getElementById('gesture-overlay');

    const canvasCtx = canvasElement.getContext("2d");

    // Check if MediaPipe is loaded
    if (typeof Hands === 'undefined') {
        console.error("❌ MediaPipe Hands not loaded");
        return;
    }

    const modelLoadStart = performance.now();
    const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0, // Fastest model
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6
    });

    hands.onResults((results) => {
        const now = Date.now();
        if (now - lastFrameTime < THROTTLE_MS) return;
        lastFrameTime = now;

        const frameStart = performance.now();
        onResults(results, canvasCtx);
        const frameEnd = performance.now();

        // Track performance metrics
        totalProcessingTime += (frameEnd - frameStart);
        gestureDetectionCount++;

        // Log FPS every 60 frames
        frameCount++;
        if (frameCount >= 60) {
            const fpsEndTime = Date.now();
            const elapsed = (fpsEndTime - fpsStartTime) / 1000;
            const fps = frameCount / elapsed;
            const avgProcessing = totalProcessingTime / gestureDetectionCount;

            console.log(`⚡ Performance: ${fps.toFixed(1)} FPS | Avg Processing: ${avgProcessing.toFixed(2)}ms/frame`);

            frameCount = 0;
            fpsStartTime = fpsEndTime;
            totalProcessingTime = 0;
            gestureDetectionCount = 0;
        }
    });

    const modelLoadEnd = performance.now();
    console.log(`📊 Model Load Time: ${(modelLoadEnd - modelLoadStart).toFixed(2)}ms`);

    // Try MediaPipe Camera first, with fallback
    try {
        const camera = new Camera(videoElement, {
            onFrame: async () => {
                if (videoElement.videoWidth) {
                    await hands.send({ image: videoElement });
                }
            },
            width: 640,
            height: 480
        });

        camera.start().then(() => {
            console.log("📹 Camera Started Correctly (MediaPipe)");
        }).catch((err) => {
            console.warn("⚠️ MediaPipe camera failed, trying fallback:", err);
            startFallbackCamera(hands);
        });
    } catch (err) {
        console.warn("⚠️ MediaPipe Camera not available, using fallback:", err);
        startFallbackCamera(hands);
    }

    initCameraButtons();

    const initEndTime = performance.now();
    console.log(`✅ Gesture Engine Initialized in ${(initEndTime - initStartTime).toFixed(2)}ms`);
}

// Fallback camera using getUserMedia
function startFallbackCamera(hands) {
    navigator.mediaDevices.getUserMedia({
        video: {
            width: 640,
            height: 480
        }
    })
        .then((stream) => {
            videoElement.srcObject = stream;
            videoElement.play();

            console.log("📹 Camera Started Correctly (Fallback)");

            // Manual frame processing
            const processFrame = async () => {
                if (videoElement.videoWidth) {
                    await hands.send({ image: videoElement });
                }
                requestAnimationFrame(processFrame);
            };
            processFrame();
        })
        .catch((err) => {
            console.error("❌ Camera access failed:", err);
            if (statusEl) statusEl.innerText = "CAMERA ERROR";
        });
}

function onResults(results, canvasCtx) {
    // Resize canvas if needed (only check when dimensions change)
    if (canvasElement.width !== videoElement.videoWidth || canvasElement.height !== videoElement.videoHeight) {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
    }

    // Early exit if no hand detected (skip all processing)
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        statusEl.innerText = "NO HAND";
        // Still clear canvas
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.restore();
        return;
    }

    // Check if overlay is minimized - skip heavy canvas drawing
    const isMinimized = cachedGestureOverlay && cachedGestureOverlay.classList.contains('minimized');

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    const lm = results.multiHandLandmarks[0];

    // Draw Skeleton (skip if minimized for performance)
    if (!isMinimized && window.drawConnectors && window.HAND_CONNECTIONS) {
        drawConnectors(canvasCtx, lm, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
        drawLandmarks(canvasCtx, lm, { color: '#FF0000', lineWidth: 1 });
    }

    // 1. Move Cursor (via Cursor Module)
    const indexTip = lm[8];
    const pos = toScreenCoords(indexTip);

    // Send raw coordinates to cursor engine for smoothing
    updateCursor(pos.x, pos.y);

    // 2. Detect Pinch - OPTIMIZED (cache calculation)
    const thumbTip = lm[4];
    const dx = thumbTip.x - indexTip.x;
    const dy = thumbTip.y - indexTip.y;
    const pinchDist = Math.sqrt(dx * dx + dy * dy); // Faster than Math.hypot
    const isPinching = pinchDist < PINCH_THRESHOLD;

    // 3. Detect Fist (Right Click) - OPTIMIZED (bitwise operations)
    // Check if fingers are extended (tip above middle joint)
    const extended = (
        (lm[8].y < lm[6].y ? 1 : 0) |  // Index
        (lm[12].y < lm[10].y ? 2 : 0) | // Middle
        (lm[16].y < lm[14].y ? 4 : 0) | // Ring
        (lm[20].y < lm[18].y ? 8 : 0)   // Pinky
    );
    const isFist = (extended === 0);

    // ---- CAMERA NAV DETECTION (Optimized with cached bounds) ----
    if (isCursorInCameraNav(pos.x, pos.y) || isCamDragging) {
        if (cachedCameraNav) cachedCameraNav.style.opacity = 1;

        handleCameraInteraction(pos.x, pos.y, isPinching);

        setCursorState("active");
        if (!isCamDragging) statusEl.innerText = "CAM CONTROLS";

    } else {
        // NORMAL GESTURE LOGIC

        // Ensure visual state if idle
        if (!isPinching && !isFist) {
            statusEl.innerText = "IDLE";
        }

        if (isFist) {
            statusEl.innerText = "FIST (Right Click)";
            setCursorState("fist");
            const now = Date.now();
            if (now - lastFistTime > FIST_DEBOUNCE_MS) {
                lastFistTime = now;
                console.log(`🎯 Fist Gesture Detected at (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`);
                fakeRightClick(pos.x, pos.y);
            }
        } else if (isPinching) {
            statusEl.innerText = "PINCH (Click/Drag)";
            setCursorState("pinch");

            if (!wasPinching) {
                // Start Pinch - with debounce
                const now = Date.now();
                if (now - lastPinchStartTime < PINCH_DEBOUNCE_MS) {
                    // Too soon, skip
                } else {
                    lastPinchStartTime = now;
                    const el = elementAt(pos.x, pos.y);
                    const win = findDraggableWindow(el);
                    if (win && el.closest(".title-bar")) {
                        isDragging = true;
                        dragTarget = win;
                        dragOffset.x = pos.x - win.offsetLeft;
                        dragOffset.y = pos.y - win.offsetTop;
                        bringToFront(win);
                        console.log(`🖱️ Pinch Drag Started on window`);
                    } else {
                        fakeMouseDown(pos.x, pos.y);
                    }
                }
            }

            if (isDragging && dragTarget) {
                dragTarget.style.left = (pos.x - dragOffset.x) + "px";
                dragTarget.style.top = (pos.y - dragOffset.y) + "px";
            }

        } else {

            setCursorState("normal");

            if (wasPinching) {
                // Release Pinch
                if (isDragging) {
                    isDragging = false;
                    dragTarget = null;
                    console.log(`🖱️ Pinch Drag Released`);
                    // Trigger synthetic mouseup for snap/drop logic
                    window.dispatchEvent(new MouseEvent('mouseup', { clientX: pos.x, clientY: pos.y }));
                } else {
                    // Click with debounce
                    const now = Date.now();
                    if (now - lastClickTime > CLICK_DEBOUNCE_MS) {
                        lastClickTime = now;
                        console.log(`👆 Click at (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`);
                        fakeMouseUp(pos.x, pos.y);
                        fakeClick(pos.x, pos.y);
                    }
                }
            }
        }
    }

    wasPinching = isPinching;
    canvasCtx.restore();
}

/* ---- Helpers - OPTIMIZED ---- */
function toScreenCoords(lm) {
    // Optimized coordinate transformation with pre-calculated constants
    let x = 1 - lm.x;
    let y = lm.y;

    // Use pre-calculated inverse margin
    let x_mapped = (x - CAMERA_MARGIN) * invMargin;
    let y_mapped = (y - CAMERA_MARGIN) * invMargin;

    // Clamp
    x_mapped = Math.max(0, Math.min(1, x_mapped));
    y_mapped = Math.max(0, Math.min(1, y_mapped));

    return {
        x: x_mapped * cachedScreenWidth,
        y: y_mapped * cachedScreenHeight
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

/* ---- Camera Overlay Logic - OPTIMIZED with cached bounds ---- */
function isCursorInCameraNav(x, y) {
    if (!cachedCameraNav) return false;

    // Update bounds only when needed
    if (cameraNavBoundsUpdateNeeded) {
        cachedCameraNavBounds = cachedCameraNav.getBoundingClientRect();
        cameraNavBoundsUpdateNeeded = false;
    }

    if (!cachedCameraNavBounds) return false;

    // Add a small buffer for easier interaction
    const buffer = 5;
    return (
        x >= cachedCameraNavBounds.left - buffer &&
        x <= cachedCameraNavBounds.right + buffer &&
        y >= cachedCameraNavBounds.top - buffer &&
        y <= cachedCameraNavBounds.bottom + buffer
    );
}

function handleCameraInteraction(x, y, isPinching) {
    if (!cachedGestureOverlay) return;

    if (isPinching && !wasPinching) {
        const el = document.elementFromPoint(x, y);
        if (el && el.classList.contains('cam-btn')) {
            el.click();
            return;
        }
        if (cachedGestureOverlay.classList.contains('locked')) {
            statusEl.innerText = "LOCKED";
            return;
        }
        isCamDragging = true;
        camDragOffset.x = x - cachedGestureOverlay.offsetLeft;
        camDragOffset.y = y - cachedGestureOverlay.offsetTop;
        console.log(`📹 Camera Drag Started`);
    }

    if (isPinching) {
        if (isCamDragging) {
            cachedGestureOverlay.style.left = (x - camDragOffset.x) + 'px';
            cachedGestureOverlay.style.top = (y - camDragOffset.y) + 'px';
        }
    } else {
        if (isCamDragging) {
            console.log(`📹 Camera Drag Released`);
            cameraNavBoundsUpdateNeeded = true; // Update bounds after drag
        }
        isCamDragging = false;
    }
}

function initCameraButtons() {
    if (!cachedGestureOverlay) return;

    const btnMin = document.getElementById('btn-minimize');
    if (btnMin) btnMin.onclick = () => {
        cachedGestureOverlay.classList.toggle('minimized');
        console.log(`📹 Camera ${cachedGestureOverlay.classList.contains('minimized') ? 'Minimized' : 'Restored'}`);
    };

    const btnSize = document.getElementById('btn-size');
    if (btnSize) btnSize.onclick = () => {
        cachedGestureOverlay.classList.toggle('large');
        cameraNavBoundsUpdateNeeded = true;
        console.log(`📹 Camera Size Toggled`);
    };

    const btnOp = document.getElementById('btn-opacity');
    if (btnOp) btnOp.onclick = () => {
        cachedGestureOverlay.classList.toggle('transparent');
        console.log(`📹 Camera Opacity Toggled`);
    };

    const btnLock = document.getElementById('btn-lock');
    if (btnLock) btnLock.onclick = () => {
        cachedGestureOverlay.classList.toggle('locked');
        btnLock.classList.toggle('active');
        btnLock.innerText = cachedGestureOverlay.classList.contains('locked') ? '🔒' : '🔓';
        console.log(`📹 Camera ${cachedGestureOverlay.classList.contains('locked') ? 'Locked' : 'Unlocked'}`);
    };
}
