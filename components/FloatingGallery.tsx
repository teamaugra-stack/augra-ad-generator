"use client";

import { useScroll, useTransform, motion } from "framer-motion";
import { useRef } from "react";

export default function FloatingGallery() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none"
    >
      {/* Dark vignette overlay */}
      <div className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_30%,#0a0a0a_80%)]" />

      <motion.div style={{ opacity }} className="absolute inset-0">
        {/* Aurora blob 1 — large rose/pink */}
        <motion.div
          style={{ y: y1 }}
          className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full aurora-blob-1"
        />

        {/* Aurora blob 2 — violet/purple */}
        <motion.div
          style={{ y: y2 }}
          className="absolute top-[20%] right-[10%] w-[600px] h-[600px] rounded-full aurora-blob-2"
        />

        {/* Aurora blob 3 — teal/cyan */}
        <motion.div
          style={{ y: y1 }}
          className="absolute bottom-[15%] left-[25%] w-[450px] h-[450px] rounded-full aurora-blob-3"
        />

        {/* Aurora blob 4 — amber/gold */}
        <motion.div
          style={{ y: y2 }}
          className="absolute top-[40%] left-[50%] w-[400px] h-[400px] rounded-full aurora-blob-4"
        />

        {/* Aurora blob 5 — deep blue accent */}
        <motion.div
          style={{ y: y1 }}
          className="absolute top-[5%] right-[30%] w-[350px] h-[350px] rounded-full aurora-blob-5"
        />

        {/* Floating particles */}
        <div className="absolute inset-0">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white/20 rounded-full particle"
              style={{
                left: `${10 + (i * 47) % 80}%`,
                top: `${5 + (i * 31) % 90}%`,
                animationDelay: `${i * 0.7}s`,
                animationDuration: `${4 + (i % 4) * 2}s`,
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
