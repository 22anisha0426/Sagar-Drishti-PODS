# SAGAR-DRISHTI — Frontend Prototype

AI-Enabled Antarctic Sea-Ice, Iceberg Trajectory & Navigation Decision Support System — SIH 2026.

This is a single React application implementing all three operational pages described in
the frontend documentation, built to run independently of the backend using mock data.

## Stack

- React 19 + Vite
- Tailwind CSS v4 (theme tokens in `src/index.css`)
- React Router v6 for navigation
- Framer Motion for transitions/animation
- Recharts for the risk-contributor chart
- lucide-react for icons

**Map note:** instead of Mapbox GL / deck.gl (which need an API token), the map surfaces
are built as a custom SVG "Antarctic grid" component (`src/components/Map/MapFrame.jsx`)
with pan (drag) and zoom (scroll wheel + buttons) built in. This keeps the whole app running
with zero external API keys. It can be swapped for real Mapbox/deck.gl layers later without
changing any page logic — only `MapFrame` and the coordinate system used by each page's
markers/paths would need updating from the 0-100 mock grid to real lat/lon projections.

## Getting started

```bash
npm install
npm run dev       # start dev server
npm run build     # production build -> dist/
npm run preview   # preview the production build locally
```

## Project structure

```
src/
├── components/
│   ├── Navbar/              shared top navigation
│   ├── Map/                 MapFrame (pan/zoom canvas) + MapLegend
│   ├── Cards/                Panel, StatRow, MetricCard
│   ├── Controls/              Slider, Dropdown, SegmentedControl, Button, ToggleChip
│   ├── StatusIndicator/      color-coded status/risk pill
│   └── LoadingScreen/        shared loading state
├── pages/
│   ├── SeaIceForecast/       Page 1 — Member 1
│   ├── IcebergTrajectory/    Page 2 — Member 2
│   └── NavigationSimulation/ Page 3 — Member 3
├── data/                     mock data + a deterministic route-simulation engine
├── services/api.js           data-access layer (mock now, swap for FastAPI calls later)
├── hooks/, utils/            empty, ready for use
├── App.jsx                   router
└── main.jsx                  entry point
```

## Pages

### 1. Sea-Ice Forecast (`/sea-ice`)
Forecast horizon selector (NOW -> +120H), sea-ice concentration heatmap, animated ice-edge
outline, uncertainty hatch overlay, nav-corridor overlay toggle, and a forecast summary
strip (confidence, ice-edge movement, update time, status).

### 2. Iceberg Trajectory (`/iceberg-trajectory`)
Multiple iceberg markers (IB-019, IB-042, IB-087, IB-103), click-to-select with animated
map centering, solid historical track + dotted animated predicted track, a widening
probability cone, and a per-iceberg info panel with reliability-by-horizon bars.

### 3. Navigation Simulation (`/navigation-simulation`)
Scenario control panel (vessel class, ice concentration, wind, waves, iceberg density,
risk tolerance) feeding a deterministic mock simulation engine (`src/data/routeData.js`)
that generates all feasible candidate routes (not fixed categories), a route map with
hover-preview/click-to-select, a Route Intelligence panel (reliability, ETA, fuel, risk,
distance, description, risk-contributor chart, waypoints), and an Emergency Halt flow with
recalculation.

## Data contracts

Mock data in `src/data/*.js` mirrors the JSON contracts from the documentation
(`sea_ice_forecasts`, `iceberg_tracks`, `route_simulations`). All data access goes through
`src/services/api.js` — when FastAPI is ready, replace the body of each function there with
a `fetch()` call; no page code needs to change.

## Team integration notes

- One repository, one React app — each member's page lives in its own folder under `src/pages`.
- Shared components live in `src/components` — please don't fork Navbar/Map/Controls/Cards
  per-page; extend the shared version and coordinate changes with the team.
- Keep pages decoupled: a page should only depend on shared components + its own page folder,
  not on another page's internals.
