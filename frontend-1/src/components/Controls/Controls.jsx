export function Slider({ label, value, min, max, step = 1, unit = "", onChange, formatValue }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-[11px] uppercase tracking-wider text-slate-400">{label}</label>
        <span className="font-mono-num text-xs font-semibold text-ice-300">
          {formatValue ? formatValue(value) : value}
          {unit}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-ice-600 to-ice-300"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent
            [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ice-100
            [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(95,242,255,0.8)] [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-ice-500"
        />
      </div>
    </div>
  );
}

export function Dropdown({ label, value, options, onChange }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-panel-2/80 px-3 py-2 text-sm text-ice-100
          outline-none ring-ice-400/40 focus:ring-2 [background-color:#101a2a]"
      >
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-[#101a2a]">
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SegmentedControl({ label, value, options, onChange }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-slate-400">{label}</label>
      <div className="flex rounded-lg border border-white/10 bg-white/[0.02] p-1">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition-colors ${
              value === opt ? "bg-ice-500/20 text-ice-200 ring-1 ring-ice-400/40" : "text-slate-400 hover:text-ice-200"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Button({ children, onClick, variant = "primary", className = "", disabled = false, icon: Icon }) {
  const variants = {
    primary:
      "bg-gradient-to-r from-ice-600 to-ice-400 text-[#03121c] hover:brightness-110 shadow-[0_0_24px_-6px_rgba(95,242,255,0.55)]",
    danger: "bg-red/15 text-red ring-1 ring-red/50 hover:bg-red/25",
    ghost: "bg-white/5 text-ice-200 ring-1 ring-white/10 hover:bg-white/10",
    success: "bg-green/15 text-green ring-1 ring-green/50 hover:bg-green/25",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

export function ToggleChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
        active
          ? "border-ice-400/60 bg-ice-500/15 text-ice-200"
          : "border-white/10 bg-white/[0.02] text-slate-500 hover:text-slate-300"
      }`}
    >
      {label}
    </button>
  );
}
