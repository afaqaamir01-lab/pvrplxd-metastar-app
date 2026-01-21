/**
 * METASTAR STUDIO PRO - Main Controller
 * Features: Auth (Split Flow), Live Session Validation, Core Injection
 * & Advanced Mobile Bottom Sheet Physics (Snap-to-Mid)
 * Updated: v4.1 (Stable)
 */

// --- CONFIGURATION ---
const API_URL = "https://metastar-v2.afaqaamir01.workers.dev";
const PURCHASE_URL = "https://whop.com/pvrplxd/metastar-4-point-star-engine/"; 
const CONTACT_EMAIL = "afaqaamir01@gmail.com";

// --- STATE ---
let userEmail = "";
let resendTimer = null;
let msToken = localStorage.getItem("ms_token"); 

// --- DOM ELEMENTS ---
const els = {
    // Inputs
    emailInput: document.getElementById('email-input'),
    otpContainer: document.getElementById('otp-container'), 
    
    // Views
    views: {
        email: document.getElementById('view-email'),
        license: document.getElementById('view-license'),
        verify: document.getElementById('view-verify'),
        resume: document.getElementById('view-resume')
    },

    // Buttons
    btnCheck: document.getElementById('btn-check-license'), 
    btnSend: document.getElementById('btn-send-otp'),     
    btnVerify: document.getElementById('btn-verify'),     
    btnResend: document.getElementById('btn-resend'),
    btnBackEmail: document.getElementById('btn-back-email'),
    btnResetAuth: document.getElementById('btn-reset-auth'),
    btnPurchase: document.getElementById('btn-purchase'),
    
    // Text & Status
    statusMsg: document.getElementById('status-msg'),
    authSubtitle: document.getElementById('auth-subtitle'),
    licenseProd: document.getElementById('license-product-name'),
    licenseEmail: document.getElementById('license-email-display'),
    otpTarget: document.getElementById('otp-email-target'),
    retryCounter: document.getElementById('retry-counter'),
    licenseHeader: document.getElementById('license-msg-header'),

    // Visuals
    iconCheck: document.getElementById('icon-check'),
    iconAlert: document.getElementById('icon-alert'),
    
    // Layout
    sidebar: document.getElementById('sidebar'),
    sheetHandle: document.getElementById('sheet-handle'),
    sidebarContent: document.querySelector('.sidebar-content'),
    mainUI: document.getElementById('main-ui'),
    authLayer: document.getElementById('auth-layer')
};

// --- UI CONTROLLER ---
const UI = {
    // 1. INTRO ANIMATION
    intro: () => {
        gsap.set(".auth-container", { y: 20, opacity: 0 }); 
        gsap.to(".auth-container", { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: 0.1 });
    },

    // 2. VIEW SWITCHING
    switchView: (viewName) => {
        Object.values(els.views).forEach(el => {
            if(el) {
                el.classList.add('hidden');
                el.classList.remove('active');
            }
        });
        const target = els.views[viewName];
        if(target) {
            target.classList.remove('hidden');
            requestAnimationFrame(() => target.classList.add('active'));
        }
    },

    // 3. STATUS TOAST
    showStatus: (msg, isError = false) => {
        if(!els.statusMsg) return;
        els.statusMsg.innerText = msg;
        els.statusMsg.classList.add('visible');
        els.statusMsg.classList.toggle('error', isError);
        
        // Error Shake Effect
        if(isError) {
            gsap.fromTo(".auth-container", { x: -5 }, { x: 5, duration: 0.1, repeat: 3, yoyo: true, ease: "none", clearProps: "x" });
        }
        
        clearTimeout(UI._statusTimer);
        if(msg) UI._statusTimer = setTimeout(() => els.statusMsg.classList.remove('visible'), 4000);
    },

    // 4. LOADING STATE
    setLoading: (btn, isLoading) => {
        if(!btn) return;
        const spinner = btn.querySelector('.btn-loader');
        const textSpan = btn.querySelector('span');
        if(isLoading) { 
            btn.disabled = true; 
            if(spinner) spinner.style.display = 'block';
            if(textSpan) textSpan.style.opacity = '0';
        } else { 
            btn.disabled = false; 
            if(spinner) spinner.style.display = 'none';
            if(textSpan) textSpan.style.opacity = '1';
        }
    },

    // 5. LICENSE STATES (Active, None, Terminated)
    updateLicenseView: (state, data = {}) => {
        const { email, product } = data;
        
        // Reset Base State
        els.iconCheck.style.display = 'none';
        els.iconAlert.style.display = 'none';
        els.btnSend.style.display = 'flex';
        els.btnSend.onclick = () => requestOtp(false);
        els.btnSend.innerHTML = '<span>Verify It\'s You</span><div class="btn-loader"></div>';
        els.btnSend.style.background = 'var(--accent)';
        els.btnSend.style.color = '#000';
        els.btnSend.style.border = 'none';

        if(state === 'ACTIVE') {
            els.iconCheck.style.display = 'flex';
            els.licenseHeader.innerText = "Active License Found";
            els.licenseProd.innerText = product || "MetaStar Access";
            els.licenseEmail.innerText = email;
            if(els.authSubtitle) els.authSubtitle.innerText = "Identity Confirmation";
        } 
        else if (state === 'NONE') {
            els.iconAlert.style.display = 'flex';
            els.licenseHeader.innerText = "No License Found";
            els.licenseProd.innerText = "No Active Subscription";
            els.licenseEmail.innerText = email;
            els.btnSend.style.display = 'none'; // Can't verify if no license
        }
        else if (state === 'TERMINATED') {
            els.iconAlert.style.display = 'flex';
            els.licenseHeader.innerText = "Access Terminated";
            els.licenseProd.innerText = "License Revoked";
            els.licenseEmail.innerText = email;
            if(els.authSubtitle) els.authSubtitle.innerText = "Access Revoked";
            
            // Change Button to Contact
            els.btnSend.innerHTML = '<span>Contact Support</span>';
            els.btnSend.style.background = 'transparent';
            els.btnSend.style.border = '1px solid #333';
            els.btnSend.style.color = '#fff';
            els.btnSend.onclick = () => {
                window.location.href = `mailto:${CONTACT_EMAIL}?subject=Access Appeal&body=Email: ${email}`;
            };
        }
        UI.switchView('license');
    },

    // --- MOBILE SHEET PHYSICS (Snap-to-Mid Logic) ---
    initMobileSheet: () => {
        if (window.innerWidth > 768) return; 

        const sheet = els.sidebar;
        const handle = els.sheetHandle;
        
        // Measurements
        const vh = window.innerHeight;
        const PEEK_H = 160; 
        const MAX_H = vh - 60; // Max height (leaving space for top bar)
        
        // Calculate Snap Points (Negative Y values because we move UP)
        // Note: CSS transform sets the initial state. GSAP works relative to that or absolute.
        // We will reset CSS transform and let GSAP handle it for consistency.
        
        // Define ranges relative to the "Collapsed" state
        const minY = 0; // Collapsed (Peek only)
        const midY = -(vh * 0.45); // Snap to ~45% of screen
        const maxY = -(MAX_H - PEEK_H); // Expanded (Full height)

        gsap.set(sheet, { y: 0 }); // Ensure clean start

        Draggable.create(sheet, {
            type: "y",
            trigger: handle, // ONLY drag via handle
            inertia: true,
            bounds: { minY: maxY, maxY: 0 }, // Constrain vertical movement
            edgeResistance: 0.7,
            dragResistance: 0.2,
            
            onDragEnd: function() {
                const cur = this.y;
                let target = 0;

                // Logic: Where to snap based on release position?
                if (cur < maxY * 0.75) {
                    target = maxY; // Snap to Full
                } else if (cur < midY * 0.5) {
                    target = midY; // Snap to Mid
                } else {
                    target = 0; // Snap back to Peek
                }

                gsap.to(sheet, {
                    y: target,
                    duration: 0.6,
                    ease: "elastic.out(1, 0.8)" 
                });
            }
        });

        // CRITICAL: Stop propagation on content to prevent sheet dragging when scrolling controls
        if(els.sidebarContent) {
            els.sidebarContent.addEventListener('pointerdown', e => e.stopPropagation());
            els.sidebarContent.addEventListener('touchstart', e => e.stopPropagation(), {passive: true});
        }
    },

    // --- APP UNLOCK TRANSITION ---
    unlockApp: () => {
        const tl = gsap.timeline({
            onComplete: () => {
                loadProtectedCore();
                UI.initMobileSheet();
            }
        });

        tl.to(els.authLayer, { opacity: 0, duration: 0.5, pointerEvents: "none" })
          .set(els.authLayer, { display: "none" })
          .set(els.mainUI, { visibility: "visible", opacity: 1 })
          
          // Sidebar Slide In
          .from(els.sidebar, { 
              x: window.innerWidth > 768 ? -50 : 0, 
              y: window.innerWidth <= 768 ? 200 : 0,
              opacity: 0, duration: 0.8, ease: "power3.out" 
          }, "-=0.2")
          
          // Content Stagger
          .from(".control-row", { 
              x: -20, opacity: 0, stagger: 0.05, duration: 0.6, ease: "power2.out" 
          }, "-=0.5")
          
          // Canvas Fade
          .from("canvas", { opacity: 0, duration: 1.5 }, "-=0.8");
    }
};

// --- AUTHENTICATION FLOW ---

// 1. CHECK EMAIL
async function checkLicense() {
    const email = els.emailInput.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return UI.showStatus("Invalid email format", true);
    
    userEmail = email;
    UI.setLoading(els.btnCheck, true);
    UI.showStatus("");

    try {
        const res = await fetch(`${API_URL}/auth/check`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
        });
        const data = await res.json();

        // Handle Errors explicitly based on codes
        if (!res.ok) {
            if (data.code === "ACCESS_TERMINATED") return UI.updateLicenseView('TERMINATED', { email });
            if (data.code === "NO_SUBSCRIPTION") {
                if(els.btnPurchase) els.btnPurchase.style.display = "block";
                return UI.updateLicenseView('NONE', { email });
            }
            throw new Error(data.message || "Connection failed");
        }
        
        // Success
        UI.updateLicenseView('ACTIVE', { email, product: data.product });
        
    } catch (e) {
        UI.showStatus(e.message, true);
    } finally {
        UI.setLoading(els.btnCheck, false);
    }
}

// 2. SEND OTP
async function requestOtp(isResend = false) {
    const btn = isResend ? els.btnResend : els.btnSend;
    UI.setLoading(btn, true);
    
    try {
        const res = await fetch(`${API_URL}/auth/send`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: userEmail })
        });
        if (!res.ok) throw new Error("Failed to send code");
        
        if(!isResend) {
            UI.switchView('verify');
            if(els.otpTarget) els.otpTarget.innerText = userEmail;
            if(els.authSubtitle) els.authSubtitle.innerText = "Verification";
            setTimeout(() => els.otpContainer.querySelector('input').focus(), 500);
        }
        startResendTimer();
    } catch (e) {
        UI.showStatus(e.message, true);
    } finally {
        UI.setLoading(btn, false);
    }
}

// 3. VERIFY OTP
async function verifyOtp() {
    const inputs = els.otpContainer.querySelectorAll('input');
    let code = ''; inputs.forEach(i => code += i.value);
    
    if (code.length < 6) return UI.showStatus("Enter full 6-digit code", true);

    UI.setLoading(els.btnVerify, true);

    try {
        const res = await fetch(`${API_URL}/auth/verify`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: userEmail, code })
        });
        const data = await res.json();
        
        if (!res.ok) {
            if (data.attemptsRemaining) els.retryCounter.innerText = `${data.attemptsRemaining} attempts left`;
            throw new Error(data.message || "Invalid Code");
        }

        if (data.token) {
            msToken = data.token;
            localStorage.setItem("ms_token", msToken);
            UI.unlockApp();
        }
    } catch (e) {
        UI.showStatus(e.message, true);
        inputs.forEach(i => i.value = ''); inputs[0].focus();
    } finally {
        UI.setLoading(els.btnVerify, false);
    }
}

// --- CORE LOADER ---
function loadProtectedCore() {
    fetch(`${API_URL}/core.js`, { 
        headers: { 'Authorization': `Bearer ${msToken}` } 
    })
    .then(res => {
        if (!res.ok) throw new Error("Auth Failed");
        return res.text();
    })
    .then(scriptContent => {
        const script = document.createElement('script');
        script.textContent = scriptContent;
        document.body.appendChild(script);
    })
    .catch(e => {
        console.error(e);
        localStorage.removeItem("ms_token");
        window.location.reload();
    });
}

// --- HELPERS ---
function startResendTimer() {
    let timeLeft = 60;
    els.btnResend.style.display = "none";
    if(resendTimer) clearInterval(resendTimer);
    resendTimer = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(resendTimer);
            els.btnResend.style.display = "block"; 
        }
    }, 1000);
}

// --- EVENT BINDINGS ---
function bindEvents() {
    els.btnCheck.onclick = checkLicense;
    els.btnSend.onclick = () => requestOtp(false);
    els.btnVerify.onclick = verifyOtp;
    els.btnResend.onclick = () => requestOtp(true);
    if(els.btnPurchase) els.btnPurchase.onclick = () => window.open(PURCHASE_URL, '_blank');
    
    const goBack = () => {
        UI.switchView('email');
        if(els.authSubtitle) els.authSubtitle.innerText = "Professional Studio Access";
        if(els.btnPurchase) els.btnPurchase.style.display = "none";
    };
    els.btnBackEmail.onclick = goBack;
    els.btnResetAuth.onclick = goBack;
    els.emailInput.addEventListener('keypress', (e) => { if(e.key==='Enter') checkLicense() });

    // OTP Auto-Advance
    const otpInputs = els.otpContainer.querySelectorAll('input');
    otpInputs.forEach((input, idx) => {
        input.addEventListener('input', (e) => {
            if(e.target.value && idx < otpInputs.length - 1) otpInputs[idx+1].focus();
        });
        input.addEventListener('keydown', (e) => {
            if(e.key === 'Backspace' && !e.target.value && idx > 0) otpInputs[idx-1].focus();
            if(e.key === 'Enter') verifyOtp();
        });
    });

    // Reset
    const resetBtn = document.getElementById('btn-reset-settings');
    if(resetBtn) resetBtn.onclick = () => window.MetaStar?.reset();
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    UI.intro();
    bindEvents();
    
    // Auto-Resume Session
    if (msToken) {
        UI.switchView('resume');
        document.getElementById('resume-email').innerText = "Validating Session...";
        document.getElementById('resume-bar').style.width = "100%";
        
        fetch(`${API_URL}/auth/validate`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${msToken}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.valid) {
                document.getElementById('resume-email').innerText = data.email;
                setTimeout(UI.unlockApp, 800);
            } else {
                // If Invalid, check why (Terminated vs Expired)
                localStorage.removeItem("ms_token");
                if(data.code === "ACCESS_TERMINATED") {
                    UI.updateLicenseView('TERMINATED', { email: data.email });
                } else {
                    UI.switchView('email');
                }
            }
        })
        .catch(() => {
            localStorage.removeItem("ms_token");
            UI.switchView('email');
        });
    }
});
