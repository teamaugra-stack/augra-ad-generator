"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { ClientData, AdCopyData, AdLayout } from "@/types/chat";
import EditChat from "@/components/EditChat";
import WelcomeScreen from "@/components/WelcomeScreen";
import { getCategoryMeta, groupCategories } from "@/lib/category-meta";

// ===== TYPES =====

interface GenerationResult {
  imageUrl: string;
  bgImageUrl?: string;
  prompt: string;
  adCopy?: AdCopyData;
  layout?: AdLayout;
  modelUsed?: string;
}

// ===== STEP 1: AD TYPE SELECTOR =====

function StepAdType({
  categories,
  selected,
  onSelect,
}: {
  categories: string[];
  selected: string;
  onSelect: (cat: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const groups = groupCategories(categories);
  const meta = getCategoryMeta(selected);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <div ref={wrapRef} className="selector-wrap">
      {/* Trigger */}
      <div
        className={`trigger ${open ? "open" : ""}`}
        onClick={() => setOpen(!open)}
      >
        <div className={`trigger-icon ${open ? "open" : ""}`}>{meta.icon}</div>
        <div className="trigger-text">
          <span className="trigger-label">{selected}</span>
          <span className={`trigger-sub ${open ? "text-purple-400/80" : ""}`}>{meta.tag}</span>
        </div>
        <div className={`chevron ${open ? "rotate-180" : ""}`}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6L8 10L12 6" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Dropdown */}
      <div className={`dropdown ${open ? "open" : ""}`}>
        <div className="dropdown-inner">
          {groups.map((group) => (
            <div key={group.group}>
              <div className="group-label">{group.label}</div>
              {group.items.map((cat, i) => {
                const catMeta = getCategoryMeta(cat);
                const isSelected = cat === selected;
                return (
                  <div
                    key={cat}
                    className={`option ${isSelected ? "selected" : ""} revealed`}
                    style={{ animationDelay: `${i * 28}ms` }}
                    onClick={() => { onSelect(cat); setTimeout(() => setOpen(false), 150); }}
                  >
                    <div className="option-icon">{catMeta.icon}</div>
                    <div className="option-text">
                      <div className="option-name">{cat}</div>
                      <div className="option-tag">{catMeta.tag}</div>
                    </div>
                    <div className="option-check">
                      <div className="option-check-dot" />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== STEP 2: DETAILS =====

function StepDetails({
  procedure, setProcedure, keyMessage, setKeyMessage,
  outputFormat, setOutputFormat, brandAssetNote, setBrandAssetNote,
}: {
  procedure: string; setProcedure: (v: string) => void;
  keyMessage: string; setKeyMessage: (v: string) => void;
  outputFormat: string; setOutputFormat: (v: string) => void;
  brandAssetNote: string; setBrandAssetNote: (v: string) => void;
}) {
  const formats = ["1:1 (Instagram Square)", "4:5 (Facebook Feed)", "9:16 (Story)"];
  return (
    <div className="w-full max-w-[580px] space-y-5">
      <div>
        <label className="label-style">Procedure or Service</label>
        <input type="text" value={procedure} onChange={(e) => setProcedure(e.target.value)}
          placeholder="e.g. Rhinoplasty, Botox, SmartLipo, Veneers, TRT" className="input-style" />
      </div>
      <div>
        <label className="label-style">Key Message & Context</label>
        <textarea value={keyMessage} onChange={(e) => setKeyMessage(e.target.value)}
          placeholder="Describe your ad vision in detail. What transformation? What emotion? What offer?"
          className="input-style min-h-[120px] resize-y" rows={4} />
      </div>
      <div>
        <label className="label-style">Output Format</label>
        <div className="grid grid-cols-3 gap-2">
          {formats.map((f) => (
            <button key={f} onClick={() => setOutputFormat(f)}
              className={`py-3.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                outputFormat === f
                  ? "bg-[var(--purple-dim)] border-[var(--purple-border)] text-white shadow-[0_0_16px_rgba(155,61,255,0.15)]"
                  : "bg-white/[0.03] border-white/[0.06] text-neutral-500 hover:border-white/[0.15] hover:text-white"
              }`}
            >
              {f.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label-style">Brand Note <span className="text-neutral-600 normal-case">(optional)</span></label>
        <input type="text" value={brandAssetNote} onChange={(e) => setBrandAssetNote(e.target.value)}
          placeholder="e.g. Use brand colors, include doctor headshot" className="input-style" />
      </div>
    </div>
  );
}

// ===== STEP 3: UPLOAD =====

function StepUpload({
  files, setFiles, imageDescription, setImageDescription,
}: {
  files: File[]; setFiles: (f: File[]) => void;
  imageDescription: string; setImageDescription: (v: string) => void;
}) {
  return (
    <div className="w-full max-w-[580px] space-y-4">
      <div
        onDrop={(e) => { e.preventDefault(); setFiles([...files, ...Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"))].slice(0, 5)); }}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file"; input.accept = "image/*"; input.multiple = true;
          input.onchange = (e) => { const t = e.target as HTMLInputElement; if (t.files) setFiles([...files, ...Array.from(t.files)].slice(0, 5)); };
          input.click();
        }}
        className="border-2 border-dashed border-white/[0.08] rounded-2xl p-14 text-center cursor-pointer hover:border-[var(--purple-border)] hover:bg-[var(--purple-dim)] transition-all duration-300"
      >
        <div className="text-3xl mb-3 opacity-40">📷</div>
        <p className="text-sm text-neutral-400 mb-1">Drop images here or <span className="text-[var(--purple)]">browse</span></p>
        <p className="text-xs text-neutral-600">Up to 5 reference images</p>
      </div>
      {files.length > 0 && (
        <>
          <div className="flex gap-3 flex-wrap">
            {files.map((file, i) => (
              <div key={i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(file)} alt="" className="w-20 h-20 rounded-xl object-cover border border-white/[0.1]" />
                <button onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs cursor-pointer">
                  ✕
                </button>
              </div>
            ))}
          </div>
          <textarea value={imageDescription} onChange={(e) => setImageDescription(e.target.value)}
            placeholder="How should these images be used? e.g. 'Edit this exact photo — add anatomical overlay' or 'Match this style'"
            className="input-style min-h-[80px] resize-y" rows={2} />
        </>
      )}
    </div>
  );
}

// ===== NAV BAR =====

function NavBar({ step, totalSteps, clientName, onNewAd }: { step: number; totalSteps: number; clientName?: string; onNewAd?: () => void }) {
  return (
    <nav className="app-nav">
      <div className="nav-left">
        <div className="logo-mark">A</div>
        <span className="nav-brand">Augra</span>
        {clientName && (
          <>
            <span className="nav-sep">/</span>
            <span className="nav-client">{clientName}</span>
          </>
        )}
      </div>
      <div className="nav-right">
        {step <= totalSteps ? (
          Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`pip ${i + 1 < step ? "done" : i + 1 === step ? "active" : "todo"}`} />
          ))
        ) : (
          <button onClick={onNewAd} className="text-xs text-neutral-500 hover:text-white transition-colors cursor-pointer">
            + New Ad
          </button>
        )}
      </div>
    </nav>
  );
}

// ===== STEP HEADER =====

function StepHeader({ stepNum, total, title, highlight, subtitle }: { stepNum: number; total: number; title: string; highlight: string; subtitle: string }) {
  return (
    <div className="header">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7 }} className="step-label">
        Step {String(stepNum).padStart(2, "0")} of {String(total).padStart(2, "0")}
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.7 }}>
        {title} <span>{highlight}</span>
      </motion.h1>
      <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38, duration: 0.7 }} className="subtitle">
        {subtitle}
      </motion.p>
    </div>
  );
}

// ===== RESULT VIEW =====

function ResultView({ result, adState, onUpdate, onNewAd }: {
  result: GenerationResult;
  adState: { currentBgImageUrl: string; adCopy: AdCopyData; layout: AdLayout; imagePrompt: string; modelUsed: string; outputFormat: string; originalInputs: { adType: string; procedure: string; keyMessage: string; brandAssetNote: string } };
  onUpdate: (u: { imageUrl: string; bgImageUrl: string; adCopy: AdCopyData; layout: AdLayout }) => void;
  onNewAd: () => void;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const handleDownload = async () => {
    try {
      const r = await fetch(result.imageUrl); const b = await r.blob(); const u = URL.createObjectURL(b);
      const a = document.createElement("a"); a.href = u; a.download = `augra-ad-${Date.now()}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u);
    } catch { window.open(result.imageUrl, "_blank"); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-60px)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
        <button onClick={onNewAd} className="text-xs text-neutral-500 hover:text-white transition-colors flex items-center gap-1 cursor-pointer">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          New Ad
        </button>
        <div className="flex items-center gap-2">
          <button onClick={handleDownload} className="btn-next !px-5 !py-2 !text-xs !rounded-full !shadow-none">Download</button>
          <button onClick={() => setShowInfo(!showInfo)} className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors px-3 py-2 cursor-pointer">{showInfo ? "Hide" : "Info"}</button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 overflow-hidden relative">
        <motion.div key={result.imageUrl.slice(-20)} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="relative max-h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.imageUrl} alt="Generated ad" className="max-h-[60vh] w-auto rounded-xl border border-white/[0.08] shadow-2xl shadow-black/50" />
        </motion.div>
        <AnimatePresence>
          {showInfo && result.adCopy && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="absolute right-6 top-6 w-72 p-4 rounded-xl bg-black/80 backdrop-blur-lg border border-white/[0.08] space-y-2">
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Ad Details</p>
              <p className="text-sm text-white font-semibold">{result.adCopy.headline}</p>
              <p className="text-xs text-neutral-400">{result.adCopy.subheadline}</p>
              {result.adCopy.offer && <p className="text-xs text-purple-400">{result.adCopy.offer}</p>}
              <p className="text-xs text-neutral-500">CTA: {result.adCopy.cta}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <EditChat initialAdState={adState} onUpdate={onUpdate} />
    </div>
  );
}

// ===== DEFAULTS =====

const DEFAULT_AD_TYPES = [
  "Plastic Surgery", "Med Spa / Aesthetics", "Cosmetic Dentistry",
  "Chiropractic / Physical Therapy", "Men's Health / TRT", "Weight Loss",
  "Peptide / Anti-Aging", "Offer or Promotion", "Authority / Doctor Positioning", "Practice Branding",
];

function buildClientContext(client: ClientData): string {
  const parts = [
    `=== CLIENT BRAND PROFILE ===`, `BUSINESS: ${client.businessName}`, `CONTACT: ${client.name}`,
    client.brandTone ? `BRAND TONE: ${client.brandTone}` : "",
    client.services ? `SERVICES: ${client.services}` : "",
    client.targetAudience ? `TARGET AUDIENCE: ${client.targetAudience}` : "",
    client.objections && client.objections.toLowerCase() !== "idk" ? `OBJECTIONS: ${client.objections}` : "",
    `=== Match this client's specialty and tone. ===`,
    client.onboardingDoc ? `\n=== ONBOARDING DOC ===\n${client.onboardingDoc}` : "",
  ];
  return parts.filter(Boolean).join("\n");
}

// ===== MAIN APP =====

function AppContent() {
  const searchParams = useSearchParams();
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [clientLoading, setClientLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const [step, setStep] = useState(1);
  const [adType, setAdType] = useState("");
  const [procedure, setProcedure] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  const [outputFormat, setOutputFormat] = useState("1:1 (Instagram Square)");
  const [brandAssetNote, setBrandAssetNote] = useState("");
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [imageDescription, setImageDescription] = useState("");

  const [, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState("");

  const adTypes = clientData?.serviceCategories?.length ? clientData.serviceCategories : DEFAULT_AD_TYPES;

  useEffect(() => { if (!adType && adTypes.length > 0) setAdType(adTypes[0]); }, [adType, adTypes]);

  useEffect(() => {
    const company = searchParams.get("client");
    if (!company) return;
    setClientLoading(true);
    fetch(`/api/lookup?company=${encodeURIComponent(company)}`)
      .then((r) => r.json())
      .then((data) => { if (data.found) { setClientData(data.client); setShowWelcome(true); } })
      .catch(() => {})
      .finally(() => setClientLoading(false));
  }, [searchParams]);

  const LOADING_MSGS = ["Analyzing your brief...", "Selecting AI model...", "Generating creative...", "Compositing text...", "Almost there..."];

  const handleGenerate = async () => {
    setLoading(true); setError(""); setResult(null); setLoadingMsg(0); setStep(4);
    const interval = setInterval(() => setLoadingMsg((p) => (p < LOADING_MSGS.length - 1 ? p + 1 : p)), 4000);
    try {
      let refB64: string | undefined;
      if (referenceImages.length > 0) {
        const buf = await referenceImages[0].arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        refB64 = btoa(bin);
      }
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adType, procedure, keyMessage, outputFormat, brandAssetNote, referenceImageDescription: imageDescription || undefined, referenceImageBase64: refB64, clientContext: clientData ? buildClientContext(clientData) : undefined }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || "Something went wrong."); setStep(3); }
      else { setResult(data); setStep(5); }
    } catch { setError("Connection error."); setStep(3); }
    finally { clearInterval(interval); setLoading(false); }
  };

  const handleNewAd = () => { setResult(null); setStep(1); setProcedure(""); setKeyMessage(""); setReferenceImages([]); setImageDescription(""); setError(""); };

  if (clientLoading) {
    return <div className="min-h-screen bg-[#050507] flex items-center justify-center"><div className="w-12 h-12 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" /></div>;
  }

  if (showWelcome && clientData) {
    return <WelcomeScreen clientName={clientData.name} businessName={clientData.businessName} onContinue={() => setShowWelcome(false)} />;
  }

  // Result view (step 5)
  if (step === 5 && result) {
    return (
      <div className="min-h-screen bg-[#050507] relative overflow-hidden">
        <div className="hex-bg"><svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full opacity-[0.13]"><defs><pattern id="hex" width="56" height="48.5" patternUnits="userSpaceOnUse"><polygon points="28,2 52,14.5 52,34 28,46.5 4,34 4,14.5" fill="none" stroke="rgba(155,61,255,0.7)" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#hex)"/></svg></div>
        <NavBar step={5} totalSteps={4} clientName={clientData?.businessName} onNewAd={handleNewAd} />
        <div className="relative z-10 pt-[60px]">
          <ResultView
            result={result}
            adState={{ currentBgImageUrl: result.bgImageUrl || "", adCopy: result.adCopy || { headline: "", subheadline: "", cta: "", offer: "" }, layout: result.layout || {} as AdLayout, imagePrompt: result.prompt, modelUsed: result.modelUsed || "flux_standard", outputFormat, originalInputs: { adType, procedure, keyMessage, brandAssetNote } }}
            onUpdate={(u) => setResult((p) => p ? { ...p, imageUrl: u.imageUrl, bgImageUrl: u.bgImageUrl, adCopy: u.adCopy, layout: u.layout } : p)}
            onNewAd={handleNewAd}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050507] relative overflow-hidden">
      {/* Hex BG */}
      <div className="hex-bg"><svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full opacity-[0.13]"><defs><pattern id="hex2" width="56" height="48.5" patternUnits="userSpaceOnUse"><polygon points="28,2 52,14.5 52,34 28,46.5 4,34 4,14.5" fill="none" stroke="rgba(155,61,255,0.7)" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#hex2)"/></svg></div>
      <div className="blob blob1" />
      <div className="blob blob2" />
      <div className="hline" />

      <NavBar step={step} totalSteps={4} clientName={clientData?.businessName} />

      <main className="app-main">
        <AnimatePresence mode="wait">
          {/* STEP 1 */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }}
              className="flex flex-col items-center w-full">
              <StepHeader stepNum={1} total={4} title="What type of" highlight="ad?" subtitle="Select the category that matches your practice." />
              <StepAdType categories={adTypes} selected={adType} onSelect={setAdType} />
              <div className="cta-row">
                <button className="btn-next" onClick={() => setStep(2)}>
                  Continue <span className="btn-arrow">→</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }}
              className="flex flex-col items-center w-full">
              <StepHeader stepNum={2} total={4} title="Describe your" highlight="ad" subtitle={`${adType} — tell us about the service and your vision.`} />
              <StepDetails procedure={procedure} setProcedure={setProcedure} keyMessage={keyMessage} setKeyMessage={setKeyMessage} outputFormat={outputFormat} setOutputFormat={setOutputFormat} brandAssetNote={brandAssetNote} setBrandAssetNote={setBrandAssetNote} />
              <div className="cta-row">
                <button className="btn-back" onClick={() => setStep(1)}>← Back</button>
                <button className="btn-next" onClick={() => setStep(3)} disabled={!procedure.trim() || !keyMessage.trim()}>
                  Continue <span className="btn-arrow">→</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }}
              className="flex flex-col items-center w-full">
              <StepHeader stepNum={3} total={4} title="Reference" highlight="images" subtitle="Upload images to edit or use as style reference. Or skip." />
              <StepUpload files={referenceImages} setFiles={setReferenceImages} imageDescription={imageDescription} setImageDescription={setImageDescription} />
              {error && <div className="w-full max-w-[580px] mt-4 p-4 rounded-xl bg-red-500/[0.06] border border-red-500/20"><p className="text-sm text-red-400">{error}</p></div>}
              <div className="cta-row">
                <button className="btn-back" onClick={() => setStep(2)}>← Back</button>
                <button className="btn-next" onClick={handleGenerate}>
                  Generate <span className="btn-arrow">→</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: LOADING */}
          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center py-20">
              <div className="relative w-32 h-32 mb-8">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[var(--purple)] to-[var(--teal)] animate-spin opacity-20 blur-xl" style={{ animationDuration: "3s" }} />
                <div className="absolute inset-4 rounded-full bg-gradient-to-r from-[var(--purple)] to-[var(--teal)] animate-spin opacity-30 blur-lg" style={{ animationDuration: "2s", animationDirection: "reverse" }} />
                <div className="absolute inset-8 rounded-full bg-gradient-to-r from-purple-400 to-teal-400 animate-pulse opacity-50 blur-md" />
                <div className="absolute inset-[44px] rounded-full bg-white/10 backdrop-blur-sm border border-white/20" />
              </div>
              <AnimatePresence mode="wait">
                <motion.p key={loadingMsg} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="text-sm text-neutral-300 mb-4">{LOADING_MSGS[loadingMsg]}</motion.p>
              </AnimatePresence>
              <div className="w-48 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full loading-gradient rounded-full animate-loading-bar" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function Home() {
  return <Suspense><AppContent /></Suspense>;
}
