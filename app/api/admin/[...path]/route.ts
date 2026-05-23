import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const API_URL = process.env.ADMIN_API_URL ?? "http://localhost:8080";
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

// Hop-by-hop headers + ones we set ourselves; never forward upstream.
const STRIPPED_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-encoding",
  "content-length",
]);

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const cookieStore = await cookies();
  const adminEmail = cookieStore.get("ADMIN_SESSION")?.value ?? "";

  const search = req.nextUrl.search;
  const upstreamUrl = `${API_URL}/v1/admin/${path.join("/")}${search}`;

  const headers = new Headers();
  headers.set("X-Admin-Key", ADMIN_SECRET);
  headers.set("X-Admin-Email", adminEmail);
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);

  const method = req.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
  };
  if (method !== "GET" && method !== "HEAD") {
    // Buffer the body — Next route handlers don't always stream cleanly to fetch().
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 0) init.body = buf;
  }

  const upstream = await fetch(upstreamUrl, init);

  const respHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) {
      respHeaders.set(key, value);
    }
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
