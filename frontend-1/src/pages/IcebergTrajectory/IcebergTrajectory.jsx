import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, Gauge, Radar, Cpu } from "lucide-react";
import MapFrame from "../../components/Map/MapFrame";
import { Panel, StatRow, MetricCard } from "../../components/Cards/Panel";
import StatusIndicator from "../../components/StatusIndicator/StatusIndicator";
import LoadingScreen from "../../components/LoadingScreen/LoadingScreen";
import { fetchIcebergs } from "../../services/api";

export default function IcebergTrajectory() {
  const [icebergs, setIcebergs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchIcebergs().then((data) => setIcebergs(data)).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const selected = icebergs.find((b) => b.id === selectedId);

  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 p-4 md:grid-cols-[1fr_280px] md:p-6">
      <div className="relative h-[70vh] min-h-[480px] md:order-1">
        {loading ? (
          <div className="flex h-full items-center justify-center rounded-xl glass-panel">
            <LoadingScreen label="Acquiring iceberg tracks" />
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center rounded-xl glass-panel p-6 text-center text-xs text-red">{error}</div>
        ) : (
          <MapFrame title="Iceberg Trajectory Intelligence" focus={selected ? selected.position : null}>
            {/* Historical + predicted trajectories for every iceberg, dimmed unless selected */}
            {icebergs.map((b) => {
              const isSelected = b.id === selectedId;
              const dim = selectedId && !isSelected;
              const historyD = toPath([...b.historical, b.position]);
              const predictedD = toPath([b.position, ...b.trajectory]);

              return (
                <g key={b.id} opacity={dim ? 0.25 : 1}>
                  {/* historical: solid line */}
                  <path d={historyD} fill="none" stroke="#7fe3fb" strokeWidth={isSelected ? 0.45 : 0.3} opacity={0.7} />

                  {/* predicted: dotted animated line */}
                  <path
                    d={predictedD}
                    fill="none"
                    stroke="#5ff2ff"
                    strokeWidth={isSelected ? 0.45 : 0.25}
                    className="dash-move"
                    opacity={isSelected ? 0.95 : 0.5}
                  />

                  {/* probability cone, widening with horizon */}
                  {isSelected && (
                    <polygon
                      points={buildCone(b)}
                      fill="url(#coneGradient)"
                      opacity={0.35}
                    />
                  )}

                  {/* iceberg marker */}
                  <g
                    onClick={() => setSelectedId(isSelected ? null : b.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <circle
                      cx={b.position.x}
                      cy={b.position.y}
                      r={isSelected ? 2.2 : 1.4}
                      fill={isSelected ? "#5ff2ff" : "#22b8e6"}
                      stroke="#eafcff"
                      strokeWidth="0.25"
                    />
                    {isSelected && (
                      <circle cx={b.position.x} cy={b.position.y} r="3.2" fill="none" stroke="#5ff2ff" strokeWidth="0.2" opacity="0.6">
                        <animate attributeName="r" values="2.5;4.5;2.5" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <text
                      x={b.position.x}
                      y={b.position.y - 2.6}
                      fontSize="2.6"
                      textAnchor="middle"
                      fill={isSelected ? "#eafcff" : "#7fe3fb"}
                      className="font-mono-num"
                      opacity={dim ? 0.4 : 1}
                    >
                      {b.id}
                    </text>
                  </g>
                </g>
              );
            })}

            <defs>
              <linearGradient id="coneGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#5ff2ff" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#5ff2ff" stopOpacity="0" />
              </linearGradient>
            </defs>
          </MapFrame>
        )}

        {!selected && !loading && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <p className="rounded-full bg-black/50 px-4 py-1.5 text-[11px] uppercase tracking-widest text-slate-300 backdrop-blur">
              Select an iceberg to view its predicted trajectory
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 md:order-2">
        <Panel title="Tracked Icebergs">
          <div className="flex flex-col gap-1.5">
            {icebergs.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedId(b.id === selectedId ? null : b.id)}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-left transition-all ${
                  selectedId === b.id ? "bg-ice-500/15 ring-1 ring-ice-400/50" : "hover:bg-white/5"
                }`}
              >
                <span className="font-mono-num text-xs font-semibold text-ice-100">{b.id}</span>
                <StatusIndicator status={b.status} size="sm" />
              </button>
            ))}
          </div>
        </Panel>

        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <Panel title={`Iceberg ${selected.id}`}>
                <StatRow label="Status" value={<StatusIndicator status={selected.status} size="sm" />} />
                <StatRow label="Current Speed" value={`${selected.speed.toFixed(2)} kn`} />
                <StatRow label="Drift" value={`${selected.direction.toFixed(1)}° ${bearingLabel(selected.direction)}`} />
                <div className="my-3 h-px bg-white/10" />
                <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">Prediction Reliability</p>
                {selected.trajectory.map((t) => (
                  <div key={t.time} className="mb-1.5 flex items-center gap-2">
                    <span className="w-10 font-mono-num text-[11px] text-slate-400">{t.time}h</span>
                    <div className="h-1.5 flex-1 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-ice-600 to-ice-300"
                        style={{ width: `${t.reliability * 100}%` }}
                      />
                    </div>
                    <span className="w-10 text-right font-mono-num text-[11px] text-ice-300">{Math.round(t.reliability * 100)}%</span>
                  </div>
                ))}
                <div className="my-3 h-px bg-white/10" />
                <StatRow label="Model" value="Physics + ML Residual" />
              </Panel>
            </motion.div>
          ) : (
            <Panel>
              <div className="flex flex-col items-center gap-2 py-6 text-center text-slate-500">
                <Radar size={22} />
                <p className="text-xs">No iceberg selected</p>
              </div>
            </Panel>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Active Tracks" value={icebergs.length} valueClass="text-ice-200" />
          <MetricCard label="Model" value="Hybrid" valueClass="text-ice-200" />
        </div>
      </div>
    </div>
  );
}

function toPath(points) {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

function buildCone(b) {
  const last = b.trajectory[b.trajectory.length - 1];
  const perp = { x: -(last.y - b.position.y), y: last.x - b.position.x };
  const len = Math.hypot(perp.x, perp.y) || 1;
  const widen = 4.5;
  const p1 = { x: last.x + (perp.x / len) * widen, y: last.y + (perp.y / len) * widen };
  const p2 = { x: last.x - (perp.x / len) * widen, y: last.y - (perp.y / len) * widen };
  return `${b.position.x},${b.position.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`;
}

function bearingLabel(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}
