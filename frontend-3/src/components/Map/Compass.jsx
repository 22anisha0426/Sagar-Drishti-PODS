import { useEffect, useState } from "react";
import { Compass as CompassIcon, Smartphone } from "lucide-react";

function normalizeHeading(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return ((n % 360) + 360) % 360;
}

function getDeviceHeading(event) {
  // iOS Safari exposes the true compass heading directly.
  if (Number.isFinite(Number(event.webkitCompassHeading))) {
    return normalizeHeading(event.webkitCompassHeading);
  }

  // Standard DeviceOrientation alpha is measured clockwise from the
  // device's initial north reference. Invert it to obtain a compass heading.
  if (Number.isFinite(Number(event.alpha))) {
    return normalizeHeading(360 - Number(event.alpha));
  }

  return null;
}

export default function Compass() {
  const [heading, setHeading] = useState(0);
  const [supported, setSupported] = useState(false);
  const [permissionNeeded, setPermissionNeeded] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const hasOrientation = typeof window !== "undefined" && "DeviceOrientationEvent" in window;
    setSupported(hasOrientation);
    if (!hasOrientation) return undefined;

    const needsPermission =
      typeof window.DeviceOrientationEvent?.requestPermission === "function";
    setPermissionNeeded(needsPermission);

    // Desktop browsers and Android normally do not require a permission
    // prompt; start listening immediately where allowed.
    if (!needsPermission) {
      window.addEventListener("deviceorientationabsolute", handleOrientation, true);
      window.addEventListener("deviceorientation", handleOrientation, true);
      setEnabled(true);
    }

    return () => {
      window.removeEventListener("deviceorientationabsolute", handleOrientation, true);
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, []);

  const handleOrientation = (event) => {
    const next = getDeviceHeading(event);
    if (next !== null) setHeading(next);
  };

  const enableCompass = async () => {
    try {
      if (typeof window.DeviceOrientationEvent?.requestPermission === "function") {
        const result = await window.DeviceOrientationEvent.requestPermission();
        if (result !== "granted") return;
      }
      window.addEventListener("deviceorientationabsolute", handleOrientation, true);
      window.addEventListener("deviceorientation", handleOrientation, true);
      setEnabled(true);
      setPermissionNeeded(false);
    } catch {
      // Permission can be denied/blocked by browser policy; keep the control
      // visible rather than making the rest of the map fail.
    }
  };

  if (!supported) {
    return (
      <div className="pointer-events-none rounded-lg border border-white/10 bg-black/45 px-2.5 py-2 text-center backdrop-blur">
        <CompassIcon size={16} className="mx-auto text-ice-300/80" />
        <p className="mt-1 font-mono-num text-[8px] uppercase tracking-wider text-slate-500">Compass</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border border-white/10 bg-black/45 p-2 backdrop-blur shadow-lg">
      <div className="relative h-12 w-12 overflow-hidden rounded-full border border-ice-300/25 bg-[#07111c]">
        {/* The dial rotates with the device heading, keeping geographic north
            visually meaningful while the map itself remains stable. */}
        <div
          className="absolute inset-0 transition-transform duration-150 ease-out"
          style={{ transform: `rotate(${-heading}deg)` }}
        >
          <span className="absolute left-1/2 top-0.5 -translate-x-1/2 font-mono-num text-[8px] font-bold text-red">N</span>
          <span className="absolute right-1 top-1/2 -translate-y-1/2 font-mono-num text-[7px] text-slate-400">E</span>
          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 font-mono-num text-[7px] text-slate-400">S</span>
          <span className="absolute left-1 top-1/2 -translate-y-1/2 font-mono-num text-[7px] text-slate-400">W</span>
          <span className="absolute left-1/2 top-1/2 h-[1px] w-8 -translate-x-1/2 -translate-y-1/2 border-t border-dashed border-ice-300/30" />
        </div>

        {/* Fixed heading marker / needle */}
        <div className="absolute left-1/2 top-1/2 h-8 w-[1.5px] -translate-x-1/2 -translate-y-1/2 bg-red shadow-[0_0_7px_rgba(255,77,79,0.7)]" />
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ice-100 ring-1 ring-ice-300/70" />
      </div>

      <div className="mt-1 flex items-center justify-center gap-1">
        <span className="font-mono-num text-[8px] tabular-nums text-ice-300">{Math.round(heading)}°</span>
      </div>

      {permissionNeeded && !enabled && (
        <button
          onClick={enableCompass}
          className="absolute -bottom-9 right-0 flex items-center gap-1 rounded-md bg-ice-500/15 px-2 py-1 text-[8px] font-semibold uppercase tracking-wider text-ice-200 ring-1 ring-ice-400/40"
          title="Allow device orientation access"
        >
          <Smartphone size={10} />
          Enable
        </button>
      )}
    </div>
  );
}
