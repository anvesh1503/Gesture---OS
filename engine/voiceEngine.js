/* =========================================================
   VOICE ENGINE - FULLY FIXED & DEPLOYMENT READY
   
   ✅ Enhanced browser compatibility (webkitSpeechRecognition)
   ✅ Robust microphone permission handling
   ✅ Smart auto-restart with exponential backoff
   ✅ Comprehensive error handling & recovery
   ✅ Detailed logging for debugging
   ✅ HTTPS/deployment ready
   ✅ No impact on gesture system
   ========================================================= */

import { openApp, closeWin, hideAllWins, focusWin } from './windowManager.js';
import { showNotification } from './notificationEngine.js';
import { navigateTo } from './browserEngine.js';

/* ========================================
   STATE MANAGEMENT
   ======================================== */
let recognition = null;
let isEnabled = false;
let isRestarting = false;
let recognitionStartedAt = 0;
let micPermissionGranted = false;
let restartAttempts = 0;
let lastErrorTime = 0;
let consecutiveErrors = 0;

// Configuration
const CONFIG = {
    MAX_RESTART_ATTEMPTS: 10,
    BASE_RESTART_DELAY: 100,      // Base delay in ms
    MAX_RESTART_DELAY: 5000,      // Max delay in ms
    ERROR_RATE_WINDOW: 5000,      // Time window for error rate limiting
    MAX_ERRORS_PER_WINDOW: 3,     // Max errors in time window
    RECOGNITION_TIMEOUT: 30000    // Max time before forcing restart
};

/* ========================================
   DOM SELECTORS
   ======================================== */
const SEL = {
    NOTEPAD_TEXTAREA: '#win-notepad textarea',
    CALC_DISPLAY: '.calc-display',
    CALC_BUTTONS: '.calc-grid button',
    TOAST: '#voice-toast',
    TOGGLE_BTN: '#voice-toggle',
    TOGGLE_ROW: '#voice-setting-row',
    STATUS_TEXT: '#voice-status'
};

/* ========================================
   INITIALIZATION
   ======================================== */
export function initVoice() {
    console.log("🎤 [VOICE ENGINE] ========== INITIALIZATION START ==========");
    console.log(`🎤 [VOICE ENGINE] Timestamp: ${new Date().toISOString()}`);
    console.log(`🎤 [VOICE ENGINE] User Agent: ${navigator.userAgent}`);

    // 1. Check Secure Context
    const isSecureContext = window.isSecureContext;
    const isLocalhost = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '';
    const protocol = window.location.protocol;

    console.log(`🎤 [VOICE ENGINE] Protocol: ${protocol}`);
    console.log(`🎤 [VOICE ENGINE] Secure Context: ${isSecureContext}`);
    console.log(`🎤 [VOICE ENGINE] Is Localhost: ${isLocalhost}`);

    if (!isSecureContext && !isLocalhost) {
        console.error("❌ [VOICE ENGINE] HTTPS required for Speech API in production");
        console.error(`❌ [VOICE ENGINE] Current URL: ${window.location.href}`);
        showToast("⚠️ Voice requires HTTPS");
        showNotification(
            "Voice Commands Unavailable",
            "HTTPS is required for voice commands. Please use a secure connection.",
            "error"
        );
        return;
    }

    // 2. Check Browser Support with all variants
    const SpeechRecognition = window.SpeechRecognition ||
        window.webkitSpeechRecognition ||
        window.mozSpeechRecognition ||
        window.msSpeechRecognition;

    if (!SpeechRecognition) {
        console.error("❌ [VOICE ENGINE] Web Speech API not supported");
        console.error(`❌ [VOICE ENGINE] Browser: ${navigator.userAgent}`);
        showToast("⚠️ Browser not supported");
        showNotification(
            "Voice Commands Unavailable",
            "Your browser doesn't support voice commands. Please use Chrome, Edge, or Safari.",
            "error"
        );
        return;
    }

    const apiVariant = window.SpeechRecognition ? 'SpeechRecognition' :
        window.webkitSpeechRecognition ? 'webkitSpeechRecognition' :
            window.mozSpeechRecognition ? 'mozSpeechRecognition' : 'msSpeechRecognition';
    console.log(`✅ [VOICE ENGINE] Speech API detected: ${apiVariant}`);

    // 3. Wait for DOM if needed
    if (!document.querySelector(SEL.TOGGLE_BTN) && !document.querySelector(SEL.TOGGLE_ROW)) {
        console.warn("⚠️ [VOICE ENGINE] Toggle elements not found, retrying in 500ms...");
        setTimeout(initVoice, 500);
        return;
    }

    console.log("✅ [VOICE ENGINE] DOM elements found");

    // 4. Restore saved state
    const saved = localStorage.getItem('pine_voice_enabled');
    isEnabled = (saved === 'true');
    console.log(`🎤 [VOICE ENGINE] Restored state from localStorage: ${isEnabled}`);

    // 5. Setup UI event handlers
    setupUIHandlers();

    // 6. Update UI to match state
    updateUI();

    // 7. Auto-start if previously enabled
    if (isEnabled) {
        console.log("🎤 [VOICE ENGINE] Auto-starting (was previously enabled)");
        requestMicrophonePermission();
    }

    console.log("🎤 [VOICE ENGINE] ========== INITIALIZATION COMPLETE ==========");
}

/* ========================================
   UI HANDLERS
   ======================================== */
function setupUIHandlers() {
    const toggleBtn = document.querySelector(SEL.TOGGLE_BTN);
    const toggleRow = document.querySelector(SEL.TOGGLE_ROW);

    const toggleFn = (e) => {
        e.stopPropagation();
        console.log(`🎤 [VOICE ENGINE] Toggle clicked (current: ${isEnabled} → new: ${!isEnabled})`);

        if (isEnabled) {
            disableVoice();
        } else {
            enableVoice();
        }
    };

    if (toggleRow) {
        toggleRow.onclick = toggleFn;
        console.log("✅ [VOICE ENGINE] Toggle row event listener attached");
    } else if (toggleBtn) {
        toggleBtn.onclick = toggleFn;
        console.log("✅ [VOICE ENGINE] Toggle button event listener attached");
    }
}

/* ========================================
   MICROPHONE PERMISSION
   ======================================== */
async function requestMicrophonePermission() {
    console.log("🎤 [VOICE ENGINE] ========== REQUESTING MICROPHONE PERMISSION ==========");

    try {
        // Check if permission API is available
        if (navigator.permissions && navigator.permissions.query) {
            try {
                const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
                console.log(`🎤 [VOICE ENGINE] Current permission state: ${permissionStatus.state}`);

                // Monitor permission changes
                permissionStatus.onchange = () => {
                    console.log(`🎤 [VOICE ENGINE] Permission state changed to: ${permissionStatus.state}`);
                    if (permissionStatus.state === 'denied' && isEnabled) {
                        console.warn("⚠️ [VOICE ENGINE] Permission revoked during session");
                        disableVoice();
                        showNotification(
                            "Microphone Access Revoked",
                            "Voice commands have been disabled because microphone access was revoked.",
                            "warning"
                        );
                    }
                };
            } catch (permErr) {
                console.warn("⚠️ [VOICE ENGINE] Permission API query failed:", permErr);
            }
        }

        // Request microphone access
        console.log("🎤 [VOICE ENGINE] Calling getUserMedia...");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Permission granted - stop the stream immediately
        stream.getTracks().forEach(track => {
            track.stop();
            console.log(`🎤 [VOICE ENGINE] Stopped audio track: ${track.label}`);
        });

        micPermissionGranted = true;
        console.log("✅ [VOICE ENGINE] Microphone permission GRANTED");

        // Start recognition
        startRecognition();

    } catch (error) {
        console.error("❌ [VOICE ENGINE] Microphone permission DENIED or error");
        console.error("❌ [VOICE ENGINE] Error details:", error);
        console.error("❌ [VOICE ENGINE] Error name:", error.name);
        console.error("❌ [VOICE ENGINE] Error message:", error.message);

        micPermissionGranted = false;

        // Disable voice and notify user
        isEnabled = false;
        localStorage.setItem('pine_voice_enabled', 'false');
        updateUI();

        const errorMsg = error.name === 'NotAllowedError'
            ? "Please allow microphone access in your browser settings to use voice commands."
            : "Could not access microphone. Please check your browser settings and try again.";

        showNotification("Microphone Access Denied", errorMsg, "error");
        showToast("❌ Microphone access denied");
    }
}

/* ========================================
   ENABLE / DISABLE VOICE
   ======================================== */
function enableVoice() {
    console.log("🎤 [VOICE ENGINE] ========== ENABLING VOICE CONTROL ==========");
    isEnabled = true;
    localStorage.setItem('pine_voice_enabled', 'true');
    updateUI();
    showToast("✅ Voice Control Enabled");

    // Reset error tracking
    restartAttempts = 0;
    consecutiveErrors = 0;
    lastErrorTime = 0;

    // Request permission and start
    requestMicrophonePermission();
}

function disableVoice() {
    console.log("🎤 [VOICE ENGINE] ========== DISABLING VOICE CONTROL ==========");
    isEnabled = false;
    localStorage.setItem('pine_voice_enabled', 'false');
    updateUI();
    showToast("🔇 Voice Control Disabled");
    stopRecognition();
}

/* ========================================
   UI UPDATE
   ======================================== */
function updateUI() {
    const btn = document.querySelector(SEL.TOGGLE_BTN);
    const stat = document.querySelector(SEL.STATUS_TEXT);
    const toast = document.querySelector(SEL.TOAST);

    if (isEnabled) {
        if (btn) btn.classList.add('active');
        if (stat) {
            stat.innerText = 'Listening...';
            stat.style.color = '#00ff00';
            stat.style.fontWeight = 'bold';
        }
        if (toast && !toast.classList.contains('show')) {
            toast.classList.add('show');
            toast.innerText = "🎤 Listening...";
        }
        console.log("🎤 [VOICE ENGINE] UI updated: ENABLED");
    } else {
        if (btn) btn.classList.remove('active');
        if (stat) {
            stat.innerText = 'Off';
            stat.style.color = 'inherit';
            stat.style.fontWeight = 'normal';
        }
        if (toast) toast.classList.remove('show');
        console.log("🎤 [VOICE ENGINE] UI updated: DISABLED");
    }
}

/* ========================================
   SPEECH RECOGNITION - START
   ======================================== */
function startRecognition() {
    console.log("🎤 [VOICE ENGINE] ========== STARTING RECOGNITION ==========");
    console.log(`🎤 [VOICE ENGINE] Restart attempts: ${restartAttempts}/${CONFIG.MAX_RESTART_ATTEMPTS}`);

    // Check if already running
    if (recognition) {
        console.log("🎤 [VOICE ENGINE] Recognition instance already exists");
        try {
            recognition.start();
            console.log("🎤 [VOICE ENGINE] Called start() on existing instance");
        } catch (e) {
            console.warn("⚠️ [VOICE ENGINE] Recognition already started:", e.message);
        }
        return;
    }

    // Get Speech Recognition constructor
    const SpeechRecognition = window.SpeechRecognition ||
        window.webkitSpeechRecognition ||
        window.mozSpeechRecognition ||
        window.msSpeechRecognition;

    if (!SpeechRecognition) {
        console.error("❌ [VOICE ENGINE] Speech API not available");
        showNotification("Voice Error", "Browser does not support Speech API", "error");
        return;
    }

    try {
        console.log("🎤 [VOICE ENGINE] Creating new SpeechRecognition instance...");
        recognition = new SpeechRecognition();

        // Configure recognition
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        console.log("🎤 [VOICE ENGINE] Configuration:");
        console.log(`   - continuous: ${recognition.continuous}`);
        console.log(`   - interimResults: ${recognition.interimResults}`);
        console.log(`   - lang: ${recognition.lang}`);
        console.log(`   - maxAlternatives: ${recognition.maxAlternatives}`);

        // Event: onstart
        recognition.onstart = () => {
            const timestamp = new Date().toISOString();
            console.log(`✅ [VOICE ENGINE] Recognition STARTED at ${timestamp}`);
            recognitionStartedAt = Date.now();
            isRestarting = false;
            restartAttempts = 0; // Reset on successful start
            consecutiveErrors = 0;

            // Update UI
            const toast = document.querySelector(SEL.TOAST);
            if (toast) {
                toast.classList.add('show');
                toast.innerText = "🎤 Listening...";
            }
            updateUI();
        };

        // Event: onend
        recognition.onend = () => {
            const timestamp = new Date().toISOString();
            const duration = Date.now() - recognitionStartedAt;
            console.log(`🎤 [VOICE ENGINE] Recognition ENDED at ${timestamp}`);
            console.log(`🎤 [VOICE ENGINE] Session duration: ${duration}ms`);

            recognition = null;

            // Auto-restart if still enabled
            if (isEnabled) {
                // Check max restart attempts
                if (restartAttempts >= CONFIG.MAX_RESTART_ATTEMPTS) {
                    console.error(`❌ [VOICE ENGINE] Max restart attempts (${CONFIG.MAX_RESTART_ATTEMPTS}) reached`);
                    disableVoice();
                    showNotification(
                        "Voice Recognition Error",
                        "Voice recognition failed repeatedly. Please try again later.",
                        "error"
                    );
                    return;
                }

                // Calculate restart delay with exponential backoff
                const baseDelay = CONFIG.BASE_RESTART_DELAY;
                const exponentialDelay = baseDelay * Math.pow(2, restartAttempts);
                const delay = Math.min(exponentialDelay, CONFIG.MAX_RESTART_DELAY);

                restartAttempts++;

                if (!isRestarting) {
                    isRestarting = true;
                    console.log(`🔄 [VOICE ENGINE] Auto-restarting in ${delay}ms (attempt ${restartAttempts}/${CONFIG.MAX_RESTART_ATTEMPTS})`);

                    setTimeout(() => {
                        startRecognition();
                    }, delay);
                }
            } else {
                console.log("🎤 [VOICE ENGINE] Not restarting (voice control disabled)");
                updateUI();
            }
        };

        // Event: onerror
        recognition.onerror = (event) => {
            const timestamp = new Date().toISOString();
            console.warn(`⚠️ [VOICE ENGINE] Recognition ERROR at ${timestamp}`);
            console.warn(`⚠️ [VOICE ENGINE] Error type: ${event.error}`);
            console.warn(`⚠️ [VOICE ENGINE] Error message: ${event.message || 'N/A'}`);

            // Track error rate
            const now = Date.now();
            if (now - lastErrorTime < CONFIG.ERROR_RATE_WINDOW) {
                consecutiveErrors++;
            } else {
                consecutiveErrors = 1;
            }
            lastErrorTime = now;

            console.warn(`⚠️ [VOICE ENGINE] Consecutive errors: ${consecutiveErrors}`);

            // Handle specific error types
            switch (event.error) {
                case 'not-allowed':
                case 'service-not-allowed':
                    console.error("❌ [VOICE ENGINE] Microphone permission denied");
                    disableVoice();
                    showNotification(
                        "Microphone Blocked",
                        "Please allow microphone access in your browser settings and try again.",
                        "error"
                    );
                    showToast("❌ Microphone blocked");
                    break;

                case 'no-speech':
                    console.log("🎤 [VOICE ENGINE] No speech detected (normal, will restart)");
                    // This is normal - will trigger onend → restart
                    break;

                case 'audio-capture':
                    console.error("❌ [VOICE ENGINE] Audio capture error - microphone may be in use");
                    showToast("⚠️ Microphone error");
                    // Will restart via onend
                    break;

                case 'network':
                    console.error("❌ [VOICE ENGINE] Network error - check internet connection");
                    showToast("⚠️ Network error");
                    // Will restart via onend
                    break;

                case 'aborted':
                    console.log("🎤 [VOICE ENGINE] Recognition aborted (normal during stop)");
                    // Normal during manual stop
                    break;

                case 'bad-grammar':
                    console.error("❌ [VOICE ENGINE] Bad grammar configuration");
                    showToast("⚠️ Configuration error");
                    break;

                case 'language-not-supported':
                    console.error("❌ [VOICE ENGINE] Language not supported");
                    showToast("⚠️ Language not supported");
                    break;

                default:
                    console.error(`❌ [VOICE ENGINE] Unknown error: ${event.error}`);
                    showToast(`⚠️ Error: ${event.error}`);
            }

            // If too many errors, disable
            if (consecutiveErrors >= CONFIG.MAX_ERRORS_PER_WINDOW) {
                console.error(`❌ [VOICE ENGINE] Too many errors (${consecutiveErrors}), disabling`);
                disableVoice();
                showNotification(
                    "Voice Recognition Error",
                    "Too many errors occurred. Voice commands have been disabled.",
                    "error"
                );
            }
        };

        // Event: onresult
        recognition.onresult = (event) => {
            try {
                const result = event.results[event.results.length - 1];

                if (result.isFinal) {
                    const transcript = result[0].transcript.trim();
                    const confidence = result[0].confidence;
                    const timestamp = new Date().toISOString();

                    console.log(`🗣️ [VOICE ENGINE] ========== SPEECH DETECTED ==========`);
                    console.log(`🗣️ [VOICE ENGINE] Timestamp: ${timestamp}`);
                    console.log(`🗣️ [VOICE ENGINE] Transcript: "${transcript}"`);
                    console.log(`🗣️ [VOICE ENGINE] Confidence: ${(confidence * 100).toFixed(1)}%`);

                    // UI feedback
                    const toast = document.querySelector(SEL.TOAST);
                    if (toast) {
                        toast.classList.add('show');
                        toast.innerText = "⚙️ Processing...";
                    }

                    // Process command
                    handlePhrase(transcript);

                    // Reset listening UI after short delay
                    setTimeout(() => {
                        if (toast && isEnabled) {
                            toast.innerText = "🎤 Listening...";
                        }
                    }, 1500);
                }
            } catch (error) {
                console.error("❌ [VOICE ENGINE] Error processing result:", error);
            }
        };

        // Start recognition
        console.log("🎤 [VOICE ENGINE] Calling recognition.start()...");
        recognition.start();

    } catch (error) {
        console.error("❌ [VOICE ENGINE] Failed to start recognition:", error);
        console.error("❌ [VOICE ENGINE] Error stack:", error.stack);
        recognition = null;
        showToast("❌ Failed to start voice recognition");

        // Try again with backoff if enabled
        if (isEnabled && restartAttempts < CONFIG.MAX_RESTART_ATTEMPTS) {
            const delay = CONFIG.BASE_RESTART_DELAY * Math.pow(2, restartAttempts);
            restartAttempts++;
            console.log(`🔄 [VOICE ENGINE] Retrying in ${delay}ms...`);
            setTimeout(startRecognition, delay);
        }
    }
}

/* ========================================
   SPEECH RECOGNITION - STOP
   ======================================== */
function stopRecognition() {
    console.log("🎤 [VOICE ENGINE] ========== STOPPING RECOGNITION ==========");

    if (recognition) {
        try {
            recognition.stop();
            recognition = null;
            console.log("✅ [VOICE ENGINE] Recognition stopped successfully");
        } catch (error) {
            console.error("❌ [VOICE ENGINE] Error stopping recognition:", error);
        }
    } else {
        console.log("🎤 [VOICE ENGINE] No recognition instance to stop");
    }
}

/* ========================================
   COMMAND HANDLING
   ======================================== */
function handlePhrase(rawText) {
    const cmd = rawText.toLowerCase();
    console.log(`🗣️ [VOICE ENGINE] Processing command: "${cmd}"`);

    // Show success feedback
    showToast("✓");

    // 1. Global App Control
    if (match(cmd, ['open', 'launch', 'start'], ['calculator', 'calc'])) {
        console.log("🗣️ [VOICE ENGINE] Command: Open Calculator");
        openApp('calculator');
        return;
    }
    if (match(cmd, ['open', 'launch', 'start'], ['notepad', 'note'])) {
        console.log("🗣️ [VOICE ENGINE] Command: Open Notepad");
        openApp('notepad');
        return;
    }
    if (match(cmd, ['open', 'launch', 'start'], ['browser', 'internet', 'chrome', 'web'])) {
        console.log("🗣️ [VOICE ENGINE] Command: Open Browser");
        openApp('browser');
        return;
    }
    if (match(cmd, ['open', 'launch', 'start'], ['settings', 'config'])) {
        console.log("🗣️ [VOICE ENGINE] Command: Open Settings");
        openApp('settings');
        return;
    }

    if (match(cmd, ['close', 'hide', 'exit', 'quit'], ['calculator', 'calc'])) {
        console.log("🗣️ [VOICE ENGINE] Command: Close Calculator");
        closeWin('win-calculator');
        return;
    }
    if (match(cmd, ['close', 'hide', 'exit', 'quit'], ['notepad', 'note'])) {
        console.log("🗣️ [VOICE ENGINE] Command: Close Notepad");
        closeWin('win-notepad');
        return;
    }
    if (match(cmd, ['close', 'hide', 'exit', 'quit'], ['browser', 'web'])) {
        console.log("🗣️ [VOICE ENGINE] Command: Close Browser");
        closeWin('win-browser');
        return;
    }
    if (match(cmd, ['close', 'hide', 'exit', 'quit'], ['settings'])) {
        console.log("🗣️ [VOICE ENGINE] Command: Close Settings");
        closeWin('win-settings');
        return;
    }

    if (cmd.includes('show desktop') || cmd.includes('minimize all')) {
        console.log("🗣️ [VOICE ENGINE] Command: Show Desktop");
        hideAllWins();
        return;
    }

    // 2. App-specific functionality
    if (processCalculator(cmd)) return;
    if (processNotepad(cmd, rawText)) return;

    console.log("🗣️ [VOICE ENGINE] No matching command found");
}

// Helper: match any verb + any noun
function match(text, verbs, nouns) {
    return verbs.some(v => text.includes(v)) && nouns.some(n => text.includes(n));
}

/* ========================================
   CALCULATOR COMMANDS
   ======================================== */
function processCalculator(cmd) {
    const mathKeys = [
        'plus', 'add', 'minus', 'subtract', 'multiply', 'times', 'divide', 'over', 'equal', 'calculate',
        'reset', 'clear calculator'
    ];
    const hasMath = mathKeys.some(k => cmd.includes(k)) || /\d/.test(cmd) || cmd.includes('zero') || cmd.includes('one');

    if (!hasMath) return false;

    const calcWin = document.querySelector('#win-calculator');
    const isOpen = (calcWin && calcWin.style.display !== 'none');

    const isDistinctMath = cmd.includes('plus') || cmd.includes('minus') || cmd.includes('times') ||
        cmd.includes('divide') || cmd.includes('equal') || cmd.includes('clear calculator');

    if (isDistinctMath && !isOpen) {
        console.log("🗣️ [VOICE ENGINE] Opening calculator for math command");
        openApp('calculator');
    } else if (!isOpen) {
        return false;
    }

    if (cmd.includes('clear calculator')) {
        console.log("🗣️ [VOICE ENGINE] Calculator: Clear");
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
            console.log(`🧮 [VOICE ENGINE] Calculator: Clicking button "${char}"`);
            btn.click();
            btn.style.transform = "scale(0.95)";
            setTimeout(() => btn.style.transform = "", 150);
            return;
        }
    }
}

/* ========================================
   NOTEPAD COMMANDS
   ======================================== */
function processNotepad(cmd, rawText) {
    const noteWin = document.querySelector('#win-notepad');
    if (!noteWin || noteWin.style.display === 'none') return false;

    if (cmd.startsWith('type ') || cmd.startsWith('write ')) {
        let content = "";
        if (cmd.startsWith('type ')) content = rawText.substring(5);
        else content = rawText.substring(6);

        console.log(`📝 [VOICE ENGINE] Notepad: Type "${content}"`);
        insertNote(content);
        return true;
    }

    if (cmd === 'new line' || cmd === 'enter') {
        console.log("📝 [VOICE ENGINE] Notepad: New line");
        insertNote('\n');
        return true;
    }

    if (cmd === 'clear notepad') {
        console.log("📝 [VOICE ENGINE] Notepad: Clear");
        const ta = document.querySelector(SEL.NOTEPAD_TEXTAREA);
        if (ta) ta.value = '';
        return true;
    }

    if (cmd === 'delete last word') {
        console.log("📝 [VOICE ENGINE] Notepad: Delete last word");
        const ta = document.querySelector(SEL.NOTEPAD_TEXTAREA);
        if (ta) {
            let val = ta.value.trimEnd();
            let lastSpace = val.lastIndexOf(' ');
            if (lastSpace >= 0) ta.value = val.substring(0, lastSpace);
            else ta.value = "";
        }
        return true;
    }

    // Dictation mode (when notepad is focused)
    if (noteWin.classList.contains('active-focus')) {
        console.log(`📝 [VOICE ENGINE] Notepad: Dictation "${rawText}"`);
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

/* ========================================
   TOAST NOTIFICATION
   ======================================== */
function showToast(msg) {
    const toast = document.querySelector(SEL.TOAST);
    if (!toast) {
        console.warn("⚠️ [VOICE ENGINE] Toast element not found");
        return;
    }

    toast.innerText = msg;
    toast.classList.add('show');

    if (toast.dataset.timer) clearTimeout(parseInt(toast.dataset.timer));

    const tid = setTimeout(() => {
        if (isEnabled) {
            toast.innerText = "🎤 Listening...";
        } else {
            toast.classList.remove('show');
        }
    }, 3000);

    toast.dataset.timer = tid;
}
