export default function MapLegend({ items, title = "Legend" }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 backdrop-blur">
      <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">{title}</p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm ring-1 ring-white/10" style={{ backgroundColor: item.color }} />
            <span className="text-[11px] text-slate-300">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
