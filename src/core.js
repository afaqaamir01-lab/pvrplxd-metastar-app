/**
 * METASTAR CORE ENGINE v2.4
 * Protected Proprietary Logic
 * Served Securely via Cloudflare R2 / Worker
 * * UPGRADES: 
 * - Fixed Alignment (300px Sidebar)
 * - Cached Color Rendering (60fps lock)
 * - Optimized Grid Physics
 */
(function() {
    console.log("%c MetaStar Engine Connecting... ", "background: #dfff00; color: #000; font-weight: bold;");

    const canvas = document.getElementById('canvas');
    if (!canvas) return console.error("MetaStar Engine: Canvas not found.");
    
    const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for no transparency
    let dpr = window.devicePixelRatio || 1;
    
    // --- STATE MANAGEMENT ---
    let w, h;
    let showGrid = true, showBones = false;
    
    // Cached Styles (Performance Fix)
    // We store these so we don't query the DOM 60 times a second
    let styleCache = {
        bg: "#050505",
        star: "#dfff00"
    };
    
    // Physics State
    let isDragging = false;
    let isDrifting = false;
    
    // Position & Velocity
    let pos = { x: 0, y: 0 };    
    let target = { x: 0, y: 0 }; 
    let vel = { x: 0, y: 0 };    
    
    // Physics Constants
    const SPRING = 0.15;   
    const DRAG = 0.6;      
    const FRICTION = 0.92; 
    
    // Touch State
    let initialPinchDist = null;
    let initialZoom = 100;

    // Default Configuration
    const config = { t:100, r:100, b:100, l:100, sx:0, sy:0, z:100, c:25 };
    
    // Active State Proxy
    const state = new Proxy({ ...config }, {
        set: function(obj, prop, value) {
            obj[prop] = value;
            updateInputUI(prop, value);
            return true;
        }
    });

    // --- INITIALIZATION ---
    function init() {
        // 1. Bind Inputs
        const ids = ['t', 'r', 'b', 'l', 'sx', 'sy', 'z', 'c'];
        ids.forEach(id => {
            const range = document.getElementById('r-'+id);
            const num = document.getElementById('n-'+id);
            
            const onUserChange = (val) => {
                state[id] = parseFloat(val);
            };

            if(range) range.oninput = () => onUserChange(range.value);
            if(num) num.oninput = () => onUserChange(num.value);
            
            updateInputUI(id, state[id]);
        });

        // 2. Bind Toggles & Colors (With Caching)
        const bind = (id, fn) => {
            const el = document.getElementById(id);
            if(el) el.oninput = (e) => fn(e.target.value || e.target.checked);
            // Initial read
            if(el) fn(el.value || el.checked);
        };

        bind('checkGrid', (v) => showGrid = v);
        bind('checkBones', (v) => showBones = v);
        bind('bgCol', (v) => styleCache.bg = v);
        bind('starCol', (v) => styleCache.star = v);

        // 3. Start System
        bindCanvasEvents();
        resize();
        render(); // Start Loop
        console.log("MetaStar Engine: Ready");
    }

    function updateInputUI(id, val) {
        const range = document.getElementById('r-'+id);
        const num = document.getElementById('n-'+id);
        if(range) range.value = val;
        if(num) num.value = Math.round(val);
        
        if(id === 'z') {
            const badge = document.getElementById('zoom-val');
            if(badge) badge.innerText = Math.round(val) + '%';
        }
    }

    // --- GEOMETRY & RENDER ---
    function resize() {
        // FIXED: Sidebar width matched to CSS (300px)
        const sidebarWidth = window.innerWidth > 768 ? 300 : 0;
        
        // Subtract sidebar from canvas width so center is visual center
        w = window.innerWidth - sidebarWidth; 
        h = window.innerHeight;
        
        canvas.width = w * dpr; 
        canvas.height = h * dpr;
        canvas.style.width = w + 'px'; 
        canvas.style.height = h + 'px';
        
        ctx.scale(dpr, dpr);
        
        // Center only if initialized at 0,0
        if(pos.x === 0 && pos.y === 0) {
            pos.x = target.x = w / 2; 
            pos.y = target.y = h / 2;
        }
    }

    function getPoints() {
        const s = (state.z || 100) / 100;
        const skX = (state.sx || 0) / 100;
        const skY = (state.sy || 0) / 100;
        
        const raw = [
            {x:0, y:-(state.t || 100)*s}, 
            {x:(state.r || 100)*s, y:0},
            {x:0, y:(state.b || 100)*s}, 
            {x:-(state.l || 100)*s, y:0}
        ];
        
        return raw.map(p => ({ 
            x: pos.x + p.x + (p.y * skX), 
            y: pos.y + p.y + (p.x * skY) 
        }));
    }

    function render() {
        // Use Cached Colors (Fast)
        const { bg, star } = styleCache;
        
        // Clear
        ctx.fillStyle = bg; 
        ctx.fillRect(0, 0, w, h);
        
        // --- PHYSICS ENGINE ---
        if (isDragging) {
            const ax = (target.x - pos.x) * SPRING;
            const ay = (target.y - pos.y) * SPRING;
            vel.x += ax; vel.y += ay;
            vel.x *= DRAG; vel.y *= DRAG;
        } else {
            vel.x *= FRICTION; vel.y *= FRICTION;
            if(Math.abs(vel.x) < 0.01) vel.x = 0;
            if(Math.abs(vel.y) < 0.01) vel.y = 0;
        }

        pos.x += vel.x;
        pos.y += vel.y;

        // --- DRAWING ---
        if (showGrid) drawGrid(state.z, bg);

        const pts = getPoints();
        const curv = 1 - ((state.c || 25) / 100);

        // Bones (Debug)
        if (showBones) {
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'; 
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); 
            pts.forEach(p => { ctx.moveTo(pos.x, pos.y); ctx.lineTo(p.x, p.y); });
            ctx.stroke(); 
            ctx.setLineDash([]);
        }

        // Star Shape
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for(let i=0; i<4; i++){
            let nxt = pts[(i+1)%4];
            let mx = (pts[i].x + nxt.x)/2;
            let my = (pts[i].y + nxt.y)/2;
            let cx = mx + (pos.x - mx) * curv;
            let cy = my + (pos.y - my) * curv;
            ctx.quadraticCurveTo(cx, cy, nxt.x, nxt.y);
        }
        ctx.fillStyle = star; 
        ctx.fill();
        
        requestAnimationFrame(render);
    }

    function drawGrid(scale, bgHex) {
        const size = 50 * (scale / 100);
        // Optimize: Stop drawing if grid is microscopic
        if(size < 5) return; 

        const opacity = Math.min(1, Math.max(0, (size - 10) / 20));
        if(opacity <= 0) return;

        // Determine if grid should be light or dark based on BG
        const isDark = parseInt(bgHex.replace('#', ''), 16) < 0xffffff / 2;
        ctx.strokeStyle = isDark 
            ? `rgba(255,255,255,${0.06 * opacity})` 
            : `rgba(0,0,0,${0.06 * opacity})`;
        
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        const ox = pos.x % size; 
        const oy = pos.y % size;
        
        // Loop Optimization: Draw only what's visible
        for(let x = ox - size; x < w; x += size) { ctx.moveTo(x,0); ctx.lineTo(x,h); }
        for(let y = oy - size; y < h; y += size) { ctx.moveTo(0,y); ctx.lineTo(w,y); }
        
        ctx.stroke();
    }

    // --- INTERACTION ---
    function bindCanvasEvents() {
        const getPointer = (e) => {
            const t = e.touches ? e.touches[0] : e;
            // FIXED: Sidebar Offset Match (300px)
            const offset = window.innerWidth > 768 ? 300 : 0; 
            return { x: t.clientX - offset, y: t.clientY };
        };

        const start = (e) => {
            if (e.touches && e.touches.length === 2) {
                isDragging = false;
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                initialPinchDist = Math.sqrt(dx*dx + dy*dy);
                initialZoom = state.z;
                return;
            }
            
            isDragging = true;
            isDrifting = false;
            const p = getPointer(e);
            target.x = p.x; 
            target.y = p.y;
        };

        const move = (e) => {
            // Pinch Zoom
            if (e.touches && e.touches.length === 2 && initialPinchDist) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const scale = dist / initialPinchDist;
                
                state.z = Math.min(Math.max(initialZoom * scale, 10), 400); 
                e.preventDefault();
                return;
            }

            // Drag
            if(!isDragging) return;
            const p = getPointer(e);
            target.x = p.x; 
            target.y = p.y;
            e.preventDefault();
        };

        const end = () => {
            isDragging = false;
            isDrifting = true;
            initialPinchDist = null;
        };

        canvas.addEventListener('mousedown', start); 
        canvas.addEventListener('touchstart', start, {passive: false});
        
        window.addEventListener('mousemove', move); 
        window.addEventListener('touchmove', move, {passive: false});
        
        window.addEventListener('mouseup', end); 
        window.addEventListener('touchend', end);
        window.addEventListener('resize', resize);
        
        canvas.addEventListener('wheel', (e) => {
            // Allow wheel zoom without keys for better UX
            e.preventDefault();
            const delta = e.deltaY * -0.5;
            state.z = Math.min(Math.max(state.z + delta, 10), 400);
        }, {passive:false});
    }

    // --- API ---
    window.MetaStar = {
        reset: function() { 
            // Safety check for GSAP
            if(typeof gsap === 'undefined') {
                console.warn("GSAP not loaded");
                // Fallback reset
                pos.x = w/2; pos.y = h/2;
                Object.assign(state, config);
                return;
            }

            // FIXED: Sidebar Offset Match (300px)
            const offset = window.innerWidth > 768 ? 300 : 0;
            gsap.to(pos, { 
                x: (window.innerWidth - offset) / 2, 
                y: window.innerHeight / 2, 
                duration: 1.2, 
                ease: "elastic.out(1, 0.5)" 
            });

            vel.x = 0; vel.y = 0;
            isDragging = false;

            gsap.to(state, {
                ...config,
                duration: 0.8,
                ease: "power2.out",
                onUpdate: () => {
                    // Update Cached Colors
                    styleCache.bg = "#050505";
                    styleCache.star = "#dfff00";
                    // Sync UI
                    document.getElementById('starCol').value = styleCache.star;
                    document.getElementById('bgCol').value = styleCache.bg;
                }
            });
        },
        
        export: function(fmt) { fmt === 'svg' ? exportSVG() : exportImage(fmt); },
        
        getState: function() { 
            return { 
                geo: { ...state }, 
                colors: { star: styleCache.star, bg: styleCache.bg } 
            }; 
        },
        
        importState: function(data) {
            if(!data) return;
            if(data.geo) Object.assign(state, data.geo);
            if(data.colors) {
                styleCache.star = data.colors.star;
                styleCache.bg = data.colors.bg;
                // Update DOM inputs to match
                const sC = document.getElementById('starCol');
                const bC = document.getElementById('bgCol');
                if(sC) sC.value = styleCache.star;
                if(bC) bC.value = styleCache.bg;
            }
        }
    };

    // --- EXPORTERS ---
    function exportSVG() {
        const pts = getPoints();
        const curv = 1 - ((state.c || 25) / 100);
        let d = `M ${pts[0].x} ${pts[0].y} `;
        for(let i=0; i<4; i++){
            let nxt = pts[(i+1)%4];
            let mx = (pts[i].x + nxt.x)/2, my = (pts[i].y + nxt.y)/2;
            let cx = mx + (pos.x - mx) * curv, cy = my + (pos.y - my) * curv;
            d += `Q ${cx} ${cy} ${nxt.x} ${nxt.y} `;
        }
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${styleCache.bg}"/><path d="${d}" fill="${styleCache.star}"/></svg>`;
        downloadBlob(new Blob([svg], {type: 'image/svg+xml'}), 'metastar-export.svg');
    }

    function exportImage(fmt) {
        const link = document.createElement('a');
        link.download = `metastar-export.${fmt}`;
        link.href = canvas.toDataURL(`image/${fmt === 'jpg' ? 'jpeg' : 'png'}`);
        link.click();
    }
    
    function downloadBlob(blob, name) {
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    }

    init();
})();