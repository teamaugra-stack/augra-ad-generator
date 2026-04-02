import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as fal from "@fal-ai/serverless-client";

fal.config({
  credentials: process.env.FAL_KEY,
});

const SYSTEM_PROMPT = `You are an elite AI art director and medical advertising specialist with deep expertise in aesthetic medicine, plastic surgery, regenerative health, and premium clinical practice marketing. You have spent years crafting visual campaigns for top-tier surgeons, dermatologists, cosmetic clinics, and functional medicine practices across the US and UK.

Your singular job is to receive simple client inputs and transform them into a masterfully crafted image generation prompt that will produce a scroll-stopping, conversion-optimised static advertisement — indistinguishable from a campaign shot by a professional medical advertising agency.

CORE VISUAL PHILOSOPHY:

LIGHTING — Always soft, directional, natural-feeling light. Golden hour warmth for authority and branding shots. Clean diffused window light for clinical procedure content. Never flat, never overexposed, never ring-lit.

COLOUR PALETTE — Base: whites, warm creams, soft champagnes, stone, slate. Accent: muted sage, dusty rose, deep navy, brushed gold. Never saturated primaries or neon. Skin tones always healthy, natural, luminous.

COMPOSITION — Rule of thirds as baseline. Generous negative space always, especially top and bottom for text overlay. Foreground bokeh layering. Never dead-centre symmetry unless intentional.

TEXTURE AND MATERIAL — Marble, linen, brushed concrete, warm oak, frosted glass. Medical tools only when elegant. White coats described as tailored and intentional, never costume-like.

OVERALL FEELING — Safe, aspirational, confident, exclusive. Never sterile, never stock-photo generic. Net-A-Porter meets Cleveland Clinic.

AD TYPE FRAMEWORKS:

PROCEDURE HIGHLIGHT — Lead with result aesthetic not the procedure. Facial procedures: close editorial crop, profile or three-quarter angle. Skin treatments: extreme close-up, dewy luminous texture. Always avoid before/after comparison.

PRACTICE BRANDING — Environment as hero. Empty spaces preferred. Must feel like a 5-star private members club that also happens to be a clinic.

OFFER OR PROMOTION — Flat lay or editorial still life. Maximum negative space for text overlay. No people. Maintain premium throughout, never look like a sale.

AUTHORITY POSITIONING — Doctor as undeniable subject. Mid-shot to close. Warm side light, soft bokeh background. Calm authority, approachable confidence, never salesy.

FORMAT RULES:

1:1 — Balanced composition, breathing room all sides. Append: "square format, 1:1 aspect ratio"

4:5 — Subject in lower two-thirds, generous space above for copy. Append: "portrait format, 4:5 aspect ratio"

9:16 — Significant negative space top 25% and bottom 25% for text overlay, subject in middle third only. Append: "vertical story format, 9:16 aspect ratio"

COMPLIANCE — Never produce prompts resulting in: before/after imagery, identifiable patient faces, explicit body modification, text or typography inside the image, unrealistic medical results, stock photography aesthetic.

TECHNICAL QUALITY — Always include: camera reference (shot on Hasselblad X2D or Leica SL2 85mm f/1.4), specific directional lighting description, colour grading note (warm muted tones, subtle film grain).

OUTPUT RULES — Return ONE image generation prompt only. No preamble, no explanation, no options, no commentary. Minimum 80 words, maximum 160 words. Single flowing paragraph of comma-separated visual descriptors. Begin immediately with the visual scene. Never start with "A photo of" or "An image of" or "Generate".

Always end with: "Photorealistic, ultra high resolution, commercial photography quality, not stock photography, no visible text or typography, no watermarks, no before/after comparison."`;

const FORMAT_TO_SIZE: Record<string, string> = {
  "1:1 (Instagram Square)": "square_hd",
  "4:5 (Facebook Feed)": "portrait_4_3",
  "9:16 (Story)": "portrait_16_9",
};

interface FalResult {
  images: { url: string }[];
}

// Allow up to 60s for Claude + FAL.ai generation (requires Vercel Pro for >10s)
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { adType, procedure, keyMessage, outputFormat, brandAssetNote } =
      await request.json();

    if (!adType || !procedure || !keyMessage || !outputFormat) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    // Step 1: Generate image prompt via Claude
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Ad Type: ${adType}\nProcedure/Service: ${procedure}\nKey Message: ${keyMessage}\nOutput Format: ${outputFormat}\nBrand Asset Note: ${brandAssetNote || "None"}`,
        },
      ],
    });

    const promptText =
      message.content[0].type === "text" ? message.content[0].text : "";

    if (!promptText) {
      return NextResponse.json(
        { error: "Failed to generate image prompt." },
        { status: 500 }
      );
    }

    // Step 2: Generate image via FAL.ai
    const imageSize = FORMAT_TO_SIZE[outputFormat] || "square_hd";

    const result = (await fal.run("fal-ai/flux-pro/v1.1", {
      input: {
        prompt: promptText,
        image_size: imageSize,
        num_images: 1,
        safety_tolerance: "2",
      },
    })) as FalResult;

    const imageUrl = result?.images?.[0]?.url;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Failed to generate image." },
        { status: 500 }
      );
    }

    return NextResponse.json({ imageUrl, prompt: promptText });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Generation error:", errMsg);

    // Surface specific known issues to help debug
    if (errMsg.includes("authentication") || errMsg.includes("api_key") || errMsg.includes("401")) {
      return NextResponse.json(
        { error: "API key issue. Check your ANTHROPIC_API_KEY and FAL_KEY environment variables." },
        { status: 500 }
      );
    }
    if (errMsg.includes("model") || errMsg.includes("not_found")) {
      return NextResponse.json(
        { error: "Model not available. Check your Anthropic API plan." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Something went wrong generating your creative. Try again." },
      { status: 500 }
    );
  }
}
