/**
 * METASTAR STUDIO PRO - Main Controller
 * Handles Auth, Animations, and Core Injection
 * Updated: v2.3 (Fixed OTP Collection & Input Logic)
 */

// --- CONFIGURATION ---
const API_URL = "https://metastar-v2.afaqaamir01.workers.dev";
const PURCHASE_URL = "https://whop.com/pvrplxd/metastar-4-point-star-engine/"; 

// --- STATE ---
let userEmail = "";
let resendTimer = null;
let msToken = null; // Hybrid Auth Token (Memory Fallback)

// --- DOM ELEMENTS ---
const els = {
    emailInput: document.getElementById('email-input'),
    // FIXED: Removed single codeInput, we now reference the container
    otpContainer: document.getElementById('otp-container'), 
    btnOtp: document.getElementById('btn-otp'),
    btnVerify: document.getElementById('btn-verify'),
    statusMsg: document.getElementById('status-msg'),
    exportPop: document.getElementById('export-pop'),
    authSubtitle: document.getElementById('auth-subtitle'),
    
    // UI Extras
    btnPurchase: document.getElementById('btn-purchase'),
    btnResend: document.getElementById('btn-resend'),
    retryCounter: document.getElementById('retry-counter'),
    
    // Sidebar
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

    // 2. Slide Logic (Email <-> Code)
    slideAuth: (toVerify = true) => {
        // Simple visibility toggle since specific ID sliders aren't in your HTML
        const viewEmail = document.getElementById('view-email');
        const viewVerify = document.getElementById('view-verify');

        if (toVerify) {
            // Hide Email View
            viewEmail.classList.add('hidden');
            viewEmail.classList.remove('active');
            
            // Show Verify View
            viewVerify.classList.remove('hidden');
            viewVerify.classList.add('active');
            
            // Focus first OTP digit
            setTimeout(() => {
                const firstDigit = els.otpContainer.querySelector('.otp-digit');
                if(firstDigit) firstDigit.focus();
            }, 400);
        } else {
            // Show Email View
            viewEmail.classList.remove('hidden');
            viewEmail.classList.add('active');
            
            // Hide Verify View
            viewVerify.classList.add('hidden');
            viewVerify.classList.remove('active');
        }
    },

    // 3. Error Shake
    shakeError: () => {
        gsap.fromTo(".auth-container", 
            { x: -5 }, 
            { x: 5, duration: 0.1, repeat: 3, yoyo: true, ease: "none", clearProps: "x" }
        );
    },

    // 4. Unlock Transition (The Grand Reveal)
    unlockTransition: (onComplete) => {
        const tl = gsap.timeline({ onComplete });
        
        tl.to("#auth-layer", { opacity: 0, duration: 0.5, pointerEvents: "none" })
          .set("#auth-layer", { display: "none" })
          .set("#main-ui", { visibility: "visible" })
          .from("#sidebar", { x: -340, opacity: 0, duration: 0.8, ease: "power3.out" }, "-=0.2")
          .from(".control-row", { x: -20, opacity: 0, stagger: 0.05, duration: 0.6, ease: "power2.out" }, "-=0.6")
          .from(".ui-element", { y: 20, opacity: 0, stagger: 0.1, duration: 0.6, ease: "back.out(1.7)" }, "-=0.8")
          .from("canvas", { opacity: 0, duration: 1 }, "-=0.8");
    },

    // 5. Toggle Purchase Button
    togglePurchaseBtn: (show) => {
        if (!els.btnPurchase) return;
        if(show) {
            els.btnPurchase.style.display = "block";
            gsap.fromTo(els.btnPurchase, { height: 0, opacity: 0 }, { height: "auto", opacity: 1, duration: 0.4 });
        } else {
            els.btnPurchase.style.display = "none";
        }
    },

    // 6. Update Retry Counter
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

    // 7. Toggle Export Menu
    toggleExport: (show) => {
        if(!els.exportPop) return;
        gsap.to("#export-pop", { 
            autoAlpha: show ? 1 : 0, 
            scale: show ? 1 : 0.9, 
            duration: 0.2, 
            display: show ? "flex" : "none" 
        });
    },

    // 8. Flash Save Success
    flashSave: () => {
        const btn = document.getElementById('btn-save');
        if(!btn) return;
        const originalText = btn.innerText;
        btn.innerText = "SAVED!";
        btn.style.color = "var(--accent)";
        btn.style.borderColor = "var(--accent)";
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.color = "";
            btn.style.borderColor = "";
        }, 2000);
    },

    // 9. Mobile Drag Logic
    initMobileDrag: () => {
        if (window.innerWidth > 768) return;
        const sidebar = document.getElementById('sidebar');
        const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const OPEN_Y = -(vh - 80); 

        // Check if Draggable is loaded
        if (typeof Draggable !== 'undefined') {
            Draggable.create(sidebar, {
                type: "y",
                trigger: "#sheet-handle", // Only drag by handle
                bounds: { minY: OPEN_Y, maxY: 0 },
                inertia: true, 
                edgeResistance: 0.8,
                onDragEnd: function() {
                    const y = this.y;
                    // Snap logic
                    gsap.to(this.target, { y: (y < OPEN_Y * 0.25) ? OPEN_Y : 0, duration: 0.5, ease: "power3.out" });
                }
            });
        }
    },

    // 10. Show Resume State
    showResume: (email) => {
        // Hide others
        document.getElementById('view-email').classList.add('hidden');
        document.getElementById('view-email').classList.remove('active');
        document.getElementById('view-verify').classList.add('hidden');
        
        // Show Resume
        const viewResume = document.getElementById('view-resume');
        const emailEl = document.getElementById('resume-email');
        const bar = document.getElementById('resume-bar');
        
        if(viewResume && emailEl && bar) {
            viewResume.classList.remove('hidden');
            viewResume.classList.add('active');
            emailEl.innerText = email;
            
            // Animate Bar
            requestAnimationFrame(() => {
                bar.style.width = "100%";
            });
        }
    }
};

// --- HELPER: AUTH HEADERS (Hybrid Strategy) ---
function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    // If cookie fails, we send the token manually
    if (msToken) headers['Authorization'] = `Bearer ${msToken}`;
    return headers;
}

// --- HELPER: OTP COLLECTION ---
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

// --- APP INITIALIZATION ---
async function initApp() {
    // 1. Start Intro Animation (Loads the container)
    UI.intro();
    setupOtpInteractions();

    // 2. Health Check (Optional but good)
    try {
        const health = await fetch(`${API_URL}/health`); 
        const status = await health.json();
        if(status.maintenance) {
            // Logic for maintenance...
            return;
        }
    } catch(e) {}

    // 3. Auto-Login (Check Session)
    try {
        const res = await fetch(`${API_URL}/auth/validate`, {
            method: 'POST',
            credentials: 'include' 
        });
        const data = await res.json();
        
        if (data.valid) {
            // SESSION FOUND! 
            userEmail = data.email || "User";
            
            // A. Show the new Resume Card
            UI.showResume(userEmail);
            
            // B. Wait for animation (1.5s), then Unlock
            setTimeout(() => {
                unlockApp();
            }, 1500); 
            
        } else {
            // No session, stay on Email Input (Default)
            console.log("No active session.");
        }
    } catch (e) {
        console.log("Network error checking session.");
    }
    
    bindEvents();
}

// --- SECURE AUTHENTICATION ---
async function requestOtp(isResend = false) {
    const email = els.emailInput.value.trim();
    
    // Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { 
        UI.shakeError(); 
        return showStatus("Invalid email format", true); 
    }
    
    userEmail = email;
    setLoading(isResend ? els.btnResend : els.btnOtp, true);
    showStatus("");
    UI.togglePurchaseBtn(false);

    try {
        // API Call
        const res = await fetch(`${API_URL}/auth/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();

        // Error Handling
        if (!res.ok) {
            if (res.status === 403 && data.code === "NO_SUBSCRIPTION") {
                UI.togglePurchaseBtn(true);
                throw new Error("No active subscription found.");
            }
            if (res.status === 429) {
                throw new Error(data.message || "Too many attempts. Try again later.");
            }
            throw new Error(data.message || "Connection failed");
        }
        
        // Success
        if(!isResend) UI.slideAuth(true);
        if(els.authSubtitle) els.authSubtitle.innerText = `Code sent to ${email}`;
        startResendTimer();
        UI.updateRetries(null); // Clear errors
        
    } catch (e) {
        showStatus(e.message, true);
        UI.shakeError();
    } finally {
        setLoading(isResend ? els.btnResend : els.btnOtp, false);
    }
}

async function verifyOtp() {
    const code = getOtpCode().trim(); // UPDATED: Get code from 6 boxes
    if (code.length < 6) { UI.shakeError(); return showStatus("Enter full 6-digit code", true); }

    setLoading(els.btnVerify, true);
    showStatus("");

    try {
        const res = await fetch(`${API_URL}/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, code }),
            credentials: 'include' // Expect HttpOnly cookie
        });
        const data = await res.json();

        if (!res.ok) {
            // Handle 3-Strike Rule
            if (data.attemptsRemaining !== undefined) {
                UI.updateRetries(data.attemptsRemaining);
                if(data.attemptsRemaining === 0) {
                    throw new Error("Account locked. Try again in 24h.");
                }
            }
            throw new Error(data.message || "Verification failed");
        }

        // Success - Store Token Fallback
        if (data.token) {
            msToken = data.token;
        }

        unlockApp();

    } catch (e) {
        showStatus(e.message, true);
        UI.shakeError();
        clearOtpInputs(); // Clear boxes on error
    } finally {
        setLoading(els.btnVerify, false);
    }
}

// --- NEW: SPLIT INPUT LOGIC ---
function setupOtpInteractions() {
    const inputs = els.otpContainer.querySelectorAll('.otp-digit');
    
    inputs.forEach((input, index) => {
        // 1. Handle typing
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            if (val.length === 1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });

        // 2. Handle Backspace
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
            if (e.key === 'Enter') verifyOtp();
        });

        // 3. Handle Paste
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasteData = e.clipboardData.getData('text').slice(0, 6).split('');
            pasteData.forEach((char, i) => {
                if (inputs[i]) inputs[i].value = char;
            });
            // Focus last filled
            if (inputs[pasteData.length - 1]) inputs[pasteData.length - 1].focus();
            // Auto submit if full
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
            if(els.authSubtitle) els.authSubtitle.innerText = "Did not receive code?";
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
    // This fetches the "Hidden" core.js from the worker
    const headers = getAuthHeaders();

    fetch(`${API_URL}/core.js`, { 
        headers: headers,
        credentials: 'include'
    })
    .then(res => {
        if (res.status === 401 || res.status === 403) throw new Error("Auth Failed");
        if (res.status === 404) throw new Error("Core Engine Not Found (404)");
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.text();
    })
    .then(scriptContent => {
        const script = document.createElement('script');
        script.textContent = scriptContent;
        document.body.appendChild(script);
        console.log("System Unlocked.");
        
        // Load preferences only after core is ready
        setTimeout(loadUserState, 500);
    })
    .catch(e => {
        console.error("Core Load Failed:", e);
        showStatus(`System Error: ${e.message}`, true);
    });
}

// --- CLOUD STORAGE ---
async function saveUserState() {
    if (!window.MetaStar) return;
    
    const btn = document.getElementById('btn-save');
    const prevText = btn.innerText;
    btn.innerText = "...";
    
    try {
        const state = window.MetaStar.getState(); 
        await fetch(`${API_URL}/storage/save`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify(state)
        });
        UI.flashSave();
    } catch (e) {
        btn.innerText = "ERROR";
        setTimeout(() => btn.innerText = prevText, 2000);
    }
}

async function loadUserState() {
    try {
        const res = await fetch(`${API_URL}/storage/load`, {
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        const data = await res.json();
        
        if (data.config) {
            const waitForCore = setInterval(() => {
                if(window.MetaStar && window.MetaStar.importState) {
                    window.MetaStar.importState(data.config);
                    clearInterval(waitForCore);
                }
            }, 100);
        }
    } catch (e) {}
}

// --- EVENT BINDING ---
function bindEvents() {
    if(els.btnOtp) els.btnOtp.onclick = () => requestOtp(false);
    if(els.btnVerify) els.btnVerify.onclick = verifyOtp;
    if(els.btnResend) els.btnResend.onclick = () => requestOtp(true);
    if(els.btnPurchase) els.btnPurchase.onclick = () => window.open(PURCHASE_URL, '_blank');

    const btnResetAuth = document.getElementById('btn-reset-auth');
    if(btnResetAuth) {
        btnResetAuth.onclick = () => {
            UI.slideAuth(false);
            resetAuthUI();
        };
    }
    
    if(els.emailInput) els.emailInput.addEventListener('keypress', (e) => { if(e.key==='Enter') requestOtp(false) });
    // Note: OTP Enter key is now handled in setupOtpInteractions

    const saveBtn = document.getElementById('btn-save');
    if(saveBtn) saveBtn.onclick = saveUserState;

    const resetSetBtn = document.getElementById('btn-reset-settings');
    if(resetSetBtn) resetSetBtn.onclick = () => window.MetaStar?.reset();

    // Export Logic
    const exportBtn = document.getElementById('btn-export-trigger'); // Fixed ID from original HTML scan
    const exportMenu = document.getElementById('export-menu'); // Fixed ID
    let isExportOpen = false;
    
    if(exportBtn && exportMenu) {
        document.addEventListener('click', (e) => {
            if (!exportBtn.contains(e.target) && !exportMenu.contains(e.target) && isExportOpen) {
                // Manually hide since UI.toggleExport uses #export-pop which isn't in your HTML
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
    if(isLoading) { 
        btn.classList.add('loading'); 
        btn.disabled = true; 
        if(spinner) spinner.style.display = 'block';
    } else { 
        btn.classList.remove('loading'); 
        btn.disabled = false; 
        if(spinner) spinner.style.display = 'none';
    }
}

function showStatus(msg, isError) {
    if(!els.statusMsg) return;
    els.statusMsg.innerText = msg;
    els.statusMsg.classList.add('visible');
    els.statusMsg.classList.toggle('error', isError); // Use .error class for color
}

function resetAuthUI() {
    if(els.authSubtitle) els.authSubtitle.innerText = "Professional Studio Access";
    if(els.statusMsg) {
        els.statusMsg.classList.remove('visible');
        els.statusMsg.classList.remove('error');
    }
    UI.togglePurchaseBtn(false);
    UI.updateRetries(null);
    if(els.btnResend) els.btnResend.style.display = "none";
    clearOtpInputs();
}

// Start
document.addEventListener('DOMContentLoaded', initApp);
