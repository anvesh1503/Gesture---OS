/* =========================================================
   PINEAPPLE OS - MAIN ENTRY
   Orchestrates modules and starts the OS
========================================================= */

import { initWindowManager, openApp, closeWin, initResizer } from './engine/windowManager.js';
import { initGestures } from './engine/gestureEngine.js';
import { initSnap } from './engine/snapEngine.js';
import { initDesktops } from './engine/desktopEngine.js';
import { initVoice } from './engine/voiceEngine.js';
import { initWidgets } from './engine/widgets.js';

// Global API for Inline HTML handlers (onclick="openApp(...)")
window.openApp = openApp;
window.closeWin = closeWin;

/* =========================================================
   BOOT SCREEN
========================================================= */
function runBootSequence() {
    // Idempotency
    if (document.getElementById('pine-boot-screen')) return;

    const bootHTML = `
        <div class="pine-boot-content">
            <span class="pine-boot-logo">🍍</span>
            <div class="pine-boot-title">Gesture OS</div>
            <div class="pine-boot-bar-container">
                <div class="pine-boot-bar"></div>
            </div>
            <div class="pine-boot-subtext">Powered by Gesture AI</div>
        </div>
    `;

    const overlay = document.createElement('div');
    overlay.id = 'pine-boot-screen';
    overlay.innerHTML = bootHTML;
    document.body.appendChild(overlay);

    const cleanup = () => {
        if (!overlay) return;
        overlay.classList.add('fade-out');
        document.removeEventListener('keydown', cleanup);
        document.removeEventListener('pointerdown', cleanup);
        setTimeout(() => {
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 300);
    };

    setTimeout(cleanup, 3500);
    document.addEventListener('keydown', cleanup);
    document.addEventListener('pointerdown', cleanup);
}

/* =========================================================
   INITIALIZATION
========================================================= */
document.addEventListener('DOMContentLoaded', () => {
    console.log("OS Boxing...");

    // 1. Boot Logic
    runBootSequence();

    // 2. Initialize Engines
    initWindowManager();
    initResizer();
    initWidgets();
    initSnap();
    initDesktops();
    initVoice();

    // 3. Gestures (Heavy load, maybe delay?)
    // setTimeout(initGestures, 1000); 
    initGestures();

    console.log("OS Ready.");
});
