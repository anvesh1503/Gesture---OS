/* =========================================================
   GESTURE ENGINE - EMERGENCY FIX
   Simplifying initialization to ensure it works.
   ========================================================= */
import { bringToFront } from './windowManager.js';
import { updateCursor, setCursorState } from './cursor.js';

const videoElement = document.getElementById("camera");
const canvasElement = document.getElementById("output_canvas");
const statusEl = document.getElementById("gesture-status");

/* ---- Config ---- */
const CAMERA_MARGIN = 0.15;
const PINCH_THRESHOLD = 0.05; // Tightened
const THROTTLE_MS = 30; // 30 FPS for stability

/* ---- State ---- */
let wasPinching = false;
let isDragging = false;
let dragTarget = null;
let lastFrameTime = 0;

export function initGestures() {
    console.log("🎮 Gesture Engine: Initializing...");

    if (!videoElement || !canvasElement) {
        console.error("❌ Camera/Canvas not found!");
        return;
    }

    if (typeof window.Hands === 'undefined') {
        console.error("❌ MediaPipe Hands NOT loaded. Network blocked?");
        if (statusEl) statusEl.innerText = "LIB ERROR";
        return;
    }

    const hands = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onResults);

    // ⚡ FAST LOAD: Safety Timeout
    // If camera fails or takes too long, force unlock the OS anyway after 1.5s
    setTimeout(() => {
        if (window.OS_FLAGS && (!window.OS_FLAGS.camera || !window.OS_FLAGS.model)) {
            console.warn("⚠️ Camera/Model slow - Force unlocking OS");
            window.OS_FLAGS.camera = true;
            window.OS_FLAGS.model = true;
            if (window.checkOSReady) window.checkOSReady();
        }
    }, 1500);

    // Camera Start - Use Camerautils if available, else plain getUserMedia
    // 1. Try Simple getUserMedia first (Most reliable generally)
    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
        .then(stream => {
            videoElement.srcObject = stream;
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                console.log("📹 Camera Stream Started");

                // ⚡ OPTIMIZED: Unlock OS immediately when camera starts
                // Don't wait for MediaPipe model to warm up (it runs in background)
                if (window.OS_FLAGS) {
                    window.OS_FLAGS.camera = true;
                    window.OS_FLAGS.model = true; // Optimistic unlock
                    if (window.checkOSReady) window.checkOSReady();
                    if (window.hideLoadingScreen) window.hideLoadingScreen(); // Direct call
                }

                // Start AI Loop in Background
                requestAnimationFrame(() => sendToMediaPipe(hands));
            };
        })
        .catch(err => {
            console.error("❌ Camera Access Denied:", err);
            if (statusEl) statusEl.innerText = "NO CAM PERM";

            // Force unlock on error
            if (window.OS_FLAGS) {
                window.OS_FLAGS.camera = true;
                window.OS_FLAGS.model = true;
                if (window.checkOSReady) window.checkOSReady();
                if (window.hideLoadingScreen) window.hideLoadingScreen(); // Direct call
            }
        });
}

function sendToMediaPipe(hands) {
    if (!videoElement.paused && !videoElement.ended) {
        // Run estimation (Async/Background)
        hands.send({ image: videoElement }).then(() => {
            // Loop continues nicely without blocking UI
            requestAnimationFrame(() => sendToMediaPipe(hands));
        });
    }
}

function onResults(results) {
    // Canvas setup
    if (canvasElement.width !== videoElement.videoWidth) {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
    }
    const ctx = canvasElement.getContext("2d");
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lm = results.multiHandLandmarks[0];

        // Draw
        if (window.drawConnectors) {
            window.drawConnectors(ctx, lm, window.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
            window.drawLandmarks(ctx, lm, { color: '#FF0000', lineWidth: 1 });
        }

        // --- Logic ---
        const indexTip = lm[8];
        const thumbTip = lm[4];

        // 1. Move Cursor - Full screen range (no margin restriction)
        const x = (1 - indexTip.x) * window.innerWidth; // Mirror
        const y = indexTip.y * window.innerHeight;
        updateCursor(x, y);

        // 2. Pinch Detect
        const distance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        const isPinching = distance < PINCH_THRESHOLD;

        if (isPinching) {
            setCursorState("pinch");
            if (!wasPinching) {
                // Click Start
                console.log("👆 Pinch Click Down");
                const el = document.elementFromPoint(x, y);
                if (el) {
                    el.click();
                    // Drag logic
                    if (el.closest('.title-bar')) {
                        const win = el.closest('.window');
                        if (win) {
                            isDragging = true;
                            dragTarget = win;
                            bringToFront(win);
                        }
                    }
                }
            }
            // Dragging
            if (isDragging && dragTarget) {
                dragTarget.style.left = (x - 200) + 'px'; // roughly centering
                dragTarget.style.top = (y - 10) + 'px';
            }
        } else {
            setCursorState("normal");
            if (wasPinching) {
                // Click Release
                console.log("👆 Pinch Release");
                isDragging = false;
                dragTarget = null;
            }
        }
        wasPinching = isPinching;
        statusEl.innerText = isPinching ? "PINCH" : "ACTIVE";

    } else {
        statusEl.innerText = "NO HAND";
    }
}
