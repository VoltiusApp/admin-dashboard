"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Link from "next/link";
import { toast } from "sonner";
import {
  adminApi,
  type LsMetrics,
  type LsRecentOrder,
  type LsSummaryResponse,
  type OverviewResponse,
} from "@/app/lib/admin-client";
import { useMeta } from "@/app/lib/use-meta";

const TIER_COLORS: Record<string, string> = {
  free: "#525252",
  pro: "#60a5fa",
  pro_trial: "#fbbf24",
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
  const qc = useQueryClient();
  const meta = useMeta();
  const selfHosted = meta.self_hosted;

  const overview = useQuery({
    queryKey: ["overview"],
    queryFn: () => adminApi.overview.get(),
    initialData,
    refetchInterval: 60_000,
  });

  const ls = useQuery({
    queryKey: ["ls-summary"],
    queryFn: () => adminApi.lemonsqueezy.summary(),
    refetchInterval: 60_000,
    enabled: !selfHosted,
  });

  const refreshLs = useMutation({
    mutationFn: () => adminApi.lemonsqueezy.summary({ refresh: true }),
    onSuccess: (data) => {
      qc.setQueryData(["ls-summary"], data);
      if (data.last_error) toast.error(`LS refresh: ${data.last_error}`);
      else toast.success("Lemon Squeezy data refreshed");
    },
    onError: () => toast.error("LS refresh failed"),
  });

  const data = overview.data;
  if (!data) {
    return <div className="p-6 text-red-400 text-sm">Failed to load overview.</div>;
  }

  const lsData = ls.data;
  const lsMetrics = lsData?.metrics ?? null;
  const lsCurrency = lsMetrics?.currency ?? "USD";

  // Build merged signups-vs-churn series for the line chart.
  const series = data.signups_series.map((s, i) => ({
    day: s.day,
    label: shortDay(s.day),
    signups: s.count,
    churn: data.churn_series[i]?.count ?? 0,
  }));

  // Accounts that have been stamped at least once. Percentages are taken against
  // this rather than total_users, so accounts that predate last_seen_on (or have
  // not reconnected since) don't read as dormant when they simply aren't counted.
  const countedUsers = data.total_users - data.never_seen;
  const activePct = (n: number) =>
    countedUsers > 0 ? Math.round((n / countedUsers) * 100) : 0;

  const tierPieData = [
    { name: "Free", value: data.tier_breakdown.free, color: TIER_COLORS.free },
    { name: "Pro", value: data.tier_breakdown.pro, color: TIER_COLORS.pro },
    { name: "Pro Trial", value: data.tier_breakdown.pro_trial, color: TIER_COLORS.pro_trial },
    { name: "Teams", value: data.tier_breakdown.teams, color: TIER_COLORS.teams },
    { name: "Business", value: data.tier_breakdown.business, color: TIER_COLORS.business },
  ].filter((d) => d.value > 0);

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Overview</h1>
          <p className="text-xs text-gray-600 mt-1">
            {selfHosted
              ? "Activity from local DB · self-hosted mode"
              : "Revenue from Lemon Squeezy · activity from local DB"}
            {overview.isFetching && (
              <span className="ml-2 text-gray-700">syncing…</span>
            )}
          </p>
        </div>
        {!selfHosted && (
          <LsRefreshControl
            ls={lsData ?? null}
            refreshing={refreshLs.isPending}
            onRefresh={() => refreshLs.mutate()}
          />
        )}
      </div>

      {/* Hero cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {!selfHosted && (
          <>
            <HeroCard
              label="MRR · live from LS"
              value={lsMetrics ? formatMoney(lsMetrics.mrr_cents, lsCurrency) : "—"}
              sub={
                lsMetrics
                  ? `${formatMoney(lsMetrics.mrr_cents * 12, lsCurrency)}/yr ARR`
                  : ls.isLoading
                    ? "loading…"
                    : lsData?.last_error
                      ? "error — see refresh"
                      : "no data yet"
              }
              accent="green"
            />
            <HeroCard
              label="Paying subscribers · LS"
              value={lsMetrics?.paying_count ?? "—"}
              sub={
                lsMetrics
                  ? `${lsMetrics.on_trial_count} on trial · ${lsMetrics.past_due_count} past due`
                  : "—"
              }
              accent="blue"
            />
          </>
        )}
        {selfHosted && (
          <HeroCard
            label="Total users"
            value={data.total_users.toLocaleString()}
            sub={`${data.signups_30d} new in 30d`}
            accent="blue"
          />
        )}
        <HeroCard
          label="Trials active · local"
          value={data.trials_active}
          sub={
            data.trials_expiring_7d > 0
              ? `${data.trials_expiring_7d} expiring in 7d`
              : "none expiring soon"
          }
          accent={data.trials_expiring_7d > 0 ? "yellow" : "neutral"}
        />
        <HeroCard
          label="Churn (30d) · local"
          value={data.churn_30d}
          sub={
            data.signups_30d > 0
              ? `vs ${data.signups_30d} signups`
              : "no signups"
          }
          accent={data.churn_30d > data.signups_30d ? "red" : "neutral"}
        />
      </div>

      {/* LS secondary row: revenue, failed, refunds, subscription mix */}
      {!selfHosted && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <HeroCard
            label="Revenue this month · LS"
            value={
              lsMetrics
                ? formatMoney(lsMetrics.revenue_this_month_cents, lsCurrency)
                : "—"
            }
            sub="paid orders since 1st"
            accent="green"
          />
          <HeroCard
            label="Failed payments (30d) · LS"
            value={lsMetrics?.failed_payments_30d ?? "—"}
            sub="failed subscription invoices"
            accent={
              lsMetrics && lsMetrics.failed_payments_30d > 0 ? "red" : "neutral"
            }
          />
          <HeroCard
            label="Refunds (30d) · LS"
            value={
              lsMetrics ? formatMoney(lsMetrics.refunds_30d_cents, lsCurrency) : "—"
            }
            sub="refunded amount"
            accent={
              lsMetrics && lsMetrics.refunds_30d_cents > 0 ? "yellow" : "neutral"
            }
          />
          <HeroCard
            label="MRR split · LS"
            value={
              lsMetrics
                ? formatMoney(lsMetrics.mrr_monthly_cents, lsCurrency)
                : "—"
            }
            sub={
              lsMetrics
                ? `monthly · annual ${formatMoney(lsMetrics.mrr_annual_cents, lsCurrency)} (norm.)`
                : "—"
            }
          />
        </div>
      )}

      {/* Account activity — coarse, from users.last_seen_on */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <HeroCard
          label="Active (30d) · local"
          value={data.active_30d.toLocaleString()}
          sub={
            countedUsers > 0
              ? `${activePct(data.active_30d)}% of ${countedUsers.toLocaleString()} counted`
              : "no accounts counted yet"
          }
          accent="blue"
        />
        <HeroCard
          label="Active (7d) · local"
          value={data.active_7d.toLocaleString()}
          sub={
            countedUsers > 0
              ? `${activePct(data.active_7d)}% of ${countedUsers.toLocaleString()} counted`
              : "no accounts counted yet"
          }
        />
        <HeroCard
          label="Not yet counted"
          value={data.never_seen.toLocaleString()}
          sub="no reconnect since tracking shipped"
          accent={data.never_seen > 0 ? "yellow" : "neutral"}
        />
      </div>
      <p className="text-[11px] text-gray-600 -mt-2">
        Activity is a single date per account, overwritten on each use — stamped when
        the app opens a sync stream or refreshes its session. It records that an
        account was used on a given day, not what was done or when in the day.
        Accounts that have not reconnected since this shipped are excluded from the
        percentages rather than counted as inactive.
      </p>

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

      {/* Subscription health + tier distribution + housekeeping */}
      <div className={`grid grid-cols-1 ${selfHosted ? "lg:grid-cols-2" : "lg:grid-cols-3"} gap-4`}>
        {!selfHosted && (
          <Section title="Subscription health · LS">
            {!lsMetrics ? (
              <EmptyChart
                label={lsData?.last_error ?? "Loading from Lemon Squeezy…"}
              />
            ) : (
              <ul className="space-y-2 text-xs">
                <MetricRow
                  label="Active"
                  value={lsMetrics.paying_count.toLocaleString()}
                />
                <MetricRow
                  label="On trial"
                  value={lsMetrics.on_trial_count.toLocaleString()}
                />
                <MetricRow
                  label="Past due"
                  value={lsMetrics.past_due_count.toLocaleString()}
                  accent={lsMetrics.past_due_count > 0 ? "red" : undefined}
                />
                <MetricRow
                  label="Cancelled (still active until period end)"
                  value={lsMetrics.cancelled_active_count.toLocaleString()}
                  accent={
                    lsMetrics.cancelled_active_count > 0 ? "yellow" : undefined
                  }
                />
              </ul>
            )}
          </Section>
        )}

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
              value={formatStorage(data.total_blob_gb)}
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
            {!selfHosted && (
              <MetricRow
                label="Paid conversion"
                value={`${data.conversion_pct.toFixed(1)}%`}
              />
            )}
          </ul>
        </Section>
      </div>

      {/* Recent orders (LS) */}
      {!selfHosted && (
        <Section
          title="Recent orders · live from Lemon Squeezy"
          right={
            <Link
              href="https://app.lemonsqueezy.com/orders"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-gray-500 hover:text-white"
            >
              View in LS →
            </Link>
          }
        >
          {!lsMetrics ? (
            <p className="text-xs text-gray-600">
              {lsData?.last_error ?? "Loading…"}
            </p>
          ) : lsMetrics.recent_orders.length === 0 ? (
            <p className="text-xs text-gray-600">No orders yet.</p>
          ) : (
            <ul className="text-xs divide-y divide-gray-900">
              {lsMetrics.recent_orders.map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </ul>
          )}
        </Section>
      )}

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
  accent?: "red" | "yellow";
  link?: string;
}) {
  const valueColor =
    accent === "red"
      ? "text-red-400"
      : accent === "yellow"
        ? "text-yellow-400"
        : "text-white";
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

function LsRefreshControl({
  ls,
  refreshing,
  onRefresh,
}: {
  ls: LsSummaryResponse | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const refreshedAt = ls?.refreshed_at;
  const fresh = refreshedAt
    ? relTime(refreshedAt)
    : ls?.refreshing
      ? "refreshing…"
      : "never";
  const stale =
    refreshedAt && Date.now() - new Date(refreshedAt).getTime() > 10 * 60_000;
  return (
    <div className="text-[10px] text-gray-600 font-mono flex items-center gap-3">
      <span>
        LS data:{" "}
        <span className={stale ? "text-yellow-500" : "text-gray-400"}>
          {fresh}
        </span>
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing || ls?.refreshing}
        className="border border-gray-800 hover:border-gray-600 text-gray-400 hover:text-white px-2 py-0.5 rounded disabled:opacity-50"
      >
        {refreshing || ls?.refreshing ? "refreshing…" : "refresh"}
      </button>
    </div>
  );
}

function OrderRow({ order }: { order: LsRecentOrder }) {
  const statusColor: Record<string, string> = {
    paid: "text-green-400",
    refunded: "text-yellow-400",
    pending: "text-gray-400",
    failed: "text-red-400",
    cancelled: "text-gray-500",
  };
  return (
    <li className="py-2 flex items-center justify-between gap-3">
      <span className="text-gray-200 truncate min-w-0">
        {order.email ?? <span className="text-gray-600">no email</span>}
      </span>
      <span className="flex items-center gap-2 shrink-0">
        <span
          className={`text-[10px] uppercase tracking-widest ${
            order.refunded
              ? statusColor.refunded
              : (statusColor[order.status] ?? "text-gray-400")
          }`}
        >
          {order.refunded ? "refunded" : order.status}
        </span>
        <span className="text-white tabular-nums">
          {formatMoney(order.total_cents, order.currency)}
        </span>
        <span className="text-gray-600 text-[10px] tabular-nums">
          {relTime(order.created_at)}
        </span>
      </span>
    </li>
  );
}

function formatStorage(gb: number): string {
  const bytes = gb * 1073741824;
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${gb.toFixed(2)} GB`;
}

function formatMoney(cents: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
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
