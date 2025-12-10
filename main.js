/* =========================================================
   MAIN ENTRY POINT
   Orchestrates Gesture OS initialization.
   ========================================================= */

import { initWindowManager, openApp, closeWin } from "./engine/windowManager.js";
import { initGestures } from "./engine/gestureEngine.js";
import { initVoice } from "./engine/voiceEngine.js";
import { initSnap } from "./engine/snapEngine.js";
import { initDesktop, runBootSequence } from "./engine/desktopEngine.js";
import { initWidgets } from "./engine/widgets.js";
import { initThemes } from "./engine/themeEngine.js";
import { initNotifications } from "./engine/notificationEngine.js";
import { initBrowser } from "./engine/browserEngine.js";
import { initCursor } from "./engine/cursor.js";

const VERSION = '1.0.7'; // Update this version to bust cache

// Expose global functions for HTML (onclick handlers)
window.openApp = openApp;
window.closeWin = closeWin;

document.addEventListener('DOMContentLoaded', () => {

    // 1. Boot Animation
    runBootSequence();

    // 2. Initialize Engines
    initTheme();
    initWindowManager();
    initSnap();
    initDesktop();
    initWidgets();
    initNotifications();
    initBrowser();
    initCursor();

    // 3. Deferred High Cost Init (Gestures/Voice)
    // Wait for MediaPipe scripts to fully load
    window.addEventListener("load", () => {
        console.log("🚀 MediaPipe scripts loaded, initializing gesture and voice engines...");

        setTimeout(() => {
            initGestures();
            initVoice();
            console.log("✅ Gesture OS: All Systems Online");
        }, 500);
    });

});
