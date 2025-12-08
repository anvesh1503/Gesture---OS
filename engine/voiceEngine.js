/* =========================================================
   VOICE ENGINE - ROBUST & PRODUCTION READY
   Handles Web Speech API with continuous recognition,
   smart restarting, and flexible natural language parsing.
   ========================================================= */

import { openApp, closeWin, hideAllWins, focusWin } from './windowManager.js';
import { showNotification } from './notificationEngine.js';
import { navigateTo } from './browserEngine.js';

/* ---- State Management ---- */
let recognition = null;
let isEnabled = false;
let isRestarting = false;  // Prevent rapid-fire loops
let recognitionStartedAt = 0;

/* ---- Selectors (User Defined) ---- */
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
    console.log("🎤 Voice Engine Loaded");

    // Safety check: Ensure DOM is ready
    if (!document.querySelector(SEL.TOGGLE_BTN) && !document.querySelector(SEL.TOGGLE_ROW)) {
        console.warn("⚠️ Voice toggle elements not found, retrying in 500ms...");
        setTimeout(initVoice, 500);
        return;
    }

    // 1. Restore State
    const saved = localStorage.getItem('pine_voice_enabled');
    isEnabled = (saved === 'true');

    // 2. Setup UI Handlers
    const toggleBtn = document.querySelector(SEL.TOGGLE_BTN);
    const toggleRow = document.querySelector(SEL.TOGGLE_ROW); // Larger click area

    const toggleFn = (e) => {
        e.stopPropagation(); // Avoid double bubbling
        if (isEnabled) {
            disableVoice();
        } else {
            enableVoice();
        }
    };

    if (toggleRow) toggleRow.onclick = toggleFn;
    else if (toggleBtn) toggleBtn.onclick = toggleFn;

    // 3. Sync UI & Start if needed
    updateUI();
    if (isEnabled) {
        startRecognition();
    }
}

/* ---- Core Controls ---- */
function enableVoice() {
    isEnabled = true;
    localStorage.setItem('pine_voice_enabled', 'true');
    updateUI();
    showToast("Voice Control Enabled");
    startRecognition();
}

function disableVoice() {
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
        // Show Toast immediately so user knows
        const toast = document.querySelector(SEL.TOAST);
        if (toast && !toast.classList.contains('show')) {
            toast.innerText = "Listening...";
            toast.classList.add('show');
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
    // Safety: If already exists, don't double init
    if (recognition) {
        try { recognition.start(); } catch (e) { /* ignore if already started */ }
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.error("❌ Web Speech API not supported in this browser.");
        showNotification("Voice Error", "Browser does not support Speech API", "error");
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        console.log("🎤 Voice Recognition STARTED");
        recognitionStartedAt = Date.now();
        isRestarting = false;
        updateUI();
    };

    recognition.onend = () => {
        console.log("🎤 Voice Recognition ENDED");
        recognition = null; // Clear instance

        // Auto-restart if we are still enabled
        if (isEnabled) {
            const lifeTime = Date.now() - recognitionStartedAt;
            // Prevention of rapid loop crashes: if it died instantly (<1s), wait a bit
            const delay = (lifeTime < 1000) ? 1000 : 100;

            if (!isRestarting) {
                isRestarting = true;
                setTimeout(() => {
                    console.log("🔄 Auto-restarting voice...");
                    startRecognition();
                }, delay);
            }
        } else {
            updateUI(); // Ensure UI reflects "Off"
        }
    };

    recognition.onerror = (event) => {
        console.warn("⚠️ Voice Recognition Error:", event.error);

        if (event.error === 'not-allowed') {
            disableVoice(); // Hard stop if permission denied
            showNotification("Microphone Blocked", "Please allow mic access.", "error");
        } else if (event.error === 'no-speech') {
            // Normal in silence, will trigger onend -> restart
            return;
        } else {
            // Other errors (network, etc) -> show toast
            showToast(`Error: ${event.error}`);
        }
    };

    recognition.onresult = (event) => {
        // Process results
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                let transcript = event.results[i][0].transcript.trim();
                handlePhrase(transcript);
            }
        }
    };

    try {
        recognition.start();
    } catch (e) {
        console.error("Failed to start recognition:", e);
    }
}

function stopRecognition() {
    if (recognition) {
        recognition.stop();
        recognition = null;
    }
}

/* ---- Command Handling ---- */
function handlePhrase(rawText) {
    const cmd = rawText.toLowerCase();
    console.log(`🗣️ Heard: "${cmd}"`);
    showToast("✓");

    // 1. Global App Control
    // Variations: open/launch/start
    if (match(cmd, ['open', 'launch', 'start'], ['calculator'])) { openApp('calculator'); return; }
    if (match(cmd, ['open', 'launch', 'start'], ['notepad'])) { openApp('notepad'); return; }
    if (match(cmd, ['open', 'launch', 'start'], ['browser', 'internet', 'chrome'])) { openApp('browser'); return; }
    if (match(cmd, ['open', 'launch', 'start'], ['settings', 'config'])) { openApp('settings'); return; }

    // Variations: close/hide/exit
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
    // Keywords allowing math
    const mathKeys = [
        'plus', 'add', 'minus', 'subtract', 'multiply', 'times', 'divide', 'over', 'equal', 'calculate',
        'reset', 'clear calculator'
    ];
    // Also digit detection
    const hasMath = mathKeys.some(k => cmd.includes(k)) || /\d/.test(cmd) || cmd.includes('zero') || cmd.includes('one');

    if (!hasMath) return false;

    // Check if we should auto-open
    const calcWin = document.querySelector('#win-calculator');
    const isOpen = (calcWin && calcWin.style.display !== 'none');

    // Only auto-open if it sounds like a distinct math command or "clear calculator"
    // (Avoid false positives on random numbers spoken)
    const isDistinctMath = cmd.includes('plus') || cmd.includes('minus') || cmd.includes('times') || cmd.includes('divide') || cmd.includes('equal') || cmd.includes('clear calculator');

    if (isDistinctMath && !isOpen) {
        openApp('calculator');
    } else if (!isOpen) {
        // If calculator is closed and we just said "5", ignore it.
        return false;
    }

    // Is Calculator processing
    if (cmd.includes('clear calculator')) {
        clickCalc('C');
        return true;
    }

    // Map words to symbols
    const tokens = cmd.split(' ');
    // Map: word -> button char
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

    // Iterate and Click
    for (let word of tokens) {
        word = word.trim();
        // Skip common filler words
        if (['to', 'the', 'is', 'set'].includes(word)) continue;

        let char = map[word];
        if (!char) {
            // Is it a number? "10" -> "1", "0"
            if (!isNaN(word)) {
                // Split multi-digit? Calculator buttons are usually single digits but
                // a standard calc usually expects sequential input: 1 then 2 for 12.
                // Our grid has 0-9.
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
            console.log(`🧮 Clicking: ${char}`);
            btn.click();
            // Visual feedback
            btn.classList.add('active-press'); // Requires CSS or inline
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

    // Check if user specifically wants to "Type ..."
    if (cmd.startsWith('type ') || cmd.startsWith('write ')) {
        // Extract content. "type hello there" -> "hello there"
        // Length of "type " is 5, "write " is 6
        let content = "";
        if (cmd.startsWith('type ')) content = rawText.substring(5);
        else content = rawText.substring(6);

        // Capitalize first letter of sentence if desired? 
        // User asked for "insert text". We'll keep raw.
        insertNote(content);
        return true;
    }

    // Commands
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

    // Dictation Mode (Loose)
    // Only if Notepad is the ACTIVE FOCUSED window
    if (noteWin.classList.contains('active-focus')) {
        // Avoid eating commands for other apps (unlikely since we checked them first)
        // But also avoid accidental noise.
        // User: "Dictation mode when notepad is focused"
        insertNote(rawText);
        return true;
    }

    return false;
}

function insertNote(text) {
    const ta = document.querySelector(SEL.NOTEPAD_TEXTAREA);
    if (!ta) return;

    let val = ta.value;
    // Auto-spacing: if not empty and not ending in newline, add space
    if (val.length > 0 && !val.endsWith('\n') && !val.endsWith(' ') && text !== '\n') {
        val += ' ';
    }
    ta.value = val + text;
    ta.scrollTop = ta.scrollHeight; // Auto-scroll
}

/* ---- Toast Notification (Fixed positioning for deployment) ---- */
function showToast(msg) {
    const toast = document.querySelector(SEL.TOAST);
    if (!toast) {
        console.warn("⚠️ Voice toast element not found");
        return;
    }

    toast.innerText = msg;
    toast.classList.add('show');

    // Clear previous timeout if any
    if (toast.dataset.timer) clearTimeout(parseInt(toast.dataset.timer));

    const tid = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);

    toast.dataset.timer = tid;
}
