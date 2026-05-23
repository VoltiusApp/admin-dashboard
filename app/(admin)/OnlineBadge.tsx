"use client";

import { usePresence } from "@/app/lib/use-presence";
import { StatusDot } from "./admin/users/StatusDot";

export function OnlineBadge() {
  const { count, isLoading } = usePresence();
  return (
    <div
      className="px-3 py-2 text-[10px] text-gray-500 border border-gray-800 rounded flex items-center gap-2"
      title="Users with an active sync connection right now"
    >
      <StatusDot color="#22c55e" size={6} animate={!isLoading && count > 0} />
      <span>
        {isLoading ? "…" : count} online
      </span>
    </div>
  );
}
