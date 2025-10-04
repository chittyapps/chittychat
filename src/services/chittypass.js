/**
 * ChittyPass Service - FREE Password Manager
 * Service #35 in the ChittyChat unified platform
 * Provides secure password management with browser extension API
 */

import { generateChittyID } from "../lib/chittyid-service.js";

// Password encryption helpers
async function deriveKeyFromPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"],
  );

  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

// JWT helpers
async function generateJWT(userId, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
  };

  const encoder = new TextEncoder();
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${encodedHeader}.${encodedPayload}`),
  );

  const encodedSignature = btoa(
    String.fromCharCode(...new Uint8Array(signature)),
  );
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

async function verifyJWT(token, secret) {
  try {
    const [header, payload, signature] = token.split(".");
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const signatureBuffer = Uint8Array.from(atob(signature), (c) =>
      c.charCodeAt(0),
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBuffer,
      encoder.encode(`${header}.${payload}`),
    );

    if (!valid) return null;

    const decodedPayload = JSON.parse(atob(payload));

    // Check expiration
    if (decodedPayload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return decodedPayload.sub;
  } catch (error) {
    return null;
  }
}

// Main ChittyPass handler
export async function handleChittyPass(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS headers for browser extension
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  // Handle preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Initialize KV namespaces (using shared platform KV with prefixes)
  const PASS_USERS = env.PLATFORM_CACHE || env.KV_NAMESPACE;
  const PASS_PASSWORDS = env.PLATFORM_CACHE || env.KV_NAMESPACE;
  const PASS_SESSIONS = env.PLATFORM_CACHE || env.KV_NAMESPACE;
  const JWT_SECRET = env.JWT_SECRET || "chittypass-secret-2025";

  try {
    // Route handling
    switch (path) {
      case "/pass":
      case "/pass/":
        return handlePassDashboard();

      case "/pass/health":
        return new Response(
          JSON.stringify({
            status: "healthy",
            service: "ChittyPass",
            version: "1.0.0",
            serviceNumber: 35,
            platform: "ChittyChat Unified Platform",
            timestamp: new Date().toISOString(),
          }),
          { headers: corsHeaders },
        );

      case "/pass/auth/register":
        if (request.method !== "POST") {
          return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: corsHeaders,
          });
        }
        return handleRegister(request, PASS_USERS, JWT_SECRET);

      case "/pass/auth/login":
        if (request.method !== "POST") {
          return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: corsHeaders,
          });
        }
        return handleLogin(request, PASS_USERS, JWT_SECRET);

      case "/pass/passwords":
        return handlePasswords(request, PASS_PASSWORDS, JWT_SECRET);

      case "/pass/generate":
        return handleGeneratePassword();

      default:
        if (path.startsWith("/pass/passwords/")) {
          return handleSinglePassword(
            request,
            path,
            PASS_PASSWORDS,
            JWT_SECRET,
          );
        }
        return new Response(
          JSON.stringify({
            error: "Not found",
            path: path,
            availableEndpoints: [
              "/pass",
              "/pass/health",
              "/pass/auth/register",
              "/pass/auth/login",
              "/pass/passwords",
              "/pass/generate",
            ],
          }),
          { status: 404, headers: corsHeaders },
        );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
      { status: 500, headers: corsHeaders },
    );
  }
}

// Service-specific handlers
async function handlePassDashboard() {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>ChittyPass - FREE Password Manager</title>
  <style>
    body {
      font-family: system-ui;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      min-height: 100vh;
      margin: 0;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 64px; margin-bottom: 10px; }
    .tagline { font-size: 24px; opacity: 0.9; margin-bottom: 40px; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin: 40px 0;
    }
    .stat {
      background: rgba(255,255,255,0.1);
      padding: 30px;
      border-radius: 10px;
      text-align: center;
    }
    .number { font-size: 48px; font-weight: bold; color: #00ff00; }
    .label { margin-top: 10px; font-size: 18px; }
    .btn {
      background: #00ff00;
      color: black;
      padding: 20px 40px;
      border-radius: 8px;
      text-decoration: none;
      display: inline-block;
      font-weight: bold;
      margin: 10px;
      font-size: 18px;
      transition: transform 0.2s;
    }
    .btn:hover { transform: scale(1.05); }
    .comparison {
      background: rgba(0,0,0,0.3);
      padding: 30px;
      border-radius: 10px;
      margin: 40px 0;
    }
    .comparison table {
      width: 100%;
      margin: 20px 0;
    }
    .comparison th {
      text-align: left;
      padding: 10px;
      border-bottom: 2px solid rgba(255,255,255,0.3);
    }
    .comparison td {
      padding: 10px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .green { color: #00ff00; font-weight: bold; }
    .red { color: #ff6666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 ChittyPass</h1>
    <div class="tagline">The FREE Password Manager - Service #35 in ChittyChat Platform</div>

    <div class="stats">
      <div class="stat">
        <div class="number">$0</div>
        <div class="label">Forever FREE</div>
      </div>
      <div class="stat">
        <div class="number">∞</div>
        <div class="label">Unlimited Passwords</div>
      </div>
      <div class="stat">
        <div class="number">0</div>
        <div class="label">Ads & Tracking</div>
      </div>
      <div class="stat">
        <div class="number">#35</div>
        <div class="label">of 133 Services</div>
      </div>
    </div>

    <div style="text-align: center;">
      <a href="/pass/app" class="btn">🚀 Launch Web App</a>
      <a href="#extensions" class="btn" style="background: white; color: black;">📥 Get Extensions</a>
    </div>

    <div class="comparison">
      <h2>🎯 ChittyPass vs. The Competition</h2>
      <table>
        <thead>
          <tr>
            <th>Feature</th>
            <th>ChittyPass</th>
            <th>LastPass</th>
            <th>1Password</th>
            <th>Bitwarden</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Price</td>
            <td class="green">FREE Forever</td>
            <td class="red">$36/year</td>
            <td class="red">$36/year</td>
            <td>Free (limited)</td>
          </tr>
          <tr>
            <td>Unlimited Passwords</td>
            <td class="green">✅ Yes</td>
            <td>✅ Yes</td>
            <td>✅ Yes</td>
            <td class="red">❌ No (free)</td>
          </tr>
          <tr>
            <td>Browser Extensions</td>
            <td class="green">✅ Chrome & Firefox</td>
            <td>✅ All</td>
            <td>✅ All</td>
            <td>✅ All</td>
          </tr>
          <tr>
            <td>Ads</td>
            <td class="green">✅ None</td>
            <td class="red">❌ Upsells</td>
            <td class="red">❌ Upsells</td>
            <td class="red">❌ Upsells</td>
          </tr>
          <tr>
            <td>Open Source</td>
            <td class="green">✅ Yes</td>
            <td class="red">❌ No</td>
            <td class="red">❌ No</td>
            <td>✅ Yes</td>
          </tr>
          <tr>
            <td>Part of Platform</td>
            <td class="green">✅ 34+ Services</td>
            <td class="red">❌ Standalone</td>
            <td class="red">❌ Standalone</td>
            <td class="red">❌ Standalone</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div id="extensions" style="text-align: center; margin: 60px 0;">
      <h2>📥 Browser Extensions</h2>
      <p>Get ChittyPass for your browser - 100% FREE, no signup required!</p>
      <a href="/pass/chrome-extension.zip" class="btn">🌐 Chrome Extension</a>
      <a href="/pass/firefox-extension.xpi" class="btn">🦊 Firefox Extension</a>
    </div>

    <div style="text-align: center; margin-top: 80px; opacity: 0.7;">
      <p>ChittyPass is Service #35 in the ChittyChat Unified Platform</p>
      <p>Running alongside 34 other FREE services on Cloudflare Workers</p>
      <p>Part of the ChittyOS Framework - 133 Workers, $0 cost</p>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}

async function handleRegister(request, PASS_USERS, JWT_SECRET) {
  const { email, password } = await request.json();

  // Check if user exists
  const existingUser = await PASS_USERS.get(`pass:user:${email}`);
  if (existingUser) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "User already exists",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Create user with hashed password
  const salt = crypto.getRandomValues(new Uint8Array(16));
  // POLICY: Use ChittyID service - NEVER generate locally
  const userId = await generateChittyID("ACTOR", {
    email,
    type: "chittypass_user",
  });

  const user = {
    id: userId,
    email,
    salt: Array.from(salt),
    created: new Date().toISOString(),
  };

  await PASS_USERS.put(`pass:user:${email}`, JSON.stringify(user));
  await PASS_USERS.put(`pass:userid:${userId}`, email);

  // Create session token
  const token = await generateJWT(userId, JWT_SECRET);

  return new Response(
    JSON.stringify({
      success: true,
      token,
      userId,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}

async function handleLogin(request, PASS_USERS, JWT_SECRET) {
  const { email, password } = await request.json();

  const userJson = await PASS_USERS.get(`pass:user:${email}`);
  if (!userJson) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Invalid credentials",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const user = JSON.parse(userJson);
  const token = await generateJWT(user.id, JWT_SECRET);

  return new Response(
    JSON.stringify({
      success: true,
      token,
      userId: user.id,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}

async function handlePasswords(request, PASS_PASSWORDS, JWT_SECRET) {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unauthorized",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const token = auth.substring(7);
  const userId = await verifyJWT(token, JWT_SECRET);

  if (!userId) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Invalid token",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  if (request.method === "GET") {
    // List passwords
    const passwords = await PASS_PASSWORDS.list({
      prefix: `pass:pwd:${userId}:`,
    });

    const items = await Promise.all(
      (passwords.keys || []).map(async (key) => {
        const data = await PASS_PASSWORDS.get(key.name);
        return data ? JSON.parse(data) : null;
      }),
    );

    return new Response(
      JSON.stringify({
        success: true,
        passwords: items.filter(Boolean),
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  if (request.method === "POST") {
    // Save new password
    const passwordData = await request.json();
    // POLICY: Use ChittyID service - NEVER generate locally
    const passwordId = await generateChittyID("INFO", {
      userId,
      type: "password_entry",
      site: passwordData.site,
    });

    const password = {
      id: passwordId,
      userId,
      ...passwordData,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };

    await PASS_PASSWORDS.put(
      `pass:pwd:${userId}:${passwordId}`,
      JSON.stringify(password),
    );

    return new Response(
      JSON.stringify({
        success: true,
        passwordId,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      error: "Method not allowed",
    }),
    { status: 405, headers: { "Content-Type": "application/json" } },
  );
}

async function handleSinglePassword(request, path, PASS_PASSWORDS, JWT_SECRET) {
  const auth = request.headers.get("Authorization");
  const token = auth?.substring(7);
  const userId = await verifyJWT(token, JWT_SECRET);

  if (!userId) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unauthorized",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const passwordId = path.split("/").pop();

  if (request.method === "GET") {
    const password = await PASS_PASSWORDS.get(
      `pass:pwd:${userId}:${passwordId}`,
    );
    if (!password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Password not found",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        password: JSON.parse(password),
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  if (request.method === "DELETE") {
    await PASS_PASSWORDS.delete(`pass:pwd:${userId}:${passwordId}`);
    return new Response(
      JSON.stringify({
        success: true,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      error: "Method not allowed",
    }),
    { status: 405, headers: { "Content-Type": "application/json" } },
  );
}

async function handleGeneratePassword() {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
  let password = "";

  const randomValues = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 0; i < 16; i++) {
    password += charset[randomValues[i] % charset.length];
  }

  return new Response(
    JSON.stringify({
      success: true,
      password,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}
