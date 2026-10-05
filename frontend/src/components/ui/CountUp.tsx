"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

interface CountUpProps {
  end: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
}

export function CountUp({ end, duration = 2, suffix = "", prefix = "" }: CountUpProps) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      start = Math.floor(eased * end);
      setValue(start);
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [inView, end, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}

interface StatItem {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
}

export function StatsStrip({ stats }: { stats: StatItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-6">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1, duration: 0.5 }}
          className="text-center"
        >
          <div className="text-3xl sm:text-4xl font-display font-bold gradient-text">
            <CountUp
              end={stat.value}
              suffix={stat.suffix}
              prefix={stat.prefix}
            />
          </div>
          <div className="text-sm text-[var(--text-secondary)] mt-1">{stat.label}</div>
        </motion.div>
      ))}
    </div>
  );
}
