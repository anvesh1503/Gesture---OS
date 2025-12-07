export function elementAt(x, y) {
    return document.elementFromPoint(x, y);
}

export function range(start, end) {
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}
