/**
 * METASTAR STUDIO PRO - Main Controller
 * Handles Auth (Split Flow), Animations, and Core Injection
 * Updated: v3.3 (Final: Live Session Check + Termination Logic + Cleanup)
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
    
    // Status & Text
    statusMsg: document.getElementById('status-msg'),
    authSubtitle: document.getElementById('auth-subtitle'),
    licenseProd: document.getElementById('license-product-name'),
    licenseEmail: document.getElementById('license-email-display'),
    otpTarget: document.getElementById('otp-email-target'),
    retryCounter: document.getElementById('retry-counter'),
    
    // UI Extras
    sidebar: document.getElementById('sidebar'),
    zoomVal: document.getElementById('zoomBadge'),

    // Icons (Dynamic)
    iconCheck: document.getElementById('icon-check'),
    iconAlert: document.getElementById('icon-alert'),
    licenseHeader: document.getElementById('license-msg-header')
};

// --- UI & ANIMATION CONTROLLER ---
const UI = {
    intro: () => {
        gsap.set(".auth-card", { y: 30, opacity: 0 }); 
        gsap.to(".auth-card", { y: 0, opacity: 1, duration: 1, ease: "power4.out", delay: 0.2 });
    },

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

    // 3. SHOW ACTIVE LICENSE (Standard Flow)
    showLicenseCard: (productName, email) => {
        if(els.licenseProd) els.licenseProd.innerText = "MetaStar Website Access"; // Hardcoded as requested
        if(els.licenseEmail) els.licenseEmail.innerText = email;
        
        // Success State Visuals
        els.iconCheck.style.display = 'flex';
        els.iconAlert.style.display = 'none';
        els.licenseHeader.innerText = "Active License Found";
        
        // Reset Button to "Verify" Mode
        els.btnSend.style.display = 'flex';
        els.btnSend.style.background = 'var(--accent)';
        els.btnSend.style.color = '#000';
        els.btnSend.style.border = 'none';
        els.btnSend.innerHTML = '<span>Verify It\'s You</span><div class="btn-loader"></div>';
        
        // IMPORTANT: Restore the correct handler for verification
        els.btnSend.onclick = () => requestOtp(false); 
        
        UI.switchView('view-license');
    },
    
    // 4. SHOW NO LICENSE ERROR
    showLicenseError: () => {
        UI.switchView('view-license');
        els.iconCheck.style.display = 'none';
        els.iconAlert.style.display = 'flex';
        els.licenseHeader.innerText = "No License Found";
        
        if(els.licenseProd) els.licenseProd.innerText = "No Active Subscription";
        if(els.licenseEmail) els.licenseEmail.innerText = userEmail;
        
        els.btnSend.style.display = 'none';
    },

    // 5. SHOW TERMINATED ERROR (New Request)
    showTerminatedError: (email) => {
        UI.switchView('view-license');
        if(els.authSubtitle) els.authSubtitle.innerText = "Access Revoked";
        
        // Visuals
        els.iconCheck.style.display = 'none';
        els.iconAlert.style.display = 'flex';
        els.licenseHeader.innerText = "Access Terminated";
        
        if(els.licenseProd) els.licenseProd.innerText = "MetaStar Website Access";
        if(els.licenseEmail) els.licenseEmail.innerText = email;

        // Transform Button to "Contact Support"
        els.btnSend.style.display = 'flex';
        els.btnSend.style.background = 'var(--bg-app)'; 
        els.btnSend.style.border = '1px solid #333';
        els.btnSend.style.color = '#fff';
        els.btnSend.innerHTML = '<span>Contact Support to Resolve</span>';
        
        // Bind Contact Action
        els.btnSend.onclick = () => {
            window.location.href = `mailto:${CONTACT_EMAIL}?subject=Access Termination Appeal&body=My email is ${email}. I believe my access was revoked in error.`;
        };
        
        showStatus("Admin has terminated your access.", true);
    },

    shakeError: () => {
        gsap.fromTo(".auth-container", { x: -5 }, { x: 5, duration: 0.1, repeat: 3, yoyo: true, ease: "none", clearProps: "x" });
    },

    unlockTransition: (onComplete) => {
        const tl = gsap.timeline({ onComplete });
        tl.to("#auth-layer", { opacity: 0, duration: 0.5, pointerEvents: "none" })
          .set("#auth-layer", { display: "none" })
          .set("#main-ui", { visibility: "visible" })
          .from("#sidebar", { x: -340, opacity: 0, duration: 0.8, ease: "power3.out" }, "-=0.2")
          .from(".control-row", { x: -20, opacity: 0, stagger: 0.05, duration: 0.6, ease: "power2.out" }, "-=0.6")
          .from("canvas", { opacity: 0, duration: 1 }, "-=0.8");
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

    initMobileDrag: () => {
        if (window.innerWidth > 768) return;
        const sidebar = document.getElementById('sidebar');
        const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const OPEN_Y = -(vh - 80); 
        if (typeof Draggable !== 'undefined') {
            Draggable.create(sidebar, {
                type: "y", trigger: "#sheet-handle", bounds: { minY: OPEN_Y, maxY: 0 }, inertia: true, edgeResistance: 0.8,
                onDragEnd: function() {
                    const y = this.y;
                    gsap.to(this.target, { y: (y < OPEN_Y * 0.25) ? OPEN_Y : 0, duration: 0.5, ease: "power3.out" });
                }
            });
        }
    },

    showResume: (email) => {
        UI.switchView('view-resume');
        const emailEl = document.getElementById('resume-email');
        const bar = document.getElementById('resume-bar');
        if(emailEl) emailEl.innerText = email;
        if(bar) requestAnimationFrame(() => bar.style.width = "100%");
    }
};

// --- HELPER: AUTH HEADERS ---
function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (msToken) headers['Authorization'] = `Bearer ${msToken}`;
    return headers;
}

// --- APP INITIALIZATION ---
async function initApp() {
    UI.intro();
    setupOtpInteractions();
    bindEvents();
    
    // Auto-hide the SAVE button if it exists in HTML (Cleanup)
    const oldSaveBtn = document.getElementById('btn-save');
    if(oldSaveBtn) oldSaveBtn.style.display = 'none';

    try {
        const health = await fetch(`${API_URL}/health`); 
        const status = await health.json();
        if(status.maintenance) return showStatus("Maintenance Mode", true);
    } catch(e) {}

    // RESUME SESSION (Live Logic)
    if (msToken) {
        try {
            const res = await fetch(`${API_URL}/auth/validate`, {
                method: 'POST',
                headers: getAuthHeaders() 
            });
            const data = await res.json();
            
            if (data.valid) {
                // Session Valid + License Active
                userEmail = data.email || "User";
                UI.showResume(userEmail);
                setTimeout(unlockApp, 1500); 
                return;
            } else {
                // Token Invalid OR Access Terminated
                localStorage.removeItem("ms_token");
                msToken = null;
                
                // CRITICAL: Check if rejection was due to Termination
                if (data.code === "ACCESS_TERMINATED") {
                    userEmail = data.email || ""; 
                    UI.showTerminatedError(userEmail);
                    return; // Stop here, show the error
                }
                
                // Otherwise (Expired/Invalid), just reset to login
            }
        } catch (e) { console.log("Session check failed."); }
    }
    
    // Default: Show Email Input
    UI.switchView('view-email');
}

// --- STEP 1: CHECK LICENSE ---
async function checkLicense() {
    const email = els.emailInput.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { UI.shakeError(); return showStatus("Invalid email format", true); }
    
    userEmail = email;
    setLoading(els.btnCheck, true);
    showStatus("");
    if(els.btnPurchase) els.btnPurchase.style.display = "none";

    try {
        const res = await fetch(`${API_URL}/auth/check`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (!res.ok) {
            // Case 1: Terminated
            if (res.status === 403 && data.code === "ACCESS_TERMINATED") {
                UI.showTerminatedError(email);
                throw new Error("Access has been terminated."); // Stop flow
            }
            // Case 2: No Subscription
            if (res.status === 403 && data.code === "NO_SUBSCRIPTION") {
                if(els.btnPurchase) els.btnPurchase.style.display = "block";
                UI.showLicenseError();
                throw new Error("No active license found.");
            }
            throw new Error(data.message || "Connection failed");
        }
        
        // Success
        UI.showLicenseCard(data.product, email);
        if(els.authSubtitle) els.authSubtitle.innerText = "Identity Confirmation";
        
    } catch (e) {
        // Prevent double-alerting if we handled it via UI
        if (e.message !== "Access has been terminated." && e.message !== "No active license found.") {
            showStatus(e.message, true);
            UI.shakeError();
        }
    } finally {
        setLoading(els.btnCheck, false);
    }
}

// --- STEP 2: SEND OTP ---
async function requestOtp(isResend = false) {
    const btn = isResend ? els.btnResend : els.btnSend;
    setLoading(btn, true);
    showStatus("");

    try {
        const res = await fetch(`${API_URL}/auth/send`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: userEmail })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to send code");
        
        if(!isResend) {
            UI.switchView('view-verify');
            if(els.otpTarget) els.otpTarget.innerText = userEmail;
             setTimeout(() => {
                const firstDigit = els.otpContainer.querySelector('.otp-digit');
                if(firstDigit) firstDigit.focus();
            }, 400);
        }
        
        if(els.authSubtitle) els.authSubtitle.innerText = "Verification";
        startResendTimer();
        UI.updateRetries(null);
        
    } catch (e) {
        showStatus(e.message, true);
        UI.shakeError();
    } finally {
        setLoading(btn, false);
    }
}

// --- STEP 3: VERIFY OTP ---
function getOtpCode() {
    const inputs = els.otpContainer.querySelectorAll('.otp-digit');
    let code = ''; inputs.forEach(input => code += input.value); return code;
}

function clearOtpInputs() {
    const inputs = els.otpContainer.querySelectorAll('.otp-digit');
    inputs.forEach(input => input.value = ''); inputs[0].focus();
}

async function verifyOtp() {
    const code = getOtpCode().trim(); 
    if (code.length < 6) { UI.shakeError(); return showStatus("Enter full 6-digit code", true); }

    setLoading(els.btnVerify, true);
    showStatus("");

    try {
        const res = await fetch(`${API_URL}/auth/verify`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: userEmail, code })
        });
        const data = await res.json();
        if (!res.ok) {
            if (data.attemptsRemaining !== undefined) UI.updateRetries(data.attemptsRemaining);
            throw new Error(data.message || "Verification failed");
        }

        if (data.token) {
            msToken = data.token;
            localStorage.setItem("ms_token", msToken);
        }
        unlockApp();

    } catch (e) {
        showStatus(e.message, true); UI.shakeError(); clearOtpInputs();
    } finally {
        setLoading(els.btnVerify, false);
    }
}

// --- OTP INPUT LOGIC ---
function setupOtpInteractions() {
    const inputs = els.otpContainer.querySelectorAll('.otp-digit');
    inputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            if (val.length === 1 && index < inputs.length - 1) inputs[index + 1].focus();
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) inputs[index - 1].focus();
            if (e.key === 'Enter') verifyOtp();
        });
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasteData = e.clipboardData.getData('text').slice(0, 6).split('');
            pasteData.forEach((char, i) => { if (inputs[i]) inputs[i].value = char; });
            if (inputs[pasteData.length - 1]) inputs[pasteData.length - 1].focus();
            if (pasteData.length === 6) verifyOtp();
        });
    });
}

function startResendTimer() {
    if(!els.btnResend) return;
    let timeLeft = 60;
    els.btnResend.style.display = "none";
    els.btnResend.innerText = `Wait ${timeLeft}s`;
    if(resendTimer) clearInterval(resendTimer);
    resendTimer = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(resendTimer);
            els.btnResend.style.display = "block"; 
            els.btnResend.innerText = "Resend Code";
        }
    }, 1000);
}

function unlockApp() {
    UI.unlockTransition(() => { loadProtectedCore(); UI.initMobileDrag(); });
}

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
        console.log("System Unlocked.");
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

function bindEvents() {
    if(els.btnCheck) els.btnCheck.onclick = checkLicense;
    if(els.btnSend) els.btnSend.onclick = () => requestOtp(false);
    if(els.btnVerify) els.btnVerify.onclick = verifyOtp;
    if(els.btnResend) els.btnResend.onclick = () => requestOtp(true);
    if(els.btnPurchase) els.btnPurchase.onclick = () => window.open(PURCHASE_URL, '_blank');
    
    const goBack = () => {
        UI.switchView('view-email');
        if(els.authSubtitle) els.authSubtitle.innerText = "Professional Studio Access";
        showStatus("");
        
        // Reset Contact Button to Standard Verify Button
        if(els.btnSend) {
            els.btnSend.style.display = "flex"; 
            els.btnSend.style.background = 'var(--accent)';
            els.btnSend.style.border = 'none';
            els.btnSend.style.color = '#000';
            els.btnSend.innerHTML = '<span>Verify It\'s You</span><div class="btn-loader"></div>';
            els.btnSend.onclick = () => requestOtp(false);
        }
    };
    
    if(els.btnBackEmail) els.btnBackEmail.onclick = goBack;
    if(els.btnResetAuth) els.btnResetAuth.onclick = goBack;
    
    if(els.emailInput) els.emailInput.addEventListener('keypress', (e) => { if(e.key==='Enter') checkLicense() });
    
    const resetSetBtn = document.getElementById('btn-reset-settings');
    if(resetSetBtn) resetSetBtn.onclick = () => window.MetaStar?.reset();
    
    // Export Menu Logic
    const exportBtn = document.getElementById('btn-export-trigger');
    const exportMenu = document.getElementById('export-menu');
    let isExportOpen = false;
    
    if(exportBtn && exportMenu) {
        document.addEventListener('click', (e) => {
            if (!exportBtn.contains(e.target) && !exportMenu.contains(e.target) && isExportOpen) {
                exportMenu.style.display = 'none'; isExportOpen = false;
            }
        });
        exportBtn.onclick = (e) => {
            e.stopPropagation(); isExportOpen = !isExportOpen;
            exportMenu.style.display = isExportOpen ? 'flex' : 'none';
        };
        exportMenu.querySelectorAll('.menu-item').forEach(btn => {
            btn.onclick = () => {
                if(window.MetaStar?.export) {
                    window.MetaStar.export(btn.dataset.fmt);
                    exportMenu.style.display = 'none'; isExportOpen = false;
                }
            };
        });
    }
}

function setLoading(btn, isLoading) {
    if(!btn) return;
    const spinner = btn.querySelector('.btn-loader');
    const textSpan = btn.querySelector('span');
    if(isLoading) { 
        btn.classList.add('loading'); btn.disabled = true; 
        if(spinner) spinner.style.display = 'block';
        if(textSpan) textSpan.style.opacity = '0';
    } else { 
        btn.classList.remove('loading'); btn.disabled = false; 
        if(spinner) spinner.style.display = 'none';
        if(textSpan) textSpan.style.opacity = '1';
    }
}

function showStatus(msg, isError) {
    if(!els.statusMsg) return;
    els.statusMsg.innerText = msg;
    els.statusMsg.classList.add('visible');
    els.statusMsg.classList.toggle('error', isError); 
}

// Start
document.addEventListener('DOMContentLoaded', initApp);
