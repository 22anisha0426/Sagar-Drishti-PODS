// Mock data contract for sea-ice forecasts.
// Matches the FastAPI contract: { timestamp, forecastHour, grid, confidence, uncertainty }

const HORIZONS = [0, 24, 48, 72, 96, 120];

// Deterministic pseudo-random so the demo looks the same every run.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Generates a lat/lon-ish grid of sea-ice concentration values (0-1) around Antarctica.
function buildGrid(forecastHour) {
  const rand = seeded(forecastHour + 7);
  const rows = 22;
  const cols = 34;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // radial falloff from the pole (center) so the ice pack looks plausible
      const cx = cols / 2;
      const cy = rows * 0.15;
      const dx = (c - cx) / cols;
      const dy = (r - cy) / rows;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const drift = forecastHour / 480; // ice edge retreats slightly over time in this mock
      const base = Math.max(0, 1.05 - dist * 2.1 - drift * 0.6);
      const noise = (rand() - 0.5) * 0.35;
      const sic = Math.min(1, Math.max(0, base + noise));
      cells.push({ row: r, col: c, sic: Number(sic.toFixed(3)) });
    }
  }
  return { rows, cols, cells };
}

export function getForecastFrame(forecastHour) {
  const grid = buildGrid(forecastHour);
  const confidence = Math.max(0.6, 0.94 - forecastHour / 900);
  return {
    timestamp: new Date().toISOString(),
    forecastHour,
    grid,
    confidence: Number(confidence.toFixed(2)),
    uncertainty: grid.cells.map((c) => Number((Math.abs(0.5 - c.sic) * 0.3 + forecastHour / 1200).toFixed(3))),
  };
}

export const forecastHorizons = HORIZONS;

export const forecastFrames = HORIZONS.reduce((acc, h) => {
  acc[h] = getForecastFrame(h);
  return acc;
}, {});

export const seaIceLegend = [
  { label: "Low (0–20%)", range: [0, 0.2], color: "#173a52", desc: "Open-water conditions" },
  { label: "Moderate (20–50%)", range: [0.2, 0.5], color: "#1596c9" },
  { label: "High (50–80%)", range: [0.5, 0.8], color: "#5ff2ff" },
  { label: "Critical (80–100%)", range: [0.8, 1.01], color: "#f5fbff" },
];

export function sicColor(sic) {
  if (sic < 0.2) return "#122b3f";
  if (sic < 0.5) return "#12699b";
  if (sic < 0.8) return "#22b8e6";
  return "#eafcff";
}

export const forecastMeta = {
  iceEdgeMovementKm: -6.4,
  updated: "2026-08-26T08:30:00Z",
  status: "NOMINAL",
};
