/* =========================================================
   WIDGETS ENGINE
   Handles Desktop Widgets (Clock, Calendar) and App Logic (Calculator).
   ========================================================= */

export function initWidgets() {
    const desktop = document.getElementById('desktop');
    if (!desktop || document.getElementById('desktop-widgets-container')) return;

    const container = document.createElement('div');
    container.id = 'desktop-widgets-container';
    desktop.appendChild(container);

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

    // Clock Logic
    function updateClock() {
        const now = new Date();
        const timeEl = clockWidget.querySelector('.clock-time');
        const dateEl = clockWidget.querySelector('.clock-date');
        if (timeEl) timeEl.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (dateEl) dateEl.innerText = now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
    }
    setInterval(updateClock, 1000);
    updateClock();

    // Calendar Logic
    function renderCalendar() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();

        const header = calendarWidget.querySelector('.calendar-header');
        if (header) header.innerText = now.toLocaleDateString([], { month: 'long', year: 'numeric' });

        const grid = calendarWidget.querySelector('.calendar-grid');
        if (!grid) return;

        // Clear old days but keep headers
        const dayNames = grid.querySelectorAll('.cal-day-name');
        grid.innerHTML = '';
        dayNames.forEach(d => grid.appendChild(d));

        for (let i = 0; i < startingDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'cal-day empty';
            grid.appendChild(empty);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const day = document.createElement('div');
            day.classList.add('cal-day');
            day.innerText = i;
            if (i === now.getDate()) day.classList.add('today');
            day.addEventListener('click', () => {
                day.style.transform = 'scale(0.9)';
                setTimeout(() => day.style.transform = 'scale(1)', 100);
            });
            grid.appendChild(day);
        }
    }
    renderCalendar();

    // Widget Dragging
    let zIndex = 100;
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

    initCalculator();
}

// Calculator Logic
function initCalculator() {
    // We attach logic to the window which might not be visible yet, but exists in DOM
    setTimeout(() => {
        const calcWin = document.getElementById('win-calculator');
        if (!calcWin) return;
        const display = calcWin.querySelector('.calc-display');
        const buttons = calcWin.querySelectorAll('button');

        let expression = '';
        let lastWasOperator = false;

        buttons.forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const val = btn.innerText;

                if (val === 'C') {
                    expression = '';
                    display.innerText = '0';
                    lastWasOperator = false;
                } else if (val === '=') {
                    try {
                        if (expression && !lastWasOperator) {
                            // Evaluate the expression
                            // eslint-disable-next-line
                            const result = new Function('return ' + expression)();
                            const final = parseFloat(result.toFixed(8));
                            display.innerText = final;
                            expression = String(final);
                            lastWasOperator = false;
                        }
                    } catch (e) {
                        display.innerText = 'Error';
                        expression = '';
                        lastWasOperator = false;
                    }
                } else {
                    // Reset if there was an error
                    if (display.innerText === 'Error') {
                        expression = '';
                        lastWasOperator = false;
                    }

                    // Check if it's an operator
                    const isOperator = ['+', '-', '*', '/'].includes(val);

                    // Prevent multiple consecutive operators
                    if (isOperator && lastWasOperator) {
                        // Replace the last operator with the new one
                        expression = expression.slice(0, -1) + val;
                    } else if (isOperator && expression === '') {
                        // Don't allow starting with an operator (except minus for negative numbers)
                        if (val === '-') {
                            expression += val;
                            lastWasOperator = true;
                        }
                        return;
                    } else {
                        expression += val;
                        lastWasOperator = isOperator;
                    }

                    display.innerText = expression;
                }
            };
        });
    }, 500);
}

