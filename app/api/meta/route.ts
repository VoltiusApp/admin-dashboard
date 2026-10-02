import { NextResponse } from "next/server";
import { getMeta } from "@/app/lib/get-meta";

export async function GET() {
  return NextResponse.json(await getMeta());
}
