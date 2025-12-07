/* =========================================================
   WIDGETS ENGINE
   Clock and Calendar
========================================================= */

import { bringToFront } from './windowManager.js';

export function initWidgets() {
    // 1. Container Injection
    const desktop = document.getElementById('desktop');
    if (!desktop || document.getElementById('desktop-widgets-container')) return;

    const container = document.createElement('div');
    container.id = 'desktop-widgets-container';
    desktop.appendChild(container);

    // 2. HTML
    const clockHTML = `
        <div class="pine-widget-header"></div>
        <div class="clock-time">00:00</div>
        <div class="clock-date">Mon, 01 Jan</div>
    `;

    const calendarHTML = `
        <div class="pine-widget-header"></div>
        <div class="calendar-header">Month Year</div>
        <div class="calendar-grid">
            <div class="cal-day-name">Su</div><div class="cal-day-name">Mo</div><div class="cal-day-name">Tu</div>
            <div class="cal-day-name">We</div><div class="cal-day-name">Th</div><div class="cal-day-name">Fr</div><div class="cal-day-name">Sa</div>
        </div>
    `;

    function createWidget(id, html, x, y) {
        const widget = document.createElement('div');
        widget.id = id;
        widget.className = 'pine-widget';
        widget.style.left = x + 'px';
        widget.style.top = y + 'px';
        widget.innerHTML = html;
        container.appendChild(widget);
        return widget;
    }

    const clockWidget = createWidget('widget-clock', clockHTML, window.innerWidth - 160, 20);
    const calendarWidget = createWidget('widget-calendar', calendarHTML, window.innerWidth - 220, 110);

    // 4. Clock Logic
    function updateClock() {
        const now = new Date();
        const timeEl = clockWidget.querySelector('.clock-time');
        const dateEl = clockWidget.querySelector('.clock-date');

        if (timeEl) timeEl.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (dateEl) dateEl.innerText = now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
    }
    setInterval(updateClock, 1000);
    updateClock();

    // 5. Calendar Logic
    function renderCalendar() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();

        const header = calendarWidget.querySelector('.calendar-header');
        header.innerText = now.toLocaleDateString([], { month: 'long', year: 'numeric' });

        const grid = calendarWidget.querySelector('.calendar-grid');
        // Clear old days (keep headers - first 7 children)
        while (grid.children.length > 7) {
            grid.removeChild(grid.lastChild);
        }

        // Empty slots
        for (let i = 0; i < startingDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'cal-day empty';
            grid.appendChild(empty);
        }

        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            const day = document.createElement('div');
            day.classList.add('cal-day');
            day.innerText = i;
            if (i === now.getDate()) day.classList.add('today');
            grid.appendChild(day);
        }
    }
    renderCalendar();

    // 6. Drag Logic
    let zIndex = 100; // Local zIndex tracking for widgets

    function initDrag(widget) {
        const header = widget.querySelector('.pine-widget-header');
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        header.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            isDragging = true;
            header.setPointerCapture(e.pointerId);

            startX = e.clientX;
            startY = e.clientY;
            initialLeft = widget.offsetLeft;
            initialTop = widget.offsetTop;

            zIndex++;
            widget.style.zIndex = zIndex;
            widget.style.cursor = 'grabbing';
        });

        header.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            widget.style.left = (initialLeft + dx) + 'px';
            widget.style.top = (initialTop + dy) + 'px';
        });

        header.addEventListener('pointerup', (e) => {
            if (!isDragging) return;
            isDragging = false;
            header.releasePointerCapture(e.pointerId);
            widget.style.cursor = 'grab';
        });
    }

    initDrag(clockWidget);
    initDrag(calendarWidget);
}
