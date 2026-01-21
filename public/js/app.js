/**
 * METASTAR STUDIO PRO - Main Controller
 * Handles Auth (Split Flow), Animations, and Core Injection
 * Updated: v3.0 (Fixed Session Resume & License Check)
 */

// --- CONFIGURATION ---
const API_URL = "https://metastar-v2.afaqaamir01.workers.dev";
const PURCHASE_URL = "https://whop.com/pvrplxd/metastar-4-point-star-engine/"; 

// --- STATE ---
let userEmail = "";
let resendTimer = null;
let msToken = localStorage.getItem("ms_token"); // Persist session

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
    btnCheck: document.getElementById('btn-check-license'), // Step 1
    btnSend: document.getElementById('btn-send-otp'),     // Step 2
    btnVerify: document.getElementById('btn-verify'),     // Step 3
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
    zoomVal: document.getElementById('zoomBadge')
};

// --- UI & ANIMATION CONTROLLER (GSAP) ---
const UI = {
    // 1. Intro Animation
    intro: () => {
        gsap.set(".auth-card", { y: 30, opacity: 0 }); 
        gsap.to(".auth-card", { 
            y: 0, opacity: 1, duration: 1, ease: "power4.out", delay: 0.2 
        });
    },

    // 2. View Switcher (The Core Transition Logic)
    switchView: (viewId) => {
        const views = [els.viewEmail, els.viewLicense, els.viewVerify, els.viewResume];
        const target = document.getElementById(viewId);

        // Hide all others
        views.forEach(v => {
            if(v && v !== target) {
                v.classList.add('hidden');
                v.classList.remove('active');
            }
        });

        // Show Target
        if(target) {
            target.classList.remove('hidden');
            // Small delay to allow 'display:none' to clear before opacity fade
            requestAnimationFrame(() => {
                target.classList.add('active');
            });
        }
    },

    // 3. License Card Animation
    showLicenseCard: (productName, email) => {
        if(els.licenseProd) els.licenseProd.innerText = productName;
        if(els.licenseEmail) els.licenseEmail.innerText = email;
        
        // Reset Icons
        document.getElementById('icon-check').style.display = 'flex';
        document.getElementById('icon-alert').style.display = 'none';
        document.getElementById('license-msg-header').innerText = "Active License Found";
        
        UI.switchView('view-license');
    },
    
    // 4. Show License Error
    showLicenseError: () => {
        UI.switchView('view-license');
        document.getElementById('icon-check').style.display = 'none';
        document.getElementById('icon-alert').style.display = 'flex';
        document.getElementById('license-msg-header').innerText = "No License Found";
        if(els.licenseProd) els.licenseProd.innerText = "No Active Subscription";
        if(els.licenseEmail) els.licenseEmail.innerText = userEmail;
        
        // Hide "Verify" button, show "Purchase" or "Back" logic
        els.btnSend.style.display = 'none';
    },

    // 5. Error Shake
    shakeError: () => {
        gsap.fromTo(".auth-container", 
            { x: -5 }, 
            { x: 5, duration: 0.1, repeat: 3, yoyo: true, ease: "none", clearProps: "x" }
        );
    },

    // 6. Unlock Transition (The Grand Reveal)
    unlockTransition: (onComplete) => {
        const tl = gsap.timeline({ onComplete });
        
        tl.to("#auth-layer", { opacity: 0, duration: 0.5, pointerEvents: "none" })
          .set("#auth-layer", { display: "none" })
          .set("#main-ui", { visibility: "visible" })
          .from("#sidebar", { x: -340, opacity: 0, duration: 0.8, ease: "power3.out" }, "-=0.2")
          .from(".control-row", { x: -20, opacity: 0, stagger: 0.05, duration: 0.6, ease: "power2.out" }, "-=0.6")
          .from("canvas", { opacity: 0, duration: 1 }, "-=0.8");
    },

    // 7. Update Retry Counter
    updateRetries: (remaining) => {
        if (!els.retryCounter) return;
        if(remaining === null || remaining === undefined) {
            els.retryCounter.innerText = "";
        } else {
            els.retryCounter.innerText = `${remaining} ATTEMPTS REMAINING`;
            if(remaining < 2) {
                gsap.fromTo(els.retryCounter, { scale: 1.1 }, { scale: 1, duration: 0.2 });
            }
        }
    },

    // 8. Mobile Drag Logic (Sidebar)
    initMobileDrag: () => {
        if (window.innerWidth > 768) return;
        const sidebar = document.getElementById('sidebar');
        const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const OPEN_Y = -(vh - 80); 

        if (typeof Draggable !== 'undefined') {
            Draggable.create(sidebar, {
                type: "y",
                trigger: "#sheet-handle",
                bounds: { minY: OPEN_Y, maxY: 0 },
                inertia: true, 
                edgeResistance: 0.8,
                onDragEnd: function() {
                    const y = this.y;
                    gsap.to(this.target, { y: (y < OPEN_Y * 0.25) ? OPEN_Y : 0, duration: 0.5, ease: "power3.out" });
                }
            });
        }
    },

    // 9. Show Resume State
    showResume: (email) => {
        UI.switchView('view-resume');
        const emailEl = document.getElementById('resume-email');
        const bar = document.getElementById('resume-bar');
        
        if(emailEl) emailEl.innerText = email;
        if(bar) {
            requestAnimationFrame(() => {
                bar.style.width = "100%";
            });
        }
    }
};

// --- HELPER: AUTH HEADERS ---
function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    // CRITICAL FIX: Always prefer the stored token over cookies
    if (msToken) headers['Authorization'] = `Bearer ${msToken}`;
    return headers;
}

// --- APP INITIALIZATION ---
async function initApp() {
    UI.intro();
    setupOtpInteractions();
    bindEvents();

    // 1. Health Check
    try {
        const health = await fetch(`${API_URL}/health`); 
        const status = await health.json();
        if(status.maintenance) return showStatus("Maintenance Mode", true);
    } catch(e) {}

    // 2. Auto-Login (Check Session)
    if (msToken) {
        try {
            const res = await fetch(`${API_URL}/auth/validate`, {
                method: 'POST',
                headers: getAuthHeaders() // Uses msToken
            });
            const data = await res.json();
            
            if (data.valid) {
                userEmail = data.email || "User";
                UI.showResume(userEmail);
                setTimeout(unlockApp, 1500); 
                return;
            } else {
                // Token invalid, clear it
                localStorage.removeItem("ms_token");
                msToken = null;
            }
        } catch (e) {
            console.log("Session check failed.");
        }
    }
    
    // Default: Show Email Input
    UI.switchView('view-email');
}

// --- STEP 1: CHECK LICENSE ---
async function checkLicense() {
    const email = els.emailInput.value.trim();
    
    // Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { 
        UI.shakeError(); 
        return showStatus("Invalid email format", true); 
    }
    
    userEmail = email;
    setLoading(els.btnCheck, true);
    showStatus("");
    
    // Hide Purchase Link initially
    if(els.btnPurchase) els.btnPurchase.style.display = "none";

    try {
        const res = await fetch(`${API_URL}/auth/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (!res.ok) {
            if (res.status === 403 && data.code === "NO_SUBSCRIPTION") {
                // Handle No License UI
                if(els.btnPurchase) els.btnPurchase.style.display = "block";
                UI.showLicenseError();
                throw new Error("No active license found.");
            }
            throw new Error(data.message || "Connection failed");
        }
        
        // Success: Show License Card
        UI.showLicenseCard(data.product, email);
        if(els.authSubtitle) els.authSubtitle.innerText = "Identity Confirmation";
        
    } catch (e) {
        showStatus(e.message, true);
        UI.shakeError();
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
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || "Failed to send code");
        
        // Success
        if(!isResend) {
            UI.switchView('view-verify');
            if(els.otpTarget) els.otpTarget.innerText = userEmail;
             // Focus first OTP digit
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
    let code = '';
    inputs.forEach(input => code += input.value);
    return code;
}

function clearOtpInputs() {
    const inputs = els.otpContainer.querySelectorAll('.otp-digit');
    inputs.forEach(input => input.value = '');
    inputs[0].focus();
}

async function verifyOtp() {
    const code = getOtpCode().trim(); 
    if (code.length < 6) { UI.shakeError(); return showStatus("Enter full 6-digit code", true); }

    setLoading(els.btnVerify, true);
    showStatus("");

    try {
        const res = await fetch(`${API_URL}/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, code })
        });
        const data = await res.json();

        if (!res.ok) {
            if (data.attemptsRemaining !== undefined) {
                UI.updateRetries(data.attemptsRemaining);
            }
            throw new Error(data.message || "Verification failed");
        }

        // Success - Store Token in LocalStorage (FIX FOR SESSION RESUME)
        if (data.token) {
            msToken = data.token;
            localStorage.setItem("ms_token", msToken);
        }

        unlockApp();

    } catch (e) {
        showStatus(e.message, true);
        UI.shakeError();
        clearOtpInputs();
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
            if (val.length === 1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
            if (e.key === 'Enter') verifyOtp();
        });

        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasteData = e.clipboardData.getData('text').slice(0, 6).split('');
            pasteData.forEach((char, i) => {
                if (inputs[i]) inputs[i].value = char;
            });
            if (inputs[pasteData.length - 1]) inputs[pasteData.length - 1].focus();
            if (pasteData.length === 6) verifyOtp();
        });
    });
}

// --- TIMERS ---
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

// --- CORE LOADER (THE VAULT) ---
function unlockApp() {
    UI.unlockTransition(() => {
        loadProtectedCore();
        UI.initMobileDrag();
    });
}

function loadProtectedCore() {
    // This fetches the "Hidden" core.js using the stored token
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
        // If auth failed, clear token to prevent loop
        if(e.message === "Auth Failed") {
            localStorage.removeItem("ms_token");
            setTimeout(() => window.location.reload(), 2000);
        }
    });
}

// --- EVENT BINDING ---
function bindEvents() {
    if(els.btnCheck) els.btnCheck.onclick = checkLicense;
    if(els.btnSend) els.btnSend.onclick = () => requestOtp(false);
    if(els.btnVerify) els.btnVerify.onclick = verifyOtp;
    if(els.btnResend) els.btnResend.onclick = () => requestOtp(true);
    if(els.btnPurchase) els.btnPurchase.onclick = () => window.open(PURCHASE_URL, '_blank');

    // Back Buttons
    const goBack = () => {
        UI.switchView('view-email');
        if(els.authSubtitle) els.authSubtitle.innerText = "Professional Studio Access";
        showStatus("");
        if(els.btnSend) els.btnSend.style.display = "flex"; // Reset send button visibility
    };

    if(els.btnBackEmail) els.btnBackEmail.onclick = goBack;
    if(els.btnResetAuth) els.btnResetAuth.onclick = goBack;
    
    if(els.emailInput) els.emailInput.addEventListener('keypress', (e) => { if(e.key==='Enter') checkLicense() });

    const resetSetBtn = document.getElementById('btn-reset-settings');
    if(resetSetBtn) resetSetBtn.onclick = () => window.MetaStar?.reset();

    // Export Logic
    const exportBtn = document.getElementById('btn-export-trigger');
    const exportMenu = document.getElementById('export-menu');
    let isExportOpen = false;
    
    if(exportBtn && exportMenu) {
        document.addEventListener('click', (e) => {
            if (!exportBtn.contains(e.target) && !exportMenu.contains(e.target) && isExportOpen) {
                exportMenu.style.display = 'none'; 
                isExportOpen = false;
            }
        });

        exportBtn.onclick = (e) => {
            e.stopPropagation();
            isExportOpen = !isExportOpen;
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

// --- HELPERS ---
function setLoading(btn, isLoading) {
    if(!btn) return;
    const spinner = btn.querySelector('.btn-loader');
    const textSpan = btn.querySelector('span');
    
    if(isLoading) { 
        btn.classList.add('loading'); 
        btn.disabled = true; 
        if(spinner) spinner.style.display = 'block';
        if(textSpan) textSpan.style.opacity = '0';
    } else { 
        btn.classList.remove('loading'); 
        btn.disabled = false; 
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
