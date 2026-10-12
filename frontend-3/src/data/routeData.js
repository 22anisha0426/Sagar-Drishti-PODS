// Mock data contract for route_simulations.
// { route_id, waypoints, eta, fuel, reliability, risk, description, risk_factors }

export const vesselClasses = [
  "Polar Class 1",
  "Polar Class 2",
  "Polar Class 3",
  "Polar Class 4",
  "Polar Class 5",
  "Polar Class 6",
  "Polar Class 7",
  "Non-Ice-Class",
];

// Lower index = stronger ice class. Used to scale risk.
const vesselStrength = (vesselClass) => {
  const idx = vesselClasses.indexOf(vesselClass);
  if (idx === -1 || vesselClass === "Non-Ice-Class") return 0.15;
  return 1 - idx / 8; // PC1 -> ~1.0, PC7 -> ~0.25
};

const START = { x: 12, y: 70 };
const DESTINATION = { x: 88, y: 22 };

// Five base candidate corridors between start and destination, each with a
// distinct bend so they read as visually separate routes on the map.
const BASE_PATHS = [
  { bend: { x: 35, y: 30 }, iceExposure: 0.25, icebergExposure: 0.15, baseDist: 1720 },
  { bend: { x: 45, y: 55 }, iceExposure: 0.4, icebergExposure: 0.2, baseDist: 1842 },
  { bend: { x: 55, y: 75 }, iceExposure: 0.55, icebergExposure: 0.1, baseDist: 1990 },
  { bend: { x: 30, y: 50 }, iceExposure: 0.65, icebergExposure: 0.35, baseDist: 1780 },
  { bend: { x: 65, y: 40 }, iceExposure: 0.15, icebergExposure: 0.45, baseDist: 2050 },
  { bend: { x: 50, y: 20 }, iceExposure: 0.35, icebergExposure: 0.55, baseDist: 1690 },
];

function buildWaypoints(bend) {
  const mid1 = { x: (START.x + bend.x) / 2, y: (START.y + bend.y) / 2 };
  const mid2 = { x: (bend.x + DESTINATION.x) / 2, y: (bend.y + DESTINATION.y) / 2 };
  return [START, mid1, bend, mid2, DESTINATION];
}

function riskLabel(score) {
  if (score < 0.33) return "LOW";
  if (score < 0.66) return "MODERATE";
  return "HIGH";
}

function describeRoute({ iceExposure, icebergExposure, waveHeight, risk }) {
  const parts = [];
  if (iceExposure < 0.3) parts.push("avoids the dense predicted sea-ice region");
  else if (iceExposure < 0.55) parts.push("clips the edge of moderate sea-ice concentration");
  else parts.push("cuts through a higher sea-ice concentration corridor");

  if (icebergExposure < 0.25) parts.push("maintains wide clearance from predicted iceberg trajectories");
  else if (icebergExposure < 0.45) parts.push("keeps moderate clearance from tracked iceberg drift paths");
  else parts.push("passes close to one or more predicted iceberg trajectories");

  if (waveHeight > 3.5) parts.push("and accepts increased wave exposure for a shorter transit");

  const lead = risk === "LOW" ? "This route" : risk === "MODERATE" ? "This alternative route" : "This higher-risk route";
  return `${lead} ${parts.join(", ")}.`;
}

/**
 * Deterministic prototype simulation engine.
 * Given the scenario controls, scores each base corridor and returns the
 * subset that is feasible, sorted by reliability.
 */
export function simulateRoutes(scenario) {
  const {
    vesselClass = "Polar Class 3",
    iceConcentration = 0.5, // 0-1
    windSpeed = 20, // knots
    waveHeight = 2.5, // meters
    icebergDensity = 0.5, // 0-1
    riskTolerance = 0.5, // 0-1 (higher = accepts more risk)
  } = scenario;

  const strength = vesselStrength(vesselClass);

  const routes = BASE_PATHS.map((path, i) => {
    const iceEffect = path.iceExposure * iceConcentration * (1.4 - strength);
    const icebergEffect = path.icebergExposure * icebergDensity * (1.2 - strength * 0.6);
    const weatherEffect = (windSpeed / 60) * 0.3 + (waveHeight / 8) * 0.35;

    const riskScore = Math.min(1, Math.max(0, iceEffect * 0.55 + icebergEffect * 0.3 + weatherEffect * 0.25));
    const reliability = Math.max(0.35, 1 - riskScore * 0.85);

    const weatherDelay = 1 + (windSpeed / 45) * 0.18 + (waveHeight / 6) * 0.22;
    const distance = Math.round(path.baseDist * (1 + path.iceExposure * 0.15));
    const speedKn = 12 * strength + 6; // stronger ships transit faster through ice
    const hours = (distance / 1.852 / Math.max(6, speedKn)) * weatherDelay;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);

    const fuel = Number((distance / 100) * (1.1 + riskScore * 0.4) * (1 + waveHeight / 20)).toFixed(1);
    const risk = riskLabel(riskScore);

    const seaIce = Number((iceEffect * 0.6).toFixed(2));
    const iceberg = Number((icebergEffect * 0.6).toFixed(2));
    const waves = Number(((waveHeight / 8) * 0.35).toFixed(2));
    const wind = Number(((windSpeed / 60) * 0.3).toFixed(2));

    return {
      route_id: `route_0${i + 1}`,
      label: `Route ${String(i + 1).padStart(2, "0")}`,
      waypoints: buildWaypoints(path.bend),
      eta: `${h}h ${m}m`,
      etaHours: Number(hours.toFixed(2)),
      fuel: Number(fuel),
      reliability: Number(reliability.toFixed(2)),
      distance,
      risk,
      riskScore,
      description: describeRoute({ iceExposure: path.iceExposure, icebergExposure: path.icebergExposure, waveHeight, risk }),
      risk_factors: { seaIce, iceberg, waves, wind },
    };
  });

  // Feasibility cutoff driven by risk tolerance: higher tolerance keeps riskier routes.
  const cutoff = 0.35 + riskTolerance * 0.65;
  const feasible = routes
    .filter((r) => r.riskScore <= cutoff)
    .sort((a, b) => b.reliability - a.reliability);

  // Always return at least the best two routes even if the scenario is severe,
  // so the page never shows an empty result set.
  if (feasible.length < 2) {
    return routes.sort((a, b) => b.reliability - a.reliability).slice(0, 2);
  }
  return feasible;
}

export const START_POINT = START;
export const DESTINATION_POINT = DESTINATION;
