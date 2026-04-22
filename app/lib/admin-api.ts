import { cookies } from "next/headers";

const API_URL = process.env.ADMIN_API_URL ?? "http://localhost:8080";
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

export async function adminFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const cookieStore = await cookies();
  const email = cookieStore.get("ADMIN_SESSION")?.value ?? "";
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": ADMIN_SECRET,
      "X-Admin-Email": email,
      ...init?.headers,
    },
    cache: "no-store",
  });
}
