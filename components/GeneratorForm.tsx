"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";

const AD_TYPES = [
  "Procedure Highlight",
  "Practice Branding",
  "Offer or Promotion",
  "Authority Positioning",
];

const OUTPUT_FORMATS = [
  "1:1 (Instagram Square)",
  "4:5 (Facebook Feed)",
  "9:16 (Story)",
];

const LOADING_MESSAGES = [
  "Crafting your creative brief...",
  "Art directing the composition...",
  "Selecting the perfect lighting...",
  "Generating your ad creative...",
  "Applying final touches...",
];

interface GenerationResult {
  imageUrl: string;
  prompt: string;
}

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: "easeOut" as const },
  }),
};

export default function GeneratorForm() {
  const [adType, setAdType] = useState(AD_TYPES[0]);
  const [procedure, setProcedure] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  const [outputFormat, setOutputFormat] = useState(OUTPUT_FORMATS[0]);
  const [brandAssetNote, setBrandAssetNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(formRef, { once: true, margin: "-100px" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    setLoadingMsgIdx(0);

    // Cycle through loading messages
    const interval = setInterval(() => {
      setLoadingMsgIdx((prev) =>
        prev < LOADING_MESSAGES.length - 1 ? prev + 1 : prev
      );
    }, 3000);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adType,
          procedure,
          keyMessage,
          outputFormat,
          brandAssetNote,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(
          data.error ||
            "Something went wrong generating your creative. Try again."
        );
      } else {
        setResult(data);
      }
    } catch {
      setError("Something went wrong generating your creative. Try again.");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!result?.imageUrl) return;
    try {
      const response = await fetch(result.imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `augra-ad-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(result.imageUrl, "_blank");
    }
  };

  return (
    <div ref={formRef} className="w-full max-w-[680px] mx-auto">
      {/* Glassmorphism Card */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="glass-card rounded-2xl p-8 md:p-10"
      >
        <motion.div
          custom={0}
          variants={fadeInUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          <h2 className="text-xl font-semibold text-white mb-1 tracking-tight">
            Create your ad
          </h2>
          <p className="text-sm text-neutral-500 mb-8">
            Fill in the details and we&apos;ll handle the rest.
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Ad Type */}
          <motion.div
            custom={1}
            variants={fadeInUp}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
          >
            <label className="label-style">Ad Type</label>
            <select
              value={adType}
              onChange={(e) => setAdType(e.target.value)}
              className="input-style"
            >
              {AD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </motion.div>

          {/* Procedure or Service */}
          <motion.div
            custom={2}
            variants={fadeInUp}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
          >
            <label className="label-style">Procedure or Service</label>
            <input
              type="text"
              value={procedure}
              onChange={(e) => setProcedure(e.target.value)}
              placeholder="e.g. Rhinoplasty, Botox, IV Therapy"
              className="input-style"
              required
            />
          </motion.div>

          {/* Key Message */}
          <motion.div
            custom={3}
            variants={fadeInUp}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
          >
            <label className="label-style">Key Message</label>
            <input
              type="text"
              value={keyMessage}
              onChange={(e) => setKeyMessage(e.target.value)}
              placeholder="e.g. Subtle refinement. Lasting confidence."
              className="input-style"
              required
            />
          </motion.div>

          {/* Output Format */}
          <motion.div
            custom={4}
            variants={fadeInUp}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
          >
            <label className="label-style">Output Format</label>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="input-style"
            >
              {OUTPUT_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </motion.div>

          {/* Brand Asset Note */}
          <motion.div
            custom={5}
            variants={fadeInUp}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
          >
            <label className="label-style">
              Brand Asset Note{" "}
              <span className="text-neutral-600 normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={brandAssetNote}
              onChange={(e) => setBrandAssetNote(e.target.value)}
              placeholder="e.g. Professional headshot of surgeon"
              className="input-style"
            />
          </motion.div>

          {/* Generate Button */}
          <motion.div
            custom={6}
            variants={fadeInUp}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
          >
            <button
              type="submit"
              disabled={loading}
              className="generate-btn w-full font-bold py-3.5 px-4 rounded-xl text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Generating..." : "Generate Creative"}
            </button>
          </motion.div>
        </form>

        {/* Loading State */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-8 overflow-hidden"
            >
              <div className="flex flex-col items-center gap-5 py-4">
                {/* Animated progress bar */}
                <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full loading-gradient rounded-full animate-loading-bar" />
                </div>
                <motion.p
                  key={loadingMsgIdx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-sm text-neutral-400"
                >
                  {LOADING_MESSAGES[loadingMsgIdx]}
                </motion.p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error State */}
        <AnimatePresence>
          {error && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-6 p-4 border border-red-900/30 bg-red-950/20 rounded-xl backdrop-blur-sm"
            >
              <p className="text-sm text-red-400">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Result */}
      <AnimatePresence>
        {result && !loading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mt-8 space-y-4"
          >
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-neutral-800 via-neutral-600 to-neutral-800 rounded-2xl opacity-30 group-hover:opacity-50 blur-lg transition-opacity duration-500" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.imageUrl}
                alt="Generated ad creative"
                className="relative w-full rounded-xl"
              />
            </div>

            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 bg-white/[0.06] border border-white/[0.1] text-white font-medium py-3.5 px-4 rounded-xl hover:bg-white/[0.1] hover:border-white/[0.15] transition-all duration-300 backdrop-blur-sm"
            >
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
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Download Image
            </button>

            {/* Collapsible Prompt */}
            <div className="pt-2">
              <button
                onClick={() => setShowPrompt(!showPrompt)}
                className="text-xs text-neutral-500 hover:text-neutral-400 transition-colors flex items-center gap-1"
              >
                <svg
                  className={`w-3 h-3 transition-transform duration-200 ${showPrompt ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                {showPrompt ? "Hide" : "Show"} generated prompt
              </button>
              <AnimatePresence>
                {showPrompt && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 text-xs text-neutral-600 leading-relaxed overflow-hidden"
                  >
                    {result.prompt}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
