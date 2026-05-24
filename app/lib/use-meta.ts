"use client";

import { useQuery } from "@tanstack/react-query";
import { adminApi, type ServerMeta } from "./admin-client";

const FALLBACK: ServerMeta = { self_hosted: true, billing_enabled: false };

/// Cached server metadata (whether the backend has Lemon Squeezy configured).
/// Falls back to "self-hosted" so the UI degrades gracefully if /v1/meta is
/// unreachable — i.e. we never show billing widgets we can't back up.
export function useMeta(): ServerMeta {
  const { data } = useQuery({
    queryKey: ["server-meta"],
    queryFn: () => adminApi.meta.get(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  return data ?? FALLBACK;
}
