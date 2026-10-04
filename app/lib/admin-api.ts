import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/app/lib/session";

export const API_URL = process.env.ADMIN_API_URL ?? "http://localhost:8080";
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

/** Backend auth headers for the signed-in admin, or null when the session doesn't verify. */
export async function adminAuthHeaders(): Promise<Headers | null> {
  const cookieStore = await cookies();
  const email = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!email) return null;
  return new Headers({ "X-Admin-Key": ADMIN_SECRET, "X-Admin-Email": email });
}

export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

export async function adminFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const auth = await adminAuthHeaders();
  if (!auth) return unauthorized();
  const headers = new Headers({ "Content-Type": "application/json" });
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  auth.forEach((value, key) => headers.set(key, value));
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
