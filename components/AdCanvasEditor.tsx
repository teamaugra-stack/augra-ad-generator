"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import type { AdCopyData } from "@/types/chat";

// Fabric.js types
interface FabricCanvas {
  dispose: () => void;
  setBackgroundImage: (url: string, callback: () => void, options?: Record<string, unknown>) => void;
  renderAll: () => void;
  toDataURL: (options?: { format?: string; quality?: number; multiplier?: number }) => string;
  getActiveObject: () => FabricObject | null;
  on: (event: string, handler: (e: unknown) => void) => void;
  add: (...objects: FabricObject[]) => void;
  getObjects: () => FabricObject[];
  setDimensions: (dims: { width: number; height: number }) => void;
}

interface FabricObject {
  set: (props: Record<string, unknown>) => FabricObject;
  get: (prop: string) => unknown;
  name?: string;
  type?: string;
  text?: string;
}

interface AdCanvasEditorProps {
  backgroundImageUrl: string;
  adCopy: AdCopyData;
  accentColor: string;
  onExport: (dataUrl: string) => void;
  onBack: () => void;
}

const FONTS = [
  "Inter", "Playfair Display", "Arial", "Helvetica", "Georgia",
  "Bebas Neue", "Montserrat", "Oswald", "Roboto", "Lato",
];

const COLORS = [
  "#FFFFFF", "#000000", "#F5F5F5", "#1a1a1a",
  "#9b3dff", "#0ef0c0", "#FF6B6B", "#4ECDC4",
  "#FFD93D", "#FF8C42", "#C8553D", "#2C3E50",
  "#D4A574", "#B76E79", "#5BA4CF", "#C9A96E",
];

export default function AdCanvasEditor({
  backgroundImageUrl,
  adCopy,
  accentColor,
  onExport,
  onBack,
}: AdCanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const [activeObject, setActiveObject] = useState<FabricObject | null>(null);
  const [activeFontSize, setActiveFontSize] = useState(48);
  const [activeColor, setActiveColor] = useState("#FFFFFF");
  const [activeFont, setActiveFont] = useState("Inter");
  const [canvasReady, setCanvasReady] = useState(false);

  // Initialize Fabric canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    let canvas: FabricCanvas;

    import("fabric").then((fabricModule) => {
      const fabric = fabricModule;

      // Determine canvas size based on container
      const containerWidth = Math.min(window.innerWidth - 340, 800);
      const containerHeight = window.innerHeight - 140;

      canvas = new fabric.Canvas(canvasRef.current!, {
        width: containerWidth,
        height: containerHeight,
        backgroundColor: "#000",
        selection: true,
      }) as unknown as FabricCanvas;

      fabricRef.current = canvas;

      // Load background image
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const fabricImg = new fabric.FabricImage(img);
        const scale = Math.min(
          containerWidth / img.width,
          containerHeight / img.height
        );
        fabricImg.set({
          scaleX: scale,
          scaleY: scale,
          left: (containerWidth - img.width * scale) / 2,
          top: (containerHeight - img.height * scale) / 2,
          selectable: false,
          evented: false,
          name: "background",
        });
        canvas.add(fabricImg as unknown as FabricObject);
        canvas.renderAll();

        // Add text elements
        addTextElements(fabric, canvas, containerWidth, containerHeight);
        setCanvasReady(true);
      };
      img.src = backgroundImageUrl;

      // Track active object
      canvas.on("selection:created", (e: unknown) => {
        const evt = e as { selected?: FabricObject[] };
        const obj = evt.selected?.[0];
        if (obj) updateActiveObjectState(obj);
      });
      canvas.on("selection:updated", (e: unknown) => {
        const evt = e as { selected?: FabricObject[] };
        const obj = evt.selected?.[0];
        if (obj) updateActiveObjectState(obj);
      });
      canvas.on("selection:cleared", () => {
        setActiveObject(null);
      });
    });

    return () => {
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundImageUrl]);

  const updateActiveObjectState = (obj: FabricObject) => {
    setActiveObject(obj);
    setActiveFontSize(Number(obj.get("fontSize")) || 48);
    setActiveColor(String(obj.get("fill")) || "#FFFFFF");
    setActiveFont(String(obj.get("fontFamily")) || "Inter");
  };

  const addTextElements = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fabric: any, canvas: FabricCanvas, w: number, h: number) => {
      const pad = 40;

      // Headline
      if (adCopy.headline) {
        const headline = new fabric.Textbox(adCopy.headline, {
          left: pad,
          top: h * 0.15,
          width: w - pad * 2,
          fontSize: Math.round(w * 0.05),
          fontFamily: "Inter",
          fontWeight: "bold",
          fill: "#FFFFFF",
          textAlign: "left",
          shadow: new fabric.Shadow({ color: "rgba(0,0,0,0.8)", blur: 10, offsetX: 0, offsetY: 2 }),
          name: "headline",
        });
        canvas.add(headline as unknown as FabricObject);
      }

      // Subheadline
      if (adCopy.subheadline) {
        const sub = new fabric.Textbox(adCopy.subheadline, {
          left: pad,
          top: h * 0.35,
          width: w - pad * 2,
          fontSize: Math.round(w * 0.025),
          fontFamily: "Inter",
          fontWeight: "normal",
          fill: "rgba(255,255,255,0.85)",
          textAlign: "left",
          shadow: new fabric.Shadow({ color: "rgba(0,0,0,0.7)", blur: 6, offsetX: 0, offsetY: 1 }),
          name: "subheadline",
        });
        canvas.add(sub as unknown as FabricObject);
      }

      // Offer badge
      if (adCopy.offer) {
        const offer = new fabric.Textbox(adCopy.offer.toUpperCase(), {
          left: pad,
          top: h * 0.75,
          width: w - pad * 2,
          fontSize: Math.round(w * 0.028),
          fontFamily: "Inter",
          fontWeight: "bold",
          fill: accentColor || "#FBBF24",
          textAlign: "center",
          shadow: new fabric.Shadow({ color: "rgba(0,0,0,0.8)", blur: 8, offsetX: 0, offsetY: 2 }),
          name: "offer",
        });
        canvas.add(offer as unknown as FabricObject);
      }

      // CTA
      if (adCopy.cta) {
        const cta = new fabric.Textbox(adCopy.cta.toUpperCase(), {
          left: w / 2 - 100,
          top: h * 0.85,
          width: 200,
          fontSize: Math.round(w * 0.02),
          fontFamily: "Inter",
          fontWeight: "bold",
          fill: "#000000",
          textAlign: "center",
          backgroundColor: "#FFFFFF",
          padding: 14,
          name: "cta",
        });
        canvas.add(cta as unknown as FabricObject);
      }

      canvas.renderAll();
    },
    [adCopy, accentColor]
  );

  // Update active object properties
  const updateProp = (prop: string, value: unknown) => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (!obj || !canvas) return;
    obj.set({ [prop]: value });
    canvas.renderAll();

    if (prop === "fontSize") setActiveFontSize(Number(value));
    if (prop === "fill") setActiveColor(String(value));
    if (prop === "fontFamily") setActiveFont(String(value));
  };

  const handleExport = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Export at higher resolution
    const dataUrl = canvas.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 2,
    });
    onExport(dataUrl);
  };

  return (
    <div className="flex h-[calc(100vh-60px)] bg-[#050507]">
      {/* Canvas Area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <canvas ref={canvasRef} />
        </motion.div>
      </div>

      {/* Sidebar Controls */}
      <div className="w-[300px] border-l border-white/[0.06] bg-[rgba(5,5,7,0.9)] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <button onClick={onBack} className="text-xs text-neutral-500 hover:text-white transition-colors cursor-pointer">
              ← Back
            </button>
            <span className="text-[10px] text-neutral-600 font-mono uppercase tracking-wider">Canvas Editor</span>
          </div>
          <button
            onClick={handleExport}
            disabled={!canvasReady}
            className="w-full py-3 rounded-xl text-sm font-bold cursor-pointer transition-all"
            style={{ background: "var(--purple)", color: "white", boxShadow: "0 0 20px rgba(155,61,255,0.3)" }}
          >
            Export PNG
          </button>
        </div>

        {/* Text Properties (show when text selected) */}
        {activeObject && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 space-y-4"
          >
            <div>
              <label className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-2">
                Element: {String(activeObject.name || "Object")}
              </label>
            </div>

            {/* Font Family */}
            <div>
              <label className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-2">Font</label>
              <select
                value={activeFont}
                onChange={(e) => updateProp("fontFamily", e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white appearance-none cursor-pointer"
              >
                {FONTS.map((f) => (
                  <option key={f} value={f} style={{ background: "#0a0a1a" }}>{f}</option>
                ))}
              </select>
            </div>

            {/* Font Size */}
            <div>
              <label className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-2">
                Size: {activeFontSize}px
              </label>
              <input
                type="range"
                min={10}
                max={120}
                value={activeFontSize}
                onChange={(e) => updateProp("fontSize", Number(e.target.value))}
                className="w-full accent-purple-500"
              />
            </div>

            {/* Text Color */}
            <div>
              <label className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-2">Color</label>
              <div className="grid grid-cols-8 gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => updateProp("fill", c)}
                    className={`w-7 h-7 rounded-md border cursor-pointer transition-all ${
                      activeColor === c ? "border-white scale-110 shadow-lg" : "border-white/10 hover:border-white/30"
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              {/* Custom color */}
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={activeColor}
                  onChange={(e) => updateProp("fill", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="text-xs text-neutral-500 font-mono">{activeColor}</span>
              </div>
            </div>

            {/* Text Alignment */}
            <div>
              <label className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-2">Align</label>
              <div className="flex gap-1">
                {["left", "center", "right"].map((align) => (
                  <button
                    key={align}
                    onClick={() => updateProp("textAlign", align)}
                    className="flex-1 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-400 hover:text-white hover:bg-[var(--purple-dim)] hover:border-[var(--purple-border)] transition-all cursor-pointer capitalize"
                  >
                    {align}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Weight */}
            <div>
              <label className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-2">Weight</label>
              <div className="flex gap-1">
                {[
                  { label: "Light", value: "300" },
                  { label: "Normal", value: "normal" },
                  { label: "Bold", value: "bold" },
                ].map((w) => (
                  <button
                    key={w.value}
                    onClick={() => updateProp("fontWeight", w.value)}
                    className="flex-1 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-400 hover:text-white hover:bg-[var(--purple-dim)] transition-all cursor-pointer"
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* No selection hint */}
        {!activeObject && canvasReady && (
          <div className="p-4 text-center">
            <p className="text-xs text-neutral-600 mt-4">Click a text element on the canvas to edit it</p>
            <p className="text-[10px] text-neutral-700 mt-2">Drag to move, handles to resize</p>
          </div>
        )}

        {/* Add Element */}
        {canvasReady && (
          <div className="p-4 border-t border-white/[0.06]">
            <label className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-2">Add Element</label>
            <button
              onClick={() => {
                import("fabric").then((fabric) => {
                  const canvas = fabricRef.current;
                  if (!canvas) return;
                  const text = new fabric.Textbox("New Text", {
                    left: 100,
                    top: 100,
                    width: 300,
                    fontSize: 32,
                    fontFamily: "Inter",
                    fill: "#FFFFFF",
                    shadow: new fabric.Shadow({ color: "rgba(0,0,0,0.8)", blur: 8, offsetX: 0, offsetY: 2 }),
                    name: "custom",
                  });
                  canvas.add(text as unknown as FabricObject);
                  canvas.renderAll();
                });
              }}
              className="w-full py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-400 hover:text-white hover:bg-[var(--purple-dim)] hover:border-[var(--purple-border)] transition-all cursor-pointer"
            >
              + Add Text
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
