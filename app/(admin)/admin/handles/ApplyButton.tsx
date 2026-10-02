"use client";

import { useActionState } from "react";
import { deriveHandlesAction, type DeriveResult } from "../users/[id]/actions";

export function ApplyButton({ changes }: { changes: number }) {
  const [state, action, pending] = useActionState<DeriveResult, FormData>(deriveHandlesAction, null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Rename ${changes} account${changes === 1 ? "" : "s"}? Old handles are retired for good.`)) {
          e.preventDefault();
        }
      }}
      className="space-y-2"
    >
      <button
        type="submit"
        disabled={changes === 0 || pending}
        className="text-sm px-4 py-2 rounded bg-yellow-700 hover:bg-yellow-600 text-white disabled:opacity-40"
      >
        {pending ? "Applying…" : `Apply ${changes} change${changes === 1 ? "" : "s"}`}
      </button>
      {state && "error" in state && <p className="text-xs text-red-400">{state.error}</p>}
      {state && "applied" in state && (
        <p className="text-xs text-green-400">
          Renamed {state.applied} account{state.applied === 1 ? "" : "s"}.
        </p>
      )}
    </form>
  );
}
