"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { adminApi } from "./admin-client";

/**
 * Live online-users tracker. Refetches every 15s so the dot stays roughly
 * in sync with the server's PresenceMap (live SSE subscribers).
 */
export function usePresence() {
  const query = useQuery({
    queryKey: ["presence"],
    queryFn: () => adminApi.presence.list(),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const onlineSet = useMemo(
    () => new Set(query.data?.online ?? []),
    [query.data]
  );

  return {
    onlineSet,
    count: query.data?.count ?? 0,
    isLoading: query.isLoading,
  };
}
