/* =========================================================
   VOICE ENGINE - ADVANCED
   Handles Web Speech API integration, command parsing, 
   and robust error handling.
   ========================================================= */
import { openApp, closeWin, hideAllWins, focusWin } from './windowManager.js';
import { showNotification } from './notificationEngine.js';
import { navigateTo } from './browserEngine.js';

let recognition = null;
let isEnabled = false;

export function initVoice() {
    setupVoiceToggle();
    startVoiceSystem();
}

function setupVoiceToggle() {
    const toggle = document.getElementById('voice-toggle');
    const row = document.getElementById('voice-setting-row');

    // Load saved state
    const savedState = localStorage.getItem('pine_voice_enabled');
    isEnabled = savedState === 'true';

    updateUIState();

    const target = row || toggle;
    if (target) {
        target.onclick = () => {
            isEnabled = !isEnabled;
            localStorage.setItem('pine_voice_enabled', isEnabled);
            updateUIState();

            if (isEnabled) {
                startVoiceSystem();
                showToast("Voice Control Enabled");
            } else {
                stopVoiceSystem();
                showToast("Voice Control Disabled");
            }
        };
    }
}

function updateUIState() {
    const toggle = document.getElementById('voice-toggle');
    const status = document.getElementById('voice-status');

    if (isEnabled) {
        if (toggle) toggle.classList.add('active');
        if (status) {
            status.innerText = 'Listening...';
            status.style.color = '#0f0'; // bright green
        }
    } else {
        if (toggle) toggle.classList.remove('active');
        if (status) {
            status.innerText = 'Off';
            status.style.color = '';
        }
    }
}

function startVoiceSystem() {
    if (!isEnabled) return;
    if (recognition) {
        // Already running or exists
        try { recognition.start(); } catch (e) { /* ignore already started error */ }
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.error("Web Speech API not supported.");
        showNotification("Voice Error", "Speech API not supported in this browser.", "error");
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        updateUIState();
    };

    recognition.onend = () => {
        // Auto-restart if it was supposed to be enabled
        if (isEnabled) {
            console.log("Voice service stopped, restarting...");
            setTimeout(() => {
                try {
                    recognition.start();
                } catch (e) {
                    console.warn("Restart failed", e);
                }
            }, 1000);
        } else {
            updateUIState();
        }
    };

    recognition.onerror = (event) => {
        console.warn("Voice error:", event.error);
        if (event.error === 'not-allowed') {
            isEnabled = false;
            updateUIState();
            showNotification("Permission Denied", "Microphone access blocked.", "error");
        }
    };

    recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                const transcript = event.results[i][0].transcript.trim();
                processCommand(transcript);
            }
        }
    };

    try {
        recognition.start();
    } catch (e) {
        console.warn("Failed to start recognition:", e);
    }
}

function stopVoiceSystem() {
    if (recognition) {
        recognition.stop();
        // We do NOT set recognition to null here because we might want to restart it later easily,
        // but 'onend' logic handles the restart loop check via 'isEnabled'.
        // Actually, let's null it to be clean.
        recognition = null;
    }
}

/* =========================================================
   COMMAND PARSING
   ========================================================= */

function processCommand(rawText) {
    const cmd = rawText.toLowerCase();
    console.log("Voice Command:", cmd);

    // Quick Feedback
    showToast(rawText);

    // 1. App Navigation
    if (cmd.includes('open calculator')) { openApp('calculator'); return; }
    if (cmd.includes('close calculator')) { closeWin('win-calculator'); return; }
    if (cmd.includes('open notepad')) { openApp('notepad'); return; }
    if (cmd.includes('close notepad')) { closeWin('win-notepad'); return; }
    if (cmd.includes('open setting')) { openApp('settings'); return; }
    if (cmd.includes('close setting')) { closeWin('win-settings'); return; }
    if (cmd.includes('open browser')) { openApp('browser'); return; }
    if (cmd.includes('close browser')) { closeWin('win-browser'); return; }

    // 2. Focused App Context
    if (handleCalculatorCommands(cmd)) return;
    if (handleNotepadCommands(rawText)) return; // Pass rawText for correct case in typing

    // 3. Fallback / Global
    if (cmd === 'show desktop' || cmd === 'minimize all' || cmd === 'hide windows') {
        hideAllWins();
        return;
    }
}

function handleCalculatorCommands(cmd) {
    const calcWin = document.getElementById('win-calculator');
    // If command looks like math, we might want to auto-open calc?
    // User requested "Command like: 5 plus 9 equals"
    // Let's checks simplistic patterns.

    // Words to numbers map
    const numMap = {
        'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
        'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9'
    };

    // If it contains math keywords, assume it's for calculator
    const mathKeywords = ['plus', 'minus', 'multiply', 'divide', 'divided', 'times', 'add', 'subtract', 'calculate', 'equal', 'equals', 'clear calculator'];
    const hasMath = mathKeywords.some(k => cmd.includes(k)) || /\d/.test(cmd);

    if (!hasMath) return false;

    // Check availability
    if (!calcWin || calcWin.style.display === 'none') {
        // Optional: Open it if they say a math command? User didn't strictly specify, 
        // but "set 8 divided by 2" implies it should probably act.
        // Let's only act if it's open OR explicit commands.
        // Actually, user said "Commands like: '5 plus 9 equals'". 
        // I will auto-open calculator if it's closed for seamless exp.
        openApp('calculator');
    }

    focusWin('win-calculator'); // Ensure it's active

    if (cmd.includes('clear calculator')) {
        clickCalcButton('C');
        return true;
    }

    // Parse the string into a sequence of button presses
    // "5 plus 9 equals" -> 5, +, 9, =
    // "set 8 divided by 2" -> 8, /, 2

    // Tokenize
    const tokens = cmd.split(' ');
    for (let token of tokens) {
        token = token.trim();
        // Map words to numbers/ops
        let btnKey = null;

        if (numMap[token]) btnKey = numMap[token];
        else if (!isNaN(token)) btnKey = token; // "5"
        else if (token === 'plus' || token === 'add') btnKey = '+';
        else if (token === 'minus' || token === 'subtract') btnKey = '-';
        else if (token === 'multiply' || token === 'times') btnKey = '*';
        else if (token === 'divide' || token === 'divided' || token === 'over') btnKey = '/';
        else if (token === 'equal' || token === 'equals' || token === 'determine') btnKey = '=';
        else if (token === 'point' || token === 'dot') btnKey = '.';

        if (btnKey) clickCalcButton(btnKey);
    }
    return true;
}

function clickCalcButton(char) {
    // Find button in .calc-grid matching text
    // Special handling for symbols vs text if needed, but existing HTML uses C, /, *, -, +, =
    const container = document.querySelector('.calc-grid');
    if (!container) return;

    const buttons = Array.from(container.querySelectorAll('button'));
    const btn = buttons.find(b => b.innerText === char);
    if (btn) {
        btn.click();

        // Visual Feedback
        btn.style.transition = '0.1s';
        btn.style.transform = 'scale(0.9)';
        btn.style.backgroundColor = 'var(--accent-color)';
        setTimeout(() => {
            btn.style.transform = 'scale(1)';
            btn.style.backgroundColor = '';
        }, 150);
    }
}

function handleNotepadCommands(rawText) {
    const cmd = rawText.toLowerCase();
    const notepadWin = document.getElementById('win-notepad');

    // Commands specific to notepad manipulation
    if (cmd === 'clear notepad') {
        if (notepadWin) {
            const ta = notepadWin.querySelector('textarea');
            if (ta) ta.value = "";
        }
        return true;
    }

    // If notepad is NOT open, we shouldn't just "type" into void, 
    // unless the command is explicit "type ..."
    const isTyping = cmd.startsWith('type ');

    if (isTyping || (notepadWin && notepadWin.style.display !== 'none')) {
        if (notepadWin.style.display === 'none') openApp('notepad');

        const textarea = notepadWin.querySelector('textarea');
        if (!textarea) return false;

        if (isTyping) {
            // "type hello world" -> "hello world"
            // remove first word "type" (case insensitive match of 'type ')
            // We use rawText to preserve casing of the content
            const content = rawText.substring(5); // "Type " length is 5
            insertAtCursor(textarea, content);
        } else {
            // Dictation mode commands? 
            if (cmd === 'new line' || cmd === 'enter') {
                insertAtCursor(textarea, '\n');
            } else if (cmd === 'delete last word') {
                deleteLastWord(textarea);
            } else {
                // Just dictate? NOTE: User said "type <text>" is the command.
                // But typically users expect open dictation if window is focused.
                // I will stick to "type <text>" as proper command to avoid false positives,
                // but if they said "new line" etc, we handle it.
                // Let's also support loose dictation if it doesn't match other commands 
                // AND notepad is explicitly the active focused window.
                const isActive = notepadWin.classList.contains('active-focus');
                if (isActive && !cmd.includes('open') && !cmd.includes('close')) {
                    // CAREFUL: This might catch garbage. Use user rule strictly? 
                    // User said: "type <text> should insert text".
                    // I will strictly allow "type ..." only for safety, unless user wants loose dictation.
                    // I'll add loose dictation for "delete last word" and "new line" only.
                }
            }
        }
        return true;
    }
    return false;
}

function insertAtCursor(textarea, text) {
    // Standard insert at end
    const val = textarea.value;
    // Add space if needed
    const needsSpace = val.length > 0 && !val.endsWith(' ') && !val.endsWith('\n') && !text.startsWith('\n');
    textarea.value = val + (needsSpace ? ' ' : '') + text;
    textarea.scrollTop = textarea.scrollHeight;
}

function deleteLastWord(textarea) {
    const text = textarea.value.trimEnd();
    const lastSpace = text.lastIndexOf(' ');
    if (lastSpace !== -1) {
        textarea.value = text.substring(0, lastSpace);
    } else {
        textarea.value = ""; // No spaces, clear all
    }
}

/* =========================================================
   UI HELPERS (Toast)
   ========================================================= */

function showToast(message) {
    let toast = document.getElementById('voice-toast');
    if (!toast) {
        // Create if missing (failsafe)
        toast = document.createElement('div');
        toast.id = 'voice-toast';
        document.body.appendChild(toast);
    }

    toast.innerText = message;
    toast.classList.add('show');

    // Hide after 3s
    if (toast.timeout) clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
