import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { readFileSync } from "fs";
import { join } from "path";
import type { AdCopyData, AdLayout } from "@/types/chat";

// Load fonts at module level
const interBold = readFileSync(join(process.cwd(), "public", "fonts", "Inter-Bold-Static.woff"));
const interRegular = readFileSync(join(process.cwd(), "public", "fonts", "Inter-Regular-Static.woff"));
const playfairBold = readFileSync(join(process.cwd(), "public", "fonts", "Playfair-Bold.woff"));
const playfairRegular = readFileSync(join(process.cwd(), "public", "fonts", "Playfair-Regular.woff"));
const playfairItalic = readFileSync(join(process.cwd(), "public", "fonts", "Playfair-Italic.woff"));

const FONTS = [
  { name: "Inter", data: interBold, weight: 700 as const, style: "normal" as const },
  { name: "Inter", data: interRegular, weight: 400 as const, style: "normal" as const },
  { name: "Playfair", data: playfairBold, weight: 700 as const, style: "normal" as const },
  { name: "Playfair", data: playfairRegular, weight: 400 as const, style: "normal" as const },
  { name: "Playfair", data: playfairItalic, weight: 400 as const, style: "italic" as const },
];

export const FORMAT_TO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "1:1 (Instagram Square)": { width: 1024, height: 1024 },
  "4:5 (Facebook Feed)": { width: 1024, height: 1280 },
  "9:16 (Story)": { width: 1024, height: 1820 },
};

export const FORMAT_TO_SIZE: Record<string, string> = {
  "1:1 (Instagram Square)": "square_hd",
  "4:5 (Facebook Feed)": "portrait_4_3",
  "9:16 (Story)": "portrait_16_9",
};

export const DEFAULT_LAYOUT: AdLayout = {
  style: "editorial_top",
  headline_position: "top-left",
  headline_size: "3xl",
  headline_color: "#FFFFFF",
  headline_style: "uppercase",
  subheadline_color: "rgba(255,255,255,0.85)",
  cta_style: "pill_white",
  cta_position: "bottom-center",
  accent_color: "#D4A574",
  scrim_style: "top_gradient",
  decorative: "none",
};

// ===== RESPONSIVE SIZING =====
// Scale all text and padding relative to image dimensions
function scale(base: number, w: number): number {
  return Math.round(base * (w / 1024));
}

function getHeadlineSize(size: string, w: number): number {
  const bases: Record<string, number> = { xl: 32, "2xl": 40, "3xl": 50, "4xl": 64 };
  return scale(bases[size] || 50, w);
}

function getFontFamily(style: string): string {
  return style === "italic" || style === "mixed" ? "Playfair" : "Inter";
}

// ===== TRUNCATE LONG TEXT =====
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3).trim() + "...";
}

// ===== BUILD THE OVERLAY =====
function buildLayout(
  adCopy: AdCopyData,
  layout: AdLayout,
  w: number,
  h: number
): Record<string, unknown> {
  const pad = scale(44, w);
  const headFontSize = getHeadlineSize(layout.headline_size, w);
  const subFontSize = scale(17, w);
  const ctaFontSize = scale(14, w);
  const offerFontSize = scale(18, w);
  const fontFamily = getFontFamily(layout.headline_style);
  const headlineText = layout.headline_style === "uppercase"
    ? truncate(adCopy.headline.toUpperCase(), 80)
    : truncate(adCopy.headline, 80);
  const subText = truncate(adCopy.subheadline, 200);
  const fontStyle = layout.headline_style === "italic" ? "italic" : "normal";

  // Common text shadow for readability
  const headShadow = "0 2px 12px rgba(0,0,0,0.9), 0 4px 30px rgba(0,0,0,0.6)";
  const subShadow = "0 1px 8px rgba(0,0,0,0.8), 0 3px 20px rgba(0,0,0,0.5)";

  // ===== SCRIM =====
  const scrims: Record<string, string> = {
    transparency_box: "transparent", // handled per-element
    top_gradient: `linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.15) 50%, transparent 65%, transparent 75%, rgba(0,0,0,0.3) 90%, rgba(0,0,0,0.7) 100%)`,
    bottom_gradient: `linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.15) 50%, transparent 65%, transparent 80%, rgba(0,0,0,0.2) 95%, rgba(0,0,0,0.5) 100%)`,
    full_overlay: `linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.35) 35%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0.75) 100%)`,
    left_gradient: `linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.15) 55%, transparent 75%)`,
    vignette: `radial-gradient(ellipse at center, rgba(0,0,0,0.1) 20%, rgba(0,0,0,0.65) 100%)`,
    none: "transparent",
  };
  const scrimBg = scrims[layout.scrim_style] || scrims.full_overlay;

  // ===== CTA ELEMENT =====
  const ctaText = layout.headline_style === "uppercase" ? adCopy.cta.toUpperCase() : adCopy.cta;
  const ctaStyles: Record<string, Record<string, unknown>> = {
    pill_white: { background: "white", color: "#0a0a0a", borderRadius: 999, padding: `${scale(12, w)}px ${scale(36, w)}px`, fontWeight: 700, fontSize: ctaFontSize, letterSpacing: "1.5px", fontFamily: "Inter" },
    pill_dark: { background: "rgba(0,0,0,0.7)", color: "white", border: `1px solid ${layout.accent_color}`, borderRadius: 999, padding: `${scale(12, w)}px ${scale(36, w)}px`, fontWeight: 700, fontSize: ctaFontSize, letterSpacing: "1.5px", fontFamily: "Inter" },
    outline: { background: "transparent", color: "white", border: "2px solid white", borderRadius: 4, padding: `${scale(12, w)}px ${scale(36, w)}px`, fontWeight: 700, fontSize: ctaFontSize, letterSpacing: "1.5px", fontFamily: "Inter" },
    underline: { background: "transparent", color: "white", borderBottom: `2px solid ${layout.accent_color}`, padding: `${scale(8, w)}px 0`, fontWeight: 700, fontSize: ctaFontSize, letterSpacing: "1px", fontFamily: "Inter" },
    none: { display: "none" },
  };
  const ctaEl = adCopy.cta ? {
    type: "div",
    props: { style: { display: "flex", ...ctaStyles[layout.cta_style] || ctaStyles.pill_white }, children: ctaText },
  } : null;

  // ===== OFFER BADGE =====
  const offerEl = adCopy.offer ? {
    type: "div",
    props: {
      style: {
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: `${scale(10, w)}px ${scale(24, w)}px`,
        background: `${layout.accent_color}30`,
        border: `1px solid ${layout.accent_color}60`,
        borderRadius: scale(10, w),
        fontSize: offerFontSize, fontWeight: 700, color: "white",
        letterSpacing: "0.5px", fontFamily: "Inter",
        textShadow: headShadow,
      },
      children: adCopy.offer.toUpperCase(),
    },
  } : null;

  // ===== HEADLINE + SUBHEADLINE GROUP =====
  const headGroup = (align: string, maxW: string) => ({
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", alignItems: align, maxWidth: maxW, gap: scale(10, w) },
      children: [
        { type: "div", props: { style: { fontSize: headFontSize, fontWeight: 700, color: layout.headline_color, fontFamily, fontStyle, letterSpacing: layout.headline_style === "uppercase" ? "2px" : "0px", lineHeight: 1.1, textShadow: headShadow }, children: headlineText } },
        { type: "div", props: { style: { fontSize: subFontSize, fontWeight: 400, color: layout.subheadline_color, lineHeight: 1.5, fontFamily: "Inter", textShadow: subShadow }, children: subText } },
      ],
    },
  });

  // ===== CTA + OFFER GROUP =====
  const ctaGroup = (align: string) => ({
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", alignItems: align, gap: scale(14, w) },
      children: [offerEl, ctaEl].filter(Boolean),
    },
  });

  // Spacer
  const spacer = { type: "div", props: { style: { flex: 1 }, children: "" } };

  // ===== LAYOUT STYLES =====
  // Each layout positions text in genuinely different areas

  const isCenter = layout.headline_position.includes("center");
  const hAlign = isCenter ? "center" : "flex-start";
  const textAlign = isCenter ? "center" : "left";
  const ctaAlign = layout.cta_position === "bottom-left" ? "flex-start" : layout.cta_position === "bottom-right" ? "flex-end" : "center";

  let content: Record<string, unknown>;

  switch (layout.style) {
    case "bottom_heavy":
      // ALL content at the bottom — image shows through the top 60%
      content = {
        type: "div",
        props: {
          style: { display: "flex", flexDirection: "column", width: "100%", height: "100%", justifyContent: "flex-end", padding: `${pad}px`, gap: scale(16, w) },
          children: [headGroup(hAlign, "90%"), ctaGroup(ctaAlign)],
        },
      };
      break;

    case "centered_hero":
    case "full_overlay":
      // Everything dead center — works for hero statements
      content = {
        type: "div",
        props: {
          style: { display: "flex", flexDirection: "column", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", textAlign: "center", padding: `${pad}px`, gap: scale(20, w) },
          children: [headGroup("center", "85%"), ctaGroup("center")],
        },
      };
      break;

    case "split_left":
      // Text on left half only — right half shows image
      content = {
        type: "div",
        props: {
          style: { display: "flex", flexDirection: "column", width: "55%", height: "100%", justifyContent: "center", padding: `${pad}px`, gap: scale(20, w) },
          children: [headGroup("flex-start", "100%"), ctaGroup("flex-start")],
        },
      };
      break;

    case "split_right":
      // Text on right half only
      content = {
        type: "div",
        props: {
          style: { display: "flex", flexDirection: "column", width: "100%", height: "100%", alignItems: "flex-end", justifyContent: "center", padding: `${pad}px`, gap: scale(20, w) },
          children: [{
            type: "div",
            props: {
              style: { display: "flex", flexDirection: "column", width: "50%", alignItems: "flex-start", gap: scale(20, w) },
              children: [headGroup("flex-start", "100%"), ctaGroup("flex-start")],
            },
          }],
        },
      };
      break;

    case "minimal_center":
      // Just headline + CTA centered, no subheadline — ultra clean
      content = {
        type: "div",
        props: {
          style: { display: "flex", flexDirection: "column", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", textAlign: "center", padding: `${pad}px`, gap: scale(28, w) },
          children: [
            { type: "div", props: { style: { fontSize: headFontSize, fontWeight: 700, color: layout.headline_color, fontFamily, fontStyle, letterSpacing: layout.headline_style === "uppercase" ? "2px" : "0px", lineHeight: 1.1, textShadow: headShadow, maxWidth: "80%" }, children: headlineText } },
            ctaEl,
          ].filter(Boolean),
        },
      };
      break;

    case "editorial_top":
    default:
      // Headline at top, CTA at bottom — classic editorial
      content = {
        type: "div",
        props: {
          style: { display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: `${pad}px`, textAlign },
          children: [
            headGroup(hAlign, "85%"),
            spacer,
            ctaGroup(ctaAlign),
          ],
        },
      };
      break;
  }

  // ===== DECORATIVE ELEMENTS =====
  const decoratives: Record<string, unknown>[] = [];

  if (layout.decorative === "border_frame") {
    decoratives.push({
      type: "div",
      props: {
        style: { position: "absolute", top: scale(24, w), left: scale(24, w), right: scale(24, w), bottom: scale(24, w), border: `1px solid ${layout.accent_color}40`, borderRadius: 4 },
        children: "",
      },
    });
  }

  if (layout.decorative === "corner_marks") {
    const s = scale(24, w);
    const cs = scale(20, w);
    const positions = [
      { top: s, left: s, borderTop: `2px solid ${layout.accent_color}`, borderLeft: `2px solid ${layout.accent_color}` },
      { top: s, right: s, borderTop: `2px solid ${layout.accent_color}`, borderRight: `2px solid ${layout.accent_color}` },
      { bottom: s, left: s, borderBottom: `2px solid ${layout.accent_color}`, borderLeft: `2px solid ${layout.accent_color}` },
      { bottom: s, right: s, borderBottom: `2px solid ${layout.accent_color}`, borderRight: `2px solid ${layout.accent_color}` },
    ];
    positions.forEach((pos) => {
      decoratives.push({ type: "div", props: { style: { position: "absolute", width: cs, height: cs, ...pos }, children: "" } });
    });
  }

  if (layout.decorative === "line_accent") {
    decoratives.push({
      type: "div",
      props: { style: { position: "absolute", top: pad, left: pad, width: scale(50, w), height: 3, background: layout.accent_color, borderRadius: 2 }, children: "" },
    });
  }

  // ===== ROOT =====
  return {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", width: "100%", height: "100%", position: "relative" },
      children: [
        // Scrim layer
        { type: "div", props: { style: { position: "absolute", top: 0, left: 0, width: w, height: h, background: scrimBg }, children: "" } },
        // Content layer
        content,
        // Decoratives
        ...decoratives,
      ],
    },
  };
}

// ===== Public API =====

export async function renderTextOverlay(
  adCopy: AdCopyData,
  layout: AdLayout,
  dimensions: { width: number; height: number }
): Promise<Buffer> {
  const { width, height } = dimensions;
  const element = buildLayout(adCopy, layout, width, height);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svg = await satori(element as any, { width, height, fonts: FONTS });
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width" as const, value: width },
    background: "rgba(0,0,0,0)",
  });
  return Buffer.from(resvg.render().asPng());
}

export async function compositeAdImage(
  bgSource: string,
  adCopy: AdCopyData,
  layout: AdLayout,
  outputFormat: string
): Promise<{ composited: string; bgUrl: string }> {
  const dimensions = FORMAT_TO_DIMENSIONS[outputFormat] || { width: 1024, height: 1024 };

  const textPng = await renderTextOverlay(adCopy, layout, dimensions);

  const bgResponse = await fetch(bgSource);
  const bgBuffer = Buffer.from(await bgResponse.arrayBuffer());

  const result = await sharp(bgBuffer)
    .resize(dimensions.width, dimensions.height, { fit: "cover" })
    .composite([{ input: textPng, top: 0, left: 0, blend: "over" }])
    .png()
    .toBuffer();

  return {
    composited: `data:image/png;base64,${result.toString("base64")}`,
    bgUrl: bgSource,
  };
}
