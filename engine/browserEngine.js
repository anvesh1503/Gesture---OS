/* =========================================================
   BROWSER ENGINE
   Handles Browser app navigation and events.
   ========================================================= */

export function initBrowser() {
    const urlInput = document.getElementById('browser-url');
    const goBtn = document.getElementById('btn-browser-go');
    const backBtn = document.getElementById('btn-browser-back');
    const reloadBtn = document.getElementById('btn-browser-reload');
    const iframe = document.getElementById('browser-frame');

    if (!urlInput || !goBtn || !iframe) return;

    // Handle "Go" Click
    goBtn.addEventListener('click', () => {
        navigateTo(urlInput.value);
    });

    // Handle Enter Key
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            navigateTo(urlInput.value);
        }
    });

    // Handle Reload
    reloadBtn.addEventListener('click', () => {
        // Attempt to reload iframe
        try {
            iframe.contentWindow.location.reload();
        } catch (e) {
            // Fallback if CORS blocks access
            iframe.src = iframe.src;
        }
    });

    // Handle Back
    backBtn.addEventListener('click', () => {
        // Simulate back if possible, or just go home
        try {
            iframe.contentWindow.history.back();
        } catch (e) {
            console.log("Cannot access iframe history due to CORS");
        }
    });
}

export function navigateTo(input) {
    const iframe = document.getElementById('browser-frame');
    const urlInput = document.getElementById('browser-url');
    if (!iframe || !input) return;

    let targetUrl = input.trim();

    // Check if it's a URL or Search Query
    const hasProtocol = targetUrl.startsWith('http://') || targetUrl.startsWith('https://');
    const hasDot = targetUrl.includes('.') && !targetUrl.includes(' '); // crude check for domain.com

    if (hasProtocol) {
        // Valid URL with protocol
    } else if (hasDot) {
        // Likely a domain like "google.com", prepend https://
        targetUrl = 'https://' + targetUrl;
    } else {
        // Search Query
        // Using "igu=1" for Google to attempt iframe support, or fallback to Bing which is often friendlier
        // targetUrl = `https://www.google.com/search?igu=1&q=${encodeURIComponent(targetUrl)}`;
        // Bing is safer for iframes usually
        targetUrl = `https://www.bing.com/search?q=${encodeURIComponent(targetUrl)}`;
    }

    iframe.src = targetUrl;
    urlInput.value = targetUrl;
}
