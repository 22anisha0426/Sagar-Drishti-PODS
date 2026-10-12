import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchSystemStatus } from "../../services/api";
import { Snowflake, Waves, Navigation2, Radio } from "lucide-react";

const links = [
  { to: "/sea-ice", label: "Sea-Ice Forecast", icon: Snowflake },
  { to: "/iceberg-trajectory", label: "Iceberg Trajectory", icon: Waves },
  { to: "/navigation-simulation", label: "Navigation Simulation", icon: Navigation2 },
];

export default function Navbar() {
  const [backendReady, setBackendReady] = useState(false);
  useEffect(() => { let active = true; fetchSystemStatus().then(() => active && setBackendReady(true)).catch(() => active && setBackendReady(false)); return () => { active = false; }; }, []);
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 glass-panel-solid">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-md bg-ice-500/10 ring-1 ring-ice-400/40">
            <Radio size={16} className="text-ice-300" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-green dot-pulse" />
          </div>
          <div className="leading-tight">
            <p className="font-mono-num text-[10px] uppercase tracking-[0.28em] text-ice-400/80">SIH 2026 · Prototype</p>
            <p className="text-sm font-semibold tracking-wide text-glow">SOUTHERN-VISION</p>
          </div>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
                  isActive
                    ? "bg-ice-500/15 text-ice-200 ring-1 ring-ice-400/40 text-glow"
                    : "text-slate-400 hover:bg-white/5 hover:text-ice-200"
                }`
              }
            >
              <Icon size={14} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 text-[10px] font-mono-num uppercase tracking-widest text-slate-400 md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-green" />
          Link Nominal
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex items-center justify-around border-t border-white/10 py-1.5 md:hidden">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-md px-2 py-1 text-[9px] uppercase tracking-wide ${
                isActive ? "text-ice-300" : "text-slate-500"
              }`
            }
          >
            <Icon size={16} />
            {label.split(" ")[0]}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
