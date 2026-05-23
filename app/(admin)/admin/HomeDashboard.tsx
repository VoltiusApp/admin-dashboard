"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Link from "next/link";
import {
  adminApi,
  type OverviewResponse,
} from "@/app/lib/admin-client";

const TIER_COLORS: Record<string, string> = {
  free: "#525252",
  pro: "#60a5fa",
  teams: "#c084fc",
  business: "#4ade80",
};

const GRID = "#1f2937";
const AXIS = "#4b5563";

export function HomeDashboard({
  initialData,
}: {
  initialData: OverviewResponse;
}) {
  const overview = useQuery({
    queryKey: ["overview"],
    queryFn: () => adminApi.overview.get(),
    initialData,
    refetchInterval: 60_000,
  });

  const data = overview.data;
  if (!data) {
    return <div className="p-6 text-red-400 text-sm">Failed to load overview.</div>;
  }

  // Build merged signups-vs-churn series for the line chart.
  const series = data.signups_series.map((s, i) => ({
    day: s.day,
    label: shortDay(s.day),
    signups: s.count,
    churn: data.churn_series[i]?.count ?? 0,
  }));

  const mrrPieData = [
    { name: "Pro", value: data.mrr_by_tier.pro, color: TIER_COLORS.pro },
    { name: "Teams", value: data.mrr_by_tier.teams, color: TIER_COLORS.teams },
    {
      name: "Business",
      value: data.mrr_by_tier.business,
      color: TIER_COLORS.business,
    },
  ].filter((d) => d.value > 0);

  const tierPieData = [
    { name: "Free", value: data.tier_breakdown.free, color: TIER_COLORS.free },
    { name: "Pro", value: data.tier_breakdown.pro, color: TIER_COLORS.pro },
    { name: "Teams", value: data.tier_breakdown.teams, color: TIER_COLORS.teams },
    {
      name: "Business",
      value: data.tier_breakdown.business,
      color: TIER_COLORS.business,
    },
  ].filter((d) => d.value > 0);

  const arrLabel = `~$${(data.mrr_total * 12).toLocaleString()}/yr ARR`;

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Overview</h1>
          <p className="text-xs text-gray-600 mt-1">
            Live metrics from local DB · webhooks-synced from Lemon Squeezy
            {overview.isFetching && (
              <span className="ml-2 text-gray-700">syncing…</span>
            )}
          </p>
        </div>
        <div className="text-[10px] text-gray-600 font-mono">
          Refreshes every 60s · ⌘K to act
        </div>
      </div>

      {/* Hero cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <HeroCard
          label="MRR"
          value={`$${data.mrr_total.toLocaleString()}`}
          sub={arrLabel}
          accent="green"
        />
        <HeroCard
          label="Paying subscribers"
          value={data.paying_subscribers}
          sub={`${data.conversion_pct.toFixed(1)}% of ${data.total_users.toLocaleString()} users`}
          accent="blue"
        />
        <HeroCard
          label="Trials active"
          value={data.trials_active}
          sub={
            data.trials_expiring_7d > 0
              ? `${data.trials_expiring_7d} expiring in 7d`
              : "none expiring soon"
          }
          accent={data.trials_expiring_7d > 0 ? "yellow" : "neutral"}
        />
        <HeroCard
          label="Churn (30d)"
          value={data.churn_30d}
          sub={
            data.signups_30d > 0
              ? `vs ${data.signups_30d} signups`
              : "no signups"
          }
          accent={data.churn_30d > data.signups_30d ? "red" : "neutral"}
        />
      </div>

      {/* Signups vs Churn chart */}
      <Section
        title="Signups vs Churn — last 90 days"
        right={
          <div className="flex gap-3 text-[10px]">
            <Legend color={TIER_COLORS.pro} label={`Signups · 7d ${data.signups_7d} · 30d ${data.signups_30d}`} />
            <Legend color="#f87171" label={`Churn · 7d ${data.churn_7d} · 30d ${data.churn_30d}`} />
          </div>
        }
      >
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gSignups" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TIER_COLORS.pro} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={TIER_COLORS.pro} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gChurn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} strokeDasharray="2 3" vertical={false} />
              <XAxis
                dataKey="label"
                stroke={AXIS}
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: GRID }}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                stroke={AXIS}
                fontSize={10}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<DarkTooltip />} />
              <Area
                type="monotone"
                dataKey="signups"
                stroke={TIER_COLORS.pro}
                strokeWidth={1.5}
                fill="url(#gSignups)"
              />
              <Area
                type="monotone"
                dataKey="churn"
                stroke="#f87171"
                strokeWidth={1.5}
                fill="url(#gChurn)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* MRR breakdown + tier distribution + recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section title="MRR by tier">
          {mrrPieData.length === 0 ? (
            <EmptyChart label="No paying subscribers yet." />
          ) : (
            <div className="grid grid-cols-[140px_1fr] gap-3 items-center">
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mrrPieData}
                      dataKey="value"
                      innerRadius={28}
                      outerRadius={56}
                      paddingAngle={2}
                      stroke="#0a0a0a"
                      strokeWidth={2}
                    >
                      {mrrPieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<DarkTooltip prefix="$" />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5 text-xs">
                {mrrPieData.map((d) => (
                  <li key={d.name} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-sm"
                        style={{ background: d.color }}
                      />
                      <span className="text-gray-400">{d.name}</span>
                    </span>
                    <span className="text-white tabular-nums">
                      ${d.value.toLocaleString()}
                    </span>
                  </li>
                ))}
                <li className="flex items-center justify-between gap-2 pt-1.5 border-t border-gray-800">
                  <span className="text-gray-500">Total</span>
                  <span className="text-white font-bold tabular-nums">
                    ${data.mrr_total.toLocaleString()}
                  </span>
                </li>
              </ul>
            </div>
          )}
        </Section>

        <Section title="Tier distribution">
          <div className="grid grid-cols-[140px_1fr] gap-3 items-center">
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tierPieData}
                    dataKey="value"
                    innerRadius={28}
                    outerRadius={56}
                    paddingAngle={2}
                    stroke="#0a0a0a"
                    strokeWidth={2}
                  >
                    {tierPieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<DarkTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-xs">
              {tierPieData.map((d) => (
                <li key={d.name} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-sm"
                      style={{ background: d.color }}
                    />
                    <span className="text-gray-400">{d.name}</span>
                  </span>
                  <span className="text-white tabular-nums">
                    {d.value.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section title="Storage + housekeeping">
          <ul className="space-y-2 text-xs">
            <MetricRow
              label="Sync blob storage"
              value={`${data.total_blob_gb.toFixed(2)} GB`}
            />
            <MetricRow
              label="Total users"
              value={data.total_users.toLocaleString()}
            />
            <MetricRow
              label="Pending deletion"
              value={data.deleted_pending}
              accent={data.deleted_pending > 0 ? "red" : undefined}
              link={data.deleted_pending > 0 ? "/admin/users?deleted=only" : undefined}
            />
            <MetricRow
              label="Paid conversion"
              value={`${data.conversion_pct.toFixed(1)}%`}
            />
          </ul>
        </Section>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Recent signups">
          {data.recent_signups.length === 0 ? (
            <p className="text-xs text-gray-600">No signups yet.</p>
          ) : (
            <ul className="text-xs divide-y divide-gray-900">
              {data.recent_signups.map((u) => (
                <li key={u.id} className="py-2 flex items-center justify-between gap-3">
                  <Link
                    href={`/admin/users?u=${u.id}`}
                    className="text-gray-200 hover:text-white truncate"
                  >
                    {u.email}
                  </Link>
                  <span className="flex items-center gap-2 shrink-0">
                    <TierBadge tier={u.subscription_tier} />
                    <span className="text-gray-600 text-[10px] tabular-nums">
                      {relTime(u.created_at)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Recent churn">
          {data.recent_churn.length === 0 ? (
            <p className="text-xs text-gray-600">No churn events.</p>
          ) : (
            <ul className="text-xs divide-y divide-gray-900">
              {data.recent_churn.map((c) => (
                <li key={c.id} className="py-2 flex items-center justify-between gap-3">
                  <Link
                    href={`/admin/users?u=${c.user_id}`}
                    className="text-gray-300 hover:text-white truncate font-mono"
                  >
                    {c.user_id.slice(0, 8)}…
                  </Link>
                  <span className="flex items-center gap-2 shrink-0">
                    <TierBadge tier={c.from_tier} />
                    <span className="text-gray-700">→</span>
                    <TierBadge tier={c.to_tier} />
                    {c.reason && (
                      <span className="text-gray-600 text-[10px] truncate max-w-[100px]">
                        {c.reason}
                      </span>
                    )}
                    <span className="text-gray-600 text-[10px] tabular-nums">
                      {relTime(c.created_at)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function HeroCard({
  label,
  value,
  sub,
  accent = "neutral",
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "neutral" | "green" | "blue" | "yellow" | "red";
}) {
  const accentRing = {
    neutral: "border-gray-800",
    green: "border-gray-800 ring-1 ring-green-900/50",
    blue: "border-gray-800 ring-1 ring-blue-900/50",
    yellow: "border-gray-800 ring-1 ring-yellow-900/50",
    red: "border-gray-800 ring-1 ring-red-900/50",
  }[accent];
  const accentLabel = {
    neutral: "text-gray-500",
    green: "text-green-400",
    blue: "text-blue-400",
    yellow: "text-yellow-400",
    red: "text-red-400",
  }[accent];
  return (
    <div className={`bg-gray-950 border rounded p-4 ${accentRing}`}>
      <div className={`text-[10px] uppercase tracking-widest ${accentLabel} mb-2`}>
        {label}
      </div>
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-gray-600 mt-1">{sub}</div>}
    </div>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-950 border border-gray-800 rounded p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
          {title}
        </h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function MetricRow({
  label,
  value,
  accent,
  link,
}: {
  label: string;
  value: string | number;
  accent?: "red";
  link?: string;
}) {
  const valueColor = accent === "red" ? "text-red-400" : "text-white";
  const content = (
    <span
      className={`flex items-center justify-between border-b border-gray-900 pb-2 ${link ? "cursor-pointer hover:bg-gray-900/30 px-1 -mx-1 rounded" : ""}`}
    >
      <span className="text-gray-500">{label}</span>
      <span className={`${valueColor} tabular-nums`}>{value}</span>
    </span>
  );
  return (
    <li>
      {link ? (
        <Link href={link} className="block">
          {content}
        </Link>
      ) : (
        content
      )}
    </li>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const cls: Record<string, string> = {
    free: "bg-gray-800 text-gray-400",
    pro: "bg-blue-950 text-blue-300",
    teams: "bg-purple-950 text-purple-300",
    business: "bg-green-950 text-green-300",
  };
  return (
    <span className={`${cls[tier] ?? cls.free} text-[10px] rounded px-1.5 py-0.5`}>
      {tier}
    </span>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-gray-500">
      <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-32 flex items-center justify-center text-xs text-gray-600">
      {label}
    </div>
  );
}

function DarkTooltip({
  active,
  payload,
  label,
  prefix = "",
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
  prefix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-950 border border-gray-700 rounded px-2.5 py-1.5 text-[11px] shadow-xl">
      {label && <div className="text-gray-500 mb-1">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-gray-400 capitalize">{p.name}</span>
          <span className="text-white tabular-nums ml-2">
            {prefix}
            {p.value?.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function shortDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}
