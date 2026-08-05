"use client";

import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  adminApi,
  type UserListRow,
  type UsersResponse,
  type UsersQuery,
} from "@/app/lib/admin-client";
import { usePresence } from "@/app/lib/use-presence";
import { UserPanel } from "./UserPanel";
import { StatusDot } from "./StatusDot";

const TIER_COLORS: Record<string, string> = {
  free: "bg-gray-700 text-gray-300",
  pro: "bg-blue-900 text-blue-300",
  teams: "bg-purple-900 text-purple-300",
  business: "bg-green-900 text-green-300",
};

function formatBytes(b: number): string {
  if (!b) return "0";
  const kb = b / 1024;
  if (kb < 1024) return `${kb.toFixed(0)}K`;
  return `${(kb / 1024).toFixed(1)}M`;
}

function relDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "1d";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

/**
 * `last_seen_on` is a calendar date (YYYY-MM-DD), not an instant — parsing it
 * with `new Date()` yields UTC midnight, which `relDate` would then measure
 * against local now and report as a day older west of UTC. Compare whole days
 * instead. Returns null for a never-seen account: absent data, not "0 days ago".
 */
function relDay(day: string | null): { text: string; days: number } | null {
  if (!day) return null;
  const [y, m, d] = day.split("-").map(Number);
  const days = Math.round(
    (Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) -
      Date.UTC(y, m - 1, d)) /
      86_400_000
  );
  if (days <= 0) return { text: "today", days: 0 };
  if (days === 1) return { text: "1d", days };
  if (days < 30) return { text: `${days}d`, days };
  if (days < 365) return { text: `${Math.floor(days / 30)}mo`, days };
  return { text: `${Math.floor(days / 365)}y`, days };
}

function trialLabel(iso: string | null): {
  text: string;
  urgent: boolean;
} | null {
  if (!iso) return null;
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return { text: "exp", urgent: true };
  if (days <= 3) return { text: `${days}d`, urgent: true };
  return { text: `${days}d`, urgent: false };
}

function usePinnedUsers() {
  const [pinned, setPinned] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("admin_pinned_users");
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  });

  function togglePin(id: string) {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("admin_pinned_users", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }

  return { pinned, togglePin };
}

export function UsersExplorer({
  initialData,
  initialParams,
}: {
  initialData: UsersResponse;
  initialParams: UsersQuery;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-backed state.
  const selectedId = searchParams.get("u");
  const search = searchParams.get("search") ?? "";
  const tier = searchParams.get("tier") ?? "";
  const banned = searchParams.get("banned") ?? "";
  const deletedRaw = searchParams.get("deleted") ?? "";

  const filters: UsersQuery = useMemo(
    () => ({
      search: search || undefined,
      tier: tier || undefined,
      banned: banned ? banned === "true" : undefined,
      deleted:
        deletedRaw === "only" || deletedRaw === "any"
          ? (deletedRaw as "only" | "any")
          : undefined,
    }),
    [search, tier, banned, deletedRaw]
  );

  const usersQuery = useInfiniteQuery({
    queryKey: ["users", filters],
    queryFn: ({ pageParam }) =>
      adminApi.users.list({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.users.length, 0);
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    initialData: filtersEqual(filters, initialParams)
      ? { pages: [initialData], pageParams: [1] }
      : undefined,
  });

  // Infinite-scroll: fetch the next page when the sentinel scrolls into view.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = usersQuery;
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root: scrollRef.current, rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const { onlineSet, count: onlineCount } = usePresence();
  const { pinned, togglePin } = usePinnedUsers();

  // Local search input state (debounced via form submit).
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => setSearchInput(search), [search]);

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    router.replace(`/admin/users?${next.toString()}`, { scroll: false });
  }

  function selectUser(id: string | null) {
    updateParams({ u: id });
  }

  const rows = useMemo(
    () => usersQuery.data?.pages.flatMap((p) => p.users) ?? [],
    [usersQuery.data]
  );
  const total = usersQuery.data?.pages[0]?.total ?? 0;

  const sortedRows = useMemo(() => {
    const p = rows.filter((r) => pinned.has(r.id));
    const rest = rows.filter((r) => !pinned.has(r.id));
    return [...p, ...rest];
  }, [rows, pinned]);

  const pinnedCount = sortedRows.filter((r) => pinned.has(r.id)).length;

  const columns: ColumnDef<UserListRow>[] = useMemo(
    () => [
      {
        id: "pin",
        header: "",
        cell: (c) => {
          const isPinned = pinned.has(c.row.original.id);
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePin(c.row.original.id);
              }}
              title={isPinned ? "Unpin" : "Pin to top"}
              className={`transition-opacity ${isPinned ? "text-amber-400" : "text-gray-700 hover:text-gray-400 opacity-0 group-hover:opacity-100"}`}
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a6 6 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707s.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a6 6 0 0 1 1.013.16l3.134-3.133a3 3 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146"/>
              </svg>
            </button>
          );
        },
      },
      {
        id: "online",
        header: "",
        cell: (c) => {
          const online = onlineSet.has(c.row.original.id);
          return (
            <div className="flex items-center justify-center w-3">
              {online ? (
                <StatusDot
                  color="#22c55e"
                  size={7}
                  title="Online — active sync connection"
                />
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: (c) => {
          const u = c.row.original;
          return (
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate text-white">{u.email}</span>
              {u.is_admin && (
                <span className="text-[10px] text-yellow-500 shrink-0">
                  admin
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "subscription_tier",
        header: "Tier",
        cell: (c) => (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${TIER_COLORS[c.row.original.subscription_tier] ?? "bg-gray-700 text-gray-300"}`}
          >
            {c.row.original.subscription_tier}
          </span>
        ),
      },
      {
        id: "trial",
        header: "Trial",
        cell: (c) => {
          const t = trialLabel(c.row.original.trial_ends_at);
          if (!t) return <span className="text-gray-700">—</span>;
          return (
            <span className={t.urgent ? "text-red-400" : "text-gray-400"}>
              {t.text}
            </span>
          );
        },
      },
      {
        accessorKey: "total_blob_bytes",
        header: "Blob",
        cell: (c) => (
          <span className="text-gray-500">
            {formatBytes(c.row.original.total_blob_bytes)}
          </span>
        ),
      },
      {
        accessorKey: "device_count",
        header: "Dev",
        cell: (c) => (
          <span className="text-gray-500">
            {c.row.original.device_count ?? 0}
          </span>
        ),
      },
      {
        accessorKey: "last_seen_on",
        header: "Seen",
        cell: (c) => {
          const seen = relDay(c.row.original.last_seen_on);
          if (!seen) {
            return (
              <span
                className="text-gray-700"
                title="Not seen since activity tracking shipped — unknown, not inactive"
              >
                —
              </span>
            );
          }
          // Dim past 90 days, flag past a year: a candidate stale account.
          const tone =
            seen.days >= 365
              ? "text-red-400"
              : seen.days >= 90
                ? "text-yellow-600"
                : "text-gray-500";
          return (
            <span className={tone} title={c.row.original.last_seen_on ?? undefined}>
              {seen.text}
            </span>
          );
        },
      },
      {
        accessorKey: "created_at",
        header: "Age",
        cell: (c) => (
          <span className="text-gray-600">
            {relDate(c.row.original.created_at)}
          </span>
        ),
      },
      {
        id: "status",
        header: "",
        cell: (c) => {
          const u = c.row.original;
          return (
            <div className="flex gap-1">
              {u.deleted_at && (
                <span className="text-[10px] bg-red-950 border border-red-900 text-red-200 px-1.5 rounded">
                  del
                </span>
              )}
              {u.is_banned && (
                <span className="text-[10px] bg-red-900 text-red-300 px-1.5 rounded">
                  ban
                </span>
              )}
            </div>
          );
        },
      },
    ],
    [onlineSet, pinned, togglePin]
  );

  const table = useReactTable({
    data: sortedRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="h-screen grid grid-cols-1 xl:grid-cols-[minmax(0,560px)_1fr]">
      {/* LEFT: list */}
      <div className="flex flex-col border-r border-gray-800 min-h-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-2">
              <h1 className="text-sm font-bold text-white">Users</h1>
              <span className="text-xs text-gray-600">({total})</span>
              {usersQuery.isFetching && (
                <span className="text-[10px] text-gray-600">syncing…</span>
              )}
            </div>
            <div
              className="flex items-center gap-1.5 text-[10px] text-gray-500"
              title="Live sync subscribers"
            >
              <StatusDot color="#22c55e" size={6} />
              <span>{onlineCount} online</span>
            </div>
          </div>
          <a
            href="/api/admin/users/export"
            className="text-[10px] text-gray-500 hover:text-white border border-gray-800 hover:border-gray-600 px-2 py-1 rounded"
          >
            Export CSV
          </a>
        </div>

        {/* Filter chips */}
        <div className="px-4 py-2 border-b border-gray-800 flex gap-1.5 flex-wrap text-[10px]">
          <Chip
            active={!deletedRaw}
            onClick={() => updateParams({ deleted: null, page: null })}
          >
            Active
          </Chip>
          <Chip
            active={deletedRaw === "only"}
            onClick={() => updateParams({ deleted: "only", page: null })}
          >
            Pending deletion
          </Chip>
          <Chip
            active={banned === "true"}
            onClick={() =>
              updateParams({
                banned: banned === "true" ? null : "true",
                page: null,
              })
            }
          >
            Banned
          </Chip>
          <Chip
            active={tier === "pro"}
            onClick={() =>
              updateParams({ tier: tier === "pro" ? null : "pro", page: null })
            }
          >
            Pro
          </Chip>
          <Chip
            active={tier === "teams"}
            onClick={() =>
              updateParams({
                tier: tier === "teams" ? null : "teams",
                page: null,
              })
            }
          >
            Teams
          </Chip>
          <Chip
            active={tier === "business"}
            onClick={() =>
              updateParams({
                tier: tier === "business" ? null : "business",
                page: null,
              })
            }
          >
            Business
          </Chip>
        </div>

        {/* Search */}
        <form
          className="px-4 py-2 border-b border-gray-800"
          onSubmit={(e) => {
            e.preventDefault();
            updateParams({ search: searchInput || null, page: null });
          }}
        >
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search email… (enter)"
            className="w-full bg-gray-950 border border-gray-800 rounded px-2.5 py-1.5 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-gray-600"
          />
        </form>

        {/* Table */}
        <div ref={scrollRef} className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-950 z-10">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-gray-800">
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      className="text-left text-[10px] text-gray-600 font-normal px-3 py-2 uppercase tracking-wider"
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.length === 0 && !usersQuery.isLoading && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="text-center text-xs text-gray-600 py-8"
                  >
                    No users match these filters.
                  </td>
                </tr>
              )}
              {table.getRowModel().rows.map((row, idx) => {
                const u = row.original;
                const isSelected = u.id === selectedId;
                const isPinned = pinned.has(u.id);
                const showSeparator = idx === pinnedCount && pinnedCount > 0;
                return (
                  <>
                    {showSeparator && (
                      <tr key="separator">
                        <td colSpan={columns.length} className="px-3 py-1 bg-gray-950">
                          <div className="border-t border-gray-800" />
                        </td>
                      </tr>
                    )}
                    <tr
                      key={u.id}
                      onClick={() => selectUser(u.id)}
                      className={`group cursor-pointer border-b transition ${
                        isPinned ? "border-amber-950/60" : "border-gray-900"
                      } ${
                        isSelected
                          ? "bg-gray-800/80"
                          : "hover:bg-gray-900/60"
                      } ${u.deleted_at ? "opacity-60" : ""}`}
                    >
                      {row.getVisibleCells().map((cell, ci) => (
                        <td
                          key={cell.id}
                          className={`px-3 py-1.5 ${ci === 0 && isPinned ? "border-l-2 border-amber-500/60" : ""}`}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
          {/* Infinite-scroll sentinel */}
          <div ref={loadMoreRef} aria-hidden className="h-1" />
        </div>

        {/* Status */}
        <div className="px-4 py-2 border-t border-gray-800 flex items-center justify-between text-[10px] text-gray-500">
          <div>
            {rows.length} of {total} loaded
          </div>
          {usersQuery.isFetchingNextPage && <div>Loading more…</div>}
        </div>
      </div>

      {/* RIGHT: detail */}
      <div className="min-h-0 overflow-hidden bg-gray-950">
        {selectedId ? (
          <UserPanel key={selectedId} id={selectedId} />
        ) : (
          <EmptyDetail count={rows.length} />
        )}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-0.5 rounded border transition ${
        active
          ? "bg-gray-700 border-gray-600 text-white"
          : "bg-gray-900 border-gray-800 text-gray-500 hover:text-white hover:border-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyDetail({ count }: { count: number }) {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="text-center text-xs text-gray-600 max-w-xs">
        <div className="text-3xl text-gray-800 mb-3">←</div>
        <div>
          {count === 0
            ? "No users to select."
            : "Pick a user from the list to see their details and take action."}
        </div>
      </div>
    </div>
  );
}

function filtersEqual(a: UsersQuery, b: UsersQuery): boolean {
  return (
    (a.search ?? "") === (b.search ?? "") &&
    (a.tier ?? "") === (b.tier ?? "") &&
    (a.banned ?? undefined) === (b.banned ?? undefined) &&
    (a.deleted ?? "") === (b.deleted ?? "")
  );
}
