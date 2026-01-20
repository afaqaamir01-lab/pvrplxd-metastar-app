/**
 * METASTAR STUDIO PRO - Main Controller
 * Handles Auth, Animations, and Core Injection
 */

// CONFIGURATION
// Replace with your actual Worker URL if different
const API_URL = "https://metastar-v2.afaqaamir01.workers.dev";

// STATE
let userEmail = "";
let resendTimer = null;

// DOM CACHE
const els = {
    emailInput: document.getElementById('email-input'),
    btnOtp: document.getElementById('btn-otp'),
    btnVerify: document.getElementById('btn-verify'),
    otpContainer: document.getElementById('otp-container'),
    otpInputs: document.querySelectorAll('.otp-digit'),
    statusMsg: document.getElementById('status-msg'),
    sidebar: document.getElementById('sidebar'),
    zoomVal: document.getElementById('zoom-val')
};

// --- UI & ANIMATION CONTROLLER (GSAP) ---
const UI = {
    // 1. Initial Entry Animation
    init: () => {
        gsap.from(".auth-container", {
            y: 40, opacity: 0, duration: 1.2, ease: "power4.out", delay: 0.2
        });
    },

    // 2. Switch Auth Views (Email <-> Verify)
    switchView: (view) => {
        const emailView = document.getElementById('view-email');
        const verifyView = document.getElementById('view-verify');
        
        if (view === 'verify') {
            gsap.to(emailView, { autoAlpha: 0, duration: 0.3, display: 'none' });
            gsap.to(verifyView, { 
                autoAlpha: 1, duration: 0.4, display: 'block', delay: 0.3,
                onComplete: () => els.otpInputs[0].focus()
            });
        } else {
            gsap.to(verifyView, { autoAlpha: 0, duration: 0.3, display: 'none' });
            gsap.to(emailView, { 
                autoAlpha: 1, duration: 0.4, display: 'block', delay: 0.3,
                onComplete: () => els.emailInput.focus()
            });
        }
    },

    // 3. Error Feedback (Shake)
    shake: (element) => {
        gsap.fromTo(element, 
            { x: -10 }, 
            { x: 10, duration: 0.1, repeat: 3, yoyo: true, clearProps: "x" }
        );
        // Flash red border
        gsap.fromTo(element, { borderColor: "#ff4444" }, { borderColor: "#333", duration: 1.5 });
    },

    // 4. Unlock Application (Grand Reveal)
    unlock: (onComplete) => {
        const tl = gsap.timeline({ onComplete });
        
        // Fade out Auth
        tl.to("#auth-layer", { opacity: 0, duration: 0.6, pointerEvents: "none" })
          .set("#auth-layer", { display: "none" })
          .set("#main-ui", { visibility: "visible" });
          
        // Animate UI In
        tl.from("#sidebar", { x: -320, opacity: 0, duration: 0.8, ease: "power3.out" }, "-=0.2")
          .from(".fab-container", { scale: 0, opacity: 0, duration: 0.4, ease: "back.out(1.7)" }, "-=0.4")
          .from(".zoom-badge", { y: -20, opacity: 0, duration: 0.4 }, "-=0.4");
    },

    // 5. Mobile Draggable Sidebar (Bottom Sheet)
    initDraggable: () => {
        if (window.innerWidth > 768) return; // Desktop uses fixed positioning

        const vh = window.innerHeight;
        // Calculate drag bounds (mostly negative Y values to slide UP)
        const openY = -(vh * 0.85); // 85% up
        
        Draggable.create(els.sidebar, {
            type: "y",
            trigger: "#sheet-handle", // Only drag from the handle
            bounds: { minY: openY, maxY: 0 },
            edgeResistance: 0.75,
            onDragEnd: function() {
                // Snap logic: If dragged past 15%, snap open. Else close.
                const threshold = openY * 0.15;
                const targetY = (this.y < threshold) ? openY : 0;
                gsap.to(this.target, { y: targetY, duration: 0.5, ease: "power3.out" });
            }
        });
    },
    
    // 6. Loading State Helper
    setLoading: (btn, isLoading) => {
        const text = btn.querySelector('span');
        const loader = btn.querySelector('.btn-loader');
        if (isLoading) {
            btn.disabled = true;
            text.style.opacity = "0";
            if(loader) loader.style.display = "block";
        } else {
            btn.disabled = false;
            text.style.opacity = "1";
            if(loader) loader.style.display = "none";
        }
    }
};

// --- AUTHENTICATION LOGIC ---

async function checkSession() {
    try {
        // Send request with credentials (cookies)
        const res = await fetch(`${API_URL}/auth/validate`, {
            method: 'POST',
            credentials: 'include' 
        });
        const data = await res.json();
        
        if (data.valid) {
            UI.unlock(() => loadCore());
            if (data.email) userEmail = data.email;
        }
    } catch (e) {
        console.log("Session check failed, please login.");
    }
}

async function requestOtp(isResend = false) {
    const email = els.emailInput.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        UI.shake(els.emailInput);
        return showStatus("Invalid email address", true);
    }
    
    userEmail = email;
    const btn = isResend ? document.getElementById('btn-resend') : els.btnOtp;
    UI.setLoading(btn, true);
    showStatus("");

    try {
        const res = await fetch(`${API_URL}/auth/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || "Failed to send code");

        // Success
        if (!isResend) UI.switchView('verify');
        startResendTimer();
        showStatus(`Code sent to ${email}`, false);

    } catch (e) {
        UI.shake(document.querySelector('.auth-container'));
        showStatus(e.message, true);
    } finally {
        UI.setLoading(btn, false);
    }
}

async function verifyOtp() {
    // Collect OTP from inputs
    let code = "";
    els.otpInputs.forEach(input => code += input.value);

    if (code.length < 6) {
        UI.shake(els.otpContainer);
        return showStatus("Enter full 6-digit code", true);
    }

    UI.setLoading(els.btnVerify, true);
    showStatus("");

    try {
        const res = await fetch(`${API_URL}/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, code }),
            credentials: 'include' // Important: Accepts the HttpOnly cookie
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || "Verification failed");

        // Success: Cookie is set by browser automatically
        UI.unlock(() => {
            loadCore();
            UI.initDraggable(); // Init mobile controls
        });

    } catch (e) {
        UI.shake(els.otpContainer);
        showStatus(e.message, true);
        // Clear inputs on error
        els.otpInputs.forEach(i => i.value = "");
        els.otpInputs[0].focus();
    } finally {
        UI.setLoading(els.btnVerify, false);
    }
}

// --- CORE ENGINE LOADER ---
function loadCore() {
    // Fetch the hidden logic using the secure cookie
    fetch(`${API_URL}/v2/core.js`, { credentials: 'include' })
        .then(res => {
            if (!res.ok) throw new Error("Access Denied");
            return res.text();
        })
        .then(scriptContent => {
            const script = document.createElement('script');
            script.textContent = scriptContent;
            document.body.appendChild(script);
            console.log("System Secured & Loaded.");
            
            // Attempt to load saved preferences
            setTimeout(loadPreferences, 500);
        })
        .catch(e => {
            console.error(e);
            showStatus("Security Error: Refresh page.", true);
        });
}

// --- PREFERENCES (Cloud Save) ---
async function savePreferences() {
    if (!window.MetaStar) return;
    const btn = document.getElementById('btn-save');
    const originalText = btn.innerText;
    btn.innerText = "SAVING...";
    
    try {
        const state = window.MetaStar.getState();
        await fetch(`${API_URL}/storage/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state),
            credentials: 'include'
        });
        btn.innerText = "SAVED!";
        btn.style.background = "#dfff00";
    } catch(e) {
        btn.innerText = "ERROR";
    }
    setTimeout(() => {
        btn.innerText = originalText;
        btn.style.background = "";
    }, 2000);
}

async function loadPreferences() {
    try {
        const res = await fetch(`${API_URL}/storage/load`, { credentials: 'include' });
        const data = await res.json();
        if (data.config && window.MetaStar) {
            window.MetaStar.importState(data.config);
        }
    } catch(e) {}
}

// --- UTILITIES ---

function showStatus(msg, isError) {
    els.statusMsg.innerText = msg;
    els.statusMsg.className = `status-toast visible ${isError ? 'error' : ''}`;
}

function startResendTimer() {
    const btn = document.getElementById('btn-resend');
    let timeLeft = 60;
    btn.disabled = true;
    
    if (resendTimer) clearInterval(resendTimer);
    resendTimer = setInterval(() => {
        timeLeft--;
        btn.innerText = `Resend in ${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(resendTimer);
            btn.innerText = "Resend Code";
            btn.disabled = false;
        }
    }, 1000);
}

// --- INITIALIZATION & EVENTS ---
function initApp() {
    UI.init();
    checkSession();

    // 1. Auth Events
    els.btnOtp.onclick = () => requestOtp(false);
    els.btnVerify.onclick = verifyOtp;
    
    // Enter Key Logic
    els.emailInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') requestOtp(false); });

    // 2. Smart OTP Inputs
    els.otpInputs.forEach((input, index) => {
        // Allow only numbers
        input.addEventListener('input', (e) => {
            if (e.target.value.length > 1) e.target.value = e.target.value.slice(0, 1); // Clamp length
            if (e.target.value.length === 1 && index < 5) els.otpInputs[index + 1].focus();
        });
        
        // Backspace navigation
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                els.otpInputs[index - 1].focus();
            }
            if (e.key === 'Enter' && index === 5) verifyOtp();
        });
    });

    // 3. Navigation
    document.getElementById('btn-back').onclick = () => UI.switchView('email');
    document.getElementById('btn-resend').onclick = () => requestOtp(true);

    // 4. App Toolbar Events
    document.getElementById('btn-save').onclick = savePreferences;
    document.getElementById('btn-reset').onclick = () => window.MetaStar?.reset();
    
    // Export Menu Toggle
    const exportBtn = document.getElementById('btn-export-trigger');
    const exportMenu = document.getElementById('export-menu');
    let menuOpen = false;

    exportBtn.onclick = (e) => {
        e.stopPropagation();
        menuOpen = !menuOpen;
        exportMenu.style.display = menuOpen ? 'flex' : 'none';
    };

    document.addEventListener('click', (e) => {
        if(menuOpen && !exportMenu.contains(e.target)) {
            menuOpen = false;
            exportMenu.style.display = 'none';
        }
    });

    // Handle Export Clicks
    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.onclick = () => {
            window.MetaStar?.export(btn.dataset.fmt);
            menuOpen = false;
            exportMenu.style.display = 'none';
        };
    });
}

// Start
document.addEventListener('DOMContentLoaded', initApp);
