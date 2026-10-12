// Fixed geographic frame for the Sea-Ice Forecast display: the Indian sector
// of the Antarctic Ocean, with the Antarctic continent occupying the lower part
// of the frame and India's Bharati and Maitri research stations on the coast.
//
// Unlike the other pages (which auto-fit the map to whatever data comes
// back), this region is intentionally fixed so the map always shows the
// same corridor regardless of how much of it the backend has data for.

export const REGION_BOUNDS = {
  min_lat: -90,   // South Pole / full Antarctic continent frame
  max_lat: -30,   // northern edge of the Antarctic Ocean view
  min_lon: 5,     // west of Maitri
  max_lon: 82,    // east of Bharati / Prydz Bay
};

// Projects a lat/lon pair into the shared 0-100 map coordinate space used by
// MapFrame, the same convention as services/api.js's geoToMap().
export function geoToRegionXY(lat, lon) {
  const dx = REGION_BOUNDS.max_lon - REGION_BOUNDS.min_lon;
  const dy = REGION_BOUNDS.max_lat - REGION_BOUNDS.min_lat;
  return {
    x: ((Number(lon) - REGION_BOUNDS.min_lon) / dx) * 90 + 5,
    y: 95 - ((Number(lat) - REGION_BOUNDS.min_lat) / dy) * 90,
  };
}

export function isWithinRegion(lat, lon) {
  return (
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lon)) &&
    lat >= REGION_BOUNDS.min_lat &&
    lat <= REGION_BOUNDS.max_lat &&
    lon >= REGION_BOUNDS.min_lon &&
    lon <= REGION_BOUNDS.max_lon
  );
}

// Converts a degree span into the map's 0-100 unit space, for sizing grid
// cells consistently with their real angular resolution.
export function degLonToUnits(deg) {
  return (Math.abs(deg) / (REGION_BOUNDS.max_lon - REGION_BOUNDS.min_lon)) * 90;
}
export function degLatToUnits(deg) {
  return (Math.abs(deg) / (REGION_BOUNDS.max_lat - REGION_BOUNDS.min_lat)) * 90;
}

export const CAPE_TOWN = { name: "Cape Town", latitude: -33.9249, longitude: 18.4241 };

// India's two permanent Antarctic research stations.
export const RESEARCH_STATIONS = [
  { id: "bharati", name: "Bharati", latitude: -69.4081, longitude: 76.1897 },
  { id: "maitri", name: "Maitri", latitude: -70.766, longitude: 11.7333 },
];

// Simplified East Antarctic coastline (west -> east) through the Prydz Bay
// indentation. Illustrative, not survey-accurate.
export const ANTARCTICA_COASTLINE = [
  { lat: -68.0, lon: 5 },
  { lat: -68.4, lon: 14 },
  { lat: -69.0, lon: 24 },
  { lat: -69.3, lon: 34 },
  { lat: -69.0, lon: 44 },
  { lat: -68.4, lon: 54 },
  { lat: -68.0, lon: 62 },
  { lat: -69.2, lon: 68 }, // Prydz Bay opening
  { lat: -70.9, lon: 73 }, // deepest point of the bay, near Larsemann Hills
  { lat: -70.2, lon: 78 },
  { lat: -68.6, lon: 82 },
];

// Simplified southern African coastline (west -> east) through Cape Town.
export const AFRICA_COASTLINE = [
  { lat: -29.0, lon: 5 },
  { lat: -30.5, lon: 10 },
  { lat: -32.0, lon: 14 },
  { lat: -33.6, lon: 17 },
  { lat: -34.3, lon: 18.42 }, // Cape Town
  { lat: -33.9, lon: 21 },
  { lat: -33.0, lon: 26 },
  { lat: -31.5, lon: 32 },
  { lat: -29.5, lon: 40 },
  { lat: -27.0, lon: 50 },
  { lat: -24.0, lon: 60 },
  { lat: -22.0, lon: 70 },
  { lat: -21.0, lon: 82 },
];

// Reference tick marks for the chart-style edges (naval nav grid), not full
// crossing lines.
export const LON_TICKS = [10, 20, 30, 40, 50, 60, 70, 80];
export const LAT_TICKS = [-35, -40, -45, -50, -55, -60, -65, -70];
