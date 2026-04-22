import { adminFetch } from "@/app/lib/admin-api";
import Link from "next/link";

interface ChurnEvent {
  id: string;
  user_id: string;
  from_tier: string;
  to_tier: string;
  reason: string | null;
  created_at: string;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString();
}

export default async function ChurnPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const from =
    sp.from ??
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = sp.to ?? new Date().toISOString().slice(0, 10);

  const qs = new URLSearchParams({ from, to });
  let events: ChurnEvent[] = [];
  try {
    const res = await adminFetch(`/v1/admin/churn?${qs}`);
    if (res.ok) events = await res.json();
  } catch {
    // silent
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-white mb-6">Churn Events</h1>

      <form method="GET" className="flex gap-3 mb-6 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input
            name="from"
            type="date"
            defaultValue={from}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input
            name="to"
            type="date"
            defaultValue={to}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="bg-gray-800 hover:bg-gray-700 text-white text-sm px-4 py-1.5 rounded"
        >
          Filter
        </button>
      </form>

      <p className="text-sm text-gray-500 mb-4">{events.length} events</p>

      {events.length === 0 ? (
        <p className="text-sm text-gray-600">No churn events in this period.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
              <th className="pb-2 pr-4 font-normal">User</th>
              <th className="pb-2 pr-4 font-normal">From</th>
              <th className="pb-2 pr-4 font-normal">To</th>
              <th className="pb-2 pr-4 font-normal">Reason</th>
              <th className="pb-2 font-normal">Date</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-gray-900">
                <td className="py-2 pr-4">
                  <Link
                    href={`/admin/users/${e.user_id}`}
                    className="font-mono text-xs text-gray-400 hover:text-white"
                  >
                    {e.user_id.slice(0, 8)}…
                  </Link>
                </td>
                <td className="py-2 pr-4 text-gray-400">{e.from_tier}</td>
                <td className="py-2 pr-4 text-gray-400">{e.to_tier}</td>
                <td className="py-2 pr-4 text-gray-500">{e.reason ?? "—"}</td>
                <td className="py-2 text-gray-600">{fmt(e.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
