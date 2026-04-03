"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { ClientData, AdCopyData, AdLayout } from "@/types/chat";
import EditChat from "@/components/EditChat";

// ===== Step Components =====

function StepCategory({
  categories,
  selected,
  onSelect,
}: {
  categories: string[];
  selected: string;
  onSelect: (cat: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {categories.map((cat) => (
        <motion.button
          key={cat}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(cat)}
          className={`p-4 rounded-xl text-left text-sm font-medium transition-all duration-200 border ${
            selected === cat
              ? "bg-violet-500/15 border-violet-500/40 text-white shadow-[0_0_20px_rgba(124,58,237,0.1)]"
              : "bg-white/[0.03] border-white/[0.06] text-neutral-400 hover:border-white/[0.15] hover:text-white"
          }`}
        >
          {cat}
        </motion.button>
      ))}
    </div>
  );
}

function StepDetails({
  procedure,
  setProcedure,
  keyMessage,
  setKeyMessage,
  outputFormat,
  setOutputFormat,
  brandAssetNote,
  setBrandAssetNote,
}: {
  procedure: string;
  setProcedure: (v: string) => void;
  keyMessage: string;
  setKeyMessage: (v: string) => void;
  outputFormat: string;
  setOutputFormat: (v: string) => void;
  brandAssetNote: string;
  setBrandAssetNote: (v: string) => void;
}) {
  const formats = ["1:1 (Instagram Square)", "4:5 (Facebook Feed)", "9:16 (Story)"];

  return (
    <div className="space-y-5">
      <div>
        <label className="label-style">Procedure or Service</label>
        <input
          type="text"
          value={procedure}
          onChange={(e) => setProcedure(e.target.value)}
          placeholder="e.g. Rhinoplasty, Botox, SmartLipo, Veneers, TRT"
          className="input-style"
        />
      </div>
      <div>
        <label className="label-style">Key Message & Context</label>
        <textarea
          value={keyMessage}
          onChange={(e) => setKeyMessage(e.target.value)}
          placeholder="Describe your ad vision in detail. What transformation do you want to show? What emotion should it trigger? What offer are you running?"
          className="input-style min-h-[120px] resize-y"
          rows={4}
        />
      </div>
      <div>
        <label className="label-style">Output Format</label>
        <div className="grid grid-cols-3 gap-2">
          {formats.map((f) => (
            <button
              key={f}
              onClick={() => setOutputFormat(f)}
              className={`py-3 rounded-xl text-xs font-medium transition-all border ${
                outputFormat === f
                  ? "bg-violet-500/15 border-violet-500/40 text-white"
                  : "bg-white/[0.03] border-white/[0.06] text-neutral-400 hover:border-white/[0.15]"
              }`}
            >
              {f.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label-style">
          Brand Note <span className="text-neutral-600 normal-case">(optional)</span>
        </label>
        <input
          type="text"
          value={brandAssetNote}
          onChange={(e) => setBrandAssetNote(e.target.value)}
          placeholder="e.g. Use our brand colors, include doctor headshot"
          className="input-style"
        />
      </div>
    </div>
  );
}

function StepUpload({
  files,
  setFiles,
  imageDescription,
  setImageDescription,
}: {
  files: File[];
  setFiles: (f: File[]) => void;
  imageDescription: string;
  setImageDescription: (v: string) => void;
}) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const newFiles = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    setFiles([...files, ...newFiles].slice(0, 5));
  };

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*";
          input.multiple = true;
          input.onchange = (e) => {
            const target = e.target as HTMLInputElement;
            if (target.files) {
              setFiles([...files, ...Array.from(target.files)].slice(0, 5));
            }
          };
          input.click();
        }}
        className="border-2 border-dashed border-white/[0.1] rounded-2xl p-12 text-center cursor-pointer hover:border-violet-500/30 hover:bg-violet-500/[0.02] transition-all duration-300"
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-sm text-neutral-400 mb-1">
          Drop images here or <span className="text-violet-400">browse</span>
        </p>
        <p className="text-xs text-neutral-600">Up to 5 reference images</p>
      </div>

      {files.length > 0 && (
        <>
          <div className="flex gap-3 flex-wrap">
            {files.map((file, i) => (
              <div key={i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Ref ${i + 1}`}
                  className="w-20 h-20 rounded-xl object-cover border border-white/[0.1]"
                />
                <button
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <textarea
            value={imageDescription}
            onChange={(e) => setImageDescription(e.target.value)}
            placeholder="How should these images be used? e.g. 'Edit this exact photo — add anatomical overlay showing injection points' or 'Use this style as reference for the new ad'"
            className="input-style min-h-[80px] resize-y"
            rows={2}
          />
        </>
      )}
    </div>
  );
}

// ===== Result + Chat View =====

interface GenerationResult {
  imageUrl: string;
  bgImageUrl?: string;
  prompt: string;
  adCopy?: AdCopyData;
  layout?: AdLayout;
  modelUsed?: string;
}

function ResultView({
  result,
  adState,
  onUpdate,
  onNewAd,
}: {
  result: GenerationResult;
  adState: {
    currentBgImageUrl: string;
    adCopy: AdCopyData;
    layout: AdLayout;
    imagePrompt: string;
    modelUsed: string;
    outputFormat: string;
    originalInputs: { adType: string; procedure: string; keyMessage: string; brandAssetNote: string };
  };
  onUpdate: (update: { imageUrl: string; bgImageUrl: string; adCopy: AdCopyData; layout: AdLayout }) => void;
  onNewAd: () => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);

  const handleDownload = async () => {
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
    <div className="grid lg:grid-cols-[1fr,400px] gap-6 max-w-6xl mx-auto">
      {/* Image Panel */}
      <div className="space-y-4">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-violet-500/20 via-blue-500/10 to-violet-500/20 rounded-2xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.imageUrl}
            alt="Generated ad"
            className="relative w-full rounded-xl border border-white/[0.08]"
          />
        </div>

        <div className="flex gap-3">
          <button onClick={handleDownload} className="flex-1 btn-primary py-3 rounded-xl text-sm flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download
          </button>
          <button onClick={onNewAd} className="btn-secondary py-3 px-6 rounded-xl text-sm">
            New Ad
          </button>
        </div>

        {/* Ad Copy Details */}
        {result.adCopy && (
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
            <p className="text-xs text-neutral-500 uppercase tracking-widest">Ad Copy</p>
            <p className="text-sm text-white font-semibold">{result.adCopy.headline}</p>
            <p className="text-xs text-neutral-400">{result.adCopy.subheadline}</p>
            {result.adCopy.offer && <p className="text-xs text-violet-400">{result.adCopy.offer}</p>}
            <p className="text-xs text-neutral-500">CTA: {result.adCopy.cta}</p>
          </div>
        )}

        <button onClick={() => setShowPrompt(!showPrompt)} className="text-xs text-neutral-500 hover:text-neutral-400 transition-colors">
          {showPrompt ? "Hide" : "Show"} prompt
        </button>
        {showPrompt && <p className="text-xs text-neutral-600 leading-relaxed">{result.prompt}</p>}
      </div>

      {/* Chat Panel */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <EditChat initialAdState={adState} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

// ===== Main App =====

const DEFAULT_AD_TYPES = [
  "Plastic Surgery", "Med Spa / Aesthetics", "Cosmetic Dentistry",
  "Chiropractic / Physical Therapy", "Men's Health / TRT", "Weight Loss",
  "Peptide / Anti-Aging", "Offer or Promotion", "Authority / Doctor Positioning", "Practice Branding",
];

function buildClientContext(client: ClientData): string {
  const parts = [
    `=== CLIENT BRAND PROFILE ===`,
    `BUSINESS: ${client.businessName}`,
    `CONTACT: ${client.name}`,
    client.brandTone ? `BRAND TONE: ${client.brandTone}` : "",
    client.services ? `SERVICES: ${client.services}` : "",
    client.website ? `WEBSITE: ${client.website}` : "",
    client.targetAudience ? `TARGET AUDIENCE: ${client.targetAudience}` : "",
    client.objections && client.objections.toLowerCase() !== "idk" ? `OBJECTIONS: ${client.objections}` : "",
    client.wordsToAvoid && client.wordsToAvoid.toLowerCase() !== "none" ? `AVOID: ${client.wordsToAvoid}` : "",
    `=== INSTRUCTIONS: Match this client's specialty and tone in all creative. ===`,
    client.onboardingDoc ? `\n=== ONBOARDING DOC ===\n${client.onboardingDoc}` : "",
  ];
  return parts.filter(Boolean).join("\n");
}

function AppContent() {
  const searchParams = useSearchParams();
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [clientLoading, setClientLoading] = useState(false);

  // Wizard state
  const [step, setStep] = useState(1);
  const [adType, setAdType] = useState("");
  const [procedure, setProcedure] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  const [outputFormat, setOutputFormat] = useState("1:1 (Instagram Square)");
  const [brandAssetNote, setBrandAssetNote] = useState("");
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [imageDescription, setImageDescription] = useState("");

  // Generation state
  const [, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState("");

  const adTypes = clientData?.serviceCategories?.length ? clientData.serviceCategories : DEFAULT_AD_TYPES;

  useEffect(() => {
    if (!adType && adTypes.length > 0) setAdType(adTypes[0]);
  }, [adType, adTypes]);

  // Client lookup
  useEffect(() => {
    const company = searchParams.get("client");
    if (!company) return;
    setClientLoading(true);
    fetch(`/api/lookup?company=${encodeURIComponent(company)}`)
      .then((res) => res.json())
      .then((data) => { if (data.found) setClientData(data.client); })
      .catch(() => {})
      .finally(() => setClientLoading(false));
  }, [searchParams]);

  const loadingMessages = [
    "Analyzing your brief...",
    "Selecting the best AI model...",
    "Generating your ad creative...",
    "Compositing text overlay...",
    "Almost there...",
  ];

  const canProceed = () => {
    if (step === 1) return !!adType;
    if (step === 2) return !!procedure.trim() && !!keyMessage.trim();
    return true;
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    setLoadingMsg(0);
    setStep(4); // Go to loading step

    const interval = setInterval(() => {
      setLoadingMsg((prev) => (prev < loadingMessages.length - 1 ? prev + 1 : prev));
    }, 4000);

    try {
      let referenceImageBase64: string | undefined;
      if (referenceImages.length > 0) {
        const file = referenceImages[0];
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
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
          referenceImageDescription: imageDescription || undefined,
          referenceImageBase64,
          clientContext: clientData ? buildClientContext(clientData) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Something went wrong. Try again.");
        setStep(3);
      } else {
        setResult(data);
        setStep(5); // Results view
      }
    } catch {
      setError("Connection error. Try again.");
      setStep(3);
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  const handleNewAd = () => {
    setResult(null);
    setStep(1);
    setProcedure("");
    setKeyMessage("");
    setReferenceImages([]);
    setImageDescription("");
    setError("");
  };

  // Full-page loader for client
  if (clientLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-neutral-400 animate-pulse">Loading brand profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Grid pattern background */}
      <div className="fixed inset-0 grid-pattern pointer-events-none" />

      {/* Aurora blob background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-[-5%] w-[700px] h-[700px] rounded-full aurora-blob-1" />
        <div className="absolute bottom-[-15%] right-[-5%] w-[600px] h-[600px] rounded-full aurora-blob-2" />
        <div className="absolute top-[35%] right-[15%] w-[400px] h-[400px] rounded-full aurora-blob-3" />
      </div>

      {/* Top bar */}
      <div className="relative z-30 flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">A</span>
          </div>
          <span className="text-white font-semibold text-sm">Augra</span>
          {clientData && (
            <span className="text-neutral-500 text-xs ml-2">
              / {clientData.businessName}
            </span>
          )}
        </div>

        {/* Step indicator */}
        {step < 4 && (
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1 rounded-full transition-all duration-300 ${
                  s === step ? "w-8 bg-violet-500" : s < step ? "w-4 bg-violet-500/40" : "w-4 bg-white/[0.08]"
                }`}
              />
            ))}
          </div>
        )}

        {step === 5 && (
          <button onClick={handleNewAd} className="text-xs text-neutral-400 hover:text-white transition-colors">
            + New Ad
          </button>
        )}
      </div>

      {/* Main content */}
      <div className="relative z-20 px-4 py-8 md:py-12">
        <AnimatePresence mode="wait">
          {/* Step 1: Category */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="max-w-2xl mx-auto"
            >
              <div className="mb-10">
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 font-heading glow-text">What type of ad?</h1>
                <p className="text-neutral-500 text-sm">Select the category that matches your practice.</p>
              </div>
              <StepCategory categories={adTypes} selected={adType} onSelect={(cat) => { setAdType(cat); setStep(2); }} />
            </motion.div>
          )}

          {/* Step 2: Details */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="max-w-xl mx-auto"
            >
              <div className="mb-8">
                <button onClick={() => setStep(1)} className="text-xs text-neutral-500 hover:text-white mb-4 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Back
                </button>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 font-heading glow-text">Describe your ad</h1>
                <p className="text-neutral-400 text-sm">
                  <span className="text-violet-400">{adType}</span> — tell us about the service and your vision.
                </p>
              </div>
              <StepDetails
                procedure={procedure} setProcedure={setProcedure}
                keyMessage={keyMessage} setKeyMessage={setKeyMessage}
                outputFormat={outputFormat} setOutputFormat={setOutputFormat}
                brandAssetNote={brandAssetNote} setBrandAssetNote={setBrandAssetNote}
              />
              <button
                onClick={() => setStep(3)}
                disabled={!canProceed()}
                className="w-full mt-6 btn-primary py-3.5 rounded-xl text-sm font-semibold disabled:opacity-30"
              >
                Continue
              </button>
            </motion.div>
          )}

          {/* Step 3: Upload + Generate */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="max-w-xl mx-auto"
            >
              <div className="mb-8">
                <button onClick={() => setStep(2)} className="text-xs text-neutral-500 hover:text-white mb-4 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Back
                </button>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 font-heading glow-text">Reference images</h1>
                <p className="text-neutral-400 text-sm">Upload images to edit or use as style reference. Or skip to generate fresh.</p>
              </div>
              <StepUpload
                files={referenceImages} setFiles={setReferenceImages}
                imageDescription={imageDescription} setImageDescription={setImageDescription}
              />

              {error && (
                <div className="mt-4 p-4 rounded-xl bg-red-500/[0.06] border border-red-500/20">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                onClick={handleGenerate}
                className="w-full mt-6 generate-btn py-4 rounded-xl text-sm font-bold transition-all duration-300"
              >
                Generate Ad Creative
              </button>
              <button
                onClick={() => { setReferenceImages([]); setImageDescription(""); handleGenerate(); }}
                className="w-full mt-2 text-xs text-neutral-500 hover:text-neutral-300 py-2 transition-colors"
              >
                Skip images & generate fresh
              </button>
            </motion.div>
          )}

          {/* Step 4: Loading */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md mx-auto text-center py-20"
            >
              {/* Animated orb */}
              <div className="relative w-32 h-32 mx-auto mb-8">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 animate-spin opacity-20 blur-xl" style={{ animationDuration: "3s" }} />
                <div className="absolute inset-4 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 animate-spin opacity-30 blur-lg" style={{ animationDuration: "2s", animationDirection: "reverse" }} />
                <div className="absolute inset-8 rounded-full bg-gradient-to-r from-violet-400 to-blue-400 animate-pulse opacity-50 blur-md" />
                <div className="absolute inset-[44px] rounded-full bg-white/10 backdrop-blur-sm border border-white/20" />
              </div>

              <AnimatePresence mode="wait">
                <motion.p
                  key={loadingMsg}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-sm text-neutral-300 mb-4"
                >
                  {loadingMessages[loadingMsg]}
                </motion.p>
              </AnimatePresence>

              <div className="w-48 h-1 bg-white/[0.06] rounded-full mx-auto overflow-hidden">
                <div className="h-full loading-gradient rounded-full animate-loading-bar" />
              </div>
            </motion.div>
          )}

          {/* Step 5: Results + Chat */}
          {step === 5 && result && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <ResultView
                result={result}
                adState={{
                  currentBgImageUrl: result.bgImageUrl || "",
                  adCopy: result.adCopy || { headline: "", subheadline: "", cta: "", offer: "" },
                  layout: result.layout || {} as AdLayout,
                  imagePrompt: result.prompt,
                  modelUsed: result.modelUsed || "flux_standard",
                  outputFormat,
                  originalInputs: { adType, procedure, keyMessage, brandAssetNote },
                }}
                onUpdate={(update) => {
                  setResult((prev) => prev ? { ...prev, imageUrl: update.imageUrl, bgImageUrl: update.bgImageUrl, adCopy: update.adCopy, layout: update.layout } : prev);
                }}
                onNewAd={handleNewAd}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <AppContent />
    </Suspense>
  );
}
