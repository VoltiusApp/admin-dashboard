"use client";

import { useActionState } from "react";
import { setHandleAction } from "./actions";

export function HandleForm({ userId, handle }: { userId: string; handle: string }) {
  const [state, action, pending] = useActionState(setHandleAction.bind(null, userId), { error: null });
  return (
    <form action={action} className="flex flex-col gap-1">
      <div className="flex gap-2 items-center">
        <span className="text-gray-500 text-sm">@</span>
        <input
          name="handle"
          defaultValue={handle}
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white font-mono"
        />
        <button
          type="submit"
          disabled={pending}
          className="text-xs px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 text-white disabled:opacity-50"
        >
          Set handle
        </button>
      </div>
      {state.error && <p className="text-xs text-red-400">{state.error}</p>}
      <p className="text-xs text-gray-500">The old handle is retired for good and can't be reused.</p>
    </form>
  );
}
