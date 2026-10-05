"use client";

import { motion } from "framer-motion";

const nodes = [
  { label: "Manufacturer", icon: "🏭", color: "#0F766E" },
  { label: "Distributor",  icon: "🚚", color: "#0EA5E9" },
  { label: "Wholesaler",   icon: "🏪", color: "#8B5CF6" },
  { label: "Pharmacy",     icon: "💊", color: "#EC4899" },
];

const pulseVariants = {
  initial:  { pathLength: 0, opacity: 0 },
  animate: (i: number) => ({
    pathLength: [0, 1, 1],
    opacity:    [0, 1, 0],
    transition: {
      duration: 2,
      delay: i * 0.7,
      repeat: Infinity,
      ease: "easeInOut",
    },
  }),
};

export function SupplyChainAnimation() {
  return (
    <div className="relative w-full max-w-2xl mx-auto py-8 select-none" aria-hidden="true">
      {/* SVG connecting lines */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 600 120"
        preserveAspectRatio="xMidYMid meet"
        fill="none"
      >
        {/* Static lines */}
        {[0, 1, 2].map((i) => (
          <line
            key={i}
            x1={75 + i * 150}
            y1={60}
            x2={225 + i * 150}
            y2={60}
            stroke="url(#lineGrad)"
            strokeWidth={2}
            strokeDasharray="6 4"
            opacity={0.3}
          />
        ))}

        {/* Animated travel pulses */}
        {[0, 1, 2].map((i) => (
          <motion.line
            key={`pulse-${i}`}
            x1={75 + i * 150}
            y1={60}
            x2={225 + i * 150}
            y2={60}
            stroke={nodes[i + 1].color}
            strokeWidth={3}
            strokeLinecap="round"
            variants={pulseVariants}
            initial="initial"
            animate="animate"
            custom={i}
          />
        ))}

        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0F766E" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>
      </svg>

      {/* Nodes */}
      <div className="relative flex justify-around items-center" style={{ height: 120 }}>
        {nodes.map((node, i) => (
          <motion.div
            key={node.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15, duration: 0.5, ease: "easeOut" }}
            className="flex flex-col items-center gap-2"
          >
            {/* Node circle */}
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{
                duration: 3,
                delay: i * 0.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative"
            >
              {/* Glow ring */}
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 2, delay: i * 0.5, repeat: Infinity }}
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: node.color }}
              />
              <div
                className="relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg border border-white/10"
                style={{
                  background: `linear-gradient(135deg, ${node.color}20, ${node.color}40)`,
                  boxShadow: `0 0 20px ${node.color}30`,
                }}
              >
                {node.icon}
              </div>
            </motion.div>
            <span className="text-xs font-semibold text-[var(--text-secondary)] text-center whitespace-nowrap">
              {node.label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
