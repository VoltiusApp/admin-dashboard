import { NextResponse } from "next/server";

const API_URL = process.env.ADMIN_API_URL ?? "http://localhost:8080";

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/v1/meta`, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { self_hosted: true, billing_enabled: false },
        { status: 200 },
      );
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(
      { self_hosted: true, billing_enabled: false },
      { status: 200 },
    );
  }
}
