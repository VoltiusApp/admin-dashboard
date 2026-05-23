// Port of voltius/src/components/shared/StatusDot.tsx so the admin dashboard
// uses the same visual language as the host ping-dot in the Tauri app.

interface Props {
  color?: string;
  animate?: boolean;
  fast?: boolean;
  size?: number;
  title?: string;
  className?: string;
}

export function StatusDot({
  color = "#22c55e",
  animate = true,
  fast = false,
  size = 8,
  title,
  className = "",
}: Props) {
  return (
    <span
      title={title}
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {animate && (
        <span
          className={`absolute inset-0 rounded-full ${fast ? "animate-ping-fast" : "animate-ping-slow"}`}
          style={{ background: color }}
        />
      )}
      <span
        className="relative block rounded-full"
        style={{ width: size, height: size, background: color }}
      />
    </span>
  );
}
