import { adminFetch } from "@/app/lib/admin-api";
import { UsersExplorer } from "./UsersExplorer";
import type { UsersResponse, UsersQuery } from "@/app/lib/admin-client";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    tier?: string;
    banned?: string;
    deleted?: string;
    u?: string;
  }>;
}) {
  const sp = await searchParams;
  const search = sp.search ?? "";
  const tier = sp.tier ?? "";
  const banned = sp.banned ?? "";
  const deleted = sp.deleted ?? "";

  // Infinite scroll always seeds from the first page.
  const qs = new URLSearchParams();
  qs.set("page", "1");
  if (search) qs.set("search", search);
  if (tier) qs.set("tier", tier);
  if (banned) qs.set("banned", banned);
  if (deleted) qs.set("deleted", deleted);

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

  if (fetchError) {
    return (
      <div className="p-6">
        <div className="bg-red-900/30 border border-red-800 rounded px-4 py-3 text-sm text-red-300 font-mono">
          {fetchError}
        </div>
      </div>
    );
  }

  const initialParams: UsersQuery = {
    page: 1,
    search: search || undefined,
    tier: tier || undefined,
    banned: banned ? banned === "true" : undefined,
    deleted:
      deleted === "only" || deleted === "any"
        ? (deleted as "only" | "any")
        : undefined,
  };

  return <UsersExplorer initialData={data} initialParams={initialParams} />;
}
