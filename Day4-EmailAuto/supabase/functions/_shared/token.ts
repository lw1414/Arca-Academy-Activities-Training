// HMAC-SHA256 magic-link tokens. Same secret signs and verifies.
const enc = new TextEncoder();

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function b64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromB64url(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

export async function sign(id: string, purpose: string, secret: string): Promise<string> {
  const k = await key(secret);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(`${id}:${purpose}`));
  return b64url(sig);
}

export async function verify(id: string, purpose: string, token: string, secret: string): Promise<boolean> {
  const k = await key(secret);
  return crypto.subtle.verify(
    "HMAC",
    k,
    fromB64url(token),
    enc.encode(`${id}:${purpose}`),
  );
}
