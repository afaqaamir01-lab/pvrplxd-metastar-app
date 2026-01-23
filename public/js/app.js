/**
 * METASTAR STUDIO PRO - Main Controller v5.1
 * - Fixed Resume Animation Jitter
 * - Enhanced Mobile Drag Physics (Handle-based)
 * - Wired Zoom Controls
 * - Core Engine Injection
 */

// --- CONFIGURATION ---
const API_URL = "https://metastar-v2.afaqaamir01.workers.dev";
const PURCHASE_URL = "https://whop.com/pvrplxd/metastar-4-point-star-engine/"; 
const CONTACT_EMAIL = "afaqaamir01@gmail.com";

// --- STATE ---
let userEmail = "";
let resendTimer = null;
let msToken = localStorage.getItem("ms_token"); 

// --- DOM CACHE ---
const els = {
    // Container
    authLayer: document.getElementById('auth-layer'),
    authContainer: document.querySelector('.auth-container'),
    terminalStatus: document.getElementById('terminal-status'),

    // States
    stateIdentity: document.getElementById('state-identity'),
    stateScanning: document.getElementById('state-scanning'),
    stateSuccess: document.getElementById('state-success'),
    statePurchase: document.getElementById('state-purchase'),
    stateTerminated: document.getElementById('state-terminated'),
    stateOtp: document.getElementById('state-otp'),
    stateResume: document.getElementById('state-resume'),

    // Inputs
    emailInput: document.getElementById('email-input'),
    otpContainer: document.getElementById('otp-container'),

    // Buttons
    btnInit: document.getElementById('btn-init'),
    btnSend: document.getElementById('btn-send-otp'),
    btnVerify: document.getElementById('btn-verify'),
    btnBuy: document.getElementById('btn-buy-access'),
    btnRenew: document.getElementById('btn-renew'),
    btnResend: document.getElementById('btn-resend'),
    btnRefresh: document.getElementById('btn-refresh-license'),
    btnContact: document.getElementById('btn-contact-support'),

    // Zoom Controls
    btnZoomInc: document.getElementById('btn-zoom-inc'),
    btnZoomDec: document.getElementById('btn-zoom-dec'),

    // Feedback
    statusMsg: document.getElementById('status-msg'),
    retryCounter: document.getElementById('retry-counter'),

    // Core UI
    coreLoader: document.getElementById('core-loader'),
    mainUI: document.getElementById('main-ui'),
    sidebar: document.getElementById('sidebar'),
    zoomVal: document.getElementById('zoom-val') // Fixed ID match
};

// --- UI CONTROLLER ---
const UI = {
    // 1. Entrance
    intro: () => {
        if(!msToken) {
            if(els.coreLoader) els.coreLoader.classList.add('loaded'); // Lift black curtain
        }
        // Terminal Pop-in
        gsap.set(".auth-container", { scale: 0.9, opacity: 0 }); 
        gsap.to(".auth-container", { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.2)", delay: 0.2 });
    },

    // 2. Terminal State Switcher (Kinetic)
    switchState: (stateId, statusText = "PROCESSING...") => {
        const allStates = document.querySelectorAll('.auth-state');
        const target = document.getElementById(stateId);
        
        // Update Status Text (Only if visible)
        if(els.terminalStatus && stateId !== 'state-resume') {
            els.terminalStatus.innerText = statusText;
        }

        // Hide all others
        allStates.forEach(el => {
            if(el !== target) {
                el.classList.remove('active');
                el.classList.add('hidden');
                el.classList.remove('compact-toast'); 
            }
        });

        // Show Target
        if(target) {
            target.classList.remove('hidden');
            target.classList.add('active');
            
            // SPECIAL: Handle "Compact Toast" Mode for Resume State
            if(stateId === 'state-resume') {
                target.classList.add('compact-toast');
                els.authContainer.classList.add('compact-mode');
                
                // FIX: Immediate Snap for Resume (No Animation Jitter)
                gsap.set(els.authContainer, { height: "auto" }); 
            } else {
                target.classList.remove('compact-toast');
                els.authContainer.classList.remove('compact-mode');
                
                // Standard Kinetic Height Animation
                gsap.to(els.authContainer, { 
                    height: "auto", 
                    duration: 0.4, 
                    ease: "power2.out" 
                });
            }
            
            // Fade In Content
            gsap.fromTo(target, 
                { opacity: 0, y: 10 }, 
                { opacity: 1, y: 0, duration: 0.3, clearProps: "all" }
            );
        }
    },

    // 3. Error Feedback
    shakeError: () => {
        gsap.fromTo(".auth-container", { x: -6 }, { x: 6, duration: 0.08, repeat: 3, yoyo: true, clearProps: "x" });
    },

    showStatus: (msg, isErr) => {
        if(!els.statusMsg) return;
        els.statusMsg.innerText = msg;
        els.statusMsg.classList.add('visible');
        els.statusMsg.classList.toggle('error', isErr);
        setTimeout(() => els.statusMsg.classList.remove('visible'), 3500);
    },

    updateRetries: (remaining) => {
        if (!els.retryCounter) return;
        if(remaining === null || remaining === undefined) {
            els.retryCounter.innerText = "";
        } else {
            els.retryCounter.innerText = `${remaining} ATTEMPTS REMAINING`;
            gsap.fromTo(els.retryCounter, { color: "#fff" }, { color: "#ff4444", duration: 0.5 });
        }
    },

    // 4. TRANSITION TO APP
    prepareForCore: (onComplete) => {
        if(els.coreLoader) els.coreLoader.classList.remove('loaded'); // Drop curtain
        
        const tl = gsap.timeline({ onComplete });
        tl.to(els.authLayer, { opacity: 0, scale: 0.95, duration: 0.4 })
          .set(els.authLayer, { display: "none" })
          .set(els.mainUI, { visibility: "visible" });
    },

    revealInterface: () => {
        if(els.coreLoader) els.coreLoader.classList.add('loaded'); // Lift curtain
        
        // Staggered Entrance
        const tl = gsap.timeline();
        tl.from(els.sidebar, { x: -50, opacity: 0, duration: 0.8, ease: "power3.out" }, "+=0.2")
          .from(".control-row", { x: -10, opacity: 0, stagger: 0.03, duration: 0.5 }, "-=0.4")
          .from(".fab-container", { scale: 0, rotation: -10, duration: 0.6, ease: "back.out(1.5)" }, "-=0.6")
          .from(".credit-badge", { y: 20, opacity: 0, duration: 0.6 }, "-=0.4")
          .from("canvas", { opacity: 0, duration: 1 }, "-=1");
    },

    // --- CORE PHYSICS (SLIDERS & DRAG) ---
    initSliders: () => {
        const ranges = document.querySelectorAll('input[type="range"]');
        if(!ranges.length) return;
        ranges.forEach(range => {
            const min = parseFloat(range.min), max = parseFloat(range.max);
            const numInput = range.parentElement.querySelector('input[type="number"]');
            const updateUI = (val) => { range.value = val; if(numInput) numInput.value = Math.round(val); range.dispatchEvent(new Event('input')); };
            
            // Allow dragging specifically on the track/knob
            Draggable.create(document.createElement("div"), {
                trigger: range, type: "x", inertia: true,
                onPress: function(e) {
                    const r = range.getBoundingClientRect();
                    const val = min + ((e.clientX - r.left)/r.width) * (max - min);
                    updateUI(Math.max(min, Math.min(max, val)));
                    this.update();
                },
                onDrag: function() {
                    const r = range.getBoundingClientRect();
                    let val = parseFloat(range.value) + (this.deltaX / r.width) * (max - min);
                    updateUI(Math.max(min, Math.min(max, val)));
                }
            });
            if(numInput) numInput.addEventListener('input', () => updateUI(numInput.value));
        });
    },

    initMobileDrag: () => {
        if (window.innerWidth > 768) return;
        
        // FIX: Use the handle if available, otherwise fallback to header
        const handle = document.getElementById('sheet-handle');
        const trigger = handle ? handle.parentElement : document.querySelector('.sidebar-header');
        
        if (!els.sidebar || !trigger || typeof Draggable === 'undefined') return;

        const getSnapPoints = () => {
            const h = els.sidebar.offsetHeight;
            const closedY = h - 80; 
            const openY = 0; 
            const midY = closedY * 0.45; 
            return { openY, midY, closedY };
        };

        Draggable.create(els.sidebar, {
            type: "y",
            trigger: trigger, // Drag from header/handle only
            inertia: true,
            edgeResistance: 0.85, // Heavier resistance
            dragClickables: false, 
            dragResistance: 0.1, // Don't drag if user tries to scroll content
            bounds: { minY: 0, maxY: 1000 }, 
            onPress: function() {
                const { closedY } = getSnapPoints();
                this.applyBounds({ minY: 0, maxY: closedY });
            },
            snap: {
                y: function(value) {
                    const { openY, midY, closedY } = getSnapPoints();
                    const distToOpen = Math.abs(value - openY);
                    const distToMid = Math.abs(value - midY);
                    const distToClosed = Math.abs(value - closedY);

                    // Prioritize closing if dragged near bottom
                    if (distToClosed < 100) return closedY;
                    if (distToOpen < distToMid) return openY; 
                    return midY; 
                }
            }
        });
    }
};

// --- API HELPERS ---
function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (msToken) headers['Authorization'] = `Bearer ${msToken}`;
    return headers;
}

function setLoading(btn, load) { 
    if(!btn) return; 
    btn.classList.toggle('loading', load); btn.disabled = load;
    const l = btn.querySelector('.btn-loader'), t = btn.querySelector('span');
    if(l) l.style.display = load?'block':'none'; if(t) t.style.opacity = load?'0':'1';
}

// --- APP INIT FLOW ---
async function initApp() {
    setupOtpInteractions();
    bindEvents();
    
    // Resume Check
    if (msToken) {
        try {
            const res = await fetch(`${API_URL}/auth/validate`, { method: 'POST', headers: getAuthHeaders() });
            const data = await res.json();
            
            if (data.valid) {
                userEmail = data.email || "User";
                
                // FIX: Instant setup for resume (prevent animation flash)
                gsap.set(".auth-container", { scale: 1, opacity: 1 });
                
                // Show Resume State (Toast Mode)
                UI.switchState('state-resume', 'RESTORING SESSION');
                const emailEl = document.getElementById('resume-email');
                if(emailEl) emailEl.innerText = userEmail;
                const bar = document.getElementById('resume-bar');
                if(bar) requestAnimationFrame(() => bar.style.width = "100%");
                
                setTimeout(unlockApp, 1200);
                return;
            } else {
                localStorage.removeItem("ms_token");
                msToken = null;
                if (data.code === "ACCESS_TERMINATED") {
                    UI.intro();
                    UI.switchState('state-terminated', 'ACCESS REVOKED');
                    return;
                }
            }
        } catch (e) { console.log("Session invalid"); }
    }
    
    UI.intro(); 
    UI.switchState('state-identity', 'SYSTEM READY');
}

// --- CORE LOADING ---
function loadProtectedCore() {
    fetch(`${API_URL}/core.js`, { headers: getAuthHeaders() })
    .then(res => {
        if (!res.ok) throw new Error(res.status === 403 ? "Auth Failed" : "Core Error");
        return res.text();
    })
    .then(scriptContent => {
        const script = document.createElement('script');
        script.textContent = scriptContent;
        document.body.appendChild(script);
        setTimeout(() => UI.revealInterface(), 400); 
    })
    .catch(e => {
        UI.showStatus("Session Expired. Reloading...", true);
        localStorage.removeItem("ms_token");
        setTimeout(() => window.location.reload(), 2000);
    });
}

// --- AUTH LOGIC ---
async function checkLicense() {
    const email = els.emailInput.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { UI.shakeError(); return UI.showStatus("Invalid email", true); }
    
    userEmail = email;
    setLoading(els.btnInit, true);
    
    // Switch to Scan
    UI.switchState('state-scanning', 'CONTACTING SERVER...');
    
    try {
        const res = await fetch(`${API_URL}/auth/check`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ email }) 
        });
        const data = await res.json();
        
        if (!res.ok) {
            if (res.status === 403 && data.code === "ACCESS_TERMINATED") { 
                UI.switchState('state-terminated', 'ACCESS DENIED');
                return; 
            }
            if (res.status === 403 && data.code === "NO_SUBSCRIPTION") { 
                UI.switchState('state-purchase', 'LICENSE REQUIRED');
                return; 
            }
            throw new Error(data.message || "Unknown Error");
        }
        
        // Success
        UI.switchState('state-success', 'VERIFIED');
    } catch (e) { 
        UI.showStatus(e.message, true); 
        UI.switchState('state-identity', 'SYSTEM READY'); // Go back
        UI.shakeError(); 
    } 
    finally { setLoading(els.btnInit, false); }
}

async function requestOtp(isResend = false) {
    const btn = isResend ? els.btnResend : els.btnSend;
    setLoading(btn, true);
    try {
        const res = await fetch(`${API_URL}/auth/send`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ email: userEmail }) 
        });
        if (!res.ok) throw new Error("Could not send code");
        
        if(!isResend) { 
            UI.switchState('state-otp', 'AWAITING CODE');
        }
        startResendTimer();
    } catch (e) { UI.showStatus(e.message, true); UI.shakeError(); } 
    finally { setLoading(btn, false); }
}

async function verifyOtp() {
    const code = getOtpCode().trim(); 
    if (code.length < 6) { UI.shakeError(); return; }
    setLoading(els.btnVerify, true);
    
    try {
        const res = await fetch(`${API_URL}/auth/verify`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ email: userEmail, code }) 
        });
        const data = await res.json();
        
        if (!res.ok) { 
            UI.updateRetries(data.attemptsRemaining); 
            throw new Error(data.message); 
        }
        
        if (data.token) localStorage.setItem("ms_token", data.token);
        msToken = data.token;
        unlockApp();
        
    } catch (e) { 
        UI.showStatus(e.message, true); 
        UI.shakeError(); 
        clearOtpInputs(); 
    } finally { setLoading(els.btnVerify, false); }
}

// --- UTILITIES ---
function getOtpCode() { return Array.from(els.otpContainer.querySelectorAll('input')).map(i=>i.value).join(''); }
function clearOtpInputs() { els.otpContainer.querySelectorAll('input').forEach(i=>i.value=''); els.otpContainer.querySelector('input').focus(); }

function startResendTimer() {
    if(!els.btnResend) return;
    let t = 60; els.btnResend.style.display = "none";
    if(resendTimer) clearInterval(resendTimer);
    resendTimer = setInterval(() => { t--; if(t<=0) { clearInterval(resendTimer); els.btnResend.style.display = "block"; els.btnResend.innerText="Resend Code"; } }, 1000);
}

function unlockApp() { 
    UI.prepareForCore(() => { 
        loadProtectedCore(); 
        UI.initMobileDrag(); 
        UI.initSliders(); 
    }); 
}

function setupOtpInteractions() {
    const inputs = els.otpContainer.querySelectorAll('input');
    inputs.forEach((input, i) => {
        input.addEventListener('input', (e) => { if (e.target.value && i < inputs.length - 1) inputs[i + 1].focus(); });
        input.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !e.target.value && i > 0) inputs[i - 1].focus(); if (e.key === 'Enter') verifyOtp(); });
        input.addEventListener('paste', (e) => {
            e.preventDefault(); const d = e.clipboardData.getData('text').slice(0, 6).split('');
            d.forEach((c, idx) => { if(inputs[idx]) inputs[idx].value = c; });
            if(d.length===6) verifyOtp();
        });
    });
}

function bindEvents() {
    // Buttons
    if(els.btnInit) els.btnInit.onclick = checkLicense;
    if(els.btnSend) els.btnSend.onclick = () => requestOtp(false);
    if(els.btnVerify) els.btnVerify.onclick = verifyOtp;
    if(els.btnResend) els.btnResend.onclick = () => requestOtp(true);
    
    // Purchase / Support Actions
    if(els.btnBuy) els.btnBuy.onclick = () => window.open(PURCHASE_URL, '_blank');
    if(els.btnRenew) els.btnRenew.onclick = () => window.open(PURCHASE_URL, '_blank');
    if(els.btnRefresh) els.btnRefresh.onclick = checkLicense;
    if(els.btnContact) els.btnContact.onclick = () => window.location.href = `mailto:${CONTACT_EMAIL}`;
    
    // Zoom Controls (Pending Core Implementation)
    if(els.btnZoomInc) els.btnZoomInc.onclick = () => window.MetaStar?.zoom?.(10);
    if(els.btnZoomDec) els.btnZoomDec.onclick = () => window.MetaStar?.zoom?.(-10);

    // Back Actions (Reset to Identity)
    document.querySelectorAll('.action-back').forEach(btn => {
        btn.onclick = () => UI.switchState('state-identity', 'SYSTEM READY');
    });

    if(els.emailInput) els.emailInput.addEventListener('keypress', (e) => { if(e.key==='Enter') checkLicense() });

    // Menu Interactions
    const expBtn = document.getElementById('btn-export-trigger'), expMenu = document.getElementById('export-menu');
    if(expBtn && expMenu) {
        document.addEventListener('click', e => { if(!expBtn.contains(e.target) && !expMenu.contains(e.target)) expMenu.style.display='none'; });
        expBtn.onclick = e => { e.stopPropagation(); expMenu.style.display = expMenu.style.display==='flex'?'none':'flex'; };
        // Handle menu item clicks (works with separators too)
        expMenu.querySelectorAll('.menu-item').forEach(b => b.onclick = () => { window.MetaStar?.export(b.dataset.fmt); expMenu.style.display='none'; });
    }
    const rst = document.getElementById('btn-reset-settings');
    if(rst) rst.onclick = () => window.MetaStar?.reset();
}

document.addEventListener('DOMContentLoaded', initApp);
