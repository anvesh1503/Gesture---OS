/* =========================================================
   UTILS MODULE
   Shared helper functions
========================================================= */

export function elementAt(x, y) {
    return document.elementFromPoint(x, y);
}

export function getDistance(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

export function toScreenCoords(lm, margin = 0.15) {
    // 1. Mirror X
    let x = 1 - lm.x;
    let y = lm.y;

    // 2. Apply Margin (Zoom)
    // Map [MARGIN, 1-MARGIN] -> [0, 1]
    let x_mapped = (x - margin) / (1 - 2 * margin);
    let y_mapped = (y - margin) / (1 - 2 * margin);

    // 3. Clamp
    x_mapped = Math.max(0, Math.min(1, x_mapped));
    y_mapped = Math.max(0, Math.min(1, y_mapped));

    return {
        x: x_mapped * window.innerWidth,
        y: y_mapped * window.innerHeight
    };
}
