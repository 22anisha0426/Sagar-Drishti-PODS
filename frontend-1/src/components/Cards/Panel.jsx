export function Panel({ title, action, children, className = "", solid = false }) {
  return (
    <div className={`rounded-xl ${solid ? "glass-panel-solid" : "glass-panel"} ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ice-300/90">{title}</h3>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function StatRow({ label, value, valueClass = "text-ice-100" }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`font-mono-num text-sm font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}

export function MetricCard({ label, value, unit, valueClass = "text-ice-200" }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 font-mono-num text-xl font-bold ${valueClass}`}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-slate-500">{unit}</span>}
      </p>
    </div>
  );
}
