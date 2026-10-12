import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Play, RotateCcw, MapPin, Flag } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import MapFrame from "../../components/Map/MapFrame";
import { Panel, StatRow, MetricCard } from "../../components/Cards/Panel";
import { Slider, Dropdown, Button } from "../../components/Controls/Controls";
import StatusIndicator from "../../components/StatusIndicator/StatusIndicator";
import LoadingScreen from "../../components/LoadingScreen/LoadingScreen";
import { vesselClasses, START_POINT, DESTINATION_POINT } from "../../data/routeData";
import { runRouteSimulation } from "../../services/api";

const RISK_COLOR = { LOW: "#33e3a3", MODERATE: "#f5a623", HIGH: "#ff4d4f" };

export default function NavigationSimulation() {
  const [scenario, setScenario] = useState({
    vesselClass: "Polar Class 3",
    iceConcentration: 0.6,
    windSpeed: 20,
    waveHeight: 2.5,
    icebergDensity: 0.4,
    riskTolerance: 0.5,
  });
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [hoveredRouteId, setHoveredRouteId] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [halted, setHalted] = useState(false);
  const [hasSimulated, setHasSimulated] = useState(false);

  const runSimulation = async () => {
    setSimulating(true);
    setHalted(false);
    const result = await runRouteSimulation(scenario);
    setRoutes(result);
    setSelectedRouteId(result[0]?.route_id ?? null);
    setSimulating(false);
    setHasSimulated(true);
  };

  const recalculate = async () => {
    setSimulating(true);
    const result = await runRouteSimulation({
      ...scenario,
      iceConcentration: Math.min(1, scenario.iceConcentration + 0.15),
    });
    setRoutes(result);
    setSelectedRouteId(result[0]?.route_id ?? null);
    setHalted(false);
    setSimulating(false);
  };

  const selectedRoute = routes.find((r) => r.route_id === selectedRouteId);
  const activeId = hoveredRouteId || selectedRouteId;

  const riskData = selectedRoute
    ? [
        { name: "Sea Ice", value: Math.round(selectedRoute.risk_factors.seaIce * 100) },
        { name: "Iceberg", value: Math.round(selectedRoute.risk_factors.iceberg * 100) },
        { name: "Waves", value: Math.round(selectedRoute.risk_factors.waves * 100) },
        { name: "Wind", value: Math.round(selectedRoute.risk_factors.wind * 100) },
      ]
    : [];

  return (
    <div className="mx-auto grid max-w-[1700px] grid-cols-1 gap-4 p-4 md:grid-cols-[260px_1fr_300px] md:p-6">
      {/* Scenario Control Panel */}
      <div className="flex flex-col gap-4 md:order-1">
        <Panel title="Scenario Control">
          <Dropdown
            label="Vessel Class"
            value={scenario.vesselClass}
            options={vesselClasses}
            onChange={(v) => setScenario((s) => ({ ...s, vesselClass: v }))}
          />
          <Slider
            label="Ice Concentration"
            value={scenario.iceConcentration}
            min={0}
            max={1}
            step={0.01}
            formatValue={(v) => Math.round(v * 100)}
            unit="%"
            onChange={(v) => setScenario((s) => ({ ...s, iceConcentration: v }))}
          />
          <Slider
            label="Wind Speed"
            value={scenario.windSpeed}
            min={0}
            max={60}
            unit="kn"
            onChange={(v) => setScenario((s) => ({ ...s, windSpeed: v }))}
          />
          <Slider
            label="Wave Height"
            value={scenario.waveHeight}
            min={0}
            max={8}
            step={0.1}
            formatValue={(v) => v.toFixed(1)}
            unit="m"
            onChange={(v) => setScenario((s) => ({ ...s, waveHeight: v }))}
          />
          <Slider
            label="Iceberg Density"
            value={scenario.icebergDensity}
            min={0}
            max={1}
            step={0.01}
            formatValue={(v) => Math.round(v * 100)}
            unit="%"
            onChange={(v) => setScenario((s) => ({ ...s, icebergDensity: v }))}
          />
          <Slider
            label="Risk Tolerance"
            value={scenario.riskTolerance}
            min={0}
            max={1}
            step={0.01}
            formatValue={(v) => Math.round(v * 100)}
            unit="%"
            onChange={(v) => setScenario((s) => ({ ...s, riskTolerance: v }))}
          />

          <div className="mt-2 flex flex-col gap-2">
            <Button icon={Play} onClick={runSimulation} disabled={simulating}>
              {simulating ? "Simulating..." : "Start Simulation"}
            </Button>
            <Button
              icon={AlertTriangle}
              variant="danger"
              onClick={() => setHalted(true)}
              disabled={!hasSimulated || halted}
            >
              Emergency Halt
            </Button>
          </div>
        </Panel>
      </div>

      {/* Route Map */}
      <div className="flex flex-col gap-4 md:order-2">
        <div className="relative h-[52vh] min-h-[380px]">
          {!hasSimulated && !simulating ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl glass-panel text-center">
              <MapPin className="text-ice-400/60" size={22} />
              <p className="text-xs text-slate-400">Configure the scenario and start simulation to generate candidate routes</p>
            </div>
          ) : simulating ? (
            <div className="flex h-full items-center justify-center rounded-xl glass-panel">
              <LoadingScreen label="Computing candidate routes" />
            </div>
          ) : (
            <MapFrame title="All Feasible Routes">
              <circle cx={START_POINT.x} cy={START_POINT.y} r="1.6" fill="#33e3a3" stroke="#eafcff" strokeWidth="0.2" />
              <text x={START_POINT.x} y={START_POINT.y + 4} fontSize="2.4" textAnchor="middle" fill="#33e3a3" className="font-mono-num">
                START
              </text>

              {routes.map((r) => {
                const isActive = r.route_id === activeId;
                const dim = activeId && !isActive;
                return (
                  <g
                    key={r.route_id}
                    onMouseEnter={() => setHoveredRouteId(r.route_id)}
                    onMouseLeave={() => setHoveredRouteId(null)}
                    onClick={() => setSelectedRouteId(r.route_id)}
                    style={{ cursor: "pointer" }}
                    opacity={dim ? 0.28 : 1}
                  >
                    <path
                      d={toSmoothPath(r.waypoints)}
                      fill="none"
                      stroke={isActive ? "#5ff2ff" : RISK_COLOR[r.risk]}
                      strokeWidth={isActive ? 0.9 : 0.45}
                    />
                    {r.waypoints.slice(1, -1).map((wp, i) => (
                      <circle key={i} cx={wp.x} cy={wp.y} r={isActive ? 0.7 : 0.4} fill={isActive ? "#eafcff" : "#7fe3fb"} />
                    ))}
                    <text
                      x={r.waypoints[2].x}
                      y={r.waypoints[2].y - 1.6}
                      fontSize="2.2"
                      textAnchor="middle"
                      fill={isActive ? "#eafcff" : "#94a3b8"}
                      className="font-mono-num"
                    >
                      {r.label}
                    </text>
                  </g>
                );
              })}

              <circle cx={DESTINATION_POINT.x} cy={DESTINATION_POINT.y} r="1.6" fill="#5ff2ff" stroke="#eafcff" strokeWidth="0.2" />
              <text x={DESTINATION_POINT.x} y={DESTINATION_POINT.y - 3} fontSize="2.4" textAnchor="middle" fill="#5ff2ff" className="font-mono-num">
                DESTINATION
              </text>
            </MapFrame>
          )}

          <AnimatePresence>
            {halted && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/75 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  className="w-[90%] max-w-sm rounded-xl border border-red/40 bg-[#160a0b]/90 p-5 text-center shadow-[0_0_60px_-10px_rgba(255,77,79,0.5)]"
                >
                  <AlertTriangle className="mx-auto mb-3 text-red" size={28} />
                  <h3 className="mb-1 text-sm font-bold uppercase tracking-widest text-red">Emergency Navigation Halt</h3>
                  <p className="mb-3 text-xs text-slate-300">Navigation simulation suspended.<br />Unexpected environmental event detected.</p>
                  <div className="mb-4 flex items-center justify-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">Current Route</span>
                    <StatusIndicator status="CRITICAL" size="sm" pulse />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setHalted(false)}>
                      Resume
                    </Button>
                    <Button variant="danger" icon={RotateCcw} onClick={recalculate}>
                      Recalculate Route
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Panel title={`Candidate Routes ${routes.length ? `· ${routes.length} Feasible` : ""}`}>
          {routes.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">No simulation run yet.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {routes.map((r) => (
                <button
                  key={r.route_id}
                  onClick={() => setSelectedRouteId(r.route_id)}
                  onMouseEnter={() => setHoveredRouteId(r.route_id)}
                  onMouseLeave={() => setHoveredRouteId(null)}
                  className={`grid grid-cols-4 items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                    r.route_id === selectedRouteId ? "bg-ice-500/15 ring-1 ring-ice-400/50" : "hover:bg-white/5"
                  }`}
                >
                  <span className="font-mono-num text-xs font-semibold text-ice-100">{r.label}</span>
                  <span className="font-mono-num text-xs text-ice-300">{Math.round(r.reliability * 100)}%</span>
                  <span className="font-mono-num text-xs text-slate-300">{r.eta}</span>
                  <StatusIndicator status={r.risk} size="sm" />
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Route Intelligence */}
      <div className="flex flex-col gap-4 md:order-3">
        <AnimatePresence mode="wait">
          {selectedRoute ? (
            <motion.div key={selectedRoute.route_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <Panel title={`${selectedRoute.label} — Selected`}>
                <div className="grid grid-cols-2 gap-2">
                  <MetricCard label="Reliability" value={Math.round(selectedRoute.reliability * 100)} unit="%" valueClass="text-ice-200" />
                  <MetricCard label="ETA" value={selectedRoute.eta} valueClass="text-ice-200" />
                  <MetricCard label="Est. Fuel" value={selectedRoute.fuel} unit="t" valueClass="text-ice-200" />
                  <MetricCard
                    label="Risk"
                    value={selectedRoute.risk}
                    valueClass={selectedRoute.risk === "LOW" ? "text-green" : selectedRoute.risk === "MODERATE" ? "text-amber" : "text-red"}
                  />
                </div>
                <StatRow label="Distance" value={`${selectedRoute.distance.toLocaleString()} km`} />
                <div className="my-3 h-px bg-white/10" />
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-500">Route Description</p>
                <p className="text-xs leading-relaxed text-slate-300">{selectedRoute.description}</p>
              </Panel>
            </motion.div>
          ) : (
            <Panel>
              <p className="py-6 text-center text-xs text-slate-500">Select a route to view intelligence</p>
            </Panel>
          )}
        </AnimatePresence>

        {selectedRoute && (
          <Panel title="Risk Contributors">
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    width={70}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{ background: "#0c1420", border: "1px solid rgba(95,242,255,0.2)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [`${v}%`, "Contribution"]}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                    {riskData.map((entry, i) => (
                      <Cell key={i} fill={["#22b8e6", "#5ff2ff", "#f5a623", "#7fe3fb"][i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        )}

        {selectedRoute && (
          <Panel title="Waypoints">
            <div className="flex flex-col gap-0">
              {["START", "WAYPOINT 01", "WAYPOINT 02", "WAYPOINT 03", "DESTINATION"].map((wp, i, arr) => (
                <div key={wp} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${
                      i === 0 ? "bg-green/20 text-green" : i === arr.length - 1 ? "bg-ice-500/20 text-ice-300" : "bg-white/10 text-slate-300"
                    }`}>
                      {i === 0 ? <Flag size={10} /> : i === arr.length - 1 ? <MapPin size={10} /> : i}
                    </span>
                    {i < arr.length - 1 && <div className="h-5 w-px bg-white/15" />}
                  </div>
                  <span className="pt-0.5 text-[11px] uppercase tracking-wider text-slate-300">{wp}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

function toSmoothPath(points) {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y} `;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    d += `Q ${prev.x} ${prev.y} ${midX} ${midY} `;
  }
  d += `L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  return d;
}
