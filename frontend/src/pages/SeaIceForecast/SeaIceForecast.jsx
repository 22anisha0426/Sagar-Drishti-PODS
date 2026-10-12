import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Clock, TrendingDown, RefreshCcw } from "lucide-react";
import MapFrame from "../../components/Map/MapFrame";
import MapLegend from "../../components/Map/MapLegend";
import { Panel, StatRow, MetricCard } from "../../components/Cards/Panel";
import { ToggleChip } from "../../components/Controls/Controls";
import LoadingScreen from "../../components/LoadingScreen/LoadingScreen";
import { seaIceLegend, sicColor } from "../../data/seaIceData";
import {
  REGION_BOUNDS,
  geoToRegionXY,
  isWithinRegion,
  degLonToUnits,
  degLatToUnits,
  CAPE_TOWN,
  RESEARCH_STATIONS,
  ANTARCTICA_COASTLINE,
  AFRICA_COASTLINE,
  LON_TICKS,
  LAT_TICKS,
} from "../../data/antarcticaRegion";
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

  // Attach uncertainty values to their matching cell (they're parallel arrays
  // keyed by index) before we filter anything down to the display region.
  const allCells = frame?.grid?.cells
    ? frame.grid.cells.map((cell, i) => ({ ...cell, u: frame.uncertainty?.[i] ?? 0 }))
    : [];

  const cellsInRegion = allCells.filter((c) => isWithinRegion(c.latitude, c.longitude));
  // Fall back to the full set if the backend's data happens to fall outside
  // the fixed Cape Town - Prydz Bay frame, so the page never renders empty.
  const visibleCells = cellsInRegion.length ? cellsInRegion : allCells;

  // Size each grid cell from the dataset's actual lat/lon spacing so the
  // navigation grid lines up with real-world resolution rather than an
  // arbitrary row/col stretch across the whole canvas.
  const lons = frame?.grid?.longitudes || [];
  const lats = frame?.grid?.latitudes || [];
  const lonStepDeg = lons.length > 1 ? (lons[lons.length - 1] - lons[0]) / (lons.length - 1) : 1;
  const latStepDeg = lats.length > 1 ? (lats[lats.length - 1] - lats[0]) / (lats.length - 1) : 1;
  const cellWidth = Math.max(0.4, degLonToUnits(lonStepDeg));
  const cellHeight = Math.max(0.4, degLatToUnits(latStepDeg));

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
            <MapFrame title="Cape Town → Prydz Bay · Sea-Ice Grid" showReferenceGrid={false}>
              <AnimatePresence mode="wait">
                <motion.g key={horizon} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                  {/* Naval-chart style tick marks along the frame edges (not full crossing lines) */}
                  {LON_TICKS.map((lon) => {
                    const { x } = geoToRegionXY(REGION_BOUNDS.min_lat, lon);
                    return (
                      <g key={`lon-${lon}`} opacity="0.55">
                        <line x1={x} y1="97" x2={x} y2="100" stroke="#5ff2ff" strokeWidth="0.25" />
                        <text x={x} y="95.5" fontSize="1.7" textAnchor="middle" fill="#7fe3fb" className="font-mono-num">
                          {lon}°E
                        </text>
                      </g>
                    );
                  })}
                  {LAT_TICKS.map((lat) => {
                    const { y } = geoToRegionXY(lat, REGION_BOUNDS.min_lon);
                    return (
                      <g key={`lat-${lat}`} opacity="0.55">
                        <line x1="0" y1={y} x2="3" y2={y} stroke="#5ff2ff" strokeWidth="0.25" />
                        <text x="4.5" y={y + 0.7} fontSize="1.7" textAnchor="start" fill="#7fe3fb" className="font-mono-num">
                          {Math.abs(lat)}°S
                        </text>
                      </g>
                    );
                  })}

                  {/* Ocean-only sea-ice concentration grid, naval-navigation style */}
                  {layers.concentration &&
                    visibleCells.map((cell, i) => {
                      const { x, y } = geoToRegionXY(cell.latitude, cell.longitude);
                      return (
                        <rect
                          key={i}
                          x={x - cellWidth / 2}
                          y={y - cellHeight / 2}
                          width={cellWidth}
                          height={cellHeight}
                          fill={sicColor(cell.sic)}
                          stroke="rgba(95,242,255,0.28)"
                          strokeWidth="0.06"
                          opacity="0.92"
                        />
                      );
                    })}

                  {layers.uncertainty &&
                    visibleCells
                      .filter((cell) => cell.u >= 0.22)
                      .map((cell, i) => {
                        const { x, y } = geoToRegionXY(cell.latitude, cell.longitude);
                        return (
                          <rect
                            key={`u-${i}`}
                            x={x - cellWidth / 2}
                            y={y - cellHeight / 2}
                            width={cellWidth}
                            height={cellHeight}
                            fill="url(#hatch)"
                            opacity={cell.u}
                          />
                        );
                      })}

                  {layers.iceEdge && (
                    <path
                      d={buildIceEdgePath(frame, cellWidth)}
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

                  {/* Landmasses drawn last so the ocean grid never visually spills onto land */}
                  <path d={coastlinePath(AFRICA_COASTLINE, "north")} fill="#141c14" stroke="rgba(95,242,255,0.25)" strokeWidth="0.25" />
                  <path d={coastlinePath(ANTARCTICA_COASTLINE, "south")} fill="#0d1f2b" stroke="rgba(95,242,255,0.35)" strokeWidth="0.25" />

                  {/* Cape Town reference point */}
                  {(() => {
                    const { x, y } = geoToRegionXY(CAPE_TOWN.latitude, CAPE_TOWN.longitude);
                    return (
                      <g>
                        <circle cx={x} cy={y} r="0.8" fill="#7fe3fb" stroke="#eafcff" strokeWidth="0.15" />
                        <text x={x} y={y - 1.6} fontSize="2" textAnchor="middle" fill="#7fe3fb" className="font-mono-num">
                          CAPE TOWN
                        </text>
                      </g>
                    );
                  })()}

                  {/* Bharati & Maitri research stations */}
                  {RESEARCH_STATIONS.map((station) => {
                    const { x, y } = geoToRegionXY(station.latitude, station.longitude);
                    return (
                      <g key={station.id}>
                        <rect
                          x={x - 1}
                          y={y - 1}
                          width="2"
                          height="2"
                          fill="#f5a623"
                          stroke="#eafcff"
                          strokeWidth="0.18"
                          transform={`rotate(45 ${x} ${y})`}
                        />
                        <text x={x} y={y - 2.4} fontSize="2.3" textAnchor="middle" fill="#f5a623" className="font-mono-num">
                          {station.name.toUpperCase()}
                        </text>
                      </g>
                    );
                  })}
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
              <StatRow label="Coverage" value="Cape Town – Prydz Bay corridor" />
              <StatRow label="Data Source" value="FastAPI · Real SIC data" />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// Traces a closed outline around the pack-ice extent (sic >= 0.2), scanning
// outward from the center of each dataset row, then projects that outline
// through the fixed Cape Town - Prydz Bay frame instead of a raw row/col
// stretch, so it stays aligned with the concentration grid above.
function buildIceEdgePath(frame, cellWidth) {
  const { rows, cols, cells } = frame.grid;
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
      rowExtents.push({ row: r, left, right, cells: rowCells });
    }
  }

  if (rowExtents.length === 0) return "";

  const toXY = (rowCells, col, side) => {
    const cell = rowCells.find((x) => x.col === col);
    if (!cell) return null;
    const { x, y } = geoToRegionXY(cell.latitude, cell.longitude);
    return `${x + (side === "right" ? cellWidth / 2 : -cellWidth / 2)} ${y}`;
  };

  const points = [];
  rowExtents.forEach((re) => {
    const p = toXY(re.cells, re.right, "right");
    if (p) points.push(p);
  });
  for (let i = rowExtents.length - 1; i >= 0; i--) {
    const p = toXY(rowExtents[i].cells, rowExtents[i].left, "left");
    if (p) points.push(p);
  }

  if (points.length === 0) return "";
  return "M " + points.join(" L ") + " Z";
}

// Builds a closed land-mass shape from a coastline polyline, filling toward
// the top ("north") or bottom ("south") edge of the 0-100 map frame.
function coastlinePath(points, side) {
  const projected = points.map((p) => geoToRegionXY(p.lat, p.lon));
  let d = `M ${projected[0].x} ${projected[0].y} `;
  projected.slice(1).forEach((p) => { d += `L ${p.x} ${p.y} `; });
  const last = projected[projected.length - 1];
  const first = projected[0];
  const edgeY = side === "south" ? 100 : 0;
  d += `L ${last.x} ${edgeY} L ${first.x} ${edgeY} Z`;
  return d;
}
