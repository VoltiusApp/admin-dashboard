"use client";

import { useState, useTransition } from "react";
import {
  deleteUserAction,
  restoreUserAction,
  type DeleteResult,
} from "./actions";

interface Props {
  userId: string;
  email: string;
  deletedAt: string | null;
  deletionReason: string | null;
  deletedBy: string | null;
}

const GRACE_DAYS = 7;

function graceRemaining(deletedAt: string): {
  text: string;
  expired: boolean;
} {
  const ms =
    new Date(deletedAt).getTime() + GRACE_DAYS * 86400000 - Date.now();
  if (ms <= 0) return { text: "grace expired — pending purge", expired: true };
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return { text: `${days}d ${hours}h until purge`, expired: false };
  return { text: `${hours}h until purge`, expired: false };
}

export function DangerZone(props: Props) {
  const { userId, email, deletedAt, deletionReason, deletedBy } = props;
  const [open, setOpen] = useState<null | "soft" | "force">(null);
  const [result, setResult] = useState<DeleteResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (deletedAt) {
    const grace = graceRemaining(deletedAt);
    return (
      <div className="border border-red-900 bg-red-950/30 rounded p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-sm text-red-300 font-bold">
              Account scheduled for deletion
            </div>
            <div className="text-xs text-red-400 mt-1">
              Deleted {new Date(deletedAt).toLocaleString()}
              {deletedBy && <> by {deletedBy}</>}
              {deletionReason && <> — {deletionReason}</>}
            </div>
            <div
              className={`text-xs mt-1 ${grace.expired ? "text-red-300" : "text-red-500"}`}
            >
              {grace.text}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await restoreUserAction(userId);
                });
              }}
              className="bg-green-900 hover:bg-green-800 disabled:opacity-50 text-green-300 text-xs px-3 py-1.5 rounded"
            >
              {pending ? "Restoring…" : "Restore"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setOpen("force");
                setResult(null);
              }}
              className="bg-red-900 hover:bg-red-800 disabled:opacity-50 text-red-300 text-xs px-3 py-1.5 rounded"
            >
              Purge now
            </button>
          </div>
        </div>
        {open === "force" && (
          <ConfirmModal
            mode="force"
            email={email}
            pending={pending}
            result={result}
            onCancel={() => setOpen(null)}
            onSubmit={(fd) => {
              startTransition(async () => {
                const r = await deleteUserAction(userId, fd);
                setResult(r);
                if (r.ok) setOpen(null);
              });
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="border border-red-900/60 bg-red-950/10 rounded p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-sm text-red-400 font-bold">Danger zone</div>
          <div className="text-xs text-gray-500 mt-1">
            Deleting locks the account immediately and queues it for permanent
            removal after {GRACE_DAYS} days. You can restore within the grace
            window.
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen("soft");
            setResult(null);
          }}
          className="bg-red-900 hover:bg-red-800 text-red-300 text-xs px-3 py-1.5 rounded"
        >
          Delete account…
        </button>
      </div>
      {open === "soft" && (
        <ConfirmModal
          mode="soft"
          email={email}
          pending={pending}
          result={result}
          onCancel={() => setOpen(null)}
          onSubmit={(fd) => {
            startTransition(async () => {
              const r = await deleteUserAction(userId, fd);
              setResult(r);
              if (r.ok) setOpen(null);
            });
          }}
          onForceInstead={(fd) => {
            fd.set("force", "true");
            startTransition(async () => {
              const r = await deleteUserAction(userId, fd);
              setResult(r);
              if (r.ok) setOpen(null);
            });
          }}
        />
      )}
    </div>
  );
}

function ConfirmModal({
  mode,
  email,
  pending,
  result,
  onCancel,
  onSubmit,
  onForceInstead,
}: {
  mode: "soft" | "force";
  email: string;
  pending: boolean;
  result: DeleteResult | null;
  onCancel: () => void;
  onSubmit: (fd: FormData) => void;
  onForceInstead?: (fd: FormData) => void;
}) {
  const [showForceFields, setShowForceFields] = useState(mode === "force");
  const isForce = mode === "force" || showForceFields;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("expected_email", email);
          if (isForce) fd.set("force", "true");
          onSubmit(fd);
        }}
        className="bg-gray-900 border border-red-900 rounded max-w-md w-full p-6 space-y-4 font-mono"
      >
        <h2 className="text-base font-bold text-red-300">
          {isForce ? "Permanently delete account" : "Delete account"}
        </h2>
        <p className="text-xs text-gray-400">
          {isForce ? (
            <>
              This <strong className="text-red-300">cannot be undone</strong>.
              The user row, devices, flags, churn history and sync blobs will be
              removed immediately.
            </>
          ) : (
            <>
              The account will be locked now and purged in {GRACE_DAYS} days.
              You can restore it from this page during the grace window.
            </>
          )}
        </p>

        <label className="block">
          <span className="text-xs text-gray-500">
            Type the email to confirm:{" "}
            <span className="text-gray-300">{email}</span>
          </span>
          <input
            name="confirm_email"
            autoComplete="off"
            required
            className="mt-1 w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-red-700"
          />
        </label>

        <label className="block">
          <span className="text-xs text-gray-500">Reason (optional, logged)</span>
          <input
            name="reason"
            autoComplete="off"
            placeholder="e.g. user request, ToS violation"
            className="mt-1 w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-gray-500"
          />
        </label>

        {isForce && (
          <label className="block">
            <span className="text-xs text-red-400">
              Type <strong>DELETE</strong> to permanently remove:
            </span>
            <input
              name="confirm_delete"
              autoComplete="off"
              required
              className="mt-1 w-full bg-gray-950 border border-red-900 rounded px-2 py-1.5 text-sm text-red-200 focus:outline-none focus:border-red-700"
            />
          </label>
        )}

        {result && !result.ok && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded px-3 py-2">
            <div className="font-bold">Error: {result.error}</div>
            {result.message && <div className="mt-1">{result.message}</div>}
            {result.constraint && (
              <div className="mt-1 text-gray-500">
                Blocked by FK constraint:{" "}
                <code className="text-red-300">{result.constraint}</code>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="text-xs text-gray-500 hover:text-white px-3 py-1.5"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            {mode === "soft" && !showForceFields && (
              <button
                type="button"
                onClick={() => setShowForceFields(true)}
                disabled={pending}
                className="text-xs text-red-500 hover:text-red-300 underline"
              >
                or purge immediately
              </button>
            )}
            {mode === "soft" && showForceFields && onForceInstead && (
              <button
                type="button"
                disabled={pending}
                onClick={(e) => {
                  const form = e.currentTarget.closest("form");
                  if (!form) return;
                  if (!form.reportValidity()) return;
                  const fd = new FormData(form);
                  fd.set("expected_email", email);
                  onForceInstead(fd);
                }}
                className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs px-4 py-1.5 rounded"
              >
                {pending ? "Purging…" : "Purge now"}
              </button>
            )}
            {!showForceFields && (
              <button
                type="submit"
                disabled={pending}
                className="bg-red-900 hover:bg-red-800 disabled:opacity-50 text-red-200 text-xs px-4 py-1.5 rounded"
              >
                {pending
                  ? "Working…"
                  : isForce
                    ? "Permanently delete"
                    : "Soft delete"}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
