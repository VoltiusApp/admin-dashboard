export const SESSION_COOKIE = "ADMIN_SESSION";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export function isAllowedEmail(email: string): boolean {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

// Keyed on the password too, so changing ADMIN_PASSWORD signs every admin out.
async function signingKey(): Promise<CryptoKey | null> {
  const secret = process.env.ADMIN_SECRET ?? "";
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!secret || !password) return null;
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(`voltius-admin-session-v1\0${secret}\0${password}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSession(email: string): Promise<string | null> {
  const key = await signingKey();
  if (!key) return null;
  const expires = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${toBase64Url(encoder.encode(email))}.${expires}`;
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return `${payload}.${toBase64Url(sig)}`;
}

/** The signed-in admin's email, or null for a missing, forged, expired or revoked session. */
export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [emailPart, expiresPart, sigPart] = parts;

  const key = await signingKey();
  const sig = fromBase64Url(sigPart);
  if (!key || !sig) return null;
  const valid = await crypto.subtle.verify("HMAC", key, sig, encoder.encode(`${emailPart}.${expiresPart}`));
  if (!valid) return null;

  const expires = Number(expiresPart);
  if (!Number.isFinite(expires) || expires <= Date.now()) return null;

  const emailBytes = fromBase64Url(emailPart);
  if (!emailBytes) return null;
  const email = new TextDecoder().decode(emailBytes);
  return isAllowedEmail(email) ? email : null;
}
