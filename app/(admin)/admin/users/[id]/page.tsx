import { adminFetch } from "@/app/lib/admin-api";
import Link from "next/link";
import {
  patchUserAction,
  banUserAction,
  unbanUserAction,
  setTrialAction,
  clearTrialAction,
  setFlagAction,
} from "./actions";

interface UserDetail {
  id: string;
  email: string;
  account_id: string;
  subscription_tier: string;
  trial_ends_at: string | null;
  trial_used: boolean;
  is_banned: boolean;
  is_admin: boolean;
  ban_reason: string | null;
  banned_at: string | null;
  admin_notes: string | null;
  discount_pct: number | null;
  ls_customer_id: string | null;
  ls_subscription_id: string | null;
  created_at: string;
}

interface Device {
  device_id: string;
  size_bytes: number;
  updated_at: string;
  metadata: unknown;
}

interface Flag {
  flag: string;
  enabled: boolean;
  set_by: string;
  set_at: string;
}

interface ChurnEvent {
  id: string;
  from_tier: string;
  to_tier: string;
  reason: string | null;
  created_at: string;
}

interface AuditEntry {
  id: string;
  admin_email: string;
  action: string;
  detail: unknown;
  created_at: string;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString();
}

const KNOWN_FLAGS = ["beta_access", "unlimited_devices", "skip_rate_limit"];

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [userRes, devicesRes, flagsRes, churnRes, auditRes] = await Promise.all(
    [
      adminFetch(`/v1/admin/users/${id}`),
      adminFetch(`/v1/admin/users/${id}/devices`),
      adminFetch(`/v1/admin/users/${id}/flags`),
      adminFetch(`/v1/admin/users/${id}/churn`),
      adminFetch(`/v1/admin/audit-log?target_id=${id}&limit=50`),
    ]
  );

  if (!userRes.ok) {
    return (
      <div className="p-6 text-red-400">User not found or fetch error.</div>
    );
  }

  const user: UserDetail = await userRes.json();
  const devices: Device[] = devicesRes.ok ? await devicesRes.json() : [];
  const flags: Flag[] = flagsRes.ok ? await flagsRes.json() : [];
  const churn: ChurnEvent[] = churnRes.ok ? await churnRes.json() : [];
  const audit: AuditEntry[] = auditRes.ok ? await auditRes.json() : [];

  const flagMap = Object.fromEntries(flags.map((f) => [f.flag, f]));
  const totalBlob = devices.reduce((s, d) => s + d.size_bytes, 0);

  const patchUser = patchUserAction.bind(null, id);
  const banUser = banUserAction.bind(null, id);
  const unbanUser = unbanUserAction.bind(null, id);

  return (
    <div className="p-6 max-w-5xl space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/admin/users" className="text-gray-500 hover:text-white text-sm">
          ← Users
        </Link>
        <h1 className="text-xl font-bold text-white">{user.email}</h1>
        {user.is_banned && (
          <span className="bg-red-900 text-red-300 text-xs px-2 py-0.5 rounded">
            BANNED
          </span>
        )}
        {user.is_admin && (
          <span className="bg-yellow-900 text-yellow-300 text-xs px-2 py-0.5 rounded">
            ADMIN
          </span>
        )}
      </div>

      {/* Identity */}
      <Section title="Identity">
        <KV label="ID" value={user.id} mono />
        <KV label="Account ID" value={user.account_id} mono />
        <KV label="Email" value={user.email} />
        <KV label="Created" value={fmt(user.created_at)} />
      </Section>

      {/* Subscription */}
      <Section title="Subscription">
        <form action={patchUser} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tier">
              <select
                name="tier"
                defaultValue={user.subscription_tier}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white"
              >
                <option value="free">free</option>
                <option value="pro">pro</option>
                <option value="teams">teams</option>
                <option value="business">business</option>
              </select>
            </Field>
            <Field label="Discount %">
              <input
                name="discount_pct"
                type="number"
                min={1}
                max={100}
                defaultValue={user.discount_pct ?? ""}
                placeholder="—"
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white"
              />
            </Field>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400 flex-wrap">
            <span>Trial used:</span>
            <span className={user.trial_used ? "text-gray-300" : "text-green-400"}>
              {user.trial_used ? "yes" : "no"}
            </span>
            {user.trial_ends_at ? (
              <>
                <span>— ends {new Date(user.trial_ends_at).toLocaleDateString()}</span>
                <form
                  action={async () => {
                    "use server";
                    await clearTrialAction(id);
                  }}
                >
                  <button
                    type="submit"
                    className="text-xs text-red-500 hover:text-red-400 underline"
                  >
                    Clear
                  </button>
                </form>
              </>
            ) : (
              <span className="text-gray-600">no trial set</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <form
              action={async (fd: FormData) => {
                "use server";
                const days = parseInt(fd.get("days") as string, 10);
                if (days > 0) await setTrialAction(id, days);
              }}
              className="flex gap-2 items-center"
            >
              <label className="text-xs text-gray-500">Set trial to</label>
              <input
                name="days"
                type="number"
                min={1}
                max={3650}
                placeholder="days"
                className="w-20 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white"
              />
              <label className="text-xs text-gray-500">days from now</label>
              <button
                type="submit"
                className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded"
              >
                Set
              </button>
            </form>
          </div>
          {user.ls_customer_id && (
            <div className="text-sm">
              <span className="text-gray-500 mr-2">LS Customer:</span>
              <a
                href={`https://app.lemonsqueezy.com/customers/${user.ls_customer_id}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:underline font-mono text-xs"
              >
                {user.ls_customer_id}
              </a>
            </div>
          )}
          <Field label="Internal notes">
            <textarea
              name="admin_notes"
              defaultValue={user.admin_notes ?? ""}
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white resize-none"
            />
          </Field>
          <div>
            <button
              type="submit"
              className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-1.5 rounded"
            >
              Save
            </button>
          </div>
        </form>
      </Section>

      {/* Ban / Unban */}
      <Section title="Ban">
        {user.is_banned ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-red-400">
              Banned: {user.ban_reason ?? "no reason given"}
              {user.banned_at && (
                <span className="text-gray-500 ml-2">— {fmt(user.banned_at)}</span>
              )}
            </p>
            <form
              action={async () => {
                "use server";
                await unbanUser();
              }}
            >
              <button
                type="submit"
                className="bg-green-900 hover:bg-green-800 text-green-300 text-xs px-3 py-1.5 rounded"
              >
                Unban
              </button>
            </form>
          </div>
        ) : (
          <form action={banUser} className="flex gap-2 items-center">
            <input
              name="reason"
              placeholder="Ban reason"
              required
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white w-64"
            />
            <button
              type="submit"
              className="bg-red-900 hover:bg-red-800 text-red-300 text-xs px-3 py-1.5 rounded"
            >
              Ban
            </button>
          </form>
        )}
      </Section>

      {/* Feature Flags */}
      <Section title="Feature Flags">
        <div className="flex flex-col gap-2">
          {KNOWN_FLAGS.map((flag) => {
            const current = flagMap[flag];
            const enabled = current?.enabled ?? false;
            return (
              <div key={flag} className="flex items-center gap-4">
                <span className="text-sm text-gray-300 w-40 font-mono">
                  {flag}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await setFlagAction(id, flag, !enabled);
                  }}
                >
                  <button
                    type="submit"
                    className={`text-xs px-3 py-1 rounded ${
                      enabled
                        ? "bg-green-900 text-green-300 hover:bg-green-800"
                        : "bg-gray-800 text-gray-500 hover:bg-gray-700"
                    }`}
                  >
                    {enabled ? "ON" : "OFF"}
                  </button>
                </form>
                {current && (
                  <span className="text-xs text-gray-600">
                    set {new Date(current.set_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Sync Blobs */}
      <Section
        title={`Sync Blobs — ${formatBytes(totalBlob)} total across ${devices.length} device(s)`}
      >
        {devices.length === 0 ? (
          <p className="text-sm text-gray-600">No devices.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-800">
                <th className="pb-1 pr-4 font-normal">Device ID</th>
                <th className="pb-1 pr-4 font-normal">Size</th>
                <th className="pb-1 pr-4 font-normal">Last sync</th>
                <th className="pb-1 font-normal">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr
                  key={d.device_id}
                  className="border-b border-gray-900 align-top"
                >
                  <td className="py-1.5 pr-4 font-mono text-gray-300">
                    {d.device_id}
                  </td>
                  <td className="py-1.5 pr-4 text-gray-400">
                    {formatBytes(d.size_bytes)}
                  </td>
                  <td className="py-1.5 pr-4 text-gray-500">
                    {fmt(d.updated_at)}
                  </td>
                  <td className="py-1.5 text-gray-600 max-w-xs break-all">
                    <details>
                      <summary className="cursor-pointer hover:text-gray-400">
                        expand
                      </summary>
                      <pre className="mt-1 text-gray-500 whitespace-pre-wrap">
                        {JSON.stringify(d.metadata, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Churn History */}
      <Section title="Churn History">
        {churn.length === 0 ? (
          <p className="text-sm text-gray-600">No churn events.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-800">
                <th className="pb-1 pr-4 font-normal">From</th>
                <th className="pb-1 pr-4 font-normal">To</th>
                <th className="pb-1 pr-4 font-normal">Reason</th>
                <th className="pb-1 font-normal">Date</th>
              </tr>
            </thead>
            <tbody>
              {churn.map((c) => (
                <tr key={c.id} className="border-b border-gray-900">
                  <td className="py-1.5 pr-4 text-gray-400">{c.from_tier}</td>
                  <td className="py-1.5 pr-4 text-gray-400">{c.to_tier}</td>
                  <td className="py-1.5 pr-4 text-gray-500">
                    {c.reason ?? "—"}
                  </td>
                  <td className="py-1.5 text-gray-600">
                    {fmt(c.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Audit Log */}
      <Section title="Audit Log">
        {audit.length === 0 ? (
          <p className="text-sm text-gray-600">No audit entries.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-800">
                <th className="pb-1 pr-4 font-normal">Action</th>
                <th className="pb-1 pr-4 font-normal">Detail</th>
                <th className="pb-1 pr-4 font-normal">Admin</th>
                <th className="pb-1 font-normal">Date</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id} className="border-b border-gray-900">
                  <td className="py-1.5 pr-4 font-mono text-gray-300">
                    {a.action}
                  </td>
                  <td className="py-1.5 pr-4 text-gray-500 max-w-xs break-all">
                    {JSON.stringify(a.detail)}
                  </td>
                  <td className="py-1.5 pr-4 text-gray-600 text-xs">
                    {a.admin_email}
                  </td>
                  <td className="py-1.5 text-gray-600">
                    {fmt(a.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
        {title}
      </h2>
      <div className="bg-gray-900/40 border border-gray-800 rounded p-4">
        {children}
      </div>
    </div>
  );
}

function KV({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-4 text-sm py-0.5">
      <span className="text-gray-500 w-28 shrink-0">{label}</span>
      <span className={`text-gray-200 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
