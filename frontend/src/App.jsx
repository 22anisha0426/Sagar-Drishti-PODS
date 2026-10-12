import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar/Navbar";
import SeaIceForecast from "./pages/SeaIceForecast/SeaIceForecast";
import IcebergTrajectory from "./pages/IcebergTrajectory/IcebergTrajectory";
import NavigationSimulation from "./pages/NavigationSimulation/NavigationSimulation";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/sea-ice" replace />} />
            <Route path="/sea-ice" element={<SeaIceForecast />} />
            <Route path="/iceberg-trajectory" element={<IcebergTrajectory />} />
            <Route path="/navigation-simulation" element={<NavigationSimulation />} />
            <Route path="*" element={<Navigate to="/sea-ice" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
