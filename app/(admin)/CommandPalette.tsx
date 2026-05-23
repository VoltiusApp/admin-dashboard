"use client";

import { Command } from "cmdk";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  adminApi,
  type UserDetail,
  type UserListRow,
} from "@/app/lib/admin-client";
import { usePresence } from "@/app/lib/use-presence";
import { StatusDot } from "./admin/users/StatusDot";

const RECENT_KEY = "admin:recent-users";
const RECENT_MAX = 6;

interface RecentUser {
  id: string;
  email: string;
  ts: number;
}

function loadRecent(): RecentUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentUser[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function pushRecent(u: { id: string; email: string }) {
  if (typeof window === "undefined") return;
  const existing = loadRecent().filter((r) => r.id !== u.id);
  const next = [{ id: u.id, email: u.email, ts: Date.now() }, ...existing].slice(
    0,
    RECENT_MAX
  );
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeValue, setActiveValue] = useState<string>("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { onlineSet, count: onlineCount } = usePresence();

  // Detect active user from URL (either /admin/users/[id] or /admin/users?u=<id>).
  const activeUserId = useMemo(() => {
    const m = pathname?.match(/^\/admin\/users\/([0-9a-f-]{36})$/);
    if (m) return m[1];
    return searchParams.get("u");
  }, [pathname, searchParams]);

  const activeUserQuery = useQuery({
    queryKey: ["user", activeUserId],
    queryFn: () => adminApi.users.get(activeUserId!),
    enabled: !!activeUserId,
    staleTime: 30_000,
  });

  // Global hotkey.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Reset state when closing.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebounced("");
      setActiveValue("");
    }
  }, [open]);

  // Debounce search.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 150);
    return () => clearTimeout(t);
  }, [query]);

  // Async search.
  const searchQuery = useQuery({
    queryKey: ["palette-search", debounced],
    queryFn: () => adminApi.users.list({ search: debounced, limit: 8 }),
    enabled: open && debounced.length > 0,
    staleTime: 10_000,
  });

  // Recent users.
  const [recent, setRecent] = useState<RecentUser[]>([]);
  useEffect(() => {
    if (open) setRecent(loadRecent());
  }, [open]);

  // Track active user → push to recent when one is opened in the right pane.
  useEffect(() => {
    if (activeUserQuery.data) {
      pushRecent({
        id: activeUserQuery.data.id,
        email: activeUserQuery.data.email,
      });
    }
  }, [activeUserQuery.data]);

  // ─── Actions on the active user ─────────────────────────────────────────────
  const onAction = useCallback(() => setOpen(false), []);

  const banMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminApi.users.ban(id, reason),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["user", vars.id] });
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Banned");
    },
    onError: () => toast.error("Ban failed"),
  });
  const unbanMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => adminApi.users.unban(id),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["user", vars.id] });
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Unbanned");
    },
    onError: () => toast.error("Unban failed"),
  });
  const extendMutation = useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) =>
      adminApi.users.extendTrial(id, days),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["user", vars.id] });
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(`Extended trial +${vars.days}d`);
    },
    onError: () => toast.error("Extend failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => adminApi.users.delete(id),
    onSuccess: (result, vars) => {
      if (!result.ok) {
        toast.error(result.message ?? `Delete failed (${result.status})`);
        return;
      }
      qc.invalidateQueries({ queryKey: ["user", vars.id] });
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Deleted", {
        description: "7-day grace. Restore from the panel.",
      });
    },
    onError: () => toast.error("Delete failed"),
  });

  function openUser(id: string) {
    router.push(`/admin/users?u=${id}`);
    onAction();
  }
  function openUserFullDetail(id: string) {
    router.push(`/admin/users/${id}`);
    onAction();
  }

  if (!open) return null;

  const results = searchQuery.data?.users ?? [];
  const showingRecent = debounced.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <Command
        loop
        shouldFilter={false}
        value={activeValue}
        onValueChange={setActiveValue}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-gray-950 border border-gray-800 rounded-lg shadow-2xl overflow-hidden font-mono grid grid-cols-[1fr_280px]"
      >
        {/* LEFT: input + list */}
        <div className="border-r border-gray-800 flex flex-col min-w-0">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-3">
            <span className="text-xs text-gray-600">›</span>
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search users, jump to a page, run an action…"
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-700 focus:outline-none"
            />
            <kbd className="text-[10px] text-gray-600 border border-gray-800 rounded px-1.5 py-0.5">
              esc
            </kbd>
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto py-2">
            {searchQuery.isFetching && debounced.length > 0 && (
              <div className="px-4 py-2 text-[10px] text-gray-600">
                Searching…
              </div>
            )}

            {/* Context actions on active user */}
            {activeUserQuery.data && (
              <Command.Group
                heading={`Actions: ${activeUserQuery.data.email}${onlineSet.has(activeUserQuery.data.id) ? "  (online)" : ""}`}
                className="palette-group"
              >
                <CmdItem
                  value={`action-open-${activeUserQuery.data.id}`}
                  onSelect={() => openUserFullDetail(activeUserQuery.data!.id)}
                  hint="↵"
                  icon="→"
                >
                  Open full detail
                </CmdItem>
                {!activeUserQuery.data.is_banned ? (
                  <CmdItem
                    value={`action-ban-${activeUserQuery.data.id}`}
                    onSelect={() => {
                      const reason = window.prompt("Ban reason?");
                      if (!reason) return;
                      banMutation.mutate({
                        id: activeUserQuery.data!.id,
                        reason,
                      });
                      onAction();
                    }}
                    icon="⊘"
                    danger
                  >
                    Ban this user…
                  </CmdItem>
                ) : (
                  <CmdItem
                    value={`action-unban-${activeUserQuery.data.id}`}
                    onSelect={() => {
                      unbanMutation.mutate({ id: activeUserQuery.data!.id });
                      onAction();
                    }}
                    icon="↺"
                  >
                    Unban this user
                  </CmdItem>
                )}
                {[7, 14, 30].map((d) => (
                  <CmdItem
                    key={d}
                    value={`action-extend-${d}-${activeUserQuery.data.id}`}
                    onSelect={() => {
                      extendMutation.mutate({
                        id: activeUserQuery.data!.id,
                        days: d,
                      });
                      onAction();
                    }}
                    icon="⏱"
                  >
                    Extend trial +{d}d
                  </CmdItem>
                ))}
                {!activeUserQuery.data.deleted_at && (
                  <CmdItem
                    value={`action-delete-${activeUserQuery.data.id}`}
                    onSelect={() => {
                      const email = activeUserQuery.data!.email;
                      const confirm = window.prompt(
                        `Type the email to soft-delete:\n${email}`
                      );
                      if (confirm?.trim() !== email) return;
                      deleteMutation.mutate({ id: activeUserQuery.data!.id });
                      onAction();
                    }}
                    icon="✕"
                    danger
                  >
                    Delete this user…
                  </CmdItem>
                )}
              </Command.Group>
            )}

            {/* Search results */}
            {results.length > 0 && (
              <Command.Group heading="Users" className="palette-group">
                {results.map((u) => (
                  <CmdItem
                    key={u.id}
                    value={`user-${u.id}`}
                    onSelect={() => openUser(u.id)}
                    icon={
                      onlineSet.has(u.id) ? (
                        <StatusDot color="#22c55e" size={7} />
                      ) : (
                        "◔"
                      )
                    }
                    hint="↵ open · ⌘↵ full"
                    suffix={<TierTag tier={u.subscription_tier} small />}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        openUserFullDetail(u.id);
                      }
                    }}
                  >
                    {u.email}
                  </CmdItem>
                ))}
              </Command.Group>
            )}

            {/* Recent (when no search) */}
            {showingRecent && recent.length > 0 && (
              <Command.Group heading="Recent" className="palette-group">
                {recent.map((r) => (
                  <CmdItem
                    key={r.id}
                    value={`recent-${r.id}`}
                    onSelect={() => openUser(r.id)}
                    icon={
                      onlineSet.has(r.id) ? (
                        <StatusDot color="#22c55e" size={7} />
                      ) : (
                        "◷"
                      )
                    }
                  >
                    {r.email}
                  </CmdItem>
                ))}
              </Command.Group>
            )}

            {/* Navigation */}
            <Command.Group heading="Go to" className="palette-group">
              <CmdItem
                value="nav-home"
                onSelect={() => {
                  router.push("/admin");
                  onAction();
                }}
                icon="◉"
              >
                Home
              </CmdItem>
              <CmdItem
                value="nav-users"
                onSelect={() => {
                  router.push("/admin/users");
                  onAction();
                }}
                icon="◧"
              >
                Users
              </CmdItem>
              <CmdItem
                value="nav-churn"
                onSelect={() => {
                  router.push("/admin/churn");
                  onAction();
                }}
                icon="◇"
              >
                Churn
              </CmdItem>
              <CmdItem
                value="nav-audit"
                onSelect={() => {
                  router.push("/admin/audit");
                  onAction();
                }}
                icon="◆"
              >
                Audit log
              </CmdItem>
            </Command.Group>

            {/* Global actions */}
            <Command.Group heading="Actions" className="palette-group">
              <CmdItem
                value="action-export-csv"
                onSelect={() => {
                  window.location.href = "/api/admin/users/export";
                  onAction();
                }}
                icon="↓"
              >
                Export users CSV
              </CmdItem>
            </Command.Group>

            {!searchQuery.isFetching &&
              debounced.length > 0 &&
              results.length === 0 && (
                <Command.Empty className="px-4 py-6 text-center text-xs text-gray-600">
                  No users match{" "}
                  <span className="text-gray-400">{debounced}</span>
                </Command.Empty>
              )}
          </Command.List>

          <div className="border-t border-gray-800 px-3 py-2 flex items-center gap-3 text-[10px] text-gray-600">
            <span>
              <kbd className="border border-gray-800 px-1 rounded">↑↓</kbd> nav
            </span>
            <span>
              <kbd className="border border-gray-800 px-1 rounded">↵</kbd> open
            </span>
            <span>
              <kbd className="border border-gray-800 px-1 rounded">⌘↵</kbd> full
              detail
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <StatusDot color="#22c55e" size={5} />
              {onlineCount} online
            </span>
          </div>
        </div>

        {/* RIGHT: preview pane */}
        <PalettePreview value={activeValue} fallbackResults={results} />
      </Command>
    </div>
  );
}

function CmdItem({
  value,
  onSelect,
  icon,
  hint,
  suffix,
  danger,
  children,
  onKeyDown,
}: {
  value: string;
  onSelect: () => void;
  icon?: React.ReactNode;
  hint?: string;
  suffix?: React.ReactNode;
  danger?: boolean;
  children: React.ReactNode;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      onKeyDown={onKeyDown}
      className={`flex items-center gap-3 px-4 py-2 text-sm cursor-pointer rounded-sm mx-1 my-0.5 ${
        danger ? "text-red-300" : "text-gray-200"
      } data-[selected=true]:bg-gray-800/80`}
    >
      {icon && (
        <span
          className={`w-4 flex items-center justify-center text-[11px] ${danger ? "text-red-500" : "text-gray-600"}`}
        >
          {icon}
        </span>
      )}
      <span className="flex-1 truncate">{children}</span>
      {suffix}
      {hint && (
        <kbd className="text-[10px] text-gray-600 border border-gray-800 rounded px-1">
          {hint}
        </kbd>
      )}
    </Command.Item>
  );
}

function TierTag({ tier, small }: { tier: string; small?: boolean }) {
  const colors: Record<string, string> = {
    free: "bg-gray-800 text-gray-400",
    pro: "bg-blue-950 text-blue-300",
    teams: "bg-purple-950 text-purple-300",
    business: "bg-green-950 text-green-300",
  };
  return (
    <span
      className={`${colors[tier] ?? colors.free} rounded px-1.5 ${small ? "text-[10px] py-0" : "text-xs py-0.5"}`}
    >
      {tier}
    </span>
  );
}

function PalettePreview({
  value,
  fallbackResults,
}: {
  value: string;
  fallbackResults: UserListRow[];
}) {
  // Pull user id out of value: "user-<uuid>" | "recent-<uuid>" | "action-…-<uuid>"
  const m = value.match(/([0-9a-f-]{36})$/);
  const id = m?.[1] ?? null;

  // Try cache first via fallbackResults (avoids fetch).
  const cached = id ? fallbackResults.find((u) => u.id === id) : null;

  const detailQuery = useQuery({
    queryKey: ["user", id],
    queryFn: () => adminApi.users.get(id!),
    enabled: !!id,
    staleTime: 30_000,
  });

  if (!id) {
    return (
      <div className="p-4 text-[11px] text-gray-700 leading-relaxed">
        <p className="text-gray-500 mb-2 text-xs font-bold uppercase tracking-widest">
          Tip
        </p>
        <p>
          Start typing to search users by email. Pick a user from Recent, or
          jump to a page from Go to.
        </p>
        <p className="mt-3">
          When a user is open in the right pane, this palette also shows
          actions you can run on them.
        </p>
      </div>
    );
  }

  const d = detailQuery.data;
  const summary: Partial<UserDetail> = d ?? {};
  const fallback = cached;

  return (
    <div className="p-4 text-xs space-y-3 overflow-y-auto">
      <div>
        <div className="text-[10px] text-gray-600 uppercase tracking-widest">
          User
        </div>
        <div className="text-sm text-white truncate">
          {d?.email ?? fallback?.email ?? "…"}
        </div>
        <div className="font-mono text-[10px] text-gray-700 truncate mt-0.5">
          {id}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <TierTag
          tier={d?.subscription_tier ?? fallback?.subscription_tier ?? "free"}
        />
        {(d?.is_banned ?? fallback?.is_banned) && (
          <span className="text-[10px] bg-red-900 text-red-300 rounded px-1.5 py-0.5">
            banned
          </span>
        )}
        {(d?.deleted_at ?? fallback?.deleted_at) && (
          <span className="text-[10px] bg-red-950 border border-red-900 text-red-200 rounded px-1.5 py-0.5">
            deleted
          </span>
        )}
        {d?.is_admin && (
          <span className="text-[10px] bg-yellow-900 text-yellow-300 rounded px-1.5 py-0.5">
            admin
          </span>
        )}
      </div>

      <FactLine label="Trial">{trialPreview(d?.trial_ends_at ?? fallback?.trial_ends_at ?? null, d?.trial_used ?? fallback?.trial_used ?? false)}</FactLine>
      <FactLine label="Signed up">
        {fmtDate(d?.created_at ?? fallback?.created_at)}
      </FactLine>
      {fallback && (
        <>
          <FactLine label="Devices">{fallback.device_count}</FactLine>
          <FactLine label="Blob">{fmtBytes(fallback.total_blob_bytes)}</FactLine>
        </>
      )}
      {(d?.admin_notes ?? "").length > 0 && (
        <div>
          <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">
            Notes
          </div>
          <p className="text-[11px] text-gray-400 whitespace-pre-wrap line-clamp-6">
            {d?.admin_notes}
          </p>
        </div>
      )}
    </div>
  );
}

function FactLine({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2 text-[11px]">
      <span className="text-gray-600 w-16 shrink-0">{label}</span>
      <span className="text-gray-300 min-w-0 truncate">{children}</span>
    </div>
  );
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}
function fmtBytes(b: number | null | undefined): string {
  if (!b) return "0 B";
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(1)} MB`;
}
function trialPreview(iso: string | null, used: boolean): string {
  if (!iso) return used ? "none (used)" : "none";
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "expired";
  return `${days}d left`;
}
