import { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ZoomIn, ZoomOut, Locate } from "lucide-react";

const VIEW_W = 100;
const VIEW_H = 100;

/**
 * Shared Antarctic-grid map canvas.
 * Renders a stylized polar map (no external map provider / API key required)
 * with a 100x100 coordinate space that page-level SVG content is drawn into.
 * Supports wheel-zoom and drag-pan, plus a "reset view" control.
 */
export default function MapFrame({ children, title, className = "", initialZoom = 1, focus = null, focusToken }) {
  const [zoom, setZoom] = useState(initialZoom);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragState = useRef(null);

  const clampZoom = (z) => Math.min(3.2, Math.max(0.7, z));

  const onWheel = useCallback((e) => {
    e.preventDefault();
    setZoom((z) => clampZoom(z - e.deltaY * 0.0015));
  }, []);

  const onPointerDown = (e) => {
    dragState.current = { x: e.clientX, y: e.clientY, pan };
  };
  const onPointerMove = (e) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.x;
    const dy = e.clientY - dragState.current.y;
    setPan({ x: dragState.current.pan.x + dx * 0.15, y: dragState.current.pan.y + dy * 0.15 });
  };
  const onPointerUp = () => (dragState.current = null);

  const targetX = focus ? 50 - focus.x : pan.x;
  const targetY = focus ? 50 - focus.y : pan.y;

  return (
    <div className={`relative h-full w-full overflow-hidden rounded-xl bg-abyss-2 grid-overlay polar-overlay ${className}`}>
      {title && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md bg-black/40 px-2.5 py-1 backdrop-blur">
          <p className="font-mono-num text-[10px] uppercase tracking-[0.25em] text-ice-300/80">{title}</p>
        </div>
      )}

      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
        <button
          onClick={() => setZoom((z) => clampZoom(z + 0.3))}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-black/40 text-ice-300 ring-1 ring-white/10 backdrop-blur hover:bg-black/60"
        >
          <ZoomIn size={13} />
        </button>
        <button
          onClick={() => setZoom((z) => clampZoom(z - 0.3))}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-black/40 text-ice-300 ring-1 ring-white/10 backdrop-blur hover:bg-black/60"
        >
          <ZoomOut size={13} />
        </button>
        <button
          onClick={() => {
            setZoom(initialZoom);
            setPan({ x: 0, y: 0 });
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-black/40 text-ice-300 ring-1 ring-white/10 backdrop-blur hover:bg-black/60"
        >
          <Locate size={13} />
        </button>
      </div>

      <div
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-full w-full select-none">
          <motion.g
            animate={{ x: targetX, y: targetY, scale: zoom }}
            transition={{ type: "spring", stiffness: 90, damping: 18 }}
            style={{ transformOrigin: "50px 50px" }}
          >
            {/* faint radial rings implying the polar projection */}
            <circle cx="50" cy="12" r="20" fill="none" stroke="rgba(95,242,255,0.06)" strokeWidth="0.2" />
            <circle cx="50" cy="12" r="40" fill="none" stroke="rgba(95,242,255,0.05)" strokeWidth="0.2" />
            <circle cx="50" cy="12" r="60" fill="none" stroke="rgba(95,242,255,0.04)" strokeWidth="0.2" />
            {children}
          </motion.g>
        </svg>
      </div>
    </div>
  );
}
