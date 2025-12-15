/* =========================================================
   MAIN ENTRY POINT
   Orchestrates Gesture OS initialization.
   ========================================================= */

import { initWindowManager } from "./engine/windowManager.js";
import { initGestures } from "./engine/gestureEngine.js";
import { initVoice } from "./engine/voiceEngine.js";
import { initSnap } from "./engine/snapEngine.js";
import { initDesktop, runBootSequence } from "./engine/desktopEngine.js";
import { initWidgets } from "./engine/widgets.js";
import { initTheme } from "./engine/themeEngine.js";
import { initNotifications } from "./engine/notificationEngine.js";
import { initBrowser } from "./engine/browserEngine.js";
import { initCursor } from "./engine/cursor.js";
import { initAssistant } from "./engine/aiAssistant.js";

console.log("🚀 Main.js Loaded");

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 DOM Content Loaded");

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
    initAssistant();


    // 3. Start Core Engines IMMEDIATELY (No artificial delays)
    window.addEventListener("load", () => {
        console.log("🚀 Window Loaded - Starting Core AI Engines...");

        // Define Global Hide Loader Function
        window.hideLoadingScreen = () => {
            const loader = document.getElementById('loading-screen');
            if (loader && !loader.classList.contains('hidden')) {
                console.log("🔓 Unlocking OS (Loading Screen Hidden)");
                loader.style.opacity = "0"; // Ensure fade out
                loader.classList.add('hidden');
                setTimeout(() => {
                    loader.style.display = "none";
                    if (loader.parentNode) loader.parentNode.removeChild(loader);
                }, 600);
            }
        };

        // State Management for Fast Boot
        window.OS_FLAGS = { camera: false, model: false, ui: false };

        window.checkOSReady = () => {
            // Note: We flag 'model' as true when first frame is processed OR if library fails (fallback)
            if (window.OS_FLAGS.camera && window.OS_FLAGS.model && window.OS_FLAGS.ui) {
                console.log("🚀 OS READY - Standard Unlock");
                window.hideLoadingScreen();
            }
        };

        // Fail-Safe: Force unlock after 5 seconds no matter what
        setTimeout(() => {
            console.warn("⏰ Fail-Safe: Force unlocking OS after timeout");
            window.hideLoadingScreen();
        }, 5000);

        // Immediate Start
        requestAnimationFrame(() => {
            try { initGestures(); } catch (e) {
                console.error("Gesture Init Failed", e);
                window.OS_FLAGS.camera = true; // Fallback to unlock
                window.OS_FLAGS.model = true;
                window.checkOSReady();
            }
            try { initVoice(); } catch (e) { console.error("Voice Init Failed", e); }

            // Allow UI to signal readiness
            window.OS_FLAGS.ui = true;
            window.checkOSReady();
        });
    });

});
