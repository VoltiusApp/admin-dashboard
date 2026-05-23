import { adminFetch } from "@/app/lib/admin-api";
import type { OverviewResponse } from "@/app/lib/admin-client";
import { HomeDashboard } from "./HomeDashboard";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  let data: OverviewResponse | null = null;
  let fetchError: string | null = null;
  try {
    const res = await adminFetch("/v1/admin/overview");
    if (res.ok) {
      data = await res.json();
    } else {
      const body = await res.text().catch(() => "");
      fetchError = `API returned ${res.status}: ${body || res.statusText}`;
    }
  } catch (e) {
    fetchError = `Network error: ${e instanceof Error ? e.message : String(e)}`;
  }

  if (fetchError || !data) {
    return (
      <div className="p-6">
        <div className="bg-red-900/30 border border-red-800 rounded px-4 py-3 text-sm text-red-300 font-mono">
          {fetchError ?? "No data."}
        </div>
      </div>
    );
  }

  return <HomeDashboard initialData={data} />;
}
