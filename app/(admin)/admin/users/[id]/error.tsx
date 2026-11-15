"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition } from "react";

export default function UserPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  return (
    <div className="p-6 max-w-xl space-y-3">
      <h1 className="text-lg font-semibold text-red-400">Not saved</h1>
      <p className="text-sm text-gray-300">
        The server rejected the last change, or the page failed to load. Nothing from that
        change was applied. Reload to see the user as it is now.
      </p>
      {error.digest && <p className="text-xs text-gray-500 font-mono">digest {error.digest}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => startTransition(() => { router.refresh(); reset(); })}
          className="bg-gray-800 hover:bg-gray-700 text-white text-sm px-3 py-1.5 rounded"
        >
          Reload
        </button>
        <Link href="/admin/users" className="text-gray-400 hover:text-white text-sm px-3 py-1.5">
          ← Users
        </Link>
      </div>
    </div>
  );
}
