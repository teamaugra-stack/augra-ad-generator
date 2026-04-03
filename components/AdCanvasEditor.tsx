"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { AdCopyData } from "@/types/chat";

interface AdCanvasEditorProps {
  backgroundImageUrl: string;
  adCopy: AdCopyData;
  accentColor: string;
  onExport: (dataUrl: string) => void;
  onBack: () => void;
}

export default function AdCanvasEditor({
  backgroundImageUrl,
  adCopy,
  accentColor,
  onExport,
  onBack,
}: AdCanvasEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storeRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { createStore } = await import("polotno/model/store");

      if (!mounted) return;

      const store = createStore({ key: "nFA5H9elEytDyPyvKL7T", showCredit: false });
      storeRef.current = store;

      store.setSize(1080, 1080);
      const page = store.addPage();

      // Background image (locked)
      page.addElement({
        type: "image",
        src: backgroundImageUrl,
        x: 0,
        y: 0,
        width: 1080,
        height: 1080,
        selectable: false,
        locked: true,
      });

      // Headline
      if (adCopy.headline) {
        page.addElement({
          type: "text",
          x: 50,
          y: 80,
          width: 980,
          text: adCopy.headline,
          fontSize: 72,
          fontFamily: "Inter",
          fontWeight: "bold",
          fill: "#FFFFFF",
          align: "left",
        });
      }

      // Subheadline
      if (adCopy.subheadline) {
        page.addElement({
          type: "text",
          x: 50,
          y: 240,
          width: 980,
          text: adCopy.subheadline,
          fontSize: 28,
          fontFamily: "Inter",
          fill: "rgba(255,255,255,0.85)",
          align: "left",
        });
      }

      // Offer
      if (adCopy.offer) {
        page.addElement({
          type: "text",
          x: 140,
          y: 820,
          width: 800,
          text: adCopy.offer.toUpperCase(),
          fontSize: 32,
          fontFamily: "Inter",
          fontWeight: "bold",
          fill: accentColor || "#FBBF24",
          align: "center",
        });
      }

      // CTA button
      if (adCopy.cta) {
        page.addElement({
          type: "figure",
          x: 340,
          y: 900,
          width: 400,
          height: 60,
          fill: "#FFFFFF",
          cornerRadius: 30,
        });
        page.addElement({
          type: "text",
          x: 340,
          y: 916,
          width: 400,
          text: adCopy.cta.toUpperCase(),
          fontSize: 20,
          fontFamily: "Inter",
          fontWeight: "bold",
          fill: "#000000",
          align: "center",
        });
      }

      setReady(true);
    }

    init();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundImageUrl]);

  const handleExport = async () => {
    if (!storeRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await storeRef.current.toDataURL({ pixelRatio: 2 });
      onExport(dataUrl);
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] bg-[#050507]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[rgba(5,5,7,0.9)] z-10">
        <button onClick={onBack} className="text-xs text-neutral-500 hover:text-white transition-colors cursor-pointer flex items-center gap-1">
          ← Back to Result
        </button>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-neutral-600 font-mono uppercase tracking-wider">Design Editor</span>
          <button onClick={handleExport} disabled={!ready || exporting}
            className="px-6 py-2 rounded-xl text-sm font-bold cursor-pointer transition-all disabled:opacity-30"
            style={{ background: "var(--purple)", color: "white", boxShadow: "0 0 16px rgba(155,61,255,0.3)" }}>
            {exporting ? "Exporting..." : "Export PNG"}
          </button>
        </div>
      </div>

      {/* Polotno Editor */}
      <div ref={containerRef} className="flex-1 overflow-hidden">
        {ready && storeRef.current ? (
          <PolotnoEditorInner store={storeRef.current} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-neutral-500">Loading editor...</p>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PolotnoEditorInner({ store }: { store: any }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Comps, setComps] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const polotno = await import("polotno");
      const workspace = await import("polotno/canvas/workspace");
      const toolbar = await import("polotno/toolbar/toolbar");
      const zoom = await import("polotno/toolbar/zoom-buttons");
      const sidepanel = await import("polotno/side-panel");

      setComps({
        PolotnoContainer: polotno.PolotnoContainer,
        SidePanelWrap: polotno.SidePanelWrap,
        WorkspaceWrap: polotno.WorkspaceWrap,
        Workspace: workspace.Workspace,
        Toolbar: toolbar.Toolbar,
        ZoomButtons: zoom.ZoomButtons,
        SidePanel: sidepanel.SidePanel,
      });
    }
    load();
  }, []);

  if (!Comps) return <div className="flex items-center justify-center h-full"><p className="text-xs text-neutral-500">Loading components...</p></div>;

  const { PolotnoContainer, SidePanelWrap, WorkspaceWrap, Workspace, Toolbar, ZoomButtons, SidePanel } = Comps;

  return (
    <PolotnoContainer className="h-full">
      <div className="flex h-full">
        <SidePanelWrap>
          <SidePanel store={store} defaultSection="text" />
        </SidePanelWrap>
        <WorkspaceWrap>
          <Toolbar store={store} />
          <Workspace store={store} />
          <ZoomButtons store={store} />
        </WorkspaceWrap>
      </div>
    </PolotnoContainer>
  );
}
