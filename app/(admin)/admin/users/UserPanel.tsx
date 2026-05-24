"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { useState } from "react";
import {
  adminApi,
  type UserDetail,
  type UsersResponse,
} from "@/app/lib/admin-client";
import { usePresence } from "@/app/lib/use-presence";
import { StatusDot } from "./StatusDot";

const TIER_COLORS: Record<string, string> = {
  free: "bg-gray-700 text-gray-300",
  pro: "bg-blue-900 text-blue-300",
  teams: "bg-purple-900 text-purple-300",
  business: "bg-green-900 text-green-300",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function formatBytes(b: number) {
  if (!b) return "0 B";
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(1)} MB`;
}

export function UserPanel({ id }: { id: string }) {
  const qc = useQueryClient();
  const { onlineSet } = usePresence();
  const isOnline = onlineSet.has(id);
  const userQuery = useQuery({
    queryKey: ["user", id],
    queryFn: () => adminApi.users.get(id),
  });
  const auditQuery = useQuery({
    queryKey: ["user", id, "audit"],
    queryFn: () => adminApi.users.audit(id, 10),
  });

  const invalidateUser = () => {
    qc.invalidateQueries({ queryKey: ["user", id] });
    qc.invalidateQueries({ queryKey: ["users"] });
  };

  const banMutation = useMutation({
    mutationFn: ({ reason }: { reason: string }) =>
      adminApi.users.ban(id, reason),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["user", id] });
      const prev = qc.getQueryData<UserDetail>(["user", id]);
      if (prev) {
        qc.setQueryData<UserDetail>(["user", id], {
          ...prev,
          is_banned: true,
        });
      }
      patchUsersListCache(qc, id, (r) => ({ ...r, is_banned: true }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["user", id], ctx.prev);
      invalidateUser();
      toast.error("Failed to ban user");
    },
    onSuccess: (_d, vars) => {
      toast.success(`Banned ${userQuery.data?.email ?? "user"}`, {
        action: {
          label: "Undo",
          onClick: () => unbanMutation.mutate(),
        },
        description: vars.reason,
      });
    },
    onSettled: invalidateUser,
  });

  const unbanMutation = useMutation({
    mutationFn: () => adminApi.users.unban(id),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["user", id] });
      const prev = qc.getQueryData<UserDetail>(["user", id]);
      if (prev) {
        qc.setQueryData<UserDetail>(["user", id], {
          ...prev,
          is_banned: false,
        });
      }
      patchUsersListCache(qc, id, (r) => ({ ...r, is_banned: false }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["user", id], ctx.prev);
      invalidateUser();
      toast.error("Failed to unban user");
    },
    onSuccess: () => {
      toast.success(`Unbanned ${userQuery.data?.email ?? "user"}`);
    },
    onSettled: invalidateUser,
  });

  const tierMutation = useMutation({
    mutationFn: ({ tier }: { tier: string }) =>
      adminApi.users.patch(id, { tier }),
    onMutate: async ({ tier }) => {
      await qc.cancelQueries({ queryKey: ["user", id] });
      const prev = qc.getQueryData<UserDetail>(["user", id]);
      if (prev) {
        qc.setQueryData<UserDetail>(["user", id], {
          ...prev,
          subscription_tier: tier,
        });
      }
      patchUsersListCache(qc, id, (r) => ({ ...r, subscription_tier: tier }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["user", id], ctx.prev);
      invalidateUser();
      toast.error("Failed to change tier");
    },
    onSuccess: (_d, vars) => {
      const oldTier = userQuery.data?.subscription_tier;
      toast.success(`Set tier ${vars.tier}`, {
        action: oldTier
          ? {
              label: "Undo",
              onClick: () => tierMutation.mutate({ tier: oldTier }),
            }
          : undefined,
      });
    },
    onSettled: invalidateUser,
  });

  const deleteMutation = useMutation({
    mutationFn: ({ reason }: { reason: string | null }) =>
      adminApi.users.delete(id, { reason }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message ?? `Delete failed (${result.status})`);
        return;
      }
      toast.success(`Deleted ${userQuery.data?.email ?? "user"}`, {
        description: "Purges in 7 days. Restore from the panel.",
        action: {
          label: "Undo",
          onClick: () => restoreMutation.mutate(),
        },
      });
      invalidateUser();
    },
    onError: () => toast.error("Failed to delete user"),
  });

  const restoreMutation = useMutation({
    mutationFn: () => adminApi.users.restore(id),
    onSuccess: () => {
      toast.success(`Restored ${userQuery.data?.email ?? "user"}`);
      invalidateUser();
    },
    onError: () => toast.error("Failed to restore user"),
  });

  const extendTrialMutation = useMutation({
    mutationFn: ({ days }: { days: number }) =>
      adminApi.users.extendTrial(id, days),
    onSuccess: (_d, vars) => {
      if (vars.days > 0) {
        toast.success(`Extended trial by ${vars.days}d`);
      } else {
        toast.success(`Reduced trial by ${Math.abs(vars.days)}d`);
      }
      invalidateUser();
    },
    onError: () => toast.error("Failed to update trial"),
  });

  const clearTrialMutation = useMutation({
    mutationFn: () => adminApi.users.clearTrial(id),
    onSuccess: () => {
      toast.success("Trial removed");
      invalidateUser();
    },
    onError: () => toast.error("Failed to remove trial"),
  });

  if (userQuery.isLoading) {
    return (
      <div className="p-6 text-sm text-gray-500">Loading user…</div>
    );
  }
  if (userQuery.isError || !userQuery.data) {
    return (
      <div className="p-6 text-sm text-red-400">Failed to load user.</div>
    );
  }

  const user = userQuery.data;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="border-b border-gray-800 bg-gray-950 px-5 py-3 flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isOnline && (
              <StatusDot
                color="#22c55e"
                size={8}
                title="Online — active sync connection"
              />
            )}
            <div className="text-sm font-bold text-white truncate">
              {user.email}
            </div>
          </div>
          <div className="text-xs text-gray-500 font-mono mt-0.5 truncate">
            {user.id}
          </div>
        </div>
        {user.deleted_at && (
          <Badge color="red-dark">DELETED</Badge>
        )}
        {user.is_banned && <Badge color="red">BANNED</Badge>}
        {user.is_admin && <Badge color="yellow">ADMIN</Badge>}
        <Link
          href={`/admin/users/${user.id}`}
          className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-2 py-1 rounded"
        >
          Full detail →
        </Link>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-5">
        {user.deleted_at && (
          <DeletionBanner
            deletedAt={user.deleted_at}
            reason={user.deletion_reason}
            by={user.deleted_by}
            restoring={restoreMutation.isPending}
            onRestore={() => restoreMutation.mutate()}
          />
        )}

        {/* Quick facts grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <Fact label="Tier">
            <TierMenu
              current={user.subscription_tier}
              disabled={tierMutation.isPending}
              onChange={(tier) => tierMutation.mutate({ tier })}
            />
          </Fact>
          <Fact label="Trial">
            <TrialControl
              endsAt={user.trial_ends_at}
              used={user.trial_used}
              pending={extendTrialMutation.isPending || clearTrialMutation.isPending}
              onExtend={(days) => extendTrialMutation.mutate({ days })}
              onClear={() => clearTrialMutation.mutate()}
            />
          </Fact>
          <Fact label="Signed up">{fmt(user.created_at)}</Fact>
          <Fact label="LS customer">
            {user.ls_customer_id ? (
              <a
                href={`https://app.lemonsqueezy.com/customers/${user.ls_customer_id}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:underline font-mono"
              >
                {user.ls_customer_id.slice(0, 12)}…
              </a>
            ) : (
              <span className="text-gray-600">—</span>
            )}
          </Fact>
        </div>

        {/* Ban / unban */}
        <Section title="Moderation">
          {user.is_banned ? (
            <BanRow
              reason={user.ban_reason}
              bannedAt={user.banned_at}
              pending={unbanMutation.isPending}
              onUnban={() => unbanMutation.mutate()}
            />
          ) : (
            <BanForm
              pending={banMutation.isPending}
              onBan={(reason) => banMutation.mutate({ reason })}
            />
          )}
        </Section>

        {/* Notes */}
        {user.admin_notes && (
          <Section title="Admin notes">
            <p className="text-xs text-gray-400 whitespace-pre-wrap">
              {user.admin_notes}
            </p>
          </Section>
        )}

        {/* Recent activity */}
        <Section title="Recent activity">
          {auditQuery.isLoading ? (
            <p className="text-xs text-gray-600">Loading…</p>
          ) : !auditQuery.data || auditQuery.data.length === 0 ? (
            <p className="text-xs text-gray-600">No audit entries.</p>
          ) : (
            <ul className="space-y-1.5">
              {auditQuery.data.slice(0, 8).map((a) => (
                <li
                  key={a.id}
                  className="text-xs flex items-baseline gap-2 border-b border-gray-900 pb-1.5"
                >
                  <span className={`font-mono ${actionColor(a.action)}`}>
                    {a.action}
                  </span>
                  <span className="text-gray-600 ml-auto whitespace-nowrap">
                    {relTime(a.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Danger zone */}
        {!user.deleted_at && (
          <Section title="Danger zone">
            <DeleteButton
              email={user.email}
              pending={deleteMutation.isPending}
              onDelete={(reason) => deleteMutation.mutate({ reason })}
            />
          </Section>
        )}
      </div>
    </div>
  );
}

function patchUsersListCache(
  qc: ReturnType<typeof useQueryClient>,
  userId: string,
  patch: (row: UserListRow) => UserListRow
) {
  const queries = qc.getQueriesData<UsersResponse>({ queryKey: ["users"] });
  for (const [key, data] of queries) {
    if (!data) continue;
    const next = data.users.map((u) => (u.id === userId ? patch(u) : u));
    qc.setQueryData<UsersResponse>(key, { ...data, users: next });
  }
}

type UserListRow = UsersResponse["users"][number];

// ─── Subcomponents ────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
        {title}
      </h2>
      <div className="bg-gray-900/40 border border-gray-800 rounded p-3">
        {children}
      </div>
    </div>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900/40 border border-gray-800 rounded p-2.5">
      <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">
        {label}
      </div>
      <div className="text-sm text-gray-200">{children}</div>
    </div>
  );
}

function Badge({
  color,
  children,
}: {
  color: "red" | "red-dark" | "yellow";
  children: React.ReactNode;
}) {
  const cls = {
    red: "bg-red-900 text-red-300",
    "red-dark": "bg-red-950 text-red-200 border border-red-900",
    yellow: "bg-yellow-900 text-yellow-300",
  }[color];
  return (
    <span className={`text-[10px] tracking-widest px-2 py-0.5 rounded ${cls}`}>
      {children}
    </span>
  );
}

function TierMenu({
  current,
  disabled,
  onChange,
}: {
  current: string;
  disabled: boolean;
  onChange: (tier: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {(["free", "pro", "teams", "business"] as const).map((tier) => (
        <button
          key={tier}
          type="button"
          disabled={disabled || tier === current}
          onClick={() => onChange(tier)}
          className={`text-[10px] px-2 py-0.5 rounded transition ${
            tier === current
              ? `${TIER_COLORS[tier] ?? "bg-gray-700"} ring-1 ring-gray-500`
              : "bg-gray-900 border border-gray-800 text-gray-500 hover:text-white hover:border-gray-600"
          } ${disabled ? "opacity-50" : ""}`}
        >
          {tier}
        </button>
      ))}
    </div>
  );
}

function TrialControl({
  endsAt,
  used,
  pending,
  onExtend,
  onClear,
}: {
  endsAt: string | null;
  used: boolean;
  pending: boolean;
  onExtend: (days: number) => void;
  onClear: () => void;
}) {
  let label: React.ReactNode = (
    <span className="text-gray-600">no trial</span>
  );
  const hasActiveTrial = endsAt != null;
  if (endsAt) {
    const ms = new Date(endsAt).getTime() - Date.now();
    const days = Math.ceil(ms / 86_400_000);
    if (days <= 0) {
      label = <span className="text-red-400">expired</span>;
    } else if (days <= 3) {
      label = <span className="text-red-400">{days}d left</span>;
    } else {
      label = <span className="text-gray-300">{days}d left</span>;
    }
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 flex-wrap">
        {label}
        {used && <span className="text-[10px] text-gray-600">(used)</span>}
      </div>
      <div className="flex gap-1 flex-wrap">
        {hasActiveTrial && [7, 14].map((d) => (
          <button
            key={`-${d}`}
            type="button"
            disabled={pending}
            onClick={() => onExtend(-d)}
            className="text-[10px] text-gray-500 hover:text-white border border-gray-800 hover:border-gray-600 px-1.5 rounded disabled:opacity-50"
          >
            -{d}d
          </button>
        ))}
        {[7, 14, 30].map((d) => (
          <button
            key={`+${d}`}
            type="button"
            disabled={pending}
            onClick={() => onExtend(d)}
            className="text-[10px] text-gray-500 hover:text-white border border-gray-800 hover:border-gray-600 px-1.5 rounded disabled:opacity-50"
          >
            +{d}d
          </button>
        ))}
        {hasActiveTrial && (
          <button
            type="button"
            disabled={pending}
            onClick={onClear}
            className="text-[10px] text-red-700 hover:text-red-400 border border-gray-800 hover:border-red-900 px-1.5 rounded disabled:opacity-50 ml-1"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function BanRow({
  reason,
  bannedAt,
  pending,
  onUnban,
}: {
  reason: string | null;
  bannedAt: string | null;
  pending: boolean;
  onUnban: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-xs text-red-300 min-w-0">
        <div>{reason ?? "no reason given"}</div>
        {bannedAt && (
          <div className="text-gray-500 text-[10px] mt-0.5">{fmt(bannedAt)}</div>
        )}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={onUnban}
        className="bg-green-900 hover:bg-green-800 disabled:opacity-50 text-green-300 text-xs px-3 py-1.5 rounded shrink-0"
      >
        {pending ? "…" : "Unban"}
      </button>
    </div>
  );
}

function BanForm({
  pending,
  onBan,
}: {
  pending: boolean;
  onBan: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason.trim()) return;
        onBan(reason.trim());
        setReason("");
      }}
      className="flex gap-2"
    >
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Ban reason"
        className="flex-1 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-gray-500"
      />
      <button
        type="submit"
        disabled={pending || !reason.trim()}
        className="bg-red-900 hover:bg-red-800 disabled:opacity-50 text-red-300 text-xs px-3 py-1.5 rounded"
      >
        {pending ? "…" : "Ban"}
      </button>
    </form>
  );
}

function DeleteButton({
  email,
  pending,
  onDelete,
}: {
  email: string;
  pending: boolean;
  onDelete: (reason: string | null) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");

  if (!confirming) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          Soft delete with 7-day grace. Use Full detail for permanent purge.
        </p>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="bg-red-900 hover:bg-red-800 text-red-300 text-xs px-3 py-1.5 rounded shrink-0"
        >
          Delete…
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm.trim() !== email) return;
        onDelete(reason.trim() || null);
        setConfirming(false);
        setConfirm("");
        setReason("");
      }}
      className="space-y-2"
    >
      <p className="text-xs text-red-400">
        Type <span className="text-gray-300">{email}</span> to confirm:
      </p>
      <input
        autoFocus
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-red-700"
      />
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-gray-500"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setConfirm("");
            setReason("");
          }}
          className="text-xs text-gray-500 hover:text-white px-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || confirm.trim() !== email}
          className="bg-red-900 hover:bg-red-800 disabled:opacity-30 text-red-200 text-xs px-3 py-1.5 rounded"
        >
          {pending ? "…" : "Soft delete"}
        </button>
      </div>
    </form>
  );
}

function DeletionBanner({
  deletedAt,
  reason,
  by,
  restoring,
  onRestore,
}: {
  deletedAt: string;
  reason: string | null;
  by: string | null;
  restoring: boolean;
  onRestore: () => void;
}) {
  const ms =
    new Date(deletedAt).getTime() + 7 * 86_400_000 - Date.now();
  const expired = ms <= 0;
  const days = Math.max(0, Math.floor(ms / 86_400_000));
  const hours = Math.max(0, Math.floor((ms % 86_400_000) / 3_600_000));
  return (
    <div className="border border-red-900 bg-red-950/30 rounded p-3 flex items-start justify-between gap-3">
      <div className="text-xs min-w-0">
        <div className="text-red-300 font-bold">Pending deletion</div>
        <div className="text-red-400 mt-1">
          Deleted {fmt(deletedAt)}
          {by && <> by {by}</>}
          {reason && <> — {reason}</>}
        </div>
        <div className={expired ? "text-red-300 mt-1" : "text-red-500 mt-1"}>
          {expired ? "grace expired — pending purge" : `${days}d ${hours}h until purge`}
        </div>
      </div>
      <button
        type="button"
        onClick={onRestore}
        disabled={restoring}
        className="bg-green-900 hover:bg-green-800 disabled:opacity-50 text-green-300 text-xs px-3 py-1.5 rounded shrink-0"
      >
        {restoring ? "…" : "Restore"}
      </button>
    </div>
  );
}

function actionColor(action: string): string {
  if (action.startsWith("delete") || action.startsWith("ban"))
    return "text-red-300";
  if (action.startsWith("restore") || action.startsWith("unban"))
    return "text-green-300";
  if (action.startsWith("patch") || action.startsWith("set_flag"))
    return "text-yellow-300";
  return "text-gray-300";
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
