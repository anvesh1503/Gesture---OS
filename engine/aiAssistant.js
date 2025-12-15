import { openApp, closeWin, hideAllWins } from './windowManager.js';

/* =========================================================
   AI ASSISTANT ENGINE (REAL AI POWERED)
   Handles Chat Logic, API Calls, and System Commands.
   ========================================================= */

// 🔒 SECURITY: Replace this with your valid API Key
const API_KEY = "YOUR_API_KEY_HERE";
const API_URL = "https://api.openai.com/v1/chat/completions"; // Standard OpenAI Endpoint

const SYSTEM_PROMPT = `
You are the built-in AI assistant of Gesture OS.
You help users understand and operate the system.
You must only answer questions related to:
- gestures (Pinch to click, Fist to close, etc.)
- voice commands
- camera usage
- windows
- apps (calculator, notepad, browser, settings)
- troubleshooting Gesture OS

If a question is outside this scope, politely say you can only help with Gesture OS.
Keep answers concise (under 2 sentences if possible) and helpful.
`;

export function initAssistant() {
    const btn = document.getElementById('ai-assistant-btn');
    const panel = document.getElementById('ai-assistant-panel');
    const input = document.getElementById('ai-input');
    const sendBtn = document.getElementById('ai-send-btn');
    const closeBtn = document.querySelector('.ai-close');

    if (btn && panel) {
        // Toggle (Open/Close)
        btn.addEventListener('click', () => toggleAssistant());
        if (closeBtn) closeBtn.addEventListener('click', () => toggleAssistant(false));

        // Chat Logic
        if (sendBtn && input) {
            sendBtn.addEventListener('click', () => handleUserMessage());
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleUserMessage();
            });
        }
    }
}

/* ---- Core Actions ---- */

export function toggleAssistant(forceState) {
    const panel = document.getElementById('ai-assistant-panel');
    if (!panel) return;

    const isVisible = panel.style.display === 'flex';
    const newState = forceState !== undefined ? forceState : !isVisible;

    if (newState) {
        panel.style.display = 'flex';
        focusInput();
    } else {
        panel.style.display = 'none';
    }
}

export function setAssistantListening(isListening) {
    const input = document.getElementById('ai-input');
    const panel = document.getElementById('ai-assistant-panel');

    if (!panel || panel.style.display === 'none') toggleAssistant(true);

    if (isListening) {
        if (input) {
            input.value = '';
            input.placeholder = "Listening to your question...";
            input.classList.add('listening');
        }
        addMessage("Listening to your question...", 'system');
    } else {
        if (input) {
            input.placeholder = "Type a message...";
            input.classList.remove('listening');
        }
    }
}

// Entry point for Voice or External calls
export function askAI(text) {
    toggleAssistant(true);
    handleLogic(text);
}

/* ---- Internals ---- */

function handleUserMessage() {
    const input = document.getElementById('ai-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    handleLogic(text);
}

async function handleLogic(text) {
    // 1. Add User Message UI
    addMessage(text, 'user');

    // 2. Check Local System Commands FIRST (Fast Path)
    // We still process these locally to ensure the OS actually ACTS.
    if (executeLocalCommand(text)) {
        return; // Action taken, no need to call AI
    }

    // 3. Fallback to Real AI for Questions
    if (API_KEY === "YOUR_API_KEY_HERE") {
        addMessage("⚠️ API Key missing. Please configure 'engine/aiAssistant.js'.", 'ai');
        return;
    }

    // 4. Call API
    showTypingIndicator(); // "Thinking..."
    try {
        const response = await fetchAIResponse(text);
        removeTypingIndicator();
        addMessage(response, 'ai');
    } catch (e) {
        removeTypingIndicator();
        console.error("AI API Error:", e);
        addMessage("I'm having trouble connecting right now. Please try again.", 'ai');
    }
}

/* ---- System Command Execution ---- */
function executeLocalCommand(rawText) {
    const cmd = rawText.toLowerCase();

    if (cmd.includes('open calculator')) { openApp('calculator'); addMessage("Opening Calculator...", 'ai'); return true; }
    if (cmd.includes('open notepad')) { openApp('notepad'); addMessage("Opening Notepad...", 'ai'); return true; }
    if (cmd.includes('open browser')) { openApp('browser'); addMessage("Opening Browser...", 'ai'); return true; }
    if (cmd.includes('open settings')) { openApp('settings'); addMessage("Opening Settings...", 'ai'); return true; }

    if (cmd.includes('close calculator')) { closeWin('win-calculator'); addMessage("Closing Calculator...", 'ai'); return true; }
    if (cmd.includes('close notepad')) { closeWin('win-notepad'); addMessage("Closing Notepad...", 'ai'); return true; }
    if (cmd.includes('close browser')) { closeWin('win-browser'); addMessage("Closing Browser...", 'ai'); return true; }

    return false;
}

/* ---- AI API Interaction ---- */
async function fetchAIResponse(userQuery) {
    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
    };

    const payload = {
        model: "gpt-3.5-turbo", // Or any compatible model
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userQuery }
        ],
        temperature: 0.7,
        max_tokens: 150
    };

    const res = await fetch(API_URL, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        if (res.status === 429) throw new Error("Rate Limit Exceeded");
        throw new Error(`API Error: ${res.status}`);
    }

    const data = await res.json();
    if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content.trim();
    }
    return "I couldn't generate a response.";
}

/* ---- UI Helpers ---- */

function addMessage(text, sender) {
    const container = document.getElementById('ai-messages');
    if (!container) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-msg ${sender}`;
    msgDiv.innerText = text;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
    addMessage("Thinking...", 'ai typing-indicator');
}

function removeTypingIndicator() {
    const container = document.getElementById('ai-messages');
    if (!container) return;
    const indicators = container.querySelectorAll('.typing-indicator');
    indicators.forEach(el => el.remove());
}

function focusInput() {
    setTimeout(() => {
        const input = document.getElementById('ai-input');
        if (input) input.focus();
    }, 300);
}
