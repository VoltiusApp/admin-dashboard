import { adminFetch } from "@/app/lib/admin-api";
import Link from "next/link";
import { ApplyButton } from "./ApplyButton";

interface DeriveRow {
  user_id: string;
  email: string;
  old: string;
  new: string | null;
  reason: "ok" | "conflict" | "reserved" | "invalid" | "already" | "unverified";
}

const REASON: Record<DeriveRow["reason"], string> = {
  ok: "will change",
  conflict: "taken — set by hand",
  reserved: "reserved name — set by hand",
  invalid: "not a valid handle — set by hand",
  unverified: "email not verified — renamed once verified",
  already: "matches",
};

export default async function HandlesPage() {
  const res = await adminFetch(`/v1/admin/handles/derive`, {
    method: "POST",
    body: JSON.stringify({ dry_run: true }),
  });
  if (res.status === 409) {
    return (
      <div className="p-6 max-w-3xl text-sm text-gray-400">
        Set <code className="text-white">HANDLES_FROM_EMAIL=true</code> on the server to derive handles from email addresses.
      </div>
    );
  }
  if (!res.ok) return <div className="p-6 text-red-400">Failed to load ({res.status}).</div>;
  const rows: DeriveRow[] = await res.json();
  const pending = rows.filter((r) => r.reason !== "already");
  const changes = rows.filter((r) => r.reason === "ok").length;

  return (
    <div className="p-6 max-w-5xl space-y-4">
      <h1 className="text-xl font-bold text-white">Handles from email</h1>
      <p className="text-sm text-gray-400">
        {changes === 0 ? "Nothing to change." : `${changes} of ${pending.length} listed accounts will change.`} Each
        old handle is retired for good. Rows marked “set by hand” stay as they are; fix them from the user’s page.
      </p>
      <ApplyButton changes={changes} />
      <table className="w-full text-sm">
        <thead className="text-gray-500 text-left">
          <tr><th>Email</th><th>Current</th><th>From email</th><th>Status</th></tr>
        </thead>
        <tbody>
          {pending.map((r) => (
            <tr key={r.user_id} className="border-t border-gray-800">
              <td className="py-1 text-gray-300">{r.email}</td>
              <td className="font-mono text-gray-400">@{r.old}</td>
              <td className="font-mono text-white">{r.new ? `@${r.new}` : "—"}</td>
              <td className={r.reason === "ok" ? "text-green-400" : "text-yellow-400"}>
                <Link href={`/admin/users/${r.user_id}`}>{REASON[r.reason]}</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
