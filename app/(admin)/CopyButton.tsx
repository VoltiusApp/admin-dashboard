"use client";

import { useEffect, useState } from "react";

type Status = "idle" | "ok" | "err";

/**
 * Copy-to-clipboard affordance with inline feedback. Self-contained rather than
 * toast-driven so it also renders inside the server-component detail page, and
 * it stops click propagation so it can sit in a row that is itself clickable.
 */
export function CopyButton({
  value,
  label,
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (status === "idle") return;
    const t = setTimeout(() => setStatus("idle"), 1200);
    return () => clearTimeout(t);
  }, [status]);

  const what = label ?? value;
  const tone =
    status === "ok"
      ? "text-green-400"
      : status === "err"
        ? "text-red-400"
        : "text-gray-600 hover:text-gray-300";

  return (
    <button
      type="button"
      title={
        status === "ok"
          ? "Copied"
          : status === "err"
            ? "Clipboard unavailable"
            : `Copy ${what}`
      }
      aria-label={`Copy ${what}`}
      onClick={(e) => {
        e.stopPropagation();
        // Absent outside a secure context, so guard rather than throw.
        if (!navigator.clipboard) {
          setStatus("err");
          return;
        }
        navigator.clipboard.writeText(value).then(
          () => setStatus("ok"),
          () => setStatus("err")
        );
      }}
      className={`shrink-0 transition-colors ${tone} ${className}`}
    >
      {status === "ok" ? (
        <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7 7a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06L6.25 10.69l6.47-6.47a.75.75 0 0 1 1.06 0" />
        </svg>
      ) : (
        <svg
          width="11"
          height="11"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="5.75" y="5.75" width="8.5" height="8.5" rx="1.5" />
          <path d="M10.25 3.25a1.5 1.5 0 0 0-1.5-1.5h-5a1.5 1.5 0 0 0-1.5 1.5v5a1.5 1.5 0 0 0 1.5 1.5" />
        </svg>
      )}
    </button>
  );
}
