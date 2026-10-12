const RISK_COLORS = {
  LOW: { text: "text-green", bg: "bg-green/15", ring: "ring-green/40", dot: "bg-green" },
  MODERATE: { text: "text-amber", bg: "bg-amber/15", ring: "ring-amber/40", dot: "bg-amber" },
  HIGH: { text: "text-red", bg: "bg-red/15", ring: "ring-red/40", dot: "bg-red" },
  NOMINAL: { text: "text-green", bg: "bg-green/15", ring: "ring-green/40", dot: "bg-green" },
  CRITICAL: { text: "text-red", bg: "bg-red/15", ring: "ring-red/40", dot: "bg-red" },
  TRACKED: { text: "text-ice-300", bg: "bg-ice-500/15", ring: "ring-ice-400/40", dot: "bg-ice-300" },
  DRIFTING: { text: "text-amber", bg: "bg-amber/15", ring: "ring-amber/40", dot: "bg-amber" },
};

export default function StatusIndicator({ status, pulse = false, size = "md" }) {
  const c = RISK_COLORS[status] || RISK_COLORS.TRACKED;
  const sizes = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-mono-num font-semibold uppercase tracking-wider ring-1 ${c.text} ${c.bg} ${c.ring} ${sizes}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot} ${pulse ? "dot-pulse" : ""}`} />
      {status}
    </span>
  );
}
