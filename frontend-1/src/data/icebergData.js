// Mock data contract for iceberg tracks.
// { id, position:{lat,lon}, speed, direction, trajectory:[{time,lat,lon,reliability}] }

export const icebergs = [
  {
    id: "IB-019",
    status: "TRACKED",
    speed: 0.31,
    direction: 342.0,
    model: "Physics + ML Residual",
    position: { x: 24, y: 18 },
    historical: [
      { x: 30, y: 10 },
      { x: 27, y: 14 },
      { x: 24, y: 18 },
    ],
    trajectory: [
      { time: 24, x: 21, y: 22, reliability: 0.93 },
      { time: 48, x: 18, y: 27, reliability: 0.86 },
      { time: 72, x: 15.5, y: 32, reliability: 0.75 },
    ],
  },
  {
    id: "IB-042",
    status: "TRACKED",
    speed: 0.42,
    direction: 18.7,
    model: "Physics + ML Residual",
    position: { x: 46, y: 24 },
    historical: [
      { x: 40, y: 30 },
      { x: 43, y: 27 },
      { x: 46, y: 24 },
    ],
    trajectory: [
      { time: 24, x: 49.5, y: 20, reliability: 0.91 },
      { time: 48, x: 53, y: 16.5, reliability: 0.84 },
      { time: 72, x: 56.5, y: 13.5, reliability: 0.72 },
    ],
  },
  {
    id: "IB-087",
    status: "DRIFTING",
    speed: 0.58,
    direction: 205.4,
    model: "Physics + ML Residual",
    position: { x: 60, y: 46 },
    historical: [
      { x: 66, y: 38 },
      { x: 63, y: 42 },
      { x: 60, y: 46 },
    ],
    trajectory: [
      { time: 24, x: 56, y: 51, reliability: 0.89 },
      { time: 48, x: 52, y: 56.5, reliability: 0.79 },
      { time: 72, x: 47.5, y: 61, reliability: 0.64 },
    ],
  },
  {
    id: "IB-103",
    status: "TRACKED",
    speed: 0.24,
    direction: 97.2,
    model: "Physics + ML Residual",
    position: { x: 34, y: 55 },
    historical: [
      { x: 30, y: 58 },
      { x: 32, y: 56.5 },
      { x: 34, y: 55 },
    ],
    trajectory: [
      { time: 24, x: 38.5, y: 54, reliability: 0.94 },
      { time: 48, x: 43, y: 53.2, reliability: 0.88 },
      { time: 72, x: 47.5, y: 52.6, reliability: 0.80 },
    ],
  },
];

export function getIceberg(id) {
  return icebergs.find((b) => b.id === id);
}
