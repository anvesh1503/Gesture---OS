/* =========================================================
   VOICE ENGINE
   Handles Web Speech API integration.
   ========================================================= */
import { openApp, closeWin, hideAllWins, focusWin } from './windowManager.js';

export function initVoice() {
    const toggle = document.getElementById('voice-toggle');
    const status = document.getElementById('voice-status');
    let recognition = null;
    let isEnabled = localStorage.getItem('pine_voice_enabled') === 'true';

    // Toast Setup
    let toast = document.getElementById('voice-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'voice-toast';
        toast.innerHTML = '<span>🎙️</span><span id="voice-toast-text"></span>';
        document.body.appendChild(toast);
    }

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
        'focus notepad': () => focusWin('win-notepad'),

        // Calculator Commands
        'press one': () => triggerCalculatorButton('1'),
        'press 1': () => triggerCalculatorButton('1'),
        'press two': () => triggerCalculatorButton('2'),
        'press 2': () => triggerCalculatorButton('2'),
        'press three': () => triggerCalculatorButton('3'),
        'press 3': () => triggerCalculatorButton('3'),
        'press four': () => triggerCalculatorButton('4'),
        'press 4': () => triggerCalculatorButton('4'),
        'press five': () => triggerCalculatorButton('5'),
        'press 5': () => triggerCalculatorButton('5'),
        'press six': () => triggerCalculatorButton('6'),
        'press 6': () => triggerCalculatorButton('6'),
        'press seven': () => triggerCalculatorButton('7'),
        'press 7': () => triggerCalculatorButton('7'),
        'press eight': () => triggerCalculatorButton('8'),
        'press 8': () => triggerCalculatorButton('8'),
        'press nine': () => triggerCalculatorButton('9'),
        'press 9': () => triggerCalculatorButton('9'),
        'press zero': () => triggerCalculatorButton('0'),
        'press 0': () => triggerCalculatorButton('0'),

        'plus': () => triggerCalculatorButton('+'),
        'add': () => triggerCalculatorButton('+'),
        'minus': () => triggerCalculatorButton('-'),
        'subtract': () => triggerCalculatorButton('-'),
        'multiply': () => triggerCalculatorButton('*'),
        'times': () => triggerCalculatorButton('*'),
        'divide': () => triggerCalculatorButton('/'),
        'equals': () => triggerCalculatorButton('='),
        'calculate': () => triggerCalculatorButton('='),
        'clear': () => triggerCalculatorButton('C'),
        'reset': () => triggerCalculatorButton('C')
    };

    function triggerCalculatorButton(label) {
        const win = document.getElementById('win-calculator');
        if (!win || win.style.display === 'none') {
            openApp('calculator');
        }
        const buttons = win.querySelectorAll('button');
        for (let btn of buttons) {
            if (btn.innerText === label) {
                btn.click();
                btn.style.transform = 'scale(0.95)';
                setTimeout(() => btn.style.transform = '', 100);
                return;
            }
        }
    }

    function insertTextIntoNotepad(text) {
        const win = document.getElementById('win-notepad');
        if (!win) return;
        const textarea = win.querySelector('textarea');
        if (textarea) {
            if (textarea.value.length > 0 && !textarea.value.endsWith(' ') && !textarea.value.endsWith('\n')) {
                textarea.value += ' ';
            }
            textarea.value += text;
            textarea.scrollTop = textarea.scrollHeight;
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
                const rawTranscript = event.results[0][0].transcript.trim();
                const cleanCmd = rawTranscript.toLowerCase();

                const notepadWin = document.getElementById('win-notepad');
                if (notepadWin && notepadWin.classList.contains('active-focus') && notepadWin.style.display !== 'none') {
                    if (cleanCmd.includes('close notepad')) {
                        showToast('Closing Notepad');
                        commands['close notepad']();
                        return;
                    }
                    insertTextIntoNotepad(rawTranscript);
                    showToast('Typed: ' + rawTranscript);
                    return;
                }

                let matched = false;
                for (const [cmd, action] of Object.entries(commands)) {
                    if (cleanCmd.includes(cmd)) {
                        showToast(cmd);
                        action();
                        matched = true;
                        break;
                    }
                }
            };

            recognition.onerror = (e) => {
                if (status) status.innerText = 'Error: ' + e.error;
            };

            recognition.start();

        } catch (e) {
            console.error(e);
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

    if (toggle) {
        if (isEnabled) toggle.classList.add('active');
        toggle.addEventListener('click', () => {
            isEnabled = !isEnabled;
            updateState();
        });
        if (isEnabled) startVoice();
    }
}
