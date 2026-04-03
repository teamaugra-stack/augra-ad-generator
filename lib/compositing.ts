import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { readFileSync } from "fs";
import { join } from "path";
import type { AdCopyData, AdLayout } from "@/types/chat";

// Load fonts at module level
const interBold = readFileSync(
  join(process.cwd(), "public", "fonts", "Inter-Bold-Static.woff")
);
const interRegular = readFileSync(
  join(process.cwd(), "public", "fonts", "Inter-Regular-Static.woff")
);
const playfairBold = readFileSync(
  join(process.cwd(), "public", "fonts", "Playfair-Bold.woff")
);
const playfairRegular = readFileSync(
  join(process.cwd(), "public", "fonts", "Playfair-Regular.woff")
);
const playfairItalic = readFileSync(
  join(process.cwd(), "public", "fonts", "Playfair-Italic.woff")
);

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

// Default layout for fallback
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

// ===== Size maps =====
const HEADLINE_SIZES = { xl: 36, "2xl": 44, "3xl": 56, "4xl": 72 };

function getFontFamily(style: string): string {
  if (style === "italic") return "Playfair";
  // Use Playfair for mixed case (editorial feel), Inter for uppercase (modern/bold)
  if (style === "mixed") return "Playfair";
  return "Inter";
}

// ===== Scrim builders =====
function buildScrim(
  layout: AdLayout,
  w: number,
  h: number
): Record<string, unknown> | null {
  const scrims: Record<string, string> = {
    top_gradient:
      "linear-gradient(180deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.1) 55%, transparent 70%)",
    bottom_gradient:
      "linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.1) 55%, transparent 70%)",
    full_overlay:
      "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.8) 100%)",
    left_gradient:
      "linear-gradient(90deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.1) 55%, transparent 75%)",
    vignette:
      "radial-gradient(ellipse at center, rgba(0,0,0,0.15) 20%, rgba(0,0,0,0.75) 100%)",
    none: "transparent",
  };

  const bg = scrims[layout.scrim_style] || scrims.full_overlay;
  return {
    type: "div",
    props: {
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        width: w,
        height: h,
        background: bg,
      },
      children: "",
    },
  };
}

// ===== CTA builders =====
function buildCTA(
  cta: string,
  layout: AdLayout
): Record<string, unknown> {
  const text = layout.headline_style === "uppercase" ? cta.toUpperCase() : cta;

  if (layout.cta_style === "pill_dark") {
    return {
      type: "div",
      props: {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "14px 48px",
          background: "rgba(0,0,0,0.8)",
          borderRadius: 999,
          border: `1px solid ${layout.accent_color}`,
        },
        children: {
          type: "div",
          props: {
            style: { fontSize: 16, fontWeight: 700, color: "white", letterSpacing: "2px", fontFamily: "Inter" },
            children: text,
          },
        },
      },
    };
  }

  if (layout.cta_style === "outline") {
    return {
      type: "div",
      props: {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "14px 48px",
          border: "2px solid white",
          borderRadius: 4,
        },
        children: {
          type: "div",
          props: {
            style: { fontSize: 16, fontWeight: 700, color: "white", letterSpacing: "2px", fontFamily: "Inter" },
            children: text,
          },
        },
      },
    };
  }

  if (layout.cta_style === "underline") {
    return {
      type: "div",
      props: {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: `2px solid ${layout.accent_color}`,
          paddingBottom: 4,
        },
        children: [
          {
            type: "div",
            props: {
              style: { fontSize: 16, fontWeight: 700, color: "white", letterSpacing: "1px", fontFamily: "Inter" },
              children: text,
            },
          },
          {
            type: "div",
            props: {
              style: { fontSize: 16, color: layout.accent_color },
              children: "→",
            },
          },
        ],
      },
    };
  }

  // Default: pill_white
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "14px 48px",
        background: "white",
        borderRadius: 999,
      },
      children: {
        type: "div",
        props: {
          style: { fontSize: 16, fontWeight: 700, color: "#0a0a0a", letterSpacing: "2px", fontFamily: "Inter" },
          children: text,
        },
      },
    },
  };
}

// ===== Decorative elements =====
function buildDecorative(
  layout: AdLayout,
  w: number,
  h: number
): Record<string, unknown> | null {
  if (layout.decorative === "none") return null;

  if (layout.decorative === "line_accent") {
    return {
      type: "div",
      props: {
        style: {
          width: 60,
          height: 3,
          background: layout.accent_color,
          borderRadius: 2,
          marginBottom: 16,
        },
        children: "",
      },
    };
  }

  if (layout.decorative === "border_frame") {
    return {
      type: "div",
      props: {
        style: {
          position: "absolute",
          top: 30,
          left: 30,
          width: w - 60,
          height: h - 60,
          border: `1px solid ${layout.accent_color}40`,
          borderRadius: 4,
        },
        children: "",
      },
    };
  }

  if (layout.decorative === "corner_marks") {
    const markStyle = {
      position: "absolute" as const,
      width: 30,
      height: 30,
    };
    return {
      type: "div",
      props: {
        style: { position: "absolute", top: 0, left: 0, width: w, height: h },
        children: [
          { type: "div", props: { style: { ...markStyle, top: 25, left: 25, borderTop: `2px solid ${layout.accent_color}`, borderLeft: `2px solid ${layout.accent_color}` }, children: "" } },
          { type: "div", props: { style: { ...markStyle, top: 25, right: 25, borderTop: `2px solid ${layout.accent_color}`, borderRight: `2px solid ${layout.accent_color}` }, children: "" } },
          { type: "div", props: { style: { ...markStyle, bottom: 25, left: 25, borderBottom: `2px solid ${layout.accent_color}`, borderLeft: `2px solid ${layout.accent_color}` }, children: "" } },
          { type: "div", props: { style: { ...markStyle, bottom: 25, right: 25, borderBottom: `2px solid ${layout.accent_color}`, borderRight: `2px solid ${layout.accent_color}` }, children: "" } },
        ],
      },
    };
  }

  return null;
}

// ===== Offer badge =====
function buildOfferBadge(
  offer: string,
  layout: AdLayout
): Record<string, unknown> | null {
  if (!offer) return null;
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "14px 28px",
        background: `${layout.accent_color}25`,
        border: `1px solid ${layout.accent_color}50`,
        borderRadius: 12,
        marginBottom: 20,
      },
      children: {
        type: "div",
        props: {
          style: {
            fontSize: 22,
            fontWeight: 700,
            color: "white",
            letterSpacing: "1px",
            textAlign: "center",
            fontFamily: "Inter",
          },
          children: offer.toUpperCase(),
        },
      },
    },
  };
}

// ===== Main layout builder =====
function buildLayout(
  adCopy: AdCopyData,
  layout: AdLayout,
  w: number,
  h: number
): Record<string, unknown> {
  const fontSize = HEADLINE_SIZES[layout.headline_size] || 56;
  const fontFamily = getFontFamily(layout.headline_style);
  const headlineText =
    layout.headline_style === "uppercase"
      ? adCopy.headline.toUpperCase()
      : adCopy.headline;
  const fontStyle = layout.headline_style === "italic" ? "italic" : "normal";

  const padding = 50;

  // Build headline element
  const headlineEl = {
    type: "div",
    props: {
      style: {
        fontSize,
        fontWeight: 700,
        color: layout.headline_color,
        fontFamily,
        fontStyle,
        letterSpacing: layout.headline_style === "uppercase" ? "2px" : "0px",
        lineHeight: 1.15,
        textShadow: "0 2px 8px rgba(0,0,0,0.8), 0 4px 24px rgba(0,0,0,0.5)",
        maxWidth: layout.style === "split_left" || layout.style === "split_right" ? "50%" : "90%",
      },
      children: headlineText,
    },
  };

  // Build subheadline
  const subEl = {
    type: "div",
    props: {
      style: {
        fontSize: 19,
        fontWeight: 400,
        color: layout.subheadline_color,
        marginTop: 14,
        lineHeight: 1.55,
        fontFamily: "Inter",
        textShadow: "0 2px 6px rgba(0,0,0,0.7), 0 4px 20px rgba(0,0,0,0.4)",
        maxWidth: layout.style === "split_left" || layout.style === "split_right" ? "50%" : "85%",
      },
      children: adCopy.subheadline,
    },
  };

  const lineAccent = buildDecorative(layout, w, h);
  const offerBadge = buildOfferBadge(adCopy.offer, layout);
  const ctaEl = buildCTA(adCopy.cta, layout);

  // Determine CTA alignment
  const ctaAlign =
    layout.cta_position === "bottom-left"
      ? "flex-start"
      : layout.cta_position === "bottom-right"
        ? "flex-end"
        : "center";

  // Build layout based on style
  const children: (Record<string, unknown> | null)[] = [];

  if (layout.style === "editorial_top" || layout.style === "split_left") {
    // Text at top, CTA at bottom
    const textAlign = layout.headline_position.includes("center") ? "center" : "flex-start";
    children.push({
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: textAlign,
          padding: `${padding + 10}px ${padding}px`,
          width: layout.style === "split_left" ? "55%" : "100%",
        },
        children: [
          layout.decorative === "line_accent" ? lineAccent : null,
          headlineEl,
          subEl,
        ].filter(Boolean),
      },
    });
    children.push({ type: "div", props: { style: { flex: 1 }, children: "" } });
    children.push({
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: ctaAlign,
          padding: `0 ${padding}px ${padding + 10}px`,
          width: "100%",
          gap: 12,
        },
        children: [offerBadge, ctaEl].filter(Boolean),
      },
    });
  } else if (layout.style === "bottom_heavy") {
    // Everything at bottom
    children.push({ type: "div", props: { style: { flex: 1 }, children: "" } });
    children.push({
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: layout.headline_position.includes("center") ? "center" : "flex-start",
          padding: `0 ${padding}px ${padding + 10}px`,
          width: "100%",
          gap: 8,
        },
        children: [
          layout.decorative === "line_accent" ? lineAccent : null,
          headlineEl,
          subEl,
          { type: "div", props: { style: { height: 16 }, children: "" } },
          offerBadge,
          { type: "div", props: { style: { alignSelf: ctaAlign }, children: ctaEl } },
        ].filter(Boolean),
      },
    });
  } else if (layout.style === "centered_hero" || layout.style === "full_overlay") {
    // Everything centered
    children.push({ type: "div", props: { style: { flex: 1 }, children: "" } });
    children.push({
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: `0 ${padding}px`,
          width: "100%",
          gap: 8,
        },
        children: [
          layout.decorative === "line_accent" ? lineAccent : null,
          headlineEl,
          subEl,
          { type: "div", props: { style: { height: 20 }, children: "" } },
          offerBadge,
          ctaEl,
        ].filter(Boolean),
      },
    });
    children.push({ type: "div", props: { style: { flex: 1 }, children: "" } });
  } else if (layout.style === "minimal_center") {
    // Minimal: just headline + CTA centered
    children.push({ type: "div", props: { style: { flex: 1 }, children: "" } });
    children.push({
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: `0 ${padding}px`,
          gap: 24,
        },
        children: [headlineEl, ctaEl].filter(Boolean),
      },
    });
    children.push({ type: "div", props: { style: { flex: 1 }, children: "" } });
  } else {
    // Default fallback: editorial_top
    children.push({
      type: "div",
      props: {
        style: { display: "flex", flexDirection: "column", padding: `${padding}px`, width: "100%" },
        children: [headlineEl, subEl],
      },
    });
    children.push({ type: "div", props: { style: { flex: 1 }, children: "" } });
    children.push({
      type: "div",
      props: {
        style: { display: "flex", flexDirection: "column", alignItems: ctaAlign, padding: `0 ${padding}px ${padding}px`, gap: 12 },
        children: [offerBadge, ctaEl].filter(Boolean),
      },
    });
  }

  // Root element
  const rootChildren: (Record<string, unknown> | null)[] = [
    buildScrim(layout, w, h),
    ...children,
  ];

  // Add absolute-positioned decoratives
  // Add frame/corner decoratives (absolute positioned)
  if (layout.decorative === "border_frame" || layout.decorative === "corner_marks") {
    const frameDecor = buildDecorative(layout, w, h);
    if (frameDecor) rootChildren.push(frameDecor);
  }

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        position: "relative",
      },
      children: rootChildren.filter(Boolean),
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

  // Render text overlay
  const textPng = await renderTextOverlay(adCopy, layout, dimensions);

  // Fetch background image
  const bgResponse = await fetch(bgSource);
  const bgBuffer = Buffer.from(await bgResponse.arrayBuffer());

  // Composite
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
