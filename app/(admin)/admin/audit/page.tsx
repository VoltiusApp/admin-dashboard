import { adminFetch } from "@/app/lib/admin-api";
import Link from "next/link";

interface AuditEntry {
  id: string;
  admin_email: string;
  target_id: string | null;
  action: string;
  detail: unknown;
  created_at: string;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString();
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ target_id?: string; limit?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ limit: sp.limit ?? "200" });
  if (sp.target_id) qs.set("target_id", sp.target_id);

  let entries: AuditEntry[] = [];
  try {
    const res = await adminFetch(`/v1/admin/audit-log?${qs}`);
    if (res.ok) entries = await res.json();
  } catch {
    // silent
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-white mb-6">Audit Log</h1>

      <p className="text-sm text-gray-500 mb-4">
        {entries.length} entries
        {sp.target_id && (
          <>
            {" "}
            for user {sp.target_id.slice(0, 8)}…
            <Link
              href="/admin/audit"
              className="ml-2 text-gray-600 hover:text-white"
            >
              clear filter
            </Link>
          </>
        )}
      </p>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-600">No audit entries.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
              <th className="pb-2 pr-4 font-normal">Date</th>
              <th className="pb-2 pr-4 font-normal">Admin</th>
              <th className="pb-2 pr-4 font-normal">Action</th>
              <th className="pb-2 pr-4 font-normal">Target</th>
              <th className="pb-2 font-normal">Detail</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-gray-900">
                <td className="py-2 pr-4 text-gray-500 text-xs whitespace-nowrap">
                  {fmt(e.created_at)}
                </td>
                <td className="py-2 pr-4 text-xs text-gray-600">
                  {e.admin_email}
                </td>
                <td className="py-2 pr-4 font-mono text-xs text-gray-300">
                  {e.action}
                </td>
                <td className="py-2 pr-4">
                  {e.target_id ? (
                    <Link
                      href={`/admin/users/${e.target_id}`}
                      className="font-mono text-xs text-gray-400 hover:text-white"
                    >
                      {e.target_id.slice(0, 8)}…
                    </Link>
                  ) : (
                    <span className="text-gray-700">—</span>
                  )}
                </td>
                <td className="py-2 text-xs text-gray-600 max-w-xs break-all">
                  {JSON.stringify(e.detail)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
