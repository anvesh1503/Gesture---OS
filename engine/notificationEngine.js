/* =========================================================
   NOTIFICATION ENGINE
   Handles stacked toasts and notification center.
   ========================================================= */
import { bringToFront } from './windowManager.js';

export function initNotifications() {
    // 1. Setup UI Containers if missing
    if (!document.getElementById('toast-container')) {
        const tc = document.createElement('div');
        tc.id = 'toast-container';
        document.body.appendChild(tc);
    }

    if (!document.getElementById('notification-center')) {
        const nc = document.createElement('div');
        nc.id = 'notification-center';
        nc.innerHTML = `
            <div class="notif-header">
                <span>Notifications</span>
                <span class="clear-all-btn">Clear All</span>
            </div>
            <div class="notif-list"></div>
        `;
        document.body.appendChild(nc);

        // Listeners
        const clearBtn = nc.querySelector('.clear-all-btn');
        if (clearBtn) clearBtn.addEventListener('click', clearAllNotifications);

        // Close when clicking outside, but handled by main click listener usually 
        // to avoid conflict with toggle button, we handle toggle in desktopEngine or here.
        // Let's export a toggle function.
    }

    const notifBtn = document.getElementById('notif-btn');
    if (notifBtn) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleNotificationCenter();
        });
    }

    // Global click listener to close center
    document.addEventListener('click', (e) => {
        const nc = document.getElementById('notification-center');
        const btn = document.getElementById('notif-btn');
        if (nc && nc.classList.contains('open')) {
            if (!nc.contains(e.target) && !btn.contains(e.target)) {
                toggleNotificationCenter(false);
            }
        }
    });

    // Expose global for convenience if needed, but module export is preferred
    window.showNotification = showNotification;
}

export function showNotification(title, message, type = 'info') {
    // 1. Create Toast
    createToast(title, message, type);

    // 2. Add to Center
    addToCenter(title, message, type);
}

export function toggleNotificationCenter(forceState) {
    const nc = document.getElementById('notification-center');
    if (!nc) return;

    const isOpen = nc.classList.contains('open');
    const newState = forceState !== undefined ? forceState : !isOpen;

    if (newState) {
        nc.classList.add('open');
        bringToFront(nc);
    } else {
        nc.classList.remove('open');
    }
}

function createToast(title, message, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `pine-toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${getIcon(type)}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-msg">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    // Animate In
    requestAnimationFrame(() => toast.classList.add('show'));

    // Remove after delay
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300); // Wait for transition
    }, 4000); // 4s display
}

function addToCenter(title, message, type) {
    const list = document.querySelector('#notification-center .notif-list');
    if (!list) return;

    const item = document.createElement('div');
    item.className = 'notif-item';
    item.innerHTML = `
        <div class="notif-icon">${getIcon(type)}</div>
        <div class="notif-details">
            <div class="notif-title">${title}</div>
            <div class="notif-msg">${message}</div>
            <div class="notif-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
    `;

    // Prepend
    list.insertBefore(item, list.firstChild);
}

function clearAllNotifications() {
    const list = document.querySelector('#notification-center .notif-list');
    if (list) list.innerHTML = '';
}

function getIcon(type) {
    switch (type) {
        case 'success': return '✅';
        case 'warning': return '⚠️';
        case 'error': return '❌';
        default: return 'ℹ️';
    }
}
