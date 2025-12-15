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

// Debug Mode
let debugMode = false;

// Gesture State Management
let currentGesture = 'IDLE';
let previousGesture = 'IDLE';
let gestureFrameCount = 0;
const GESTURE_DEBOUNCE_FRAMES = 3; // Require 3 consecutive frames to confirm gesture change
let firstHandDetected = false;
let fistLocked = false; // Prevent repeated closes

// Frame history for swipe detection
const frameHistory = [];
const MAX_FRAME_HISTORY = 10;

/* =========================================================
   DEBUG LAYER
   ========================================================= */
// Toggle debug mode with 'D' key
document.addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') {
        debugMode = !debugMode;
        console.log(`🐛 Debug Mode: ${debugMode ? 'ON' : 'OFF'}`);
    }
});

function drawDebugLandmarks(ctx, landmarks) {
    if (!debugMode) return;

    // Draw all 21 landmarks with numbers
    landmarks.forEach((landmark, index) => {
        const x = landmark.x * canvasElement.width;
        const y = landmark.y * canvasElement.height;

        // Draw landmark dot
        ctx.fillStyle = '#00FF00';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();

        // Draw landmark index number
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '10px Arial';
        ctx.fillText(index.toString(), x + 8, y + 4);
    });
}

/* =========================================================
   GESTURE DETECTION FUNCTIONS
   ========================================================= */
function getFingerExtended(landmarks, fingerTipIndex, fingerPipIndex) {
    // Check if finger is extended by comparing tip vs PIP joint Y position
    // (lower Y = higher on screen = extended)
    return landmarks[fingerTipIndex].y < landmarks[fingerPipIndex].y - 0.02;
}

function isOpenPalm(landmarks) {
    // All fingers extended
    const thumbExtended = landmarks[4].x < landmarks[3].x - 0.02; // Thumb special case
    const indexExtended = getFingerExtended(landmarks, 8, 6);
    const middleExtended = getFingerExtended(landmarks, 12, 10);
    const ringExtended = getFingerExtended(landmarks, 16, 14);
    const pinkyExtended = getFingerExtended(landmarks, 20, 18);

    return indexExtended && middleExtended && ringExtended && pinkyExtended;
}

function isFist(landmarks) {
    // All fingers closed (curled)
    const indexClosed = !getFingerExtended(landmarks, 8, 6);
    const middleClosed = !getFingerExtended(landmarks, 12, 10);
    const ringClosed = !getFingerExtended(landmarks, 16, 14);
    const pinkyClosed = !getFingerExtended(landmarks, 20, 18);

    return indexClosed && middleClosed && ringClosed && pinkyClosed;
}

function isPointing(landmarks) {
    // Only index finger extended
    const indexExtended = getFingerExtended(landmarks, 8, 6);
    const middleClosed = !getFingerExtended(landmarks, 12, 10);
    const ringClosed = !getFingerExtended(landmarks, 16, 14);
    const pinkyClosed = !getFingerExtended(landmarks, 20, 18);

    return indexExtended && middleClosed && ringClosed && pinkyClosed;
}

function detectSwipe(landmarks) {
    // Add current palm position to history
    const palmX = landmarks[0].x; // Wrist X position
    frameHistory.push(palmX);

    // Keep only recent frames
    if (frameHistory.length > MAX_FRAME_HISTORY) {
        frameHistory.shift();
    }

    // Need enough history
    if (frameHistory.length < MAX_FRAME_HISTORY) {
        return null;
    }

    // Calculate movement
    const startX = frameHistory[0];
    const endX = frameHistory[frameHistory.length - 1];
    const movement = endX - startX;

    const SWIPE_THRESHOLD = 0.15; // 15% of screen width

    if (movement > SWIPE_THRESHOLD) {
        return 'SWIPE_RIGHT';
    } else if (movement < -SWIPE_THRESHOLD) {
        return 'SWIPE_LEFT';
    }

    return null;
}

/* =========================================================
   GESTURE STATE MACHINE
   ========================================================= */
function updateGestureState(detectedGesture) {
    // Priority order: PINCH > SWIPE > POINT > FIST > PALM
    // Pinch is handled separately in the existing code

    if (detectedGesture === currentGesture) {
        gestureFrameCount = 0; // Reset debounce
        return;
    }

    // Check if enough consecutive frames detected the new gesture
    gestureFrameCount++;

    if (gestureFrameCount >= GESTURE_DEBOUNCE_FRAMES) {
        previousGesture = currentGesture;
        currentGesture = detectedGesture;
        gestureFrameCount = 0;

        // Log gesture change (avoid spam)
        if (detectedGesture !== 'IDLE' && detectedGesture !== previousGesture) {
            logGesture(detectedGesture);
        }

        // Update cursor state
        updateCursorForGesture(detectedGesture);
    }
}

function logGesture(gesture) {
    const gestureEmojis = {
        'FIST': '👊',
        'PALM': '✋',
        'POINT': '☝️',
        'SWIPE_LEFT': '👈',
        'SWIPE_RIGHT': '👉',
        'RELEASE': '🔓'
    };

    const emoji = gestureEmojis[gesture] || '❓';
    console.log(`${emoji} Gesture: ${gesture}`);
}

function updateCursorForGesture(gesture) {
    if (gesture === 'FIST') {
        setCursorState('fist');
    } else if (gesture === 'POINT') {
        setCursorState('point');
    } else if (gesture === 'SWIPE_LEFT' || gesture === 'SWIPE_RIGHT') {
        setCursorState('swipe');
    } else {
        setCursorState('normal');
    }
}

/* =========================================================
   INITIALIZATION
   ========================================================= */
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

                // Set camera flag (but wait for landmarks before unlocking)
                if (window.OS_FLAGS) {
                    window.OS_FLAGS.camera = true;
                    // Model flag will be set when first hand is detected in onResults()
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

        // ⚡ FIRST HAND DETECTION - Unlock OS
        if (!firstHandDetected) {
            firstHandDetected = true;
            console.log("🖐️ Hand Detected (First Time)");
            if (window.OS_FLAGS) {
                window.OS_FLAGS.model = true;
                if (window.checkOSReady) window.checkOSReady();
            }
        }

        // Draw standard landmarks (always)
        if (window.drawConnectors) {
            window.drawConnectors(ctx, lm, window.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
            window.drawLandmarks(ctx, lm, { color: '#FF0000', lineWidth: 1 });
        }

        // Draw debug layer (if enabled) - additional overlay
        drawDebugLandmarks(ctx, lm);

        // --- Logic ---
        const indexTip = lm[8];
        const thumbTip = lm[4];

        // 1. Move Cursor - Full screen range (no margin restriction)
        const x = (1 - indexTip.x) * window.innerWidth; // Mirror
        const y = indexTip.y * window.innerHeight;
        updateCursor(x, y);

        // 2. Pinch Detect (EXISTING LOGIC - DO NOT MODIFY)
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

                // Detect Release gesture (pinch → open palm)
                if (isOpenPalm(lm)) {
                    logGesture('RELEASE');
                }

                isDragging = false;
                dragTarget = null;
            }
        }
        wasPinching = isPinching;

        // 3. NEW GESTURE DETECTION (only when not pinching - pinch has priority)
        if (!isPinching) {
            let detectedGesture = 'IDLE';

            // Check gestures in priority order
            const swipe = detectSwipe(lm);
            if (swipe) {
                detectedGesture = swipe;
            } else if (isPointing(lm)) {
                detectedGesture = 'POINT';
            } else if (isFist(lm)) {
                detectedGesture = 'FIST';
            } else if (isOpenPalm(lm)) {
                detectedGesture = 'PALM';
            }

            updateGestureState(detectedGesture);

            // Update status
            statusEl.innerText = detectedGesture !== 'IDLE' ? detectedGesture : "ACTIVE";

            // 4. FIST ACTION: Close Window OR Close Assistant
            if (currentGesture === 'FIST' && !fistLocked) {
                // Check if hovering over Assistant Header
                const ms = document.elementFromPoint(x, y); // Use latest cursor x,y
                if (ms) console.log("👊 Fist Hit Test:", ms.tagName, ms.className, ms.id);

                const assistantHeader = ms ? ms.closest('.ai-header') : null;

                if (assistantHeader) {
                    console.log("👊 Fist Action: Closing AI Assistant (Hit Header)");
                    const panel = document.getElementById('ai-assistant-panel');
                    if (panel) panel.style.display = 'none';
                    fistLocked = true;
                } else {
                    // Standard Window Closing Logic
                    const activeWin = document.querySelector('.window.active-focus');
                    if (activeWin && activeWin.style.display !== 'none') {
                        console.log(`👊 Fist Action: Closing ${activeWin.id}`);
                        activeWin.style.display = 'none';
                        fistLocked = true;
                    }
                }
            } else if (currentGesture !== 'FIST') {
                fistLocked = false; // Reset lock on release
            }
        } else {
            // Pinching - override gesture state
            currentGesture = 'PINCH';
            gestureFrameCount = 0;
            statusEl.innerText = "PINCH";
        }

    } else {
        statusEl.innerText = "NO HAND";
        currentGesture = 'IDLE';
        frameHistory.length = 0; // Clear frame history when no hand
    }
}
