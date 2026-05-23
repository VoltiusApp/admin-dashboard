import { adminFetch } from "@/app/lib/admin-api";

interface Stats {
  total_users: number;
  by_tier: { free: number; pro: number; teams: number; business: number };
  trials_active: number;
  trials_expiring_7d: number;
  banned_count: number;
  signups_last_30d: number;
  churned_last_30d: number;
  total_blob_gb: number;
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-600 mt-1">{sub}</div>}
    </div>
  );
}

export default async function StatsPage() {
  let stats: Stats | null = null;
  let fetchError: string | null = null;
  try {
    const res = await adminFetch("/v1/admin/stats");
    if (res.ok) {
      stats = await res.json();
    } else {
      const body = await res.text().catch(() => "");
      fetchError = `API returned ${res.status}: ${body || res.statusText}`;
    }
  } catch (e) {
    fetchError = `Network error: ${e instanceof Error ? e.message : String(e)}`;
  }

  if (!stats) {
    return (
      <div className="p-6">
        <div className="bg-red-900/30 border border-red-800 rounded px-4 py-3 text-sm text-red-300 font-mono">
          {fetchError ?? "Failed to load stats."}
        </div>
      </div>
    );
  }

  const mrrEstimate =
    stats.by_tier.pro * 7 + stats.by_tier.teams * 15 + stats.by_tier.business * 49;
  const conversionRate =
    stats.total_users > 0
      ? (
          ((stats.by_tier.pro + stats.by_tier.teams + stats.by_tier.business) /
            stats.total_users) *
          100
        ).toFixed(1)
      : "0";

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-white">Stats</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total users" value={stats.total_users} />
        <Stat label="Signups last 30d" value={stats.signups_last_30d} />
        <Stat label="Churned last 30d" value={stats.churned_last_30d} />
        <Stat label="Banned" value={stats.banned_count} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Trials active" value={stats.trials_active} />
        <Stat label="Expiring in 7d" value={stats.trials_expiring_7d} />
        <Stat
          label="Paid conversion"
          value={`${conversionRate}%`}
          sub="non-free / total"
        />
        <Stat
          label="MRR estimate"
          value={`$${mrrEstimate}`}
          sub="rough, not from LS"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total blob storage" value={`${stats.total_blob_gb.toFixed(2)} GB`} />
      </div>

      <div>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
          Tier Breakdown
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(["free", "pro", "teams", "business"] as const).map((tier) => (
            <Stat
              key={tier}
              label={tier.charAt(0).toUpperCase() + tier.slice(1)}
              value={stats!.by_tier[tier]}
              sub={
                stats!.total_users > 0
                  ? `${((stats!.by_tier[tier] / stats!.total_users) * 100).toFixed(1)}%`
                  : "0%"
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
