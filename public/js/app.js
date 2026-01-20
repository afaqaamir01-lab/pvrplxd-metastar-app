/**
 * METASTAR STUDIO PRO - Main Controller
 * Handles Auth, Animations, and Core Injection
 * Updated: v2.1 (Fixes Paths & Auth Headers)
 */

// CONFIGURATION
const API_URL = "https://metastar-v2.afaqaamir01.workers.dev";

// STATE
let userEmail = "";
let resendTimer = null;
let msToken = null; // Memory Fallback for Auth

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
        gsap.set(".auth-container", { autoAlpha: 1 }); // Ensure visibility
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
        // Flash red border if supported
        if(element.style) {
            gsap.fromTo(element, { borderColor: "#ff4444" }, { borderColor: "#333", duration: 1.5 });
        }
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

        // Use visualViewport height for better accuracy on mobile browsers
        const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const openY = -(vh * 0.80); // 80% up
        
        Draggable.create(els.sidebar, {
            type: "y",
            trigger: "#sheet-handle", 
            bounds: { minY: openY, maxY: 0 },
            edgeResistance: 0.8,
            inertia: true, // Requires InertiaPlugin, falls back gracefully if missing
            onDrag: function() {
                // Dim background based on drag percentage? (Optional enhancement)
            },
            onDragEnd: function() {
                // Snap logic: If dragged past 15% of open height, snap open
                const threshold = openY * 0.15;
                const isOpening = this.y < threshold;
                
                if (isOpening) {
                    gsap.to(this.target, { y: openY, duration: 0.5, ease: "power3.out" });
                    this.target.classList.add('open');
                } else {
                    gsap.to(this.target, { y: 0, duration: 0.5, ease: "power3.out" });
                    this.target.classList.remove('open');
                }
            }
        });
    },
    
    // 6. Loading State Helper
    setLoading: (btn, isLoading) => {
        const text = btn.querySelector('span');
        const loader = btn.querySelector('.btn-loader');
        if (isLoading) {
            btn.disabled = true;
            if(text) text.style.opacity = "0";
            if(loader) loader.style.display = "block";
        } else {
            btn.disabled = false;
            if(text) text.style.opacity = "1";
            if(loader) loader.style.display = "none";
        }
    }
};

// --- AUTHENTICATION LOGIC ---

// Helper: Get Headers (Robust Auth)
function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    // Always attach Bearer token if we have it, as a backup for Cookies
    if (msToken) headers['Authorization'] = `Bearer ${msToken}`;
    return headers;
}

async function checkSession() {
    try {
        // Send request with credentials (cookies)
        const res = await fetch(`${API_URL}/auth/validate`, {
            method: 'POST',
            credentials: 'include',
            headers: getAuthHeaders() // Include token if we recovered it from storage
        });
        
        // Handle non-JSON responses (like 404/500 text errors) gracefully
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Server communication error");
        }

        const data = await res.json();
        
        if (data.valid) {
            if (data.email) userEmail = data.email;
            UI.unlock(() => loadCore());
        } else {
            console.log("Session invalid, waiting for login.");
        }
    } catch (e) {
        console.warn("Session check skipped:", e.message);
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

        if (!res.ok) {
            // Handle Rate Limits specifically
            if(res.status === 429) throw new Error(data.message || "Too many attempts. Wait a bit.");
            throw new Error(data.message || "Failed to send code");
        }

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

        if (!res.ok) {
            if(data.attemptsRemaining !== undefined) {
                 throw new Error(`${data.message}. attempts left: ${data.attemptsRemaining}`);
            }
            throw new Error(data.message || "Verification failed");
        }

        // Success: 
        // 1. Browser sets Cookie automatically (Primary)
        // 2. We capture Token as fallback (Secondary)
        if (data.token) {
            msToken = data.token;
            // Optional: Persist token to sessionStorage for refresh survival (if cookies fail)
            try { sessionStorage.setItem('ms_backup_token', data.token); } catch(e){}
        }

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
    // Check for backup token if msToken is empty (page refresh scenario)
    if (!msToken) {
        try { msToken = sessionStorage.getItem('ms_backup_token'); } catch(e){}
    }

    const headers = getAuthHeaders();
    
    // UPDATED PATH: fetching from root /core.js as per R2 structure
    fetch(`${API_URL}/core.js`, { 
        headers: headers,
        credentials: 'include' 
    })
    .then(res => {
        if (res.status === 401 || res.status === 403) throw new Error("Unauthorized Access");
        if (res.status === 404) throw new Error("Core Engine Not Found (404)");
        if (!res.ok) throw new Error(`System Error (${res.status})`);
        return res.text();
    })
    .then(scriptContent => {
        const script = document.createElement('script');
        script.textContent = scriptContent;
        document.body.appendChild(script);
        console.log("%c MetaStar System Secured & Loaded.", "color: #dfff00");
        
        // Attempt to load saved preferences after engine injects
        setTimeout(loadPreferences, 500);
    })
    .catch(e => {
        console.error(e);
        showStatus(`Load Error: ${e.message}`, true);
        // Re-show auth if unauthorized
        if(e.message.includes("Unauthorized")) {
             // reload page to clear stale state
             setTimeout(() => window.location.reload(), 2000);
        }
    });
}

// --- PREFERENCES (Cloud Save) ---
async function savePreferences() {
    if (!window.MetaStar) return;
    const btn = document.getElementById('btn-save');
    const originalText = btn.innerText;
    
    // UI Feedback
    btn.innerText = "SAVING...";
    btn.style.opacity = "0.7";
    
    try {
        const state = window.MetaStar.getState();
        const headers = getAuthHeaders();
        
        const res = await fetch(`${API_URL}/storage/save`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(state),
            credentials: 'include'
        });
        
        if(!res.ok) throw new Error("Save failed");

        btn.innerText = "SAVED!";
        btn.style.backgroundColor = "#dfff00";
        btn.style.color = "#000";
    } catch(e) {
        console.error(e);
        btn.innerText = "ERROR";
        btn.style.backgroundColor = "#ff4444";
    }
    
    setTimeout(() => {
        btn.innerText = originalText;
        btn.style.backgroundColor = "";
        btn.style.color = "";
        btn.style.opacity = "1";
    }, 2000);
}

async function loadPreferences() {
    try {
        const headers = getAuthHeaders();
        const res = await fetch(`${API_URL}/storage/load`, { 
            headers: headers,
            credentials: 'include' 
        });
        if(!res.ok) return; // Silent fail on new accounts
        
        const data = await res.json();
        if (data.config && window.MetaStar) {
            window.MetaStar.importState(data.config);
            showStatus("Preferences loaded", false);
            setTimeout(() => showStatus("", false), 2000);
        }
    } catch(e) {
        console.log("No preferences found or load error.");
    }
}

// --- UTILITIES ---

function showStatus(msg, isError) {
    if(!els.statusMsg) return;
    els.statusMsg.innerText = msg;
    els.statusMsg.className = `status-toast visible ${isError ? 'error' : ''}`;
}

function startResendTimer() {
    const btn = document.getElementById('btn-resend');
    if(!btn) return;
    
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
    checkSession(); // Auto-login check

    // 1. Auth Events
    if(els.btnOtp) els.btnOtp.onclick = () => requestOtp(false);
    if(els.btnVerify) els.btnVerify.onclick = verifyOtp;
    
    // Enter Key Logic
    if(els.emailInput) {
        els.emailInput.addEventListener('keypress', (e) => { 
            if(e.key === 'Enter') requestOtp(false); 
        });
    }

    // 2. Smart OTP Inputs
    if(els.otpInputs) {
        els.otpInputs.forEach((input, index) => {
            // Allow only numbers
            input.addEventListener('input', (e) => {
                // Remove non-numeric chars
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
                
                if (e.target.value.length > 1) e.target.value = e.target.value.slice(0, 1);
                
                // Auto-advance
                if (e.target.value.length === 1 && index < 5) {
                    els.otpInputs[index + 1].focus();
                }
            });
            
            // Backspace navigation
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && index > 0) {
                    els.otpInputs[index - 1].focus();
                }
                if (e.key === 'Enter' && index === 5) verifyOtp();
            });
            
            // Paste support
            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
                if (!paste) return;
                
                const digits = paste.split('').slice(0, 6);
                digits.forEach((d, i) => {
                    if (els.otpInputs[i]) els.otpInputs[i].value = d;
                });
                
                // Focus last filled or next empty
                const nextFocus = Math.min(digits.length, 5);
                els.otpInputs[nextFocus].focus();
                
                if (digits.length === 6) verifyOtp();
            });
        });
    }

    // 3. Navigation
    const btnBack = document.getElementById('btn-back');
    const btnResend = document.getElementById('btn-resend');
    if(btnBack) btnBack.onclick = () => UI.switchView('email');
    if(btnResend) btnResend.onclick = () => requestOtp(true);

    // 4. App Toolbar Events
    const btnSave = document.getElementById('btn-save');
    const btnReset = document.getElementById('btn-reset');
    if(btnSave) btnSave.onclick = savePreferences;
    if(btnReset) btnReset.onclick = () => window.MetaStar?.reset();
    
    // Export Menu Toggle
    const exportBtn = document.getElementById('btn-export-trigger');
    const exportMenu = document.getElementById('export-menu');
    let menuOpen = false;

    if(exportBtn && exportMenu) {
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
}

// Start
document.addEventListener('DOMContentLoaded', initApp);
