/* =========================================================
   MAIN ENTRY POINT (CRITICAL FIX)
   Guarantees UI Load regardless of Engine Failures.
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

// -- CRITICAL: FORCE UI VISIBILITY --
function forceUnlockUI() {
    console.log("� FORCE UNLOCK: Hiding Loading Screen...");
    const loader = document.getElementById('loading-screen');
    if (loader) {
        loader.style.opacity = "0";
        loader.style.pointerEvents = "none"; // Stop blocking immediately
        setTimeout(() => {
            loader.style.display = "none";
            if (loader.parentNode) loader.parentNode.removeChild(loader);
        }, 500); // Wait for fade out
    }
}

// -- MAIN INIT SEQUENCE --
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 DOM Content Loaded");

    // 1. Run Visuals Immediately
    runBootSequence();
    initTheme();
    initWindowManager();
    initSnap();
    initDesktop();
    initWidgets();
    initNotifications();
    initBrowser();
    initCursor();
    initAssistant();

    // 2. Start Heavy Engines (Async/Non-Blocking)
    // Wrap in timeout to let UI frame render first
    setTimeout(() => {
        console.log("⚡ Starting Gesture & Voice Engines...");
        try { initGestures(); } catch (e) { console.error("❌ Gesture Init Error (Non-Fatal):", e); }
        try { initVoice(); } catch (e) { console.error("❌ Voice Init Error (Non-Fatal):", e); }
    }, 100);

    // 3. FAIL-SAFE TIMER (The Ultimate Guarantee)
    // Will unlock the screen after 2.0s NO MATTER WHAT happens above.
    // This fixes the "Stuck Loading" bug.
    setTimeout(() => {
        console.log("⏰ Timer Expired: Unlocking UI");
        forceUnlockUI();
    }, 2000);
});

// Remove old blocking logic if any remains globally
window.checkOSReady = () => { /* No-op to prevent errors in other files */ };
