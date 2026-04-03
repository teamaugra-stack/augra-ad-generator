"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import EditChat from "./EditChat";
import type { AdLayout, AdCopyData, ClientData } from "@/types/chat";

const AD_TYPES = [
  "Plastic Surgery",
  "Med Spa / Aesthetics",
  "Cosmetic Dentistry",
  "Chiropractic / Physical Therapy",
  "Men's Health / TRT",
  "Weight Loss",
  "Peptide / Anti-Aging / Functional Medicine",
  "Offer or Promotion",
  "Authority / Doctor Positioning",
  "Practice Branding",
];

const OUTPUT_FORMATS = [
  "1:1 (Instagram Square)",
  "4:5 (Facebook Feed)",
  "9:16 (Story)",
];

const LOADING_MESSAGES = [
  "Analyzing your brief...",
  "Art directing the composition...",
  "Selecting the perfect lighting...",
  "Generating your ad creative...",
  "Applying final touches...",
];

interface GenerationResult {
  imageUrl: string;
  bgImageUrl?: string;
  prompt: string;
  adCopy?: AdCopyData;
  layout?: AdLayout;
  modelUsed?: string;
}

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: "easeOut" as const },
  }),
};

/* ===== Custom Dropdown ===== */
function CustomSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  return (
    <div ref={ref} className="relative">
      <label className="label-style">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="input-style text-left flex items-center justify-between w-full"
      >
        <span className="truncate">{value}</span>
        <svg
          className={`w-4 h-4 text-neutral-400 transition-transform duration-200 flex-shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" as const }}
            className="absolute z-50 mt-2 w-full rounded-xl overflow-hidden border border-white/[0.1] bg-[#161616] backdrop-blur-xl shadow-2xl shadow-black/50 max-h-[280px] overflow-y-auto"
          >
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-3 text-sm transition-colors duration-150 ${
                  opt === value
                    ? "text-white bg-white/[0.08]"
                    : "text-neutral-300 hover:text-white hover:bg-white/[0.05]"
                }`}
              >
                {opt}
                {opt === value && (
                  <span className="float-right text-violet-400">
                    <svg
                      className="w-4 h-4 inline"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ===== Main Form ===== */
function buildClientContext(client: ClientData): string {
  const parts = [
    `CLIENT BRAND PROFILE:`,
    `Business: ${client.businessName}`,
    `Contact: ${client.name}`,
    client.brandTone ? `Brand Tone: ${client.brandTone}` : "",
    client.services ? `Services: ${client.services}` : "",
    client.website ? `Website: ${client.website}` : "",
    client.targetAudience ? `Target Audience: ${client.targetAudience}` : "",
    client.objections ? `Common Objections: ${client.objections}` : "",
    client.wordsToAvoid && client.wordsToAvoid.toLowerCase() !== "none"
      ? `Words to Avoid: ${client.wordsToAvoid}`
      : "",
    client.onboardingDoc
      ? `\nFULL ONBOARDING DOCUMENT:\n${client.onboardingDoc}`
      : "",
  ];
  return parts.filter(Boolean).join("\n");
}

export default function GeneratorForm({ clientData }: { clientData?: ClientData | null }) {
  const [adType, setAdType] = useState(AD_TYPES[0]);
  const [procedure, setProcedure] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  const [outputFormat, setOutputFormat] = useState(OUTPUT_FORMATS[0]);
  const [brandAssetNote, setBrandAssetNote] = useState("");
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [referenceImageDescription, setReferenceImageDescription] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInView = useInView(formRef, { once: true, margin: "-80px" });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setReferenceImages((prev) => [...prev, ...newFiles].slice(0, 5));
    }
  };

  const removeImage = (index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!procedure.trim() || !keyMessage.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);
    setLoadingMsgIdx(0);

    const interval = setInterval(() => {
      setLoadingMsgIdx((prev) =>
        prev < LOADING_MESSAGES.length - 1 ? prev + 1 : prev
      );
    }, 3000);

    try {
      // Convert first reference image to base64 if present
      let referenceImageBase64: string | undefined;
      if (referenceImages.length > 0) {
        const file = referenceImages[0];
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        referenceImageBase64 = btoa(binary);
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adType,
          procedure,
          keyMessage,
          outputFormat,
          brandAssetNote,
          referenceImageDescription: referenceImageDescription || undefined,
          referenceImageBase64,
          clientContext: clientData ? buildClientContext(clientData) : undefined,
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
    <div ref={formRef} className="w-full max-w-[680px] mx-auto relative z-10">
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
          <div className="flex items-center gap-3 mb-1">
            <svg
              className="w-5 h-5 text-violet-400/70"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
            </svg>
            <h2 className="text-xl font-semibold text-white tracking-tight">
              {clientData ? `${clientData.businessName}` : "Create your ad"}
            </h2>
          </div>
          <p className="text-sm text-neutral-500 mb-8 pl-8">
            {clientData
              ? "Your brand profile is loaded. Generate on-brand ad creatives."
              : "Fill in the details and we\u0027ll generate your ad creative."}
          </p>
          {clientData?.logoUrl && (
            <div className="mb-6 pl-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={clientData.logoUrl}
                alt={`${clientData.businessName} logo`}
                className="h-10 w-auto object-contain opacity-70"
              />
            </div>
          )}
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Ad Type */}
          <motion.div
            custom={1}
            variants={fadeInUp}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
          >
            <CustomSelect
              label="Ad Category"
              value={adType}
              onChange={setAdType}
              options={AD_TYPES}
            />
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
              placeholder="e.g. Rhinoplasty, Botox, SmartLipo, Veneers, TRT, IV Therapy"
              className="input-style"
              required
            />
          </motion.div>

          {/* Key Message — now a textarea */}
          <motion.div
            custom={3}
            variants={fadeInUp}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
          >
            <label className="label-style">Key Message & Context</label>
            <textarea
              value={keyMessage}
              onChange={(e) => setKeyMessage(e.target.value)}
              placeholder="Describe your ad vision in detail. Example: Our clinic specializes in hormone optimization for men. We want to convey strength, confidence, and vitality. The ad should feel premium and masculine — think dark gym aesthetic with dramatic lighting. We're running a limited-time offer for new patients."
              className="input-style min-h-[120px] resize-y"
              rows={4}
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
            <CustomSelect
              label="Output Format"
              value={outputFormat}
              onChange={setOutputFormat}
              options={OUTPUT_FORMATS}
            />
          </motion.div>

          {/* Reference Image Upload */}
          <motion.div
            custom={5}
            variants={fadeInUp}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
          >
            <label className="label-style">
              Reference Images{" "}
              <span className="text-neutral-600 normal-case">
                (optional, up to 5)
              </span>
            </label>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="input-style cursor-pointer flex items-center justify-center gap-2 py-4 border-dashed hover:border-white/[0.2] hover:bg-white/[0.06]"
            >
              <svg
                className="w-5 h-5 text-neutral-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="text-sm text-neutral-500">
                Click to upload reference images
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Image previews */}
            {referenceImages.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {referenceImages.map((file, i) => (
                  <div key={i} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Reference ${i + 1}`}
                      className="w-16 h-16 rounded-lg object-cover border border-white/[0.1]"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Reference image description */}
            {referenceImages.length > 0 && (
              <textarea
                value={referenceImageDescription}
                onChange={(e) => setReferenceImageDescription(e.target.value)}
                placeholder="Describe what you want from these reference images. e.g. 'Match the dark moody lighting and gym aesthetic from image 1, but with our doctor as the subject instead'"
                className="input-style mt-3 min-h-[80px] resize-y"
                rows={2}
              />
            )}
          </motion.div>

          {/* Brand Asset Note */}
          <motion.div
            custom={6}
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
              placeholder="e.g. Professional headshot of surgeon, clinic interior, specific brand colors"
              className="input-style"
            />
          </motion.div>

          {/* Generate Button */}
          <motion.div
            custom={7}
            variants={fadeInUp}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            className="pt-2"
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
                <div className="w-full h-1 bg-neutral-800/50 rounded-full overflow-hidden">
                  <div className="h-full loading-gradient rounded-full animate-loading-bar" />
                </div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={loadingMsgIdx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-sm text-neutral-400"
                  >
                    {LOADING_MESSAGES[loadingMsgIdx]}
                  </motion.p>
                </AnimatePresence>
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
              className="mt-6 p-4 border border-red-500/20 bg-red-500/[0.06] rounded-xl"
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
              <div className="absolute -inset-2 bg-gradient-to-r from-violet-500/20 via-blue-500/10 to-rose-500/20 rounded-2xl opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-700" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.imageUrl}
                alt="Generated ad creative"
                className="relative w-full rounded-xl border border-white/[0.08]"
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

            {/* Ad Copy Details */}
            {result.adCopy && (
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2">
                <p className="text-xs text-neutral-500 uppercase tracking-widest mb-3">
                  Generated Ad Copy
                </p>
                <p className="text-sm text-white font-semibold">
                  {result.adCopy.headline}
                </p>
                <p className="text-xs text-neutral-400">
                  {result.adCopy.subheadline}
                </p>
                {result.adCopy.offer && (
                  <p className="text-xs text-violet-400 font-medium">
                    {result.adCopy.offer}
                  </p>
                )}
                <p className="text-xs text-neutral-500">
                  CTA: {result.adCopy.cta}
                </p>
              </div>
            )}

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
                    className="mt-3 text-xs text-neutral-500 leading-relaxed overflow-hidden"
                  >
                    {result.prompt}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Chat */}
      <AnimatePresence>
        {result && !loading && result.adCopy && result.layout && (
          <EditChat
            initialAdState={{
              currentBgImageUrl: result.bgImageUrl || "",
              adCopy: result.adCopy,
              layout: result.layout,
              imagePrompt: result.prompt,
              modelUsed: result.modelUsed || "fal-ai/flux-pro/v1.1",
              outputFormat,
              originalInputs: {
                adType,
                procedure,
                keyMessage,
                brandAssetNote,
              },
            }}
            onUpdate={(update) => {
              setResult((prev) =>
                prev
                  ? {
                      ...prev,
                      imageUrl: update.imageUrl,
                      bgImageUrl: update.bgImageUrl,
                      adCopy: update.adCopy,
                      layout: update.layout,
                    }
                  : prev
              );
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
