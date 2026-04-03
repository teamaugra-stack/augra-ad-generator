import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as fal from "@fal-ai/serverless-client";
import sharp from "sharp";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "fs";
import { join } from "path";

fal.config({
  credentials: process.env.FAL_KEY,
});

// Load static (non-variable) WOFF fonts — satori requires static weight fonts
const fontBold = readFileSync(
  join(process.cwd(), "public", "fonts", "Inter-Bold-Static.woff")
);
const fontRegular = readFileSync(
  join(process.cwd(), "public", "fonts", "Inter-Regular-Static.woff")
);

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

async function renderTextOverlay(
  adCopy: AdCopy,
  dimensions: { width: number; height: number }
): Promise<Buffer> {
  const { width, height } = dimensions;
  const isStory = height > width * 1.5;

  const headlineSize = isStory ? 54 : 48;
  const subSize = isStory ? 22 : 20;
  const ctaSize = 17;
  const offerSize = isStory ? 26 : 23;

  // Build the overlay layout as satori virtual DOM
  const children: Record<string, unknown>[] = [];

  // Top section: headline + subheadline
  const topChildren: Record<string, unknown>[] = [
    {
      type: "div",
      props: {
        style: {
          fontSize: headlineSize,
          fontWeight: 700,
          color: "white",
          letterSpacing: "1px",
          lineHeight: 1.2,
          textShadow: "0 2px 20px rgba(0,0,0,0.5)",
        },
        children: adCopy.headline.toUpperCase(),
      },
    },
    {
      type: "div",
      props: {
        style: {
          fontSize: subSize,
          fontWeight: 400,
          color: "rgba(255,255,255,0.88)",
          marginTop: 12,
          lineHeight: 1.5,
          textShadow: "0 1px 10px rgba(0,0,0,0.5)",
        },
        children: adCopy.subheadline,
      },
    },
  ];

  // Top gradient scrim + text
  children.push({
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        padding: "50px 50px 80px",
        width: "100%",
        background:
          "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)",
      },
      children: topChildren,
    },
  });

  // Spacer to push bottom content down
  children.push({
    type: "div",
    props: { style: { flex: 1 }, children: "" },
  });

  // Bottom section: offer + CTA
  const bottomChildren: Record<string, unknown>[] = [];

  if (adCopy.offer) {
    bottomChildren.push({
      type: "div",
      props: {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "14px 28px",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 12,
          marginBottom: 20,
          width: "100%",
        },
        children: {
          type: "div",
          props: {
            style: {
              fontSize: offerSize,
              fontWeight: 700,
              color: "white",
              letterSpacing: "1px",
              textAlign: "center",
            },
            children: adCopy.offer.toUpperCase(),
          },
        },
      },
    });
  }

  // CTA button
  bottomChildren.push({
    type: "div",
    props: {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "14px 48px",
        background: "white",
        borderRadius: 999,
        alignSelf: "center",
      },
      children: {
        type: "div",
        props: {
          style: {
            fontSize: ctaSize,
            fontWeight: 700,
            color: "black",
            letterSpacing: "2px",
          },
          children: adCopy.cta.toUpperCase(),
        },
      },
    },
  });

  children.push({
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "80px 50px 50px",
        width: "100%",
        background:
          "linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)",
      },
      children: bottomChildren,
    },
  });

  // Root element
  const element = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
      },
      children,
    },
  };

  // Render with satori — fonts are embedded as vector paths
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svg = await satori(element as any, {
    width,
    height,
    fonts: [
      { name: "Inter", data: fontBold, weight: 700, style: "normal" as const },
      {
        name: "Inter",
        data: fontRegular,
        weight: 400,
        style: "normal" as const,
      },
    ],
  });

  // Convert SVG to PNG with resvg
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width" as const, value: width },
    background: "rgba(0,0,0,0)",
  });
  return Buffer.from(resvg.render().asPng());
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
      messages: [{ role: "user", content: userMessage }],
    });

    const rawText =
      message.content[0].type === "text" ? message.content[0].text : "";

    if (!rawText) {
      return NextResponse.json(
        { error: "Failed to generate ad copy." },
        { status: 500 }
      );
    }

    let adCopy: AdCopy;
    try {
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

    // Step 3: Render text overlay with satori + resvg
    const textPng = await renderTextOverlay(adCopy, dimensions);

    // Step 4: Composite text onto background with sharp
    const bgResponse = await fetch(bgImageUrl);
    const bgBuffer = Buffer.from(await bgResponse.arrayBuffer());

    const composited = await sharp(bgBuffer)
      .resize(dimensions.width, dimensions.height, { fit: "cover" })
      .composite([{ input: textPng, top: 0, left: 0, blend: "over" }])
      .png()
      .toBuffer();

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
