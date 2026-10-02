import type { ServerMeta } from "./admin-client";

const API_URL = process.env.ADMIN_API_URL ?? "http://localhost:8080";
const FALLBACK: ServerMeta = { self_hosted: true, billing_enabled: false };

export async function getMeta(): Promise<ServerMeta> {
  try {
    const res = await fetch(`${API_URL}/v1/meta`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok ? ((await res.json()) as ServerMeta) : FALLBACK;
  } catch {
    return FALLBACK;
  }
}
