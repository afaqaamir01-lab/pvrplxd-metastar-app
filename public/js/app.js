/**
 * METASTAR STUDIO PRO - Main Controller v6.0 (ESM)
 * - Optimized Event Delegation
 * - Robust Error Handling & Network Timeouts
 * - Memory-Safe GSAP Integration
 * - Secure Remote Core Injection
 */

// --- CONFIGURATION ---
const CONFIG = {
    API_URL: "https://metastar-v2.afaqaamir01.workers.dev",
    PURCHASE_URL: "https://whop.com/pvrplxd/metastar-4-point-star-engine/",
    CONTACT_EMAIL: "afaqaamir01@gmail.com",
    TIMEOUT_MS: 10000 // 10s Network Timeout
};

// --- SESSION MANAGEMENT ---
const Session = {
    token: localStorage.getItem("ms_token"),
    email: "",
    
    set(token) {
        this.token = token;
        localStorage.setItem("ms_token", token);
    },
    
    clear() {
        this.token = null;
        this.email = "";
        localStorage.removeItem("ms_token");
    },

    get headers() {
        const h = { 'Content-Type': 'application/json' };
        if (this.token) h['Authorization'] = `Bearer ${this.token}`;
        return h;
    }
};

// --- DOM CACHE (Lazy Getters) ---
const DOM = {
    get: (id) => document.getElementById(id),
    query: (sel) => document.querySelector(sel),
    
    // Groups
    authLayer: document.getElementById('auth-layer'),
    authContainer: document.querySelector('.auth-container'),
    mainUI: document.getElementById('main-ui'),
    sidebar: document.getElementById('sidebar'),
    sidebarControls: document.getElementById('sidebar-controls'), // New Delegation Target
    
    // Dynamic Feedback
    terminalStatus: document.getElementById('terminal-status'),
    statusMsg: document.getElementById('status-msg'),
    retryCounter: document.getElementById('retry-counter'),
    
    // Loaders
    coreLoader: document.getElementById('core-loader'),
    
    // Inputs (Cached for frequent access)
    inputs: {
        email: document.getElementById('email-input'),
        otp: document.getElementById('otp-container')
    }
};

// --- UI CONTROLLER ---
const UI = {
    // 1. Entrance Animations
    intro() {
        if (!Session.token && DOM.coreLoader) DOM.coreLoader.classList.add('loaded'); // Lift curtain if no auto-login
        
        gsap.set(DOM.authContainer, { scale: 0.9, opacity: 0 });
        gsap.to(DOM.authContainer, { 
            scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.2)", delay: 0.1 
        });
    },

    // 2. State Switching (Kinetic)
    switchState(stateId, statusText = "PROCESSING...") {
        const target = DOM.get(stateId);
        if(!target) return console.error(`State ${stateId} not found`);

        if(DOM.terminalStatus) DOM.terminalStatus.innerText = statusText;

        // Batch DOM updates
        document.querySelectorAll('.auth-state').forEach(el => {
            if(el === target) {
                el.classList.remove('hidden');
                el.classList.add('active');
                
                // Animate Height & Content
                gsap.to(DOM.authContainer, { height: "auto", duration: 0.4, ease: "power2.out" });
                gsap.fromTo(target, 
                    { opacity: 0, y: 8 }, 
                    { opacity: 1, y: 0, duration: 0.3, clearProps: "all" }
                );
            } else {
                el.classList.remove('active');
                el.classList.add('hidden');
            }
        });
    },

    // 3. Feedback System
    shakeError() {
        gsap.fromTo(DOM.authContainer, { x: -6 }, { x: 6, duration: 0.08, repeat: 3, yoyo: true, clearProps: "x" });
        if(navigator.vibrate) navigator.vibrate(200);
    },

    showStatus(msg, isErr = false) {
        const el = DOM.statusMsg;
        if(!el) return;
        el.innerText = msg;
        el.classList.add('visible');
        el.classList.toggle('error', isErr);
        
        // Auto-hide using GSAP delayedCall (better than setTimeout for cleanup)
        gsap.delayedCall(3.5, () => el.classList.remove('visible'));
    },

    setLoading(btnId, isLoading) {
        const btn = DOM.get(btnId);
        if (!btn) return;
        btn.disabled = isLoading;
        btn.classList.toggle('loading', isLoading);
        
        const loader = btn.querySelector('.btn-loader');
        const text = btn.querySelector('span');
        if (loader) loader.style.display = isLoading ? 'block' : 'none';
        if (text) text.style.opacity = isLoading ? '0' : '1';
    },

    updateRetries(remaining) {
        if (!DOM.retryCounter) return;
        if (remaining == null) {
            DOM.retryCounter.innerText = "";
        } else {
            DOM.retryCounter.innerText = `${remaining} ATTEMPTS REMAINING`;
            gsap.fromTo(DOM.retryCounter, { color: "#fff" }, { color: "#ff4444", duration: 0.5 });
        }
    },

    // 4. Core Transition
    revealInterface() {
        if(DOM.coreLoader) DOM.coreLoader.classList.add('loaded'); // Lift curtain
        
        // Hide Auth Layer completely after animation
        gsap.to(DOM.authLayer, { 
            opacity: 0, scale: 0.95, duration: 0.5, 
            onComplete: () => DOM.authLayer.style.display = 'none' 
        });

        DOM.mainUI.style.visibility = "visible";

        // Staggered Entrance
        const tl = gsap.timeline();
        tl.from(DOM.sidebar, { x: -40, opacity: 0, duration: 0.6, ease: "power3.out" }, "+=0.1")
          .from(".control-row", { x: -10, opacity: 0, stagger: 0.02, duration: 0.4 }, "-=0.3")
          .from(".fab", { scale: 0, rotation: -90, duration: 0.5, ease: "back.out(1.5)" }, "-=0.4")
          .from("canvas", { opacity: 0, duration: 0.8 }, "-=0.6");
    }
};

// --- CORE PHYSICS ENGINE ---
const Physics = {
    registry: [], // To track and kill draggables if needed

    initSliders() {
        // We iterate specifically over the wrappers to create the proxy
        const sliderGroups = document.querySelectorAll('.slider-group');
        
        sliderGroups.forEach(group => {
            const range = group.querySelector('input[type="range"]');
            const number = group.querySelector('input[type="number"]');
            if (!range) return;

            const min = parseFloat(range.min);
            const max = parseFloat(range.max);

            // Create invisible proxy for inertia
            const proxy = document.createElement("div"); 
            
            const update = (val) => {
                const clamped = Math.max(min, Math.min(max, val));
                range.value = clamped;
                if(number) number.value = Math.round(clamped);
                // Dispatch event for the delegated listener in Core to pick up
                range.dispatchEvent(new Event('input', { bubbles: true }));
            };

            const dragInstance = Draggable.create(proxy, {
                trigger: range, 
                type: "x", 
                inertia: true,
                onPress: (e) => {
                    const r = range.getBoundingClientRect();
                    // Instant jump to click position
                    const clickX = e.clientX;
                    const percent = (clickX - r.left) / r.width;
                    const val = min + percent * (max - min);
                    update(val);
                },
                onDrag: function() {
                    const r = range.getBoundingClientRect();
                    const deltaVal = (this.deltaX / r.width) * (max - min);
                    update(parseFloat(range.value) + deltaVal);
                },
                onThrowUpdate: function() {
                    // Logic allows inertia to continue changing the value
                    const r = range.getBoundingClientRect();
                    const deltaVal = (this.deltaX / r.width) * (max - min);
                    update(parseFloat(range.value) + deltaVal);
                }
            });
            
            this.registry.push(dragInstance[0]);
        });
    },

    initMobileSheet() {
        if (window.innerWidth > 768 || !DOM.sidebar) return;
        
        const header = DOM.query('.sidebar-header');
        if(!header) return;

        Draggable.create(DOM.sidebar, {
            type: "y",
            trigger: header,
            inertia: true,
            edgeResistance: 0.65,
            bounds: { minY: 0, maxY: window.innerHeight },
            snap: {
                y: (value) => {
                    const h = DOM.sidebar.offsetHeight;
                    const stops = [0, h * 0.4, h - 80]; // Open, Mid, Closed
                    // Find closest stop
                    return stops.reduce((prev, curr) => 
                        Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
                    );
                }
            }
        });
    }
};

// --- API CLIENT ---
async function apiCall(endpoint, body = null) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

    try {
        const res = await fetch(`${CONFIG.API_URL}${endpoint}`, {
            method: 'POST',
            headers: Session.headers,
            body: body ? JSON.stringify(body) : null,
            signal: controller.signal
        });
        clearTimeout(id);
        const data = await res.json();
        if (!res.ok) throw { status: res.status, ...data };
        return data;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
}

// --- APP LOGIC ---
const App = {
    async init() {
        this.bindEvents();
        this.bindOtpLogic();

        // 1. Check for Resume
        if (Session.token) {
            try {
                const data = await apiCall('/auth/validate', {}); // Empty body for post
                if (data.valid) {
                    Session.email = data.email || "User";
                    UI.switchState('state-resume', 'RESTORING SESSION');
                    
                    if(DOM.get('resume-email')) DOM.get('resume-email').innerText = Session.email;
                    const bar = DOM.get('resume-bar');
                    if(bar) requestAnimationFrame(() => bar.style.width = "100%");

                    setTimeout(() => this.unlock(), 1200);
                    return;
                } 
                // Invalid Token
                Session.clear();
                if (data.code === "ACCESS_TERMINATED") {
                    UI.intro();
                    UI.switchState('state-terminated', 'ACCESS REVOKED');
                    return;
                }
            } catch (e) {
                console.warn("Session check failed:", e);
                Session.clear();
            }
        }

        // 2. Default Entry
        UI.intro();
        UI.switchState('state-identity', 'SYSTEM READY');
    },

    async checkLicense() {
        const email = DOM.inputs.email.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { 
            UI.shakeError(); 
            return UI.showStatus("Invalid email format", true); 
        }

        Session.email = email;
        UI.setLoading('btn-init', true);
        UI.switchState('state-scanning', 'CONTACTING SERVER...');

        try {
            await apiCall('/auth/check', { email });
            UI.switchState('state-success', 'VERIFIED');
        } catch (e) {
            if (e.code === "ACCESS_TERMINATED") UI.switchState('state-terminated', 'ACCESS DENIED');
            else if (e.code === "NO_SUBSCRIPTION") UI.switchState('state-purchase', 'LICENSE REQUIRED');
            else {
                UI.showStatus(e.message || "Connection Error", true);
                UI.switchState('state-identity', 'SYSTEM READY');
                UI.shakeError();
            }
        } finally {
            UI.setLoading('btn-init', false);
        }
    },

    async sendOtp(isResend = false) {
        const btnId = isResend ? 'btn-resend' : 'btn-send-otp';
        UI.setLoading(btnId, true);
        
        try {
            await apiCall('/auth/send', { email: Session.email });
            if(!isResend) UI.switchState('state-otp', 'AWAITING CODE');
            this.startResendTimer();
        } catch (e) {
            UI.showStatus(e.message || "Failed to send code", true);
            UI.shakeError();
        } finally {
            UI.setLoading(btnId, false);
        }
    },

    async verifyOtp() {
        const inputs = Array.from(DOM.inputs.otp.querySelectorAll('input'));
        const code = inputs.map(i => i.value).join('');
        
        if (code.length < 6) { UI.shakeError(); return; }
        UI.setLoading('btn-verify', true);

        try {
            const data = await apiCall('/auth/verify', { email: Session.email, code });
            Session.set(data.token);
            this.unlock();
        } catch (e) {
            UI.updateRetries(e.attemptsRemaining);
            UI.showStatus(e.message || "Verification Failed", true);
            UI.shakeError();
            inputs.forEach(i => i.value = ''); // Clear inputs
            inputs[0].focus();
        } finally {
            UI.setLoading('btn-verify', false);
        }
    },

    unlock() {
        // 1. Fetch Protected Core
        fetch(`${CONFIG.API_URL}/core.js`, { headers: Session.headers })
            .then(res => {
                if(!res.ok) throw new Error("Auth Failed");
                return res.text();
            })
            .then(scriptText => {
                // 2. Inject
                const script = document.createElement('script');
                script.textContent = scriptText;
                document.body.appendChild(script);
                
                // 3. Init Physics & UI
                Physics.initSliders();
                Physics.initMobileSheet();
                
                // 4. Reveal
                setTimeout(() => UI.revealInterface(), 300);
            })
            .catch(() => {
                UI.showStatus("Session Expired", true);
                Session.clear();
                setTimeout(() => window.location.reload(), 1500);
            });
    },

    startResendTimer() {
        const btn = DOM.get('btn-resend');
        if(!btn) return;
        
        let t = 60; 
        btn.style.display = "none";
        
        if(this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => { 
            t--; 
            if(t <= 0) { 
                clearInterval(this.timer); 
                btn.style.display = "block"; 
                btn.innerText = "Resend Code"; 
            } 
        }, 1000);
    },

    // --- EVENT BINDING ---
    bindEvents() {
        // Delegated Clicks for simple buttons
        const clickMap = {
            'btn-init': () => this.checkLicense(),
            'btn-send-otp': () => this.sendOtp(false),
            'btn-verify': () => this.verifyOtp(),
            'btn-resend': () => this.sendOtp(true),
            'btn-buy-access': () => window.open(CONFIG.PURCHASE_URL, '_blank'),
            'btn-renew': () => window.open(CONFIG.PURCHASE_URL, '_blank'),
            'btn-refresh-license': () => this.checkLicense(),
            'btn-contact-support': () => window.location.href = `mailto:${CONFIG.CONTACT_EMAIL}`,
            'btn-reset-settings': () => window.MetaStar?.reset()
        };

        document.addEventListener('click', (e) => {
            const id = e.target.closest('button')?.id;
            if (id && clickMap[id]) clickMap[id]();
            
            // Back Buttons
            if (e.target.closest('.action-back')) UI.switchState('state-identity', 'SYSTEM READY');
        });

        // Enter Key for Email
        DOM.inputs.email.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.checkLicense();
        });

        // Export Menu Toggle
        const fab = DOM.get('btn-export-trigger');
        const menu = DOM.get('export-menu');
        if (fab && menu) {
            fab.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
            });
            document.addEventListener('click', () => menu.style.display = 'none');
            // Export Actions
            menu.addEventListener('click', (e) => {
                const fmt = e.target.closest('.menu-item')?.dataset.fmt;
                if(fmt && window.MetaStar) window.MetaStar.export(fmt);
            });
        }
        
        // DELEGATED INPUT LISTENER (The big optimization)
        // This handles updates from both Sliders and Number inputs sync
        if(DOM.sidebarControls) {
            DOM.sidebarControls.addEventListener('input', (e) => {
                const target = e.target;
                const row = target.closest('.control-row');
                if(!row) return;

                // Sync the sibling input
                const isRange = target.type === 'range';
                const sibling = isRange 
                    ? row.querySelector('input[type="number"]') 
                    : row.querySelector('input[type="range"]');
                
                if(sibling) sibling.value = target.value;
                
                // Update MetaStar Engine State via Proxy
                // The 'data-bind' attribute tells us which state property to update
                const bindKey = row.dataset.bind;
                if(bindKey && window.MetaStar) {
                    // We assume MetaStar exposes a way to set state or we access the global state object if exposed
                    // Based on core.js logic, it's watching specific IDs. 
                    // However, for best practice, let's trigger the event expected by core.js
                    // Note: core.js uses direct ID lookups, so just updating value + input event is enough.
                }
            });
        }
    },

    bindOtpLogic() {
        const inputs = DOM.inputs.otp.querySelectorAll('input');
        inputs.forEach((input, i) => {
            input.addEventListener('input', (e) => { 
                if (e.target.value && i < inputs.length - 1) inputs[i + 1].focus(); 
            });
            input.addEventListener('keydown', (e) => { 
                if (e.key === 'Backspace' && !e.target.value && i > 0) inputs[i - 1].focus(); 
                if (e.key === 'Enter') this.verifyOtp(); 
            });
            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const text = (e.clipboardData || window.clipboardData).getData('text');
                const chars = text.slice(0, 6).split('');
                chars.forEach((c, idx) => { if (inputs[idx]) inputs[idx].value = c; });
                if (chars.length === 6) this.verifyOtp();
            });
        });
    }
};

// --- BOOTSTRAP ---
document.addEventListener('DOMContentLoaded', () => App.init());
