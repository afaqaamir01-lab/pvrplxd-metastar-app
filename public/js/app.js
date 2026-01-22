/**
 * METASTAR STUDIO PRO - Main Controller v5.0
 * - Kinetic Auth Transitions (Height + Slide)
 * - Intelligent Error Handling (Purchase Paths)
 * - Seamless Core Injection
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
    // Inputs
    emailInput: document.getElementById('email-input'),
    otpContainer: document.getElementById('otp-container'), 
    
    // Views (Auth Stages)
    viewEmail: document.getElementById('view-email'),
    viewLicense: document.getElementById('view-license'),
    viewVerify: document.getElementById('view-verify'),
    viewResume: document.getElementById('view-resume'),
    authContainer: document.querySelector('.auth-container'),

    // Buttons
    btnCheck: document.getElementById('btn-check-license'), 
    btnSend: document.getElementById('btn-send-otp'),     
    btnVerify: document.getElementById('btn-verify'),     
    btnResend: document.getElementById('btn-resend'),
    btnBackEmail: document.getElementById('btn-back-email'),
    btnResetAuth: document.getElementById('btn-reset-auth'),
    btnBuy: document.getElementById('btn-buy-license'), // New Buy Button
    
    // UI Elements
    authLayer: document.getElementById('auth-layer'),
    coreLoader: document.getElementById('core-loader'),
    mainUI: document.getElementById('main-ui'),
    sidebar: document.getElementById('sidebar'),
    zoomVal: document.getElementById('zoomBadge'),
    
    // Status & Text
    statusMsg: document.getElementById('status-msg'),
    authSubtitle: document.getElementById('auth-subtitle'),
    
    // License Card Details
    licenseProd: document.getElementById('license-product-name'),
    licenseEmail: document.getElementById('license-email-display'),
    licenseHeader: document.getElementById('license-msg-header'),
    iconCheck: document.getElementById('icon-check'),
    iconAlert: document.getElementById('icon-alert'),
    
    // Verify Details
    otpTarget: document.getElementById('otp-email-target'),
    retryCounter: document.getElementById('retry-counter')
};

// --- UI CONTROLLER ---
const UI = {
    // 1. Kinetic View Switcher (Slide + Height Resize)
    switchView: (targetId, direction = 'forward') => {
        const currentView = document.querySelector('.auth-view.active');
        const targetView = document.getElementById(targetId);
        
        if (!targetView || currentView === targetView) return;

        // A. Measure Target Height (Invisible Render)
        targetView.style.display = 'block';
        targetView.style.visibility = 'hidden';
        targetView.style.position = 'absolute'; 
        const targetHeight = targetView.offsetHeight;
        targetView.style.position = '';
        targetView.style.visibility = '';
        targetView.style.display = 'none';

        // B. Animate Container Height
        // Add padding (32*2) + Header Height (~70) + Footer/Toast (~40)
        // Roughly: targetHeight + 140px. 
        // Better approach: Let CSS auto-height handle it, but animate specific max-height if needed.
        // For simplicity with GSAP, we often animate the container explicitly if we want perfect smoothing.
        // Here we rely on the CSS 'transition: height' we added. We just need to trigger the DOM flow change.
        
        // C. Slide Animation
        const outX = direction === 'forward' ? -20 : 20;
        const inX = direction === 'forward' ? 20 : -20;

        const tl = gsap.timeline();

        if (currentView) {
            tl.to(currentView, {
                opacity: 0,
                x: outX,
                duration: 0.2,
                ease: "power2.in",
                onComplete: () => {
                    currentView.classList.remove('active');
                    currentView.classList.add('hidden');
                    
                    // Swap DOM
                    targetView.classList.remove('hidden');
                    
                    // Trigger Height Transition (Browser handles this via CSS)
                    
                    gsap.fromTo(targetView, 
                        { opacity: 0, x: inX },
                        { opacity: 1, x: 0, duration: 0.3, ease: "power2.out", 
                          onComplete: () => targetView.classList.add('active') 
                        }
                    );
                }
            });
        } else {
            // First Load
            targetView.classList.remove('hidden');
            targetView.classList.add('active');
        }
    },

    // 2. Entrance
    intro: () => {
        if(!msToken) {
            if(els.coreLoader) els.coreLoader.classList.add('loaded'); // Lift curtain
        }
        gsap.set(".auth-container", { y: 30, opacity: 0 }); 
        gsap.to(".auth-container", { y: 0, opacity: 1, duration: 0.8, ease: "back.out(1.2)", delay: 0.2 });
    },

    // 3. License State: SUCCESS
    showLicenseCard: (productName, email) => {
        // Text
        els.licenseHeader.innerText = "Active Purchase Found";
        els.licenseProd.innerText = "MetaStar Website Access"; 
        els.licenseEmail.innerText = email;
        
        // Styling
        els.iconCheck.style.display = 'flex';
        els.iconAlert.style.display = 'none';
        els.licenseProd.classList.remove('error-text');
        els.licenseProd.classList.add('highlight');

        // Buttons
        els.btnSend.style.display = 'flex'; // Show Verify Button
        els.btnBuy.style.display = 'none';  // Hide Buy Button
        
        UI.switchView('view-license', 'forward');
    },
    
    // 4. License State: NO SUBSCRIPTION (Offer Purchase)
    showLicenseError: () => {
        // Text
        els.licenseHeader.innerText = "No Active License Found";
        els.licenseProd.innerText = "MetaStar Website Access (Required)"; 
        els.licenseEmail.innerText = userEmail;
        
        // Styling
        els.iconCheck.style.display = 'none';
        els.iconAlert.style.display = 'flex';
        els.licenseProd.classList.remove('highlight');
        
        // Buttons
        els.btnSend.style.display = 'none'; // Hide Verify
        els.btnBuy.style.display = 'flex';  // Show Buy
        els.btnBuy.querySelector('span').innerText = "Secure Access Now \u2192";
        els.btnBuy.onclick = () => window.open(PURCHASE_URL, '_blank');

        UI.switchView('view-license', 'forward');
    },

    // 5. License State: TERMINATED (Offer Renew + Support)
    showTerminatedError: (email) => {
        // Text
        els.licenseHeader.innerText = "Access Terminated";
        els.licenseProd.innerText = "License Revoked by Admin";
        els.licenseEmail.innerText = email;

        // Styling
        els.iconCheck.style.display = 'none';
        els.iconAlert.style.display = 'flex';
        
        // Buttons
        els.btnSend.style.display = 'none'; // Hide Verify
        els.btnBuy.style.display = 'flex';  // Show Buy (Renew)
        els.btnBuy.querySelector('span').innerText = "Renew / Buy Access \u2192";
        els.btnBuy.onclick = () => window.open(PURCHASE_URL, '_blank');
        
        // Add "Contact Support" as a secondary link in footer if not already there
        // Or inject a secondary button dynamically
        showStatus("Access has been revoked.", true);
        
        UI.switchView('view-license', 'forward');
    },

    shakeError: () => {
        gsap.fromTo(".auth-container", { x: -6 }, { x: 6, duration: 0.08, repeat: 3, yoyo: true, clearProps: "x" });
    },

    // 6. Transition to App
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
          .from(".fab", { scale: 0, rotation: -90, duration: 0.6, ease: "back.out(1.5)" }, "-=0.6")
          .from("canvas", { opacity: 0, duration: 1 }, "-=1");
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

    // --- UTILS: Sliders & Drag (Preserved) ---
    initSliders: () => {
        const ranges = document.querySelectorAll('input[type="range"]');
        if(!ranges.length) return;
        ranges.forEach(range => {
            const min = parseFloat(range.min), max = parseFloat(range.max);
            const numInput = range.parentElement.querySelector('input[type="number"]');
            const updateUI = (val) => { range.value = val; if(numInput) numInput.value = Math.round(val); range.dispatchEvent(new Event('input')); };
            
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
        if (window.innerWidth > 768 || !els.sidebar) return;
        const header = document.querySelector('.sidebar-header');
        const h = els.sidebar.offsetHeight, closedY = h - 80;
        
        Draggable.create(els.sidebar, {
            type: "y", trigger: header, inertia: true, edgeResistance: 0.65,
            bounds: { minY: 0, maxY: h },
            onPress: function() { this.applyBounds({ minY: 0, maxY: closedY }); },
            snap: { y: (v) => (v < closedY * 0.4) ? 0 : closedY }
        });
    },

    showResume: (email) => {
        UI.switchView('view-resume');
        const emailEl = document.getElementById('resume-email');
        if(emailEl) emailEl.innerText = email;
        const bar = document.getElementById('resume-bar');
        if(bar) requestAnimationFrame(() => bar.style.width = "100%");
    }
};

// --- API HELPERS ---
function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (msToken) headers['Authorization'] = `Bearer ${msToken}`;
    return headers;
}

// --- INIT FLOW ---
async function initApp() {
    setupOtpInteractions();
    bindEvents();
    
    // Check for existing session
    if (msToken) {
        try {
            const res = await fetch(`${API_URL}/auth/validate`, { method: 'POST', headers: getAuthHeaders() });
            const data = await res.json();
            
            if (data.valid) {
                userEmail = data.email || "User";
                UI.showResume(userEmail);
                setTimeout(unlockApp, 1200); // Allow loader bar to fill
                return;
            } else {
                localStorage.removeItem("ms_token");
                msToken = null;
                if (data.code === "ACCESS_TERMINATED") {
                    UI.intro();
                    UI.showTerminatedError(data.email);
                    return;
                }
            }
        } catch (e) { console.log("Session invalid"); }
    }
    
    UI.intro(); 
    UI.switchView('view-email');
}

// --- CORE LOADER ---
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
        setTimeout(() => UI.revealInterface(), 400); // Sync with script exec
    })
    .catch(e => {
        showStatus("Session Expired. Refreshing...", true);
        localStorage.removeItem("ms_token");
        setTimeout(() => window.location.reload(), 2000);
    });
}

// --- AUTH LOGIC ---
async function checkLicense() {
    const email = els.emailInput.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { UI.shakeError(); return showStatus("Invalid email", true); }
    
    userEmail = email;
    setLoading(els.btnCheck, true);
    
    try {
        const res = await fetch(`${API_URL}/auth/check`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ email }) 
        });
        const data = await res.json();
        
        if (!res.ok) {
            // SPECIFIC ERROR HANDLING (Redirection to Buy)
            if (res.status === 403 && data.code === "ACCESS_TERMINATED") { 
                UI.showTerminatedError(email); return; 
            }
            if (res.status === 403 && data.code === "NO_SUBSCRIPTION") { 
                UI.showLicenseError(); return; 
            }
            throw new Error(data.message || "Unknown Error");
        }
        UI.showLicenseCard(data.product, email);
    } catch (e) { 
        showStatus(e.message, true); 
        UI.shakeError(); 
    } 
    finally { setLoading(els.btnCheck, false); }
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
            UI.switchView('view-verify', 'forward'); 
            els.otpTarget.innerText = userEmail; 
        }
        startResendTimer();
    } catch (e) { showStatus(e.message, true); UI.shakeError(); } 
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
        showStatus(e.message, true); 
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
function showStatus(msg, isErr) {
    if(!els.statusMsg) return;
    els.statusMsg.innerText = msg;
    els.statusMsg.classList.add('visible');
    els.statusMsg.classList.toggle('error', isErr);
    setTimeout(() => els.statusMsg.classList.remove('visible'), 3500);
}
function setLoading(btn, load) { 
    if(!btn) return; 
    btn.classList.toggle('loading', load); btn.disabled = load;
    const l = btn.querySelector('.btn-loader'), t = btn.querySelector('span');
    if(l) l.style.display = load?'block':'none'; if(t) t.style.opacity = load?'0':'1';
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
    if(els.btnCheck) els.btnCheck.onclick = checkLicense;
    if(els.btnSend) els.btnSend.onclick = () => requestOtp(false);
    if(els.btnVerify) els.btnVerify.onclick = verifyOtp;
    if(els.btnResend) els.btnResend.onclick = () => requestOtp(true);
    if(els.btnBackEmail) els.btnBackEmail.onclick = () => UI.switchView('view-email', 'back');
    if(els.btnResetAuth) els.btnResetAuth.onclick = () => UI.switchView('view-email', 'back');
    if(els.emailInput) els.emailInput.addEventListener('keypress', (e) => { if(e.key==='Enter') checkLicense() });

    // Menu Interactions
    const expBtn = document.getElementById('btn-export-trigger'), expMenu = document.getElementById('export-menu');
    if(expBtn && expMenu) {
        document.addEventListener('click', e => { if(!expBtn.contains(e.target) && !expMenu.contains(e.target)) expMenu.style.display='none'; });
        expBtn.onclick = e => { e.stopPropagation(); expMenu.style.display = expMenu.style.display==='flex'?'none':'flex'; };
        expMenu.querySelectorAll('.menu-item').forEach(b => b.onclick = () => { window.MetaStar?.export(b.dataset.fmt); expMenu.style.display='none'; });
    }
    const rst = document.getElementById('btn-reset-settings');
    if(rst) rst.onclick = () => window.MetaStar?.reset();
}

document.addEventListener('DOMContentLoaded', initApp);
