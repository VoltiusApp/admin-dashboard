// Browser-side admin API client. Talks to the Next proxy at /api/admin/*,
// which forwards to the Rust backend with the admin secret attached.

export interface UserListRow {
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
  deleted_at: string | null;
}

export interface UsersResponse {
  users: UserListRow[];
  total: number;
  page: number;
  limit: number;
}

export interface UserDetail {
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
  admin_override: boolean;
  created_at: string;
  seat_count: number | null;
  deleted_at: string | null;
  deletion_reason: string | null;
  deleted_by: string | null;
}

export interface OverviewResponse {
  mrr_total: number;
  mrr_by_tier: { pro: number; teams: number; business: number };
  paying_subscribers: number;
  trials_active: number;
  trials_expiring_7d: number;
  signups_7d: number;
  signups_30d: number;
  churn_7d: number;
  churn_30d: number;
  total_users: number;
  deleted_pending: number;
  total_blob_gb: number;
  conversion_pct: number;
  tier_breakdown: { free: number; pro: number; teams: number; business: number };
  signups_series: { day: string; count: number }[];
  churn_series: { day: string; count: number }[];
  recent_signups: {
    id: string;
    email: string;
    subscription_tier: string;
    created_at: string;
  }[];
  recent_churn: {
    id: string;
    user_id: string;
    from_tier: string;
    to_tier: string;
    reason: string | null;
    created_at: string;
  }[];
}

export interface LsRecentOrder {
  id: string;
  email: string | null;
  status: string;
  total_cents: number;
  currency: string;
  created_at: string;
  refunded: boolean;
}

export interface LsMetrics {
  mrr_cents: number;
  mrr_monthly_cents: number;
  mrr_annual_cents: number;
  paying_count: number;
  on_trial_count: number;
  past_due_count: number;
  cancelled_active_count: number;
  revenue_this_month_cents: number;
  refunds_30d_cents: number;
  failed_payments_30d: number;
  recent_orders: LsRecentOrder[];
  currency: string;
}

export interface LsSummaryResponse {
  metrics: LsMetrics | null;
  refreshed_at: string | null;
  last_error: string | null;
  refreshing: boolean;
}

export interface AuditEntry {
  id: string;
  admin_email: string;
  target_id: string | null;
  action: string;
  detail: unknown;
  created_at: string;
}

export interface UsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  tier?: string;
  banned?: boolean;
  deleted?: "only" | "any";
}

export interface PatchUserBody {
  tier?: string;
  trial_ends_at?: string | null;
  clear_trial?: boolean;
  trial_used?: boolean;
  discount_pct?: number | null;
  admin_notes?: string;
  admin_override?: boolean;
  seat_count?: number;
}

export interface DeleteResult {
  ok: boolean;
  status: number;
  error?: string;
  constraint?: string;
  message?: string;
}

class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { expectEmpty?: boolean }
): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      (body as { error?: string }).error ?? res.statusText,
      body
    );
  }

  if (init?.expectEmpty || res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

function buildQuery(params: UsersQuery): string {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.search) qs.set("search", params.search);
  if (params.tier) qs.set("tier", params.tier);
  if (params.banned !== undefined) qs.set("banned", String(params.banned));
  if (params.deleted) qs.set("deleted", params.deleted);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export interface PresenceResponse {
  online: string[];
  count: number;
}

export interface ServerMeta {
  self_hosted: boolean;
  billing_enabled: boolean;
}

export async function fetchMeta(): Promise<ServerMeta> {
  try {
    const res = await fetch("/api/meta", { cache: "no-store" });
    if (!res.ok) return { self_hosted: true, billing_enabled: false };
    return (await res.json()) as ServerMeta;
  } catch {
    return { self_hosted: true, billing_enabled: false };
  }
}

export const adminApi = {
  presence: {
    list: () => request<PresenceResponse>(`/presence`),
  },
  overview: {
    get: () => request<OverviewResponse>("/overview"),
  },
  meta: {
    get: fetchMeta,
  },
  lemonsqueezy: {
    summary: (opts: { refresh?: boolean } = {}) =>
      request<LsSummaryResponse>(
        `/lemonsqueezy/summary${opts.refresh ? "?refresh=true" : ""}`
      ),
  },
  users: {
    list: (params: UsersQuery = {}) =>
      request<UsersResponse>(`/users${buildQuery(params)}`),

    get: (id: string) => request<UserDetail>(`/users/${id}`),

    patch: (id: string, body: PatchUserBody) =>
      request<void>(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
        expectEmpty: true,
      }),

    ban: (id: string, reason: string) =>
      request<void>(`/users/${id}/ban`, {
        method: "POST",
        body: JSON.stringify({ reason }),
        expectEmpty: true,
      }),

    unban: (id: string) =>
      request<void>(`/users/${id}/unban`, {
        method: "POST",
        expectEmpty: true,
      }),

    delete: async (
      id: string,
      opts: { force?: boolean; reason?: string | null } = {}
    ): Promise<DeleteResult> => {
      const qs = opts.force ? "?force=true" : "";
      const res = await fetch(`/api/admin/users/${id}${qs}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: opts.reason ?? null }),
      });
      if (res.status === 204) {
        return { ok: true, status: 204 };
      }
      const body = await res.json().catch(() => ({}));
      return {
        ok: false,
        status: res.status,
        error: (body as { error?: string }).error,
        constraint: (body as { constraint?: string }).constraint,
        message: (body as { message?: string }).message,
      };
    },

    restore: (id: string) =>
      request<void>(`/users/${id}/restore`, {
        method: "POST",
        expectEmpty: true,
      }),

    extendTrial: (id: string, days: number) =>
      request<void>(`/users/${id}/extend-trial`, {
        method: "POST",
        body: JSON.stringify({ days }),
        expectEmpty: true,
      }),

    audit: (id: string, limit = 50) =>
      request<AuditEntry[]>(`/audit-log?target_id=${id}&limit=${limit}`),
  },
};

export { ApiError };
