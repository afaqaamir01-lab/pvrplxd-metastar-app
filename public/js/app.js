/**
 * METASTAR STUDIO PRO - Main Controller v4.5
 * - Handles Auth & Core Loading (Transitions)
 * - Mobile Sheet Physics (Snap & Throw)
 * - Precision Slider Inertia
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

    // Buttons
    btnCheck: document.getElementById('btn-check-license'), 
    btnSend: document.getElementById('btn-send-otp'),     
    btnVerify: document.getElementById('btn-verify'),     
    btnResend: document.getElementById('btn-resend'),
    btnBackEmail: document.getElementById('btn-back-email'),
    btnResetAuth: document.getElementById('btn-reset-auth'),
    btnPurchase: document.getElementById('btn-purchase'),
    
    // UI Elements
    authLayer: document.getElementById('auth-layer'),
    coreLoader: document.getElementById('core-loader'),
    mainUI: document.getElementById('main-ui'),
    sidebar: document.getElementById('sidebar'),
    zoomVal: document.getElementById('zoomBadge'),
    
    // Status & Text
    statusMsg: document.getElementById('status-msg'),
    authSubtitle: document.getElementById('auth-subtitle'),
    licenseProd: document.getElementById('license-product-name'),
    licenseEmail: document.getElementById('license-email-display'),
    otpTarget: document.getElementById('otp-email-target'),
    retryCounter: document.getElementById('retry-counter'),
    
    // Icons
    iconCheck: document.getElementById('icon-check'),
    iconAlert: document.getElementById('icon-alert'),
    licenseHeader: document.getElementById('license-msg-header')
};

// --- UI CONTROLLER ---
const UI = {
    // 1. Entrance Animation (Shows Auth, Hides Loader if needed)
    intro: () => {
        // If we are showing auth, hide the core loader immediately
        if(!msToken) {
            if(els.coreLoader) els.coreLoader.classList.add('loaded');
        }
        
        gsap.set(".auth-container", { y: 30, opacity: 0 }); 
        gsap.to(".auth-container", { y: 0, opacity: 1, duration: 1, ease: "power4.out", delay: 0.2 });
    },

    // 2. View Switcher
    switchView: (viewId) => {
        const views = [els.viewEmail, els.viewLicense, els.viewVerify, els.viewResume];
        const target = document.getElementById(viewId);

        views.forEach(v => {
            if(v && v !== target) {
                v.classList.add('hidden');
                v.classList.remove('active');
            }
        });

        if(target) {
            target.classList.remove('hidden');
            requestAnimationFrame(() => target.classList.add('active'));
        }
    },

    // 3. License States
    showLicenseCard: (productName, email) => {
        if(els.licenseProd) els.licenseProd.innerText = "MetaStar Website Access"; 
        if(els.licenseEmail) els.licenseEmail.innerText = email;
        
        els.iconCheck.style.display = 'flex';
        els.iconAlert.style.display = 'none';
        els.licenseHeader.innerText = "Active License Found";
        
        els.btnSend.style.display = 'flex';
        els.btnSend.className = 'primary-btn';
        els.btnSend.innerHTML = '<span>Verify It\'s You</span><div class="btn-loader"></div>';
        
        els.btnSend.onclick = () => requestOtp(false); 
        UI.switchView('view-license');
    },
    
    showLicenseError: () => {
        UI.switchView('view-license');
        els.iconCheck.style.display = 'none';
        els.iconAlert.style.display = 'flex';
        els.licenseHeader.innerText = "No License Found";
        
        if(els.licenseProd) els.licenseProd.innerText = "No Active Subscription";
        if(els.licenseEmail) els.licenseEmail.innerText = userEmail;
        els.btnSend.style.display = 'none';
    },

    showTerminatedError: (email) => {
        UI.switchView('view-license');
        if(els.authSubtitle) els.authSubtitle.innerText = "Access Revoked";
        
        els.iconCheck.style.display = 'none';
        els.iconAlert.style.display = 'flex';
        els.licenseHeader.innerText = "Access Terminated";
        if(els.licenseEmail) els.licenseEmail.innerText = email;

        els.btnSend.style.display = 'flex';
        els.btnSend.style.background = '#222'; 
        els.btnSend.style.border = '1px solid #333';
        els.btnSend.style.color = '#fff';
        els.btnSend.innerHTML = '<span>Contact Support</span>';
        
        els.btnSend.onclick = () => {
            window.location.href = `mailto:${CONTACT_EMAIL}?subject=Termination Appeal&body=Email: ${email}`;
        };
        showStatus("Admin has terminated your access.", true);
    },

    shakeError: () => {
        gsap.fromTo(".auth-container", { x: -5 }, { x: 5, duration: 0.1, repeat: 3, yoyo: true, ease: "none", clearProps: "x" });
    },

    // 4. TRANSITION PHASE 1: Hide Auth & Prep Loader
    prepareForCore: (onComplete) => {
        // Ensure loader is visible (removed 'loaded' class) to act as curtain
        if(els.coreLoader) els.coreLoader.classList.remove('loaded');
        
        const tl = gsap.timeline({ onComplete });
        
        // Fade out auth layer
        tl.to(els.authLayer, { opacity: 0, duration: 0.5, pointerEvents: "none" })
          .set(els.authLayer, { display: "none" })
          .set(els.mainUI, { visibility: "visible" });
    },

    // 5. TRANSITION PHASE 2: Reveal Interface (Called after Core loads)
    revealInterface: () => {
        // 1. Fade out the black curtain (Core Loader)
        if(els.coreLoader) els.coreLoader.classList.add('loaded');

        // 2. Animate elements in
        const tl = gsap.timeline();
        
        tl.from(els.sidebar, { 
            x: -40, 
            opacity: 0, 
            duration: 1, 
            ease: "power3.out",
            delay: 0.4 // Wait for loader fade
        })
        .from(".control-row", { 
            x: -20, 
            opacity: 0, 
            stagger: 0.04, 
            duration: 0.6, 
            ease: "power2.out" 
        }, "-=0.6")
        .from(".fab", { scale: 0, duration: 0.4, ease: "back.out(1.7)" }, "-=0.8")
        .from("canvas", { opacity: 0, duration: 1.2 }, "-=1.0");
    },

    updateRetries: (remaining) => {
        if (!els.retryCounter) return;
        if(remaining === null || remaining === undefined) {
            els.retryCounter.innerText = "";
        } else {
            els.retryCounter.innerText = `${remaining} ATTEMPTS REMAINING`;
            if(remaining < 2) gsap.fromTo(els.retryCounter, { scale: 1.1 }, { scale: 1, duration: 0.2 });
        }
    },

    // --- 6. SLIDER PHYSICS ---
    initSliders: () => {
        const ranges = document.querySelectorAll('input[type="range"]');
        if(!ranges.length) return;

        ranges.forEach(range => {
            const min = parseFloat(range.min);
            const max = parseFloat(range.max);
            const numInput = range.parentElement.querySelector('input[type="number"]');

            const updateUI = (val) => {
                range.value = val;
                if(numInput) numInput.value = val;
                range.dispatchEvent(new Event('input', { bubbles: true }));
            };

            const tracker = { x: 0 }; 
            
            Draggable.create(document.createElement("div"), {
                trigger: range,
                type: "x",
                inertia: true,
                onPress: function(e) {
                    const rect = range.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const pct = Math.max(0, Math.min(1, clickX / rect.width));
                    const val = min + pct * (max - min);
                    tracker.x = val; 
                    updateUI(val);
                    this.update(); 
                },
                onDrag: function() {
                    const rect = range.getBoundingClientRect();
                    const valueRange = max - min;
                    const deltaVal = (this.deltaX / rect.width) * valueRange;
                    let newVal = parseFloat(range.value) + deltaVal;
                    newVal = Math.max(min, Math.min(max, newVal));
                    tracker.x = newVal;
                    updateUI(newVal);
                }
            });
            
            if(numInput) {
                numInput.addEventListener('input', () => {
                    let v = parseFloat(numInput.value);
                    if(!isNaN(v)) {
                        v = Math.max(min, Math.min(max, v));
                        range.value = v;
                        range.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                });
            }
        });
    },

    // --- 7. MOBILE SHEET PHYSICS ---
    initMobileDrag: () => {
        if (window.innerWidth > 768) return;
        const header = document.querySelector('.sidebar-header');
        if (!els.sidebar || !header || typeof Draggable === 'undefined') return;

        const getSnapPoints = () => {
            const h = els.sidebar.offsetHeight;
            const closedY = h - 80; 
            const openY = 0; 
            const midY = closedY * 0.45; 
            return { openY, midY, closedY };
        };

        Draggable.create(els.sidebar, {
            type: "y",
            trigger: header,
            inertia: true,
            edgeResistance: 0.65,
            dragClickables: false, 
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

                    if (distToOpen < distToMid && distToOpen < distToClosed) return openY; 
                    if (distToMid < distToClosed) return midY; 
                    return closedY; 
                }
            }
        });
    },

    showResume: (email) => {
        UI.switchView('view-resume');
        const emailEl = document.getElementById('resume-email');
        const bar = document.getElementById('resume-bar');
        if(emailEl) emailEl.innerText = email;
        if(bar) requestAnimationFrame(() => bar.style.width = "100%");
    }
};

// --- HELPER: HEADERS ---
function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (msToken) headers['Authorization'] = `Bearer ${msToken}`;
    return headers;
}

// --- APP INITIALIZATION ---
async function initApp() {
    setupOtpInteractions();
    bindEvents();
    
    // 1. Resume Check
    if (msToken) {
        // Keep Loader Visible (Don't run UI.intro yet)
        try {
            const res = await fetch(`${API_URL}/auth/validate`, {
                method: 'POST',
                headers: getAuthHeaders() 
            });
            const data = await res.json();
            
            if (data.valid) {
                userEmail = data.email || "User";
                UI.showResume(userEmail);
                // Transition to app
                setTimeout(unlockApp, 1000); 
                return;
            } else {
                localStorage.removeItem("ms_token");
                msToken = null;
                if (data.code === "ACCESS_TERMINATED") {
                    UI.intro(); // Hide loader, show auth
                    UI.showTerminatedError(data.email || "");
                    return;
                }
            }
        } catch (e) { console.log("Session check failed."); }
    }
    
    // 2. No Session -> Standard Entrance
    UI.intro(); 
    UI.switchView('view-email');
}

// --- CORE LOADER (Protected) ---
function loadProtectedCore() {
    const headers = getAuthHeaders();
    
    fetch(`${API_URL}/core.js`, { headers: headers })
    .then(res => {
        if (res.status === 401 || res.status === 403) throw new Error("Auth Failed");
        if (res.status === 404) throw new Error("Core Engine Not Found");
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.text();
    })
    .then(scriptContent => {
        const script = document.createElement('script');
        script.textContent = scriptContent;
        document.body.appendChild(script);
        console.log("Core Engine Injected.");
        
        // --- THE KEY CHANGE: REVEAL INTERFACE ---
        // Give slight buffer for script execution
        setTimeout(() => {
            UI.revealInterface(); 
        }, 500);
    })
    .catch(e => {
        console.error("Core Load Failed:", e);
        showStatus(`System Error: ${e.message}`, true);
        if(e.message === "Auth Failed") {
            localStorage.removeItem("ms_token");
            setTimeout(() => window.location.reload(), 2000);
        }
    });
}

// --- AUTH FUNCTIONS ---
async function checkLicense() {
    const email = els.emailInput.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { 
        UI.shakeError(); 
        return showStatus("Invalid email format", true); 
    }
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
            if (res.status === 403 && data.code === "ACCESS_TERMINATED") { 
                UI.showTerminatedError(email); throw new Error("Terminated"); 
            }
            if (res.status === 403 && data.code === "NO_SUBSCRIPTION") { 
                els.btnPurchase.style.display = "block"; 
                UI.showLicenseError(); throw new Error("No License"); 
            }
            throw new Error(data.message);
        }
        UI.showLicenseCard(data.product, email);
    } catch (e) { 
        if(e.message!=="Terminated" && e.message!=="No License") { 
            showStatus(e.message, true); UI.shakeError(); 
        } 
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
        if (!res.ok) throw new Error("Failed to send code");
        if(!isResend) { UI.switchView('view-verify'); els.otpTarget.innerText = userEmail; }
        startResendTimer();
    } catch (e) { showStatus(e.message, true); UI.shakeError(); } finally { setLoading(btn, false); }
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
        if (data.token) { msToken = data.token; localStorage.setItem("ms_token", msToken); }
        
        unlockApp();
    } catch (e) { 
        showStatus(e.message, true); UI.shakeError(); clearOtpInputs(); 
    } finally { setLoading(els.btnVerify, false); }
}

// --- UTILS ---
function getOtpCode() { let c=''; els.otpContainer.querySelectorAll('input').forEach(i=>c+=i.value); return c; }
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
    setTimeout(() => els.statusMsg.classList.remove('visible'), 3000);
}
function setLoading(btn, load) { 
    if(!btn) return; 
    btn.classList.toggle('loading', load); btn.disabled = load;
    const s = btn.querySelector('.btn-loader'), t = btn.querySelector('span');
    if(s) s.style.display = load?'block':'none'; if(t) t.style.opacity = load?'0':'1';
}
function setupOtpInteractions() {
    const inputs = els.otpContainer.querySelectorAll('input');
    inputs.forEach((input, i) => {
        input.addEventListener('input', (e) => { if (e.target.value.length === 1 && i < inputs.length - 1) inputs[i + 1].focus(); });
        input.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !e.target.value && i > 0) inputs[i - 1].focus(); if (e.key === 'Enter') verifyOtp(); });
        input.addEventListener('paste', (e) => {
            e.preventDefault(); const data = e.clipboardData.getData('text').slice(0, 6).split('');
            data.forEach((c, idx) => { if(inputs[idx]) inputs[idx].value = c; }); verifyOtp();
        });
    });
}
function bindEvents() {
    if(els.btnCheck) els.btnCheck.onclick = checkLicense;
    if(els.btnSend) els.btnSend.onclick = () => requestOtp(false);
    if(els.btnVerify) els.btnVerify.onclick = verifyOtp;
    if(els.btnResend) els.btnResend.onclick = () => requestOtp(true);
    if(els.btnPurchase) els.btnPurchase.onclick = () => window.open(PURCHASE_URL, '_blank');
    if(els.btnBackEmail) els.btnBackEmail.onclick = () => UI.switchView('view-email');
    if(els.btnResetAuth) els.btnResetAuth.onclick = () => UI.switchView('view-email');
    if(els.emailInput) els.emailInput.addEventListener('keypress', (e) => { if(e.key==='Enter') checkLicense() });
    
    // Export Menu
    const expBtn = document.getElementById('btn-export-trigger'), expMenu = document.getElementById('export-menu');
    if(expBtn && expMenu) {
        document.addEventListener('click', e => { if(!expBtn.contains(e.target) && !expMenu.contains(e.target)) expMenu.style.display='none'; });
        expBtn.onclick = e => { e.stopPropagation(); expMenu.style.display = expMenu.style.display==='flex'?'none':'flex'; };
        expMenu.querySelectorAll('.menu-item').forEach(b => b.onclick = () => { window.MetaStar?.export(b.dataset.fmt); expMenu.style.display='none'; });
    }
    
    // Reset Settings
    const rst = document.getElementById('btn-reset-settings');
    if(rst) rst.onclick = () => window.MetaStar?.reset();
}

document.addEventListener('DOMContentLoaded', initApp);
