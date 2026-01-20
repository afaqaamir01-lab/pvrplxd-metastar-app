// NOTE: Deployed on Cloudflare Workers
// REPLACES: The previous worker.js (Fully Fixed & Pro-Secured)

// --- 1. HELPER: DYNAMIC CORS ---
function getCorsHeaders(request) {
    const origin = request.headers.get("Origin");
    return {
        "Access-Control-Allow-Origin": origin || "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true" 
    };
}

// --- 2. HELPER: JSON RESPONSE ---
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { 
    headers: { ...headers, 'Content-Type': 'application/json' }, 
    status 
  });
}

// --- 3. HELPER: PARSE COOKIES (Safe Version) ---
function getCookie(request, name) {
  const cookieString = request.headers.get("Cookie");
  if (!cookieString) return null;
  const cookies = cookieString.split(';');
  for (let cookie of cookies) {
    const parts = cookie.split('=');
    const key = parts[0].trim();
    if (key === name) return parts.slice(1).join('=').trim();
  }
  return null;
}

// --- 4. HELPER: VERIFY JWT ---
async function verifyToken(token, secretStr) {
    try {
        const [headerB64, bodyB64, sigB64] = token.split('.');
        if (!headerB64 || !bodyB64 || !sigB64) return null;

        const secret = new TextEncoder().encode(secretStr);
        const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const checkSig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${headerB64}.${bodyB64}`));
        const checkSigB64 = btoa(String.fromCharCode(...new Uint8Array(checkSig)))
            .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        
        if (sigB64 !== checkSigB64) return null;
        
        const payload = JSON.parse(atob(bodyB64));
        if (Date.now() / 1000 > payload.exp) return null; 
        
        return payload;
    } catch (e) { return null; }
}

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = getCorsHeaders(request);

    // --- HANDLE PREFLIGHT ---
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);
    const path = url.pathname;

    // --- ROUTE 1: HEALTH CHECK ---
    if (path === "/health") {
        const isMaintenance = await env.AUTH.get("maintenance");
        return json({ status: "ok", maintenance: isMaintenance === "true" }, 200, corsHeaders);
    }

    // --- ROUTE 2: AUTH INIT (Send Code) ---
    if (path === "/auth/init" && request.method === "POST") {
      try {
        const { email } = await request.json();
        if (!email) return json({ message: "Email required" }, 400, corsHeaders);

        // A. Security Checks (Rate Limits & Blocks)
        const blockUntil = await env.AUTH.get(`block:${email}`);
        if (blockUntil && Date.now() < parseInt(blockUntil)) {
             return json({ message: "Account locked due to failed attempts.", retryAfter: "24h" }, 429, corsHeaders);
        }

        const today = new Date().toISOString().split('T')[0];
        const sendCount = parseInt(await env.AUTH.get(`sends:${email}:${today}`) || "0");
        
        // Strict Limit: 5 OTPs per day per email
        if (sendCount >= 5) {
            return json({ message: "Daily login limit reached. Try tomorrow." }, 429, corsHeaders);
        }

        // B. Whop Subscription Check
        // We fetch ALL memberships for this email
        const whopRes = await fetch(`https://api.whop.com/v1/memberships?email=${encodeURIComponent(email)}&company_id=biz_NKjInkwjdusLhS`, {
            headers: { 'Authorization': `Bearer ${env.WHOP_API_KEY}` }
        });
        
        if (!whopRes.ok) {
            console.error("Whop API Error:", whopRes.status);
            return json({ message: "License check failed (Provider Error)" }, 502, corsHeaders);
        }

        const whopData = await whopRes.json();
        
        // Valid Statuses: We include 'completed' for Lifetime/One-time purchases
        const validStatuses = ['active', 'trialing', 'paid_subscriber', 'completed'];
        
        const hasAccess = whopData.data && whopData.data.some(m => {
            const statusOk = validStatuses.includes(m.status);
            
            // STRICT PRODUCT CHECK
            // If WHOP_PRODUCT_ID is set in Cloudflare, we enforce it.
            // If not set, we allow any valid membership (Be careful!)
            const requiredId = env.WHOP_PRODUCT_ID;
            const productOk = requiredId ? (m.product_id === requiredId || m.experience_id === requiredId) : true;
            
            return statusOk && productOk;
        });

        if (!hasAccess) {
            return json({ message: "No active subscription found for this email.", code: "NO_SUBSCRIPTION" }, 403, corsHeaders);
        }

        // C. Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store hash/code with 5 min expiry
        await env.AUTH.put(`otp:${email}`, JSON.stringify({ code: otp, attempts: 0 }), { expirationTtl: 300 });
        
        // Increment daily counter
        await env.AUTH.put(`sends:${email}:${today}`, (sendCount + 1).toString(), { expirationTtl: 86400 });

        // D. Send Email via Resend
        // REMOVED ADMIN BYPASS: Even personal email must go through this now.
        const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: "MetaStar Security <auth@metastar.site>", 
                to: email, 
                subject: `Your Access Code: ${otp}`, 
                html: `
                <div style="font-family: sans-serif; text-align: center; padding: 20px;">
                    <h2>MetaStar Studio</h2>
                    <p>Your verification code is:</p>
                    <h1 style="font-size: 32px; letter-spacing: 5px; color: #000;">${otp}</h1>
                    <p style="color: #888; font-size: 12px;">This code expires in 5 minutes.</p>
                </div>`
            })
        });

        if (!emailRes.ok) {
            console.error("Resend API Error");
            return json({ message: "Failed to send email." }, 500, corsHeaders);
        }

        return json({ success: true }, 200, corsHeaders);

      } catch (e) { 
        console.error("Auth Init Error:", e);
        return json({ message: "Server Error" }, 500, corsHeaders); 
      }
    }

    // --- ROUTE 3: AUTH VERIFY (Login) ---
    if (path === "/auth/verify" && request.method === "POST") {
      try {
        const { email, code } = await request.json();
        
        // Retrieve OTP Data
        const otpDataStr = await env.AUTH.get(`otp:${email}`);
        if (!otpDataStr) return json({ message: "Code expired or invalid." }, 403, corsHeaders);

        const otpData = JSON.parse(otpDataStr);

        // Check Logic: 3 Attempts Max
        if (otpData.attempts >= 3) {
            // Lock account for 24h
            await env.AUTH.put(`block:${email}`, (Date.now() + 86400000).toString(), { expirationTtl: 86400 });
            await env.AUTH.delete(`otp:${email}`); // Kill the code
            return json({ message: "Too many failed attempts. Account locked for 24h." }, 429, corsHeaders);
        }

        if (otpData.code !== code) {
            otpData.attempts++;
            await env.AUTH.put(`otp:${email}`, JSON.stringify(otpData), { expirationTtl: 300 });
            return json({ 
                message: "Incorrect code", 
                attemptsRemaining: 3 - otpData.attempts 
            }, 400, corsHeaders);
        }

        // Success: Clean up OTP
        await env.AUTH.delete(`otp:${email}`);

        // Generate JWT
        const secret = new TextEncoder().encode(env.JWT_SECRET);
        const payload = { sub: email, exp: Math.floor(Date.now() / 1000) + 604800 }; // 7 Days
        
        const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
        const body = btoa(JSON.stringify(payload));
        
        // Sign
        const sig = await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), new TextEncoder().encode(`${header}.${body}`));
        const token = `${header}.${body}.${btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;

        // Return Cookie + Token (Fallback)
        const cookie = `__Secure-MsToken=${token}; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=604800`;
        
        return json({ valid: true, token: token }, 200, { ...corsHeaders, "Set-Cookie": cookie });

      } catch (e) { 
          console.error("Verify Error:", e);
          return json({ message: "Verify failed" }, 500, corsHeaders); 
      }
    }

    // --- AUTH MIDDLEWARE (Internal) ---
    async function getAuth() {
        let token = getCookie(request, "__Secure-MsToken");
        // Fallback to Bearer Header
        if (!token) {
            const authHeader = request.headers.get("Authorization");
            if (authHeader && authHeader.startsWith("Bearer ")) token = authHeader.split(" ")[1];
        }
        if (!token) return null;
        return await verifyToken(token, env.JWT_SECRET);
    }

    // --- ROUTE 4: VALIDATE SESSION ---
    if (path === "/auth/validate" && request.method === "POST") {
        const user = await getAuth();
        if (!user) return json({ valid: false }, 200, corsHeaders);
        return json({ valid: true, email: user.sub }, 200, corsHeaders);
    }

    // --- ROUTE 5: SERVE CORE (Protected Asset) ---
    // Note: Updated path to match app.js request (/v2/core.js)
    if (path === "/v2/core.js") {
        const user = await getAuth();
        if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

        try {
            // Try v2 folder first, fallback to root if needed
            let object = await env.ASSETS.get("v2/core.js");
            if (object === null) object = await env.ASSETS.get("core.js"); 
            
            if (object === null) return new Response("Core not found", { status: 404, headers: corsHeaders });

            const headers = new Headers(corsHeaders);
            object.writeHttpMetadata(headers);
            headers.set("etag", object.httpEtag);
            // Prevent caching so revoked users lose access immediately on reload
            headers.set("Cache-Control", "no-store, max-age=0"); 

            return new Response(object.body, { headers });
        } catch (e) {
            return new Response("Storage Error", { status: 500, headers: corsHeaders });
        }
    }

    // --- ROUTE 6: STORAGE ---
    if (path.startsWith("/storage/")) {
        const user = await getAuth();
        if (!user) return json({ error: "Unauthorized" }, 401, corsHeaders);

        if (path.includes("save") && request.method === "POST") {
            try {
                const data = await request.json();
                await env.AUTH.put(`data:${user.sub}`, JSON.stringify(data));
                return json({ success: true }, 200, corsHeaders);
            } catch(e) { return json({ error: "Save Failed" }, 500, corsHeaders); }
        }

        if (path.includes("load") && request.method === "GET") {
            try {
                const data = await env.AUTH.get(`data:${user.sub}`);
                return json({ config: data ? JSON.parse(data) : null }, 200, corsHeaders);
            } catch(e) { return json({ error: "Load Failed" }, 500, corsHeaders); }
        }
    }
  
    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};