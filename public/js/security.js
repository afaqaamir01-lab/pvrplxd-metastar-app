/**
 * METASTAR SECURITY LAYER
 * Prevents casual inspection and theft of UI assets.
 * Note: Real security is handled by the Worker (Server-Side).
 */

// 1. Disable Right-Click Context Menu
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
});

// 2. Disable Keyboard Shortcuts (F12, Ctrl+Shift+I, Ctrl+U, etc.)
document.addEventListener('keydown', (e) => {
    // F12 (DevTools)
    if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        return false;
    }

    // Ctrl+Shift+I (Inspect)
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
        e.preventDefault();
        return false;
    }

    // Ctrl+Shift+C (Inspect Element)
    if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        return false;
    }

    // Ctrl+Shift+J (Console)
    if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) {
        e.preventDefault();
        return false;
    }

    // Ctrl+U (View Source)
    if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
        return false;
    }
});

// 3. Console Warning for anyone who forces it open
console.log("%cSTOP!", "color: red; font-size: 50px; font-weight: bold; -webkit-text-stroke: 1px black;");
console.log("%cThis is a restricted area.", "font-size: 20px; font-weight: bold;");
console.log("%cAccess to this application's core logic is protected by server-side verification.", "font-size: 14px;");
