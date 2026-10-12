import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Clock, TrendingDown, RefreshCcw } from "lucide-react";
import MapFrame from "../../components/Map/MapFrame";
import MapLegend from "../../components/Map/MapLegend";
import { Panel, StatRow, MetricCard } from "../../components/Cards/Panel";
import { ToggleChip } from "../../components/Controls/Controls";
import LoadingScreen from "../../components/LoadingScreen/LoadingScreen";
import { seaIceLegend, sicColor } from "../../data/seaIceData";
import { fetchSeaIceForecast } from "../../services/api";

const forecastHorizons = [0, 24, 48];
const HORIZON_LABELS = { 0: "NOW", 24: "+24H", 48: "+48H" };

export default function SeaIceForecast() {
  const [horizon, setHorizon] = useState(0);
  const [frame, setFrame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [layers, setLayers] = useState({
    concentration: true,
    uncertainty: false,
    iceEdge: true,
    corridor: false,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoading(true);
    fetchSeaIceForecast(horizon).then((data) => { if (!cancelled) setFrame(data); }).catch((e) => { if (!cancelled) setFrame({ error: e.message }); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => (cancelled = true);
  }, [horizon]);

  const toggleLayer = (key) => setLayers((l) => ({ ...l, [key]: !l[key] }));

  const cellSizeX = frame?.grid?.cols ? 100 / frame.grid.cols : 0;
  const cellSizeY = frame?.grid?.rows ? 100 / frame.grid.rows : 0;

  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 p-4 md:grid-cols-[240px_1fr] md:p-6">
      {/* Forecast timeline + legend column */}
      <div className="flex flex-col gap-4 md:order-1">
        <Panel title="Forecast Horizon">
          <div className="flex flex-col gap-1.5">
            {forecastHorizons.map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider transition-all ${
                  horizon === h
                    ? "bg-ice-500/15 text-ice-200 ring-1 ring-ice-400/50 text-glow"
                    : "text-slate-400 hover:bg-white/5"
                }`}
              >
                <span>{HORIZON_LABELS[h]}</span>
                {horizon === h && <span className="h-1.5 w-1.5 rounded-full bg-ice-300 dot-pulse" />}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Legend">
          <div className="space-y-2">
            {seaIceLegend.map((item) => (
              <div key={item.label} className="flex items-center gap-2.5">
                <span className="h-3 w-3 rounded-sm ring-1 ring-white/10" style={{ backgroundColor: item.color }} />
                <span className="text-[11px] text-slate-300">{item.label}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Display Layers">
          <div className="flex flex-wrap gap-2">
            <ToggleChip label="Concentration" active={layers.concentration} onClick={() => toggleLayer("concentration")} />
            <ToggleChip label="Uncertainty" active={layers.uncertainty} onClick={() => toggleLayer("uncertainty")} />
            <ToggleChip label="Ice Edge" active={layers.iceEdge} onClick={() => toggleLayer("iceEdge")} />
            <ToggleChip label="Nav Corridor" active={layers.corridor} onClick={() => toggleLayer("corridor")} />
          </div>
        </Panel>
      </div>

      {/* Main map + info column */}
      <div className="flex flex-col gap-4 md:order-2">
        <div className="relative h-[58vh] min-h-[420px]">
          {loading || !frame || frame.error ? (
            <div className="flex h-full items-center justify-center rounded-xl glass-panel">
              <LoadingScreen label={frame?.error || "Retrieving forecast grid"} />
            </div>
          ) : (
            <MapFrame title="Antarctic Sea-Ice · Heatmap">
              <AnimatePresence mode="wait">
                <motion.g key={horizon} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                  {layers.concentration &&
                    frame.grid.cells.map((cell, i) => (
                      <rect
                        key={i}
                        x={cell.col * cellSizeX}
                        y={cell.row * cellSizeY}
                        width={cellSizeX * 1.02}
                        height={cellSizeY * 1.02}
                        fill={sicColor(cell.sic)}
                        opacity={0.15 + cell.sic * 0.75}
                      />
                    ))}

                  {layers.uncertainty &&
                    frame.uncertainty.map((u, i) => {
                      const cell = frame.grid.cells[i];
                      if (u < 0.22) return null;
                      return (
                        <rect
                          key={`u-${i}`}
                          x={cell.col * cellSizeX}
                          y={cell.row * cellSizeY}
                          width={cellSizeX * 1.02}
                          height={cellSizeY * 1.02}
                          fill="url(#hatch)"
                          opacity={u}
                        />
                      );
                    })}

                  {layers.iceEdge && (
                    <path
                      d={buildIceEdgePath(frame)}
                      fill="none"
                      stroke="#5ff2ff"
                      strokeWidth="0.4"
                      opacity="0.8"
                    />
                  )}

                  {layers.corridor && (
                    <path
                      d="M 18 55 Q 40 30 65 20"
                      fill="none"
                      stroke="#33e3a3"
                      strokeWidth="0.8"
                      strokeDasharray="2 1.5"
                      opacity="0.85"
                    />
                  )}

                  <defs>
                    <pattern id="hatch" width="2" height="2" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="0" x2="0" y2="2" stroke="#f5a623" strokeWidth="0.6" />
                    </pattern>
                  </defs>
                </motion.g>
              </AnimatePresence>
            </MapFrame>
          )}

          <div className="pointer-events-none absolute bottom-3 left-3">
            <MapLegend
              title="Concentration"
              items={seaIceLegend.map((l) => ({ label: l.label.split(" ")[0], color: l.color }))}
            />
          </div>
        </div>

        {/* Bottom info strip */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="Confidence" value="--" unit="%" />
          <MetricCard
            label="Ice Edge Movement"
            value="--"
            unit="km/24h"
            valueClass="text-slate-300"
          />
          <MetricCard label="Updated" value={frame?.timestamp ? new Date(frame.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"} />
          <MetricCard label="Forecast Status" value={frame?.meta?.source ? "LIVE" : "--"} valueClass="text-green" />
        </div>

        <Panel title="Forecast Summary">
          <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
            <div>
              <StatRow label="Forecast Horizon" value={HORIZON_LABELS[horizon]} />
              <StatRow label="Model" value={frame?.meta?.model?.name || (horizon === 0 ? "Observed SIC" : "RandomForest SIC baseline")} />
              <StatRow label="Grid Resolution" value={`${frame?.grid.rows ?? "--"} × ${frame?.grid.cols ?? "--"}`} />
            </div>
            <div>
              <StatRow label="P10 / P50 / P90" value={horizon === 0 ? "Observed concentration" : "Available per cell"} />
              <StatRow label="Coverage" value="Dataset-defined region" />
              <StatRow label="Data Source" value="FastAPI · Real SIC data" />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function buildIceEdgePath(frame) {
  // Trace the outer boundary of the ice pack (sic >= 0.2) as a closed blob
  // outline: right-hand extent going down, then left-hand extent going back up.
  const { rows, cols, cells } = frame.grid;
  const cellSizeX = 100 / cols;
  const cellSizeY = 100 / rows;
  const centerCol = cols / 2;

  const rowExtents = [];
  for (let r = 0; r < rows; r++) {
    const rowCells = cells.filter((c) => c.row === r);
    let left = null;
    let right = null;
    for (let c = Math.floor(centerCol); c < cols; c++) {
      const cell = rowCells.find((x) => x.col === c);
      if (!cell || cell.sic < 0.2) break;
      right = c;
    }
    for (let c = Math.floor(centerCol); c >= 0; c--) {
      const cell = rowCells.find((x) => x.col === c);
      if (!cell || cell.sic < 0.2) break;
      left = c;
    }
    if (left !== null && right !== null) {
      rowExtents.push({ row: r, left, right });
    }
  }

  if (rowExtents.length === 0) return "";

  const toXY = (row, col, side) => {
    const x = (col + (side === "right" ? 1 : 0)) * cellSizeX;
    const y = (row + 0.5) * cellSizeY;
    return `${x} ${y}`;
  };

  let path = "M " + toXY(rowExtents[0].row, rowExtents[0].right, "right") + " ";
  rowExtents.forEach((re) => {
    path += "L " + toXY(re.row, re.right, "right") + " ";
  });
  for (let i = rowExtents.length - 1; i >= 0; i--) {
    path += "L " + toXY(rowExtents[i].row, rowExtents[i].left, "left") + " ";
  }
  path += "Z";
  return path;
}
