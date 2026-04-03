import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as fal from "@fal-ai/serverless-client";
import sharp from "sharp";
import { readFileSync } from "fs";
import { join } from "path";

fal.config({
  credentials: process.env.FAL_KEY,
});

const SYSTEM_PROMPT = `You are an elite AI art director and medical advertising specialist. You create high-converting static ad creatives for medical and aesthetic practices.

Your job: receive client inputs and produce TWO things:
1. An image generation prompt for the ad BACKGROUND (no text in the image)
2. Ad copy text that will be overlaid on the image

You must respond with ONLY a valid JSON object in this exact format — no markdown, no code fences, no explanation:

{"image_prompt":"...","headline":"...","subheadline":"...","cta":"...","offer":"..."}

FIELD RULES:
- image_prompt: 80-180 word prompt for generating the background image. Must produce a premium ad background with space for text overlay. NO text/typography in the image.
- headline: The main headline, 2-8 words. Bold, attention-grabbing. e.g. "Your Mommy Makeover Starts Here", "#BeastMode", "Precision Body Sculpting."
- subheadline: Supporting text, 5-20 words. e.g. "Board-certified plastic surgeon with 25+ years of experience", "Laser-assisted contouring guided by expertise"
- cta: Call to action, 2-4 words. e.g. "Book Now", "Learn More", "Free Consultation", "Schedule Today"
- offer: Optional promotional text. Leave empty string if no offer mentioned. e.g. "$1,500 Off Liposuction", "Limited to 50 Patients", "$37 Special Voucher"

IMAGE PROMPT GUIDELINES BY CATEGORY:

PLASTIC SURGERY — Editorial beauty shot or confident surgeon portrait. Warm creams, dusty rose, soft gold tones. Leave top third and bottom quarter empty for text.

MED SPA / AESTHETICS — Treatment scene (gloved hands, device on skin) or luxury clinic environment. Pink/rose gold accents. Premium self-care feel.

COSMETIC DENTISTRY — Perfect smile close-up with soft lighting, or 3D dental illustration. Bright, clean whites and soft blue accents.

CHIROPRACTIC — Pain visualization (person touching neck/back with warm red glow) or active wellness scene. Clean whites, warm neutrals.

MEN'S HEALTH / TRT — Dark, powerful, masculine. Athletic male figure, gym setting, dramatic low-key lighting, smoke/haze. Charcoal and steel tones.

WEIGHT LOSS — Lifestyle energy. Healthy meal prep flat lay, active person, or confident athleisure scene. Bright, optimistic.

PEPTIDE / ANTI-AGING — Modern clinical luxury. IV drips, elegant vials on marble, lab-meets-lounge. Teal, slate, brushed metal.

OFFER / PROMOTION — Editorial still life. Treatment products arranged artfully. Maximum negative space. No people. Premium feel.

AUTHORITY / DOCTOR — Doctor mid-shot, warm side light, premium clinic background. Tailored white coat, calm confidence.

PRACTICE BRANDING — Environment as hero. Luxury empty clinic spaces. 5-star private club aesthetic.

FORMAT RULES FOR IMAGE PROMPT:
1:1 — Balanced composition. Append: "square format, 1:1 aspect ratio"
4:5 — Subject lower two-thirds, space above. Append: "portrait format, 4:5 aspect ratio"
9:16 — Subject middle third only, empty top/bottom. Append: "vertical story format, 9:16 aspect ratio"

Always end image_prompt with: "Photorealistic, ultra high resolution, commercial advertising photography, no text or typography or words or letters, no watermarks, no logos."

REFERENCE IMAGE: If the user describes a reference image, adapt its visual style into your image_prompt.

AD COPY GUIDELINES:
- Match the tone to the category (premium for surgery, bold for TRT, warm for wellness)
- Headline should be the hook — what stops the scroll
- Use the client's key message to inform the copy
- If they mention an offer/discount, put it in the offer field
- Keep it punchy and conversion-focused`;

const FORMAT_TO_SIZE: Record<string, string> = {
  "1:1 (Instagram Square)": "square_hd",
  "4:5 (Facebook Feed)": "portrait_4_3",
  "9:16 (Story)": "portrait_16_9",
};

const FORMAT_TO_DIMENSIONS: Record<string, { width: number; height: number }> =
  {
    "1:1 (Instagram Square)": { width: 1024, height: 1024 },
    "4:5 (Facebook Feed)": { width: 1024, height: 1280 },
    "9:16 (Story)": { width: 1024, height: 1820 },
  };

interface FalResult {
  images: { url: string }[];
}

interface AdCopy {
  image_prompt: string;
  headline: string;
  subheadline: string;
  cta: string;
  offer: string;
}

export const maxDuration = 60;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(
  text: string,
  maxCharsPerLine: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if ((current + " " + word).trim().length > maxCharsPerLine) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

// Load and cache font as base64 for SVG embedding
let fontBase64Cache: string | null = null;
function getFontBase64(): string {
  if (fontBase64Cache) return fontBase64Cache;
  try {
    const fontPath = join(process.cwd(), "public", "fonts", "Inter-Variable.ttf");
    const fontBuffer = readFileSync(fontPath);
    fontBase64Cache = fontBuffer.toString("base64");
    return fontBase64Cache;
  } catch {
    return ""; // Fallback: will use system fonts
  }
}

async function compositeTextOnImage(
  imageUrl: string,
  adCopy: AdCopy,
  dimensions: { width: number; height: number }
): Promise<Buffer> {
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  const { width, height } = dimensions;
  const isStory = height > width * 1.5;
  const isPortrait = height > width;

  const headlineFontSize = isStory ? 52 : isPortrait ? 48 : 44;
  const subFontSize = isStory ? 22 : 20;
  const ctaFontSize = 18;
  const offerFontSize = isStory ? 28 : 24;

  const padding = 60;
  const headlineY = isStory ? height * 0.14 : height * 0.1;
  const ctaY = height - (isStory ? 180 : 140);

  const headlineChars = isStory ? 18 : 22;
  const headlineLines = wrapText(adCopy.headline.toUpperCase(), headlineChars);
  const subLines = wrapText(adCopy.subheadline, isStory ? 28 : 34);

  const fontB64 = getFontBase64();
  const fontFamily = fontB64 ? "Inter" : "Arial, Helvetica, sans-serif";

  const svgParts: string[] = [];

  // Embed font via @font-face if available
  if (fontB64) {
    svgParts.push(`
      <defs>
        <style>
          @font-face {
            font-family: 'Inter';
            src: url('data:font/ttf;base64,${fontB64}') format('truetype');
            font-weight: 100 900;
            font-style: normal;
          }
        </style>
        <linearGradient id="topGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="black" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="black" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="bottomGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="black" stop-opacity="0"/>
          <stop offset="100%" stop-color="black" stop-opacity="0.85"/>
        </linearGradient>
      </defs>
    `);
  } else {
    svgParts.push(`
      <defs>
        <linearGradient id="topGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="black" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="black" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="bottomGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="black" stop-opacity="0"/>
          <stop offset="100%" stop-color="black" stop-opacity="0.85"/>
        </linearGradient>
      </defs>
    `);
  }

  // Gradient scrims
  svgParts.push(`
    <rect x="0" y="0" width="${width}" height="${height * 0.45}" fill="url(#topGrad)"/>
    <rect x="0" y="${height * 0.55}" width="${width}" height="${height * 0.45}" fill="url(#bottomGrad)"/>
  `);

  // Headline
  headlineLines.forEach((line, i) => {
    const y = headlineY + i * (headlineFontSize * 1.3);
    svgParts.push(`
      <text x="${padding}" y="${y}" font-family="${fontFamily}" font-size="${headlineFontSize}" font-weight="800" fill="white" letter-spacing="1.5">${escapeXml(line)}</text>
    `);
  });

  // Subheadline
  const subStartY = headlineY + headlineLines.length * (headlineFontSize * 1.3) + 16;
  subLines.forEach((line, i) => {
    const y = subStartY + i * (subFontSize * 1.6);
    svgParts.push(`
      <text x="${padding}" y="${y}" font-family="${fontFamily}" font-size="${subFontSize}" font-weight="400" fill="rgba(255,255,255,0.9)">${escapeXml(line)}</text>
    `);
  });

  // Offer badge
  if (adCopy.offer) {
    const offerLines = wrapText(adCopy.offer.toUpperCase(), 25);
    const badgeHeight = offerLines.length * (offerFontSize * 1.4) + 30;
    const badgeY = ctaY - badgeHeight - 25;
    svgParts.push(`
      <rect x="${padding}" y="${badgeY}" width="${width - padding * 2}" height="${badgeHeight}" rx="12" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
    `);
    offerLines.forEach((line, i) => {
      svgParts.push(`
        <text x="${width / 2}" y="${badgeY + 30 + i * (offerFontSize * 1.4)}" font-family="${fontFamily}" font-size="${offerFontSize}" font-weight="700" fill="white" text-anchor="middle" letter-spacing="1">${escapeXml(line)}</text>
      `);
    });
  }

  // CTA button
  const ctaText = adCopy.cta.toUpperCase();
  const ctaWidth = Math.max(ctaText.length * ctaFontSize * 0.7 + 60, 220);
  const ctaX = (width - ctaWidth) / 2;
  svgParts.push(`
    <rect x="${ctaX}" y="${ctaY}" width="${ctaWidth}" height="50" rx="25" fill="white"/>
    <text x="${width / 2}" y="${ctaY + 33}" font-family="${fontFamily}" font-size="${ctaFontSize}" font-weight="700" fill="black" text-anchor="middle" letter-spacing="2">${escapeXml(ctaText)}</text>
  `);

  const svgOverlay = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgParts.join("")}</svg>`;

  const result = await sharp(imageBuffer)
    .resize(width, height, { fit: "cover" })
    .composite([
      {
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const {
      adType,
      procedure,
      keyMessage,
      outputFormat,
      brandAssetNote,
      referenceImageDescription,
      referenceImageBase64,
    } = await request.json();

    if (!adType || !procedure || !keyMessage || !outputFormat) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    // Build user message
    let userMessage = `Ad Category: ${adType}
Procedure/Service: ${procedure}
Key Message & Context: ${keyMessage}
Output Format: ${outputFormat}
Brand Asset Note: ${brandAssetNote || "None"}`;

    if (referenceImageDescription) {
      userMessage += `\nReference Image Description: ${referenceImageDescription}`;
    }

    // Step 1: Generate ad copy + image prompt via Claude
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    const rawText =
      message.content[0].type === "text" ? message.content[0].text : "";

    if (!rawText) {
      return NextResponse.json(
        { error: "Failed to generate ad copy." },
        { status: 500 }
      );
    }

    // Parse Claude's JSON response
    let adCopy: AdCopy;
    try {
      // Strip any markdown code fences if present
      const cleaned = rawText
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      adCopy = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse Claude response:", rawText);
      return NextResponse.json(
        { error: "Failed to parse ad copy. Retrying may help." },
        { status: 500 }
      );
    }

    // Step 2: Generate background image via FAL.ai
    const imageSize = FORMAT_TO_SIZE[outputFormat] || "square_hd";
    const dimensions = FORMAT_TO_DIMENSIONS[outputFormat] || {
      width: 1024,
      height: 1024,
    };

    let falInput: Record<string, unknown> = {
      prompt: adCopy.image_prompt,
      image_size: imageSize,
      num_images: 1,
      safety_tolerance: "2",
    };

    // If reference image provided, use redux endpoint for image-to-image
    let falModel = "fal-ai/flux-pro/v1.1";
    if (referenceImageBase64) {
      falModel = "fal-ai/flux-pro/v1.1/redux";
      falInput = {
        ...falInput,
        image_url: `data:image/jpeg;base64,${referenceImageBase64}`,
      };
    }

    const result = (await fal.run(falModel, {
      input: falInput,
    })) as FalResult;

    const bgImageUrl = result?.images?.[0]?.url;

    if (!bgImageUrl) {
      return NextResponse.json(
        { error: "Failed to generate image." },
        { status: 500 }
      );
    }

    // Step 3: Composite text overlay onto image
    const composited = await compositeTextOnImage(
      bgImageUrl,
      adCopy,
      dimensions
    );

    // Convert to base64 data URL for the response
    const base64Image = `data:image/png;base64,${composited.toString("base64")}`;

    return NextResponse.json({
      imageUrl: base64Image,
      bgImageUrl,
      prompt: adCopy.image_prompt,
      adCopy: {
        headline: adCopy.headline,
        subheadline: adCopy.subheadline,
        cta: adCopy.cta,
        offer: adCopy.offer,
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Generation error:", errMsg);

    if (
      errMsg.includes("authentication") ||
      errMsg.includes("api_key") ||
      errMsg.includes("401")
    ) {
      return NextResponse.json(
        {
          error:
            "API key issue. Check your ANTHROPIC_API_KEY and FAL_KEY environment variables.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: `Generation failed: ${errMsg}` },
      { status: 500 }
    );
  }
}
