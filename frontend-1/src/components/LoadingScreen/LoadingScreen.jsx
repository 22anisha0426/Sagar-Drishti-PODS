import { motion } from "framer-motion";

export default function LoadingScreen({ label = "Loading operational data" }) {
  return (
    <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-4">
      <div className="relative h-16 w-16">
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-ice-400/20 border-t-ice-300"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
        />
        <motion.div
          className="absolute inset-3 rounded-full border-2 border-ice-400/10 border-b-cyan-glow"
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }}
        />
      </div>
      <p className="font-mono-num text-[11px] uppercase tracking-[0.3em] text-ice-300/80">{label}</p>
    </div>
  );
}
