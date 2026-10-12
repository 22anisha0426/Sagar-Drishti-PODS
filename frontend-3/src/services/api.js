export const API_BASE = (import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api").replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : `API request failed (${response.status})`);
  return body;
}

function boundsFromPoints(points = []) {
  if (!points.length) return null;
  const lats = points.map((p) => Number(p.latitude));
  const lons = points.map((p) => Number(p.longitude));
  return { min_lat: Math.min(...lats), max_lat: Math.max(...lats), min_lon: Math.min(...lons), max_lon: Math.max(...lons) };
}

function geoToMap(lat, lon, bounds) {
  if (!bounds) return { x: 50, y: 50 };
  const dx = Math.max(1e-9, bounds.max_lon - bounds.min_lon);
  const dy = Math.max(1e-9, bounds.max_lat - bounds.min_lat);
  return { x: ((Number(lon) - bounds.min_lon) / dx) * 90 + 5, y: 95 - ((Number(lat) - bounds.min_lat) / dy) * 90 };
}

function gridFromPoints(points = [], valueKey = "p50") {
  if (!points.length) return { rows: 0, cols: 0, cells: [], uncertainty: [] };
  const lats = [...new Set(points.map((p) => Number(p.latitude)))].sort((a, b) => a - b);
  const lons = [...new Set(points.map((p) => Number(p.longitude)))].sort((a, b) => a - b);
  const latIndex = new Map(lats.map((v, i) => [v, i]));
  const lonIndex = new Map(lons.map((v, i) => [v, i]));
  return {
    rows: lats.length, cols: lons.length, latitudes: lats, longitudes: lons,
    bounds: boundsFromPoints(points),
    cells: points.map((p) => ({ row: latIndex.get(Number(p.latitude)), col: lonIndex.get(Number(p.longitude)), sic: Number(p[valueKey] ?? p.concentration ?? 0), latitude: Number(p.latitude), longitude: Number(p.longitude) })),
  };
}

function environmentFrame(data) {
  const points = (data?.sea_ice || []).filter((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)));
  const grid = gridFromPoints(points, "concentration");
  return { timestamp: data?.timestamp || new Date().toISOString(), forecastHour: 0, grid, confidence: null, uncertainty: grid.cells.map(() => 0), meta: { source: "FastAPI · Real SIC data", ...(data?.meta || {}) } };
}

export async function fetchSeaIceForecast(forecastHour) {
  if (forecastHour === 0) return environmentFrame(await request("/environment?max_points=5000"));
  const result = await request(`/forecast/grid?hours=${forecastHour}&max_points=5000`);
  const points = result?.points || [];
  return { timestamp: result?.latest_observation || new Date().toISOString(), forecastHour, grid: gridFromPoints(points, "p50"), confidence: null, uncertainty: points.map((p) => Math.max(0, Number(p.p90 ?? 0) - Number(p.p10 ?? 0))), meta: { source: "FastAPI · RandomForest SIC baseline", model: result?.model, latestObservation: result?.latest_observation, count: result?.count } };
}

export const fetchForecastSummary = () => request("/forecast");

function bearingFromVelocity(dLat = 0, dLon = 0) {
  return ((Math.atan2(Number(dLon), Number(dLat)) * 180) / Math.PI + 360) % 360;
}

function normalizeIceberg(b, all) {
  const points = all.flatMap((x) => [{ latitude: x.latitude, longitude: x.longitude }, ...(x.track || []), ...(x.predicted_positions || [])]);
  const bounds = boundsFromPoints(points);
  const project = (lat, lon) => geoToMap(lat, lon, bounds);
  const speedKmh = Number(b.velocity?.speed_kmh || 0);
  return {
    ...b,
    status: speedKmh > 0.05 ? "DRIFTING" : "TRACKED",
    speed: speedKmh / 1.852,
    direction: bearingFromVelocity(b.velocity?.latitude_deg_per_hour, b.velocity?.longitude_deg_per_hour),
    model: "Physics drift prototype",
    position: project(b.latitude, b.longitude),
    historical: (b.track || []).map((p) => ({ ...project(p.latitude, p.longitude), latitude: p.latitude, longitude: p.longitude, timestamp: p.timestamp })),
    trajectory: (b.predicted_positions || []).map((p) => ({ ...project(p.latitude, p.longitude), latitude: p.latitude, longitude: p.longitude, time: p.hours, reliability: Math.max(0.35, 1 - p.hours / 180), risk_radius_km: p.risk_radius_km })),
  };
}

export async function fetchIcebergs() {
  const result = await request("/icebergs?limit=100");
  const raw = result?.icebergs || [];
  return raw.map((b) => normalizeIceberg(b, raw));
}

export async function fetchIcebergById(id) { const b = await request(`/icebergs/${encodeURIComponent(id)}`); return normalizeIceberg(b, [b]); }

function routeBounds(result) {
  if (result?.grid?.bounds) return result.grid.bounds;
  const points = [...(result?.fastest_route?.coordinates || []), ...(result?.safest_route?.coordinates || [])];
  return boundsFromPoints(points.map((p) => ({ latitude: p.lat, longitude: p.lon })));
}

function normalizeRoute(route, id, label, bounds, explanation) {
  if (!route) return null;
  const coordinates = route.coordinates || [];
  const metrics = route.metrics || {};
  const avg = Number(metrics.average_risk ?? 0), max = Number(metrics.max_risk ?? avg);
  const risk = max < 0.33 ? "LOW" : max < 0.66 ? "MODERATE" : "HIGH";
  const etaHours = Number(metrics.eta_hours ?? 0), h = Math.floor(etaHours), m = Math.round((etaHours - h) * 60);
  return {
    route_id: id, label, coordinates,
    waypoints: coordinates.map((p) => geoToMap(p.lat, p.lon, bounds)),
    eta: `${h}h ${m}m`, etaHours, distance: Number(metrics.distance_km ?? 0),
    reliability: Math.max(0.05, 1 - avg), risk, riskScore: max, fuel: null,
    description: `${label} generated by the live A* risk-grid service. ${explanation || ""}`.trim(),
    risk_factors: { seaIce: 0, iceberg: 0, waves: 0, wind: 0 }, raw: route,
  };
}

export async function runRouteCalculation({ start, destination, vessel }) {
  const result = await request("/routes?rows=40&cols=40&max_points=5000", { method: "POST", body: JSON.stringify({ start, destination, vessel }) });
  const bounds = routeBounds(result), explanation = result?.explanation?.join(" ") || "";
  return { ...result, routes: [normalizeRoute(result.fastest_route, "fastest", "Fastest Route", bounds, explanation), normalizeRoute(result.safest_route, "safest", "Safest Route", bounds, explanation)].filter(Boolean) };
}

export async function runRouteSimulation({ scenario = "A", start, destination, vessel, iceMultiplier = 1, icebergMultiplier = 1 }) {
  const result = await request("/simulation?rows=40&cols=40&max_points=5000", { method: "POST", body: JSON.stringify({ scenario, start, destination, vessel, ice_multiplier: iceMultiplier, iceberg_multiplier: icebergMultiplier }) });
  const rr = result?.routes || {}, bounds = routeBounds(rr), explanation = rr?.explanation?.join(" ") || result?.expected_behavior || "";
  return { ...result, routes: [normalizeRoute(rr.fastest_route, "fastest", "Fastest Route", bounds, explanation), normalizeRoute(rr.safest_route, "safest", "Safest Route", bounds, explanation)].filter(Boolean), rl_replanning: result?.rl_replanning || null };
}

export async function replanRoute({ vesselPosition, destination }) {
  return request("/replan?rows=40&cols=40&max_points=5000", { method: "POST", body: JSON.stringify({ vessel_position: vesselPosition, destination, environment: {}, mode: "RL" }) });
}

export const fetchRiskGrid = ({ rows = 40, cols = 40 } = {}) => request(`/risk/grid?rows=${rows}&cols=${cols}&max_points=5000`);
export const fetchSystemStatus = () => request("/system/status");
export const fetchAlerts = async () => [];
