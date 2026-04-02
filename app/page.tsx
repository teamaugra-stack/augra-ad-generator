"use client";

import { motion } from "framer-motion";
import FloatingGallery from "@/components/FloatingGallery";
import GeneratorForm from "@/components/GeneratorForm";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] relative">
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        <FloatingGallery />

        {/* Hero Content */}
        <div className="relative z-20 text-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1 className="text-7xl md:text-8xl font-bold tracking-tighter bg-gradient-to-b from-white via-white to-neutral-500 bg-clip-text text-transparent pb-2">
              Augra
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="text-lg md:text-xl text-neutral-400 mt-4 max-w-md mx-auto leading-relaxed"
          >
            Premium ad creatives for medical
            <br />
            and aesthetic practices.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            className="mt-8"
          >
            <a
              href="#generator"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/[0.08] border border-white/[0.1] text-sm text-neutral-300 hover:bg-white/[0.12] hover:border-white/[0.2] transition-all duration-300 backdrop-blur-sm"
            >
              Start generating
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            </a>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 z-20"
        >
          <div className="w-5 h-8 border-2 border-neutral-600 rounded-full flex items-start justify-center p-1">
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-1 h-1.5 bg-neutral-400 rounded-full"
            />
          </div>
        </motion.div>
      </section>

      {/* Generator Section */}
      <section
        id="generator"
        className="relative py-24 px-4"
      >
        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-radial from-white/[0.03] to-transparent rounded-full blur-3xl pointer-events-none" />

        <GeneratorForm />
      </section>
    </main>
  );
}
