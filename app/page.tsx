"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import FloatingGallery from "@/components/FloatingGallery";
import GeneratorForm from "@/components/GeneratorForm";
import type { ClientData } from "@/types/chat";

function HomeContent() {
  const searchParams = useSearchParams();
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientError, setClientError] = useState("");

  useEffect(() => {
    const company = searchParams.get("client");
    if (!company) return;

    setClientLoading(true);
    fetch(`/api/lookup?company=${encodeURIComponent(company)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.found && data.client) {
          setClientData(data.client);
        } else {
          setClientError(data.error || "Client not found.");
        }
      })
      .catch(() => setClientError("Failed to load client data."))
      .finally(() => setClientLoading(false));
  }, [searchParams]);

  // Show full-page loading when looking up client
  if (clientLoading) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 border-2 border-violet-500/20 rounded-full" />
            <div className="absolute inset-0 border-2 border-transparent border-t-violet-400 rounded-full animate-spin" />
            <div className="absolute inset-2 border-2 border-transparent border-t-white/40 rounded-full animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
          </div>
          <p className="text-sm text-neutral-400 animate-pulse">
            Loading your brand profile...
          </p>
        </motion.div>
      </main>
    );
  }

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
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <h1 className="text-7xl md:text-9xl font-bold tracking-tighter bg-gradient-to-b from-white via-white/90 to-neutral-500/80 bg-clip-text text-transparent pb-2 select-none">
              Augra
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="text-lg md:text-xl text-neutral-400 mt-4 max-w-md mx-auto leading-relaxed"
          >
            {clientData ? (
              <>
                Welcome back,{" "}
                <span className="text-white font-medium">
                  {clientData.businessName}
                </span>
              </>
            ) : (
              <>
                Premium ad creatives for medical
                <br />
                and aesthetic practices.
              </>
            )}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
            className="mt-10"
          >
            <a
              href="#generator"
              className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-white/[0.07] border border-white/[0.12] text-sm text-neutral-200 hover:bg-white/[0.12] hover:border-white/[0.25] hover:text-white transition-all duration-500 backdrop-blur-md"
            >
              Start generating
              <svg
                className="w-4 h-4 transition-transform duration-300 group-hover:translate-y-0.5"
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
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 z-20"
        >
          <div className="w-5 h-8 border-2 border-neutral-700 rounded-full flex items-start justify-center p-1">
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="w-1 h-1.5 bg-neutral-500 rounded-full"
            />
          </div>
        </motion.div>
      </section>

      {/* Section divider */}
      <div className="h-32 section-divider" />

      {/* Generator Section */}
      <section id="generator" className="relative py-24 px-4 noise-overlay">
        {/* Ambient colored glows */}
        <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[800px] h-[500px] pointer-events-none">
          <div className="absolute top-0 left-[20%] w-[300px] h-[300px] bg-violet-500/[0.04] rounded-full blur-[100px]" />
          <div className="absolute top-[50px] right-[15%] w-[250px] h-[250px] bg-blue-500/[0.03] rounded-full blur-[80px]" />
          <div className="absolute top-[100px] left-[40%] w-[200px] h-[200px] bg-rose-500/[0.025] rounded-full blur-[90px]" />
        </div>

        {/* Client error state */}
        {clientError && (
          <div className="max-w-[680px] mx-auto mb-8 p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 text-center">
            <p className="text-sm text-amber-400">{clientError}</p>
          </div>
        )}

        <GeneratorForm clientData={clientData} />
      </section>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
