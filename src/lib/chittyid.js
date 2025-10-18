/**
 * ChittyID Proxy Service - Compliant with proxy-only policy
 * ALL ID generation MUST go through id.chitty.cc
 */

export async function getChittyId(env, type = "generic") {
  const url = env.CHITTY_ID_ENDPOINT || "https://id.chitty.cc/api/id/new";
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.CHITTY_ID_API_KEY ? { "x-api-key": env.CHITTY_ID_API_KEY } : {}),
    },
    body: JSON.stringify({ type }),
  });

  if (!res.ok) {
    throw new Error(`ChittyID service error: ${res.status}`);
  }

  const { id } = await res.json();
  return id;
}

export function sanitizeIdentifier(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error("Invalid identifier");
  }
  return name;
}

export async function sha256Hex(obj) {
  const enc = new TextEncoder();
  const buf = enc.encode(typeof obj === "string" ? obj : JSON.stringify(obj));
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}
