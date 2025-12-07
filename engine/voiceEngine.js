/* =========================================================
   VOICE ENGINE
   Handles Web Speech API
========================================================= */

import { openApp, closeWin, hideAllWins, bringToFront } from './windowManager.js';

export function initVoice() {
    const toggle = document.getElementById('voice-toggle');
    const status = document.getElementById('voice-status');
    let recognition = null;
    let isEnabled = localStorage.getItem('pine_voice_enabled') === 'true';

    // Toast Setup
    const toast = document.createElement('div');
    toast.id = 'voice-toast';
    toast.innerHTML = '<span>🎙️</span><span id="voice-toast-text"></span>';
    document.body.appendChild(toast);

    function showToast(text) {
        const textEl = document.getElementById('voice-toast-text');
        if (textEl) textEl.innerText = text;
        toast.classList.remove('show');
        void toast.offsetWidth; // Trigger reflow
        toast.classList.add('show');
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        if (status) status.innerText = 'Not Supported';
        return;
    }

    const commands = {
        'open calculator': () => openApp('calculator'),
        'open notepad': () => openApp('notepad'),
        'open notes': () => openApp('notepad'),
        'open settings': () => openApp('settings'),
        'open browser': () => openApp('browser'),
        'close calculator': () => closeWin('win-calculator'),
        'close notepad': () => closeWin('win-notepad'),
        'close settings': () => closeWin('win-settings'),
        'close browser': () => closeWin('win-browser'),
        'show desktop': () => hideAllWins(),
        'focus calculator': () => focusWin('win-calculator'),
        'focus notepad': () => focusWin('win-notepad')
    };

    function focusWin(id) {
        const win = document.getElementById(id);
        // bringToFront handled if visible
        if (win && win.style.display !== 'none') {
            bringToFront(win);
        }
    }

    function startVoice() {
        try {
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.lang = 'en-US';
            recognition.interimResults = false;

            recognition.onstart = () => {
                if (status) {
                    status.innerText = 'Listening...';
                    status.style.color = '#0f0';
                }
            };

            recognition.onend = () => {
                if (isEnabled && recognition) {
                    setTimeout(() => {
                        if (isEnabled && recognition) recognition.start();
                    }, 500);
                } else {
                    if (status) {
                        status.innerText = 'Off';
                        status.style.color = '';
                    }
                }
            };

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript.toLowerCase().trim();
                console.log('Voice:', transcript);

                let matched = false;
                for (const [cmd, action] of Object.entries(commands)) {
                    if (transcript.includes(cmd)) {
                        showToast(cmd);
                        action();
                        matched = true;
                        break;
                    }
                }
            };

            recognition.start();

        } catch (e) {
            console.error(e);
            if (status) status.innerText = 'Error starting';
        }
    }

    function stopVoice() {
        if (recognition) {
            recognition.stop();
            recognition = null;
        }
        if (status) {
            status.innerText = 'Off';
            status.style.color = '';
        }
    }

    function updateState() {
        if (isEnabled) {
            toggle.classList.add('active');
            startVoice();
        } else {
            toggle.classList.remove('active');
            stopVoice();
        }
        localStorage.setItem('pine_voice_enabled', isEnabled);
    }

    // Init Logic
    if (toggle) {
        if (isEnabled) toggle.classList.add('active');

        toggle.onclick = () => {
            isEnabled = !isEnabled;
            updateState();
        };

        if (isEnabled) startVoice();
    }
}
