import { adminFetch } from "@/app/lib/admin-api";
import Link from "next/link";

interface User {
  id: string;
  email: string;
  subscription_tier: string;
  trial_ends_at: string | null;
  trial_used: boolean;
  is_banned: boolean;
  is_admin: boolean;
  created_at: string;
  ls_customer_id: string | null;
  total_blob_bytes: number;
  device_count: number;
  last_churn_at: string | null;
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function trialEndsLabel(iso: string | null): {
  text: string;
  urgent: boolean;
} {
  if (!iso) return { text: "—", urgent: false };
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(ms / 86400000);
  if (days <= 0) return { text: "expired", urgent: true };
  if (days <= 3) return { text: `${days}d`, urgent: true };
  return { text: `${days}d`, urgent: false };
}

const TIER_COLORS: Record<string, string> = {
  free: "bg-gray-700 text-gray-300",
  pro: "bg-blue-900 text-blue-300",
  teams: "bg-purple-900 text-purple-300",
  business: "bg-green-900 text-green-300",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    tier?: string;
    banned?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = parseInt(sp.page ?? "1", 10);
  const search = sp.search ?? "";
  const tier = sp.tier ?? "";
  const banned = sp.banned ?? "";

  const qs = new URLSearchParams();
  qs.set("page", String(page));
  if (search) qs.set("search", search);
  if (tier) qs.set("tier", tier);
  if (banned) qs.set("banned", banned);

  let data: UsersResponse = { users: [], total: 0, page: 1, limit: 50 };
  let fetchError: string | null = null;
  try {
    const res = await adminFetch(`/v1/admin/users?${qs}`);
    if (res.ok) {
      data = await res.json();
    } else {
      const body = await res.text().catch(() => "");
      fetchError = `API returned ${res.status}: ${body || res.statusText}`;
    }
  } catch (e) {
    fetchError = `Network error: ${e instanceof Error ? e.message : String(e)}`;
  }

  return (
    <div className="p-6">
      {fetchError && (
        <div className="mb-4 bg-red-900/30 border border-red-800 rounded px-4 py-3 text-sm text-red-300 font-mono">
          {fetchError}
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">
          Users{" "}
          <span className="text-gray-500 font-normal text-base">
            ({data.total})
          </span>
        </h1>
        <a
          href="/v1/admin/users/export"
          className="text-xs text-gray-400 hover:text-white border border-gray-700 px-3 py-1 rounded"
        >
          Export CSV
        </a>
      </div>

      {/* Filters */}
      <form method="GET" className="flex gap-3 mb-4 flex-wrap">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search email…"
          className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 w-56"
        />
        <select
          name="tier"
          defaultValue={tier}
          className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none"
        >
          <option value="">All tiers</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="teams">Teams</option>
          <option value="business">Business</option>
        </select>
        <select
          name="banned"
          defaultValue={banned}
          className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none"
        >
          <option value="">All</option>
          <option value="true">Banned only</option>
          <option value="false">Not banned</option>
        </select>
        <button
          type="submit"
          className="bg-gray-800 hover:bg-gray-700 text-white text-sm px-4 py-1.5 rounded"
        >
          Filter
        </button>
        <a
          href="/admin/users"
          className="text-sm text-gray-500 hover:text-white py-1.5"
        >
          Reset
        </a>
      </form>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
              <th className="pb-2 pr-4 font-normal">Email</th>
              <th className="pb-2 pr-4 font-normal">Tier</th>
              <th className="pb-2 pr-4 font-normal">Trial</th>
              <th className="pb-2 pr-4 font-normal">Blob</th>
              <th className="pb-2 pr-4 font-normal">Devices</th>
              <th className="pb-2 pr-4 font-normal">Signed up</th>
              <th className="pb-2 pr-4 font-normal">Status</th>
              <th className="pb-2 font-normal">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => {
              const trial = trialEndsLabel(u.trial_ends_at);
              return (
                <tr
                  key={u.id}
                  className="border-b border-gray-900 hover:bg-gray-900/40"
                >
                  <td className="py-2 pr-4">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="hover:underline text-white"
                    >
                      {u.email}
                    </Link>
                    {u.is_admin && (
                      <span className="ml-2 text-xs text-yellow-500">
                        admin
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${TIER_COLORS[u.subscription_tier] ?? "bg-gray-700 text-gray-300"}`}
                    >
                      {u.subscription_tier}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={trial.urgent ? "text-red-400" : "text-gray-400"}
                    >
                      {trial.text}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-400">
                    {formatBytes(u.total_blob_bytes ?? 0)}
                  </td>
                  <td className="py-2 pr-4 text-gray-400">
                    {u.device_count ?? 0}
                  </td>
                  <td className="py-2 pr-4 text-gray-500">
                    {relativeDate(u.created_at)}
                  </td>
                  <td className="py-2 pr-4">
                    {u.is_banned && (
                      <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded">
                        banned
                      </span>
                    )}
                  </td>
                  <td className="py-2">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Detail →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex gap-4 mt-4 text-sm text-gray-500">
        {page > 1 && (
          <a
            href={`/admin/users?${new URLSearchParams({ ...sp, page: String(page - 1) })}`}
            className="hover:text-white"
          >
            ← Prev
          </a>
        )}
        <span>
          Page {page} · {data.total} total
        </span>
        {data.users.length === data.limit && (
          <a
            href={`/admin/users?${new URLSearchParams({ ...sp, page: String(page + 1) })}`}
            className="hover:text-white"
          >
            Next →
          </a>
        )}
      </div>
    </div>
  );
}
