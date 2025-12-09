/* =========================================================
   VOICE ENGINE - DEPLOYMENT READY
   Handles Web Speech API with continuous recognition,
   microphone permissions, HTTPS detection, and robust error handling.
   Compatible with both local development and production deployments.
   ========================================================= */

import { openApp, closeWin, hideAllWins, focusWin } from './windowManager.js';
import { showNotification } from './notificationEngine.js';
import { navigateTo } from './browserEngine.js';

/* ---- State Management ---- */
let recognition = null;
let isEnabled = false;
let isRestarting = false;
let recognitionStartedAt = 0;
let micPermissionGranted = false;
let restartAttempts = 0;
const MAX_RESTART_ATTEMPTS = 10;

/* ---- Selectors ---- */
const SEL = {
    NOTEPAD_TEXTAREA: '#win-notepad textarea',
    CALC_DISPLAY: '.calc-display',
    CALC_BUTTONS: '.calc-grid button',
    TOAST: '#voice-toast',
    TOGGLE_BTN: '#voice-toggle',
    TOGGLE_ROW: '#voice-setting-row',
    STATUS_TEXT: '#voice-status'
};

/* ---- Main Init ---- */
export function initVoice() {
    console.log("🎤 Voice Engine: Initializing...");

    // Check if running on HTTPS or localhost
    const isSecureContext = window.isSecureContext;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    console.log(`🎤 Voice Engine: Secure Context = ${isSecureContext}, Localhost = ${isLocalhost}`);

    if (!isSecureContext && !isLocalhost) {
        console.warn("⚠️ Voice Engine: HTTPS required for Speech API in production. Current protocol:", window.location.protocol);
        showToast("Voice requires HTTPS");
        return;
    }

    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.error("❌ Voice Engine: Web Speech API not supported in this browser");
        return;
    }
    console.log("🎤 Voice Engine: Speech API detected");

    // Safety check: Ensure DOM is ready
    if (!document.querySelector(SEL.TOGGLE_BTN) && !document.querySelector(SEL.TOGGLE_ROW)) {
        console.warn("⚠️ Voice Engine: Toggle elements not found, retrying in 500ms...");
        setTimeout(initVoice, 500);
        return;
    }

    console.log("🎤 Voice Engine: DOM elements found");

    // 1. Restore State
    const saved = localStorage.getItem('pine_voice_enabled');
    isEnabled = (saved === 'true');
    console.log(`🎤 Voice Engine: Restored state = ${isEnabled}`);

    // 2. Setup UI Handlers
    const toggleBtn = document.querySelector(SEL.TOGGLE_BTN);
    const toggleRow = document.querySelector(SEL.TOGGLE_ROW);

    const toggleFn = (e) => {
        e.stopPropagation();
        console.log(`🎤 Voice Engine: Toggle clicked (current state: ${isEnabled})`);
        if (isEnabled) {
            disableVoice();
        } else {
            enableVoice();
        }
    };

    if (toggleRow) {
        toggleRow.onclick = toggleFn;
        console.log("🎤 Voice Engine: Toggle row listener attached");
    } else if (toggleBtn) {
        toggleBtn.onclick = toggleFn;
        console.log("🎤 Voice Engine: Toggle button listener attached");
    }

    // 3. Sync UI & Start if needed
    updateUI();
    if (isEnabled) {
        console.log("🎤 Voice Engine: Auto-starting (was previously enabled)");
        requestMicrophonePermission();
    }

    console.log("🎤 Voice Engine: Initialization complete");
}

/* ---- Microphone Permission ---- */
async function requestMicrophonePermission() {
    console.log("🎤 Voice Engine: Requesting microphone permission...");

    try {
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Permission granted - stop the stream immediately (we don't need it, just the permission)
        stream.getTracks().forEach(track => track.stop());

        micPermissionGranted = true;
        console.log("🎤 Voice Engine: Microphone permission GRANTED");

        // Now start recognition
        startRecognition();

    } catch (error) {
        console.error("❌ Voice Engine: Microphone permission DENIED or error:", error);
        micPermissionGranted = false;

        // Disable voice and notify user
        isEnabled = false;
        localStorage.setItem('pine_voice_enabled', 'false');
        updateUI();

        showNotification("Microphone Access Denied", "Please allow microphone access to use voice commands.", "error");
        showToast("Microphone access denied");
    }
}

/* ---- Core Controls ---- */
function enableVoice() {
    console.log("🎤 Voice Engine: Enabling voice control...");
    isEnabled = true;
    localStorage.setItem('pine_voice_enabled', 'true');
    updateUI();
    showToast("Voice Control Enabled");

    // Request permission first
    requestMicrophonePermission();
}

function disableVoice() {
    console.log("🎤 Voice Engine: Disabling voice control...");
    isEnabled = false;
    localStorage.setItem('pine_voice_enabled', 'false');
    updateUI();
    showToast("Voice Control Disabled");
    stopRecognition();
}

function updateUI() {
    const btn = document.querySelector(SEL.TOGGLE_BTN);
    const stat = document.querySelector(SEL.STATUS_TEXT);

    if (isEnabled) {
        if (btn) btn.classList.add('active');
        if (stat) {
            stat.innerText = 'Listening...';
            stat.style.color = '#00ff00';
            stat.style.fontWeight = 'bold';
        }
        // Show Toast instantly
        const toast = document.querySelector(SEL.TOAST);
        if (toast && !toast.classList.contains('show')) {
            toast.classList.add('show');
            toast.innerText = "Listening...";
        }
    } else {
        if (btn) btn.classList.remove('active');
        if (stat) {
            stat.innerText = 'Off';
            stat.style.color = 'inherit';
            stat.style.fontWeight = 'normal';
        }
        const toast = document.querySelector(SEL.TOAST);
        if (toast) toast.classList.remove('show');
    }
}

/* ---- Speech Recognition Logic ---- */
function startRecognition() {
    console.log("🎤 Voice Engine: Starting recognition...");

    // Safety: If already exists, don't double init
    if (recognition) {
        console.log("🎤 Voice Engine: Recognition already exists, attempting to start...");
        try {
            recognition.start();
        } catch (e) {
            console.warn("⚠️ Voice Engine: Recognition already started:", e.message);
        }
        return;
    }

    // Check browser support again
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.error("❌ Voice Engine: Speech API not available");
        showNotification("Voice Error", "Browser does not support Speech API", "error");
        return;
    }

    try {
        console.log("🎤 Voice Engine: Creating new SpeechRecognition instance...");
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        console.log("🎤 Voice Engine: Recognition configured (continuous=true, lang=en-US)");

        recognition.onstart = () => {
            console.log("🎤 Voice Engine: Recognition STARTED");
            recognitionStartedAt = Date.now();
            isRestarting = false;
            restartAttempts = 0; // Reset on successful start

            // Instant UI feedback
            const toast = document.querySelector(SEL.TOAST);
            if (toast) {
                toast.classList.add('show');
                toast.innerText = "Listening...";
            }
            updateUI();
        };

        recognition.onend = () => {
            console.log("🎤 Voice Engine: Recognition ENDED");
            recognition = null;

            // Auto-restart if still enabled
            if (isEnabled) {
                // Check restart attempts to prevent infinite loops
                if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
                    console.error(`❌ Voice Engine: Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Stopping.`);
                    disableVoice();
                    showNotification("Voice Error", "Recognition failed repeatedly. Please try again.", "error");
                    return;
                }

                // Fast restart for better responsiveness
                const delay = 100;
                restartAttempts++;

                if (!isRestarting) {
                    isRestarting = true;
                    console.log(`🔄 Voice Engine: Auto-restarting in ${delay}ms (attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS})...`);
                    setTimeout(() => {
                        startRecognition();
                    }, delay);
                }
            } else {
                console.log("🎤 Voice Engine: Not restarting (disabled)");
                updateUI();
            }
        };

        recognition.onerror = (event) => {
            console.warn(`⚠️ Voice Engine: Recognition error: ${event.error}`);

            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                console.error("❌ Voice Engine: Microphone permission denied");
                disableVoice();
                showNotification("Microphone Blocked", "Please allow microphone access in your browser settings.", "error");
            } else if (event.error === 'no-speech') {
                console.log("🎤 Voice Engine: No speech detected (normal, will restart)");
                // Normal - will trigger onend -> restart
                return;
            } else if (event.error === 'network') {
                console.error("❌ Voice Engine: Network error");
                showToast("Network error - check connection");
            } else if (event.error === 'aborted') {
                console.log("🎤 Voice Engine: Recognition aborted (normal during stop)");
                // Normal during manual stop
                return;
            } else if (event.error === 'audio-capture') {
                console.error("❌ Voice Engine: Audio capture error");
                showToast("Microphone error");
            } else {
                console.error(`❌ Voice Engine: Unknown error: ${event.error}`);
                showToast(`Error: ${event.error}`);
            }
        };

        recognition.onresult = (event) => {
            try {
                // Fast processing - only handle final results
                const result = event.results[event.results.length - 1];
                if (result.isFinal) {
                    const transcript = result[0].transcript.trim();
                    console.log(`🗣️ Voice Engine: Heard: "${transcript}"`);

                    // Instant UI feedback
                    const toast = document.querySelector(SEL.TOAST);
                    if (toast) {
                        toast.classList.add('show');
                        toast.innerText = "Processing...";
                    }

                    handlePhrase(transcript);
                }
            } catch (error) {
                console.error("❌ Voice Engine: Error processing result:", error);
            }
        };

        // Start recognition
        console.log("🎤 Voice Engine: Calling recognition.start()...");
        recognition.start();

    } catch (error) {
        console.error("❌ Voice Engine: Failed to start recognition:", error);
        recognition = null;
        showToast("Failed to start voice recognition");
    }
}

function stopRecognition() {
    console.log("🎤 Voice Engine: Stopping recognition...");
    if (recognition) {
        try {
            recognition.stop();
            recognition = null;
            console.log("🎤 Voice Engine: Recognition stopped");
        } catch (error) {
            console.error("❌ Voice Engine: Error stopping recognition:", error);
        }
    }
}

/* ---- Command Handling ---- */
function handlePhrase(rawText) {
    const cmd = rawText.toLowerCase();
    console.log(`🗣️ Voice Engine: Processing command: "${cmd}"`);
    showToast("✓");

    // 1. Global App Control
    if (match(cmd, ['open', 'launch', 'start'], ['calculator'])) { openApp('calculator'); return; }
    if (match(cmd, ['open', 'launch', 'start'], ['notepad'])) { openApp('notepad'); return; }
    if (match(cmd, ['open', 'launch', 'start'], ['browser', 'internet', 'chrome'])) { openApp('browser'); return; }
    if (match(cmd, ['open', 'launch', 'start'], ['settings', 'config'])) { openApp('settings'); return; }

    if (match(cmd, ['close', 'hide', 'exit', 'quit'], ['calculator'])) { closeWin('win-calculator'); return; }
    if (match(cmd, ['close', 'hide', 'exit', 'quit'], ['notepad'])) { closeWin('win-notepad'); return; }
    if (match(cmd, ['close', 'hide', 'exit', 'quit'], ['browser'])) { closeWin('win-browser'); return; }
    if (match(cmd, ['close', 'hide', 'exit', 'quit'], ['settings'])) { closeWin('win-settings'); return; }

    if (cmd.includes('show desktop') || cmd.includes('minimize all')) {
        hideAllWins();
        return;
    }

    // 2. Functionality
    if (processCalculator(cmd)) return;
    if (processNotepad(cmd, rawText)) return;
}

// Helper: match any verb + any noun
function match(text, verbs, nouns) {
    return verbs.some(v => text.includes(v)) && nouns.some(n => text.includes(n));
}

/* ---- Calculator Logic ---- */
function processCalculator(cmd) {
    const mathKeys = [
        'plus', 'add', 'minus', 'subtract', 'multiply', 'times', 'divide', 'over', 'equal', 'calculate',
        'reset', 'clear calculator'
    ];
    const hasMath = mathKeys.some(k => cmd.includes(k)) || /\d/.test(cmd) || cmd.includes('zero') || cmd.includes('one');

    if (!hasMath) return false;

    const calcWin = document.querySelector('#win-calculator');
    const isOpen = (calcWin && calcWin.style.display !== 'none');

    const isDistinctMath = cmd.includes('plus') || cmd.includes('minus') || cmd.includes('times') || cmd.includes('divide') || cmd.includes('equal') || cmd.includes('clear calculator');

    if (isDistinctMath && !isOpen) {
        openApp('calculator');
    } else if (!isOpen) {
        return false;
    }

    if (cmd.includes('clear calculator')) {
        clickCalc('C');
        return true;
    }

    const tokens = cmd.split(' ');
    const map = {
        'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
        'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
        'plus': '+', 'add': '+', 'added': '+',
        'minus': '-', 'subtract': '-', 'less': '-',
        'multiply': '*', 'multiplied': '*', 'times': '*', 'into': '*',
        'divide': '/', 'divided': '/', 'over': '/', 'by': '/',
        'equal': '=', 'equals': '=', 'calculate': '=', 'result': '=',
        'point': '.', 'dot': '.'
    };

    for (let word of tokens) {
        word = word.trim();
        if (['to', 'the', 'is', 'set'].includes(word)) continue;

        let char = map[word];
        if (!char) {
            if (!isNaN(word)) {
                for (let digit of word) {
                    clickCalc(digit);
                }
                continue;
            }
        }

        if (char) {
            clickCalc(char);
        }
    }
    return true;
}

function clickCalc(char) {
    const buttons = document.querySelectorAll(SEL.CALC_BUTTONS);
    for (let btn of buttons) {
        if (btn.innerText === char) {
            console.log(`🧮 Voice Engine: Clicking calculator button: ${char}`);
            btn.click();
            btn.style.transform = "scale(0.95)";
            setTimeout(() => btn.style.transform = "", 150);
            return;
        }
    }
}

/* ---- Notepad Logic ---- */
function processNotepad(cmd, rawText) {
    const noteWin = document.querySelector('#win-notepad');
    if (!noteWin || noteWin.style.display === 'none') return false;

    if (cmd.startsWith('type ') || cmd.startsWith('write ')) {
        let content = "";
        if (cmd.startsWith('type ')) content = rawText.substring(5);
        else content = rawText.substring(6);

        insertNote(content);
        return true;
    }

    if (cmd === 'new line' || cmd === 'enter') {
        insertNote('\n');
        return true;
    }
    if (cmd === 'clear notepad') {
        const ta = document.querySelector(SEL.NOTEPAD_TEXTAREA);
        if (ta) ta.value = '';
        return true;
    }
    if (cmd === 'delete last word') {
        const ta = document.querySelector(SEL.NOTEPAD_TEXTAREA);
        if (ta) {
            let val = ta.value.trimEnd();
            let lastSpace = val.lastIndexOf(' ');
            if (lastSpace >= 0) ta.value = val.substring(0, lastSpace);
            else ta.value = "";
        }
        return true;
    }

    // Dictation Mode (when notepad is focused)
    if (noteWin.classList.contains('active-focus')) {
        insertNote(rawText);
        return true;
    }

    return false;
}

function insertNote(text) {
    const ta = document.querySelector(SEL.NOTEPAD_TEXTAREA);
    if (!ta) return;

    let val = ta.value;
    if (val.length > 0 && !val.endsWith('\n') && !val.endsWith(' ') && text !== '\n') {
        val += ' ';
    }
    ta.value = val + text;
    ta.scrollTop = ta.scrollHeight;
}

/* ---- Toast Notification ---- */
function showToast(msg) {
    const toast = document.querySelector(SEL.TOAST);
    if (!toast) {
        console.warn("⚠️ Voice Engine: Toast element not found");
        return;
    }

    toast.innerText = msg;
    toast.classList.add('show');

    if (toast.dataset.timer) clearTimeout(parseInt(toast.dataset.timer));

    const tid = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);

    toast.dataset.timer = tid;
}
