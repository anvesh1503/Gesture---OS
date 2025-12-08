/* =========================================================
   MAIN ENTRY POINT
   Orchestrates Gesture OS initialization.
   ========================================================= */

const VERSION = '1.0.6'; // Update this version to bust cache

import { initWindowManager, openApp, closeWin } from `./engine/windowManager.js?v=${VERSION}`;
import { initGestures } from `./engine/gestureEngine.js?v=${VERSION}`;
import { initVoice } from `./engine/voiceEngine.js?v=${VERSION}`;
import { initSnap } from `./engine/snapEngine.js?v=${VERSION}`;
import { initDesktop, runBootSequence } from `./engine/desktopEngine.js?v=${VERSION}`;
import { initWidgets } from `./engine/widgets.js?v=${VERSION}`;
import { initTheme } from `./engine/themeEngine.js?v=${VERSION}`;
import { initNotifications } from `./engine/notificationEngine.js?v=${VERSION}`;
import { initBrowser } from `./engine/browserEngine.js?v=${VERSION}`;

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

    // 3. Deferred High Cost Init (Gestures/Voice)
    // Wait for boot to settle slightly
    setTimeout(() => {
        initGestures();
        initVoice();
        console.log("Gesture OS: All Systems Online");
    }, 1500);

});
