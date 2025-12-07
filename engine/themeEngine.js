/* =========================================================
   THEME ENGINE
   Handles theme switching and persistence.
   ========================================================= */

export function initTheme() {
    // 1. Load saved theme
    const savedTheme = localStorage.getItem('pine_theme') || 'dark';
    setTheme(savedTheme);

    // 2. Setup Listeners
    setupThemeListeners();
}

export function setTheme(themeName) {
    document.body.setAttribute('data-theme', themeName);
    localStorage.setItem('pine_theme', themeName);

    // Update active state in UI if it exists
    updateThemeUI(themeName);
}

function updateThemeUI(activeTheme) {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        if (btn.dataset.theme === activeTheme) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function setupThemeListeners() {
    // We delegate this to the settings window initialization mostly,
    // but we can attach a global handler if we want dynamic buttons added later.
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.theme-btn');
        if (btn) {
            const theme = btn.dataset.theme;
            setTheme(theme);
        }
    });
}
