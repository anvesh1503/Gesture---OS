/* =========================================================
   MAIN ENTRY POINT
   Orchestrates Gesture OS initialization.
   ========================================================= */

import { initWindowManager, openApp, closeWin } from './engine/windowManager.js';
import { initGestures } from './engine/gestureEngine.js';
import { initVoice } from './engine/voiceEngine.js';
import { initSnap } from './engine/snapEngine.js';
import { initDesktop, runBootSequence } from './engine/desktopEngine.js';
import { initWidgets } from './engine/widgets.js';
import { initTheme } from './engine/themeEngine.js';
import { initNotifications } from './engine/notificationEngine.js';
import { initBrowser } from './engine/browserEngine.js';

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
