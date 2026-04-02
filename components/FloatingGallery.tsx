"use client";

import { useScroll, useTransform, motion } from "framer-motion";
import { useRef } from "react";

const PREVIEW_CARDS = [
  // Column 1
  [
    { gradient: "from-amber-700/60 via-stone-600/40 to-neutral-700/50", label: "Rhinoplasty" },
    { gradient: "from-rose-700/50 via-neutral-600/40 to-stone-700/40", label: "Dermal Fillers" },
    { gradient: "from-slate-600/50 via-neutral-700/40 to-zinc-600/40", label: "Practice Interior" },
    { gradient: "from-emerald-700/40 via-stone-600/40 to-neutral-700/50", label: "IV Therapy" },
  ],
  // Column 2
  [
    { gradient: "from-sky-700/50 via-slate-600/40 to-neutral-700/40", label: "Facial Contouring" },
    { gradient: "from-violet-700/40 via-neutral-600/40 to-stone-700/40", label: "Skin Rejuvenation" },
    { gradient: "from-amber-600/50 via-stone-700/40 to-neutral-600/40", label: "Surgeon Portrait" },
    { gradient: "from-teal-700/50 via-neutral-600/40 to-slate-700/40", label: "Laser Treatment" },
  ],
  // Column 3
  [
    { gradient: "from-rose-600/50 via-stone-700/40 to-neutral-600/40", label: "Lip Enhancement" },
    { gradient: "from-indigo-700/50 via-slate-600/40 to-neutral-700/40", label: "Clinical Suite" },
    { gradient: "from-orange-700/40 via-neutral-600/40 to-stone-700/40", label: "Body Sculpting" },
    { gradient: "from-cyan-700/40 via-stone-600/40 to-neutral-700/40", label: "Chemical Peel" },
  ],
  // Column 4
  [
    { gradient: "from-fuchsia-700/40 via-neutral-600/40 to-stone-700/40", label: "Brow Lift" },
    { gradient: "from-lime-700/35 via-stone-600/40 to-neutral-700/40", label: "Wellness Drip" },
    { gradient: "from-slate-500/40 via-neutral-600/40 to-zinc-700/40", label: "Consultation" },
    { gradient: "from-rose-700/40 via-amber-700/35 to-stone-700/40", label: "Facelift" },
  ],
];

export default function FloatingGallery() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -150]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -250]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -180]);
  const y4 = useTransform(scrollYProgress, [0, 1], [0, -220]);
  const yValues = [y1, y2, y3, y4];

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none"
    >
      {/* Gradient overlays for fade effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a]/30 to-[#0a0a0a] z-10" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/80 via-transparent to-[#0a0a0a]/80 z-10" />

      <div className="absolute inset-0 flex items-start justify-center gap-4 px-8 pt-16 opacity-60">
        {PREVIEW_CARDS.map((column, colIdx) => (
          <motion.div
            key={colIdx}
            style={{ y: yValues[colIdx] }}
            className="flex flex-col gap-4 w-[220px] flex-shrink-0"
          >
            {/* Duplicate cards for seamless loop illusion */}
            {[...column, ...column].map((card, cardIdx) => (
              <div
                key={cardIdx}
                className={`relative rounded-xl overflow-hidden bg-gradient-to-br ${card.gradient} border border-white/[0.06] aspect-[4/5] animate-float-${colIdx}`}
                style={{
                  animationDelay: `${cardIdx * 0.8}s`,
                }}
              >
                {/* Simulated image content */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="h-1.5 w-12 bg-white/20 rounded-full mb-1.5" />
                  <div className="h-1 w-20 bg-white/10 rounded-full" />
                </div>
                {/* Shimmer overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent shimmer-overlay" />
              </div>
            ))}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
