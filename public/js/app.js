// --- CONFIGURATION ---
// Ensure this matches your Cloudflare Worker URL
const API_URL = "https://metastar-v2.afaqaamir01.workers.dev";
const PURCHASE_URL = "https://whop.com/pvrplxd/metastar-4-point-star-engine/"; 

let userEmail = "";
let authToken = localStorage.getItem('ms_token');
let resendTimer = null;

// --- DOM ELEMENTS ---
const els = {
    emailInput: document.getElementById('email-input'),
    codeInput: document.getElementById('code-input'),
    btnOtp: document.getElementById('btn-otp'),
    btnVerify: document.getElementById('btn-verify'),
    statusMsg: document.getElementById('status-msg'),
    exportPop: document.getElementById('export-pop'),
    authSubtitle: document.getElementById('auth-subtitle'),
    
    // New Security Elements
    btnPurchase: document.getElementById('btn-purchase'),
    btnResend: document.getElementById('btn-resend'),
    retryCounter: document.getElementById('retry-counter')
};

// --- ANIMATION CONTROLLER (GSAP) ---
const UI = {
    // 1. Intro Animation
    intro: () => {
        gsap.to(".auth-card", { 
            y: 0, opacity: 1, duration: 1, ease: "power4.out", delay: 0.2 
        });
    },

    // 2. Slide Logic (Email <-> Code)
    slideAuth: (toVerify = true) => {
        const xVal = toVerify ? "-50%" : "0%";
        gsap.to("#step-slider", { x: xVal, duration: 0.6, ease: "expo.inOut" });
        
        if (toVerify) {
            gsap.to("#step-email", { opacity: 0, duration: 0.3 });
            gsap.to("#step-verify", { opacity: 1, delay: 0.2, duration: 0.3, pointerEvents: "all" });
        } else {
            gsap.to("#step-email", { opacity: 1, delay: 0.2, duration: 0.3 });
            gsap.to("#step-verify", { opacity: 0, duration: 0.3, pointerEvents: "none" });
        }
    },

    // 3. Error Shake
    shakeError: () => {
        gsap.fromTo(".auth-card", 
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
            // Flash red if low
            if(remaining < 2) {
                gsap.fromTo(els.retryCounter, { scale: 1.1 }, { scale: 1, duration: 0.2 });
            }
        }
    },

    // 7. Toggle Export Menu
    toggleExport: (show) => {
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
        const vh = window.innerHeight;
        const OPEN_Y = -(vh - 80); 

        Draggable.create(sidebar, {
            type: "y",
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
};

// --- APP INITIALIZATION ---
async function initApp() {
    gsap.set(".auth-card", { y: 30, opacity: 0 }); 
    UI.intro();

    // 1. Health Check
    try {
        const health = await fetch(`${API_URL}/health`); 
        const status = await health.json();
        if(status.maintenance) {
            document.getElementById('maintenance-layer').classList.remove('hidden');
            document.getElementById('auth-layer').classList.add('hidden');
            return;
        }
    } catch(e) {}

    // 2. Auto-Login (Validate Session)
    if (authToken) {
        setLoading(els.btnOtp, true);
        els.authSubtitle.innerText = "Verifying session...";
        try {
            const res = await fetch(`${API_URL}/auth/validate`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const data = await res.json();
            
            if (data.valid) {
                unlockApp();
                loadUserState(); 
            } else {
                throw new Error("Expired");
            }
        } catch (e) {
            localStorage.removeItem('ms_token');
            authToken = null;
            resetAuthUI();
            showStatus("Session expired. Please sign in.", true);
        }
        setLoading(els.btnOtp, false);
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
        els.authSubtitle.innerText = `Code sent to ${email}`;
        startResendTimer();
        UI.updateRetries(null); // Clear errors
        
        setTimeout(() => els.codeInput.focus(), 600);

    } catch (e) {
        showStatus(e.message, true);
        UI.shakeError();
    } finally {
        setLoading(isResend ? els.btnResend : els.btnOtp, false);
    }
}

async function verifyOtp() {
    const code = els.codeInput.value.trim();
    if (code.length < 6) { UI.shakeError(); return showStatus("Enter 6-digit code", true); }

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
            // Handle 3-Strike Rule
            if (data.attemptsRemaining !== undefined) {
                UI.updateRetries(data.attemptsRemaining);
                if(data.attemptsRemaining === 0) {
                    throw new Error("Account locked. Try again in 24h.");
                }
            }
            throw new Error(data.message || "Verification failed");
        }

        // Success
        authToken = data.token;
        localStorage.setItem('ms_token', authToken);
        unlockApp();
        loadUserState(); 

    } catch (e) {
        showStatus(e.message, true);
        UI.shakeError();
        els.codeInput.value = ""; 
    } finally {
        setLoading(els.btnVerify, false);
    }
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
            els.authSubtitle.innerText = "Did not receive code?";
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
    fetch(`${API_URL}/core.js`, { 
        headers: { 'Authorization': `Bearer ${authToken}` } 
    })
    .then(res => {
        if(!res.ok) throw new Error("Auth Failed");
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
        showStatus("Security Error: Reload page.", true);
    });
}

// --- CLOUD STORAGE ---
async function saveUserState() {
    if (!window.MetaStar || !authToken) return;
    
    const btn = document.getElementById('btn-save');
    const prevText = btn.innerText;
    btn.innerText = "...";
    
    try {
        const state = window.MetaStar.getState(); 
        await fetch(`${API_URL}/storage/save`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
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
            headers: { 'Authorization': `Bearer ${authToken}` }
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
    els.btnOtp.onclick = () => requestOtp(false);
    els.btnVerify.onclick = verifyOtp;
    if(els.btnResend) els.btnResend.onclick = () => requestOtp(true);
    if(els.btnPurchase) els.btnPurchase.onclick = () => window.open(PURCHASE_URL, '_blank');

    document.getElementById('btn-reset-auth').onclick = () => {
        UI.slideAuth(false);
        resetAuthUI();
    };
    
    els.emailInput.addEventListener('keypress', (e) => { if(e.key==='Enter') requestOtp(false) });
    els.codeInput.addEventListener('keypress', (e) => { if(e.key==='Enter') verifyOtp() });

    const saveBtn = document.getElementById('btn-save');
    if(saveBtn) saveBtn.onclick = saveUserState;

    document.getElementById('btn-reset-settings').onclick = () => window.MetaStar?.reset();

    // Export Logic
    const exportBtn = document.getElementById('btn-export-menu');
    let isExportOpen = false;
    
    document.addEventListener('click', (e) => {
        if (!exportBtn.contains(e.target) && !els.exportPop.contains(e.target) && isExportOpen) {
            UI.toggleExport(false); isExportOpen = false;
        }
    });

    exportBtn.onclick = (e) => {
        e.stopPropagation();
        isExportOpen = !isExportOpen;
        UI.toggleExport(isExportOpen);
    };

    els.exportPop.querySelectorAll('.export-option').forEach(btn => {
        btn.onclick = () => {
            if(window.MetaStar?.export) {
                window.MetaStar.export(btn.dataset.fmt);
                UI.toggleExport(false); isExportOpen = false;
            }
        };
    });
}

// --- HELPERS ---
function setLoading(btn, isLoading) {
    if(!btn) return;
    if(isLoading) { btn.classList.add('loading'); btn.disabled = true; }
    else { btn.classList.remove('loading'); btn.disabled = false; }
}

function showStatus(msg, isError) {
    els.statusMsg.innerText = msg;
    els.statusMsg.classList.add('visible');
    els.statusMsg.style.color = isError ? '#ff4444' : '#888';
}

function resetAuthUI() {
    document.getElementById('auth-subtitle').innerText = "Professional Studio Access";
    els.statusMsg.classList.remove('visible');
    UI.togglePurchaseBtn(false);
    UI.updateRetries(null);
    if(els.btnResend) els.btnResend.style.display = "none";
    els.codeInput.value = "";
}

// Start
initApp();