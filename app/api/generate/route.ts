import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as fal from "@fal-ai/serverless-client";
import { FORMAT_TO_SIZE } from "@/lib/compositing";
import { FULL_AD_SYSTEM_PROMPT } from "@/lib/prompts";
import { logUsage, extractClientName } from "@/lib/usage";

fal.config({ credentials: process.env.FAL_KEY });

interface FalResult {
  images: { url: string }[];
}

export const maxDuration = 120;

async function uploadToFal(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const file = new File([new Uint8Array(buffer)], "input.jpg", { type: "image/jpeg" });
  return await fal.storage.upload(file);
}

// ===== SKIN REALISM ENHANCEMENT (appended to every prompt) =====

const SKIN_REALISM_SUFFIX = `\n\nEnhance this image to achieve extremely realistic professional skin texture. Preserve the original face, identity, and proportions exactly. Add natural skin pores, subtle imperfections, realistic micro-texture, and true-to-life skin detail. Maintain natural skin tones and soft transitions in light. Professional fashion photography look, high-end editorial quality, photorealistic skin, ultra-detailed, natural lighting, RAW photo quality, high dynamic range, sharp focus, no plastic skin, no artificial smoothing.\nVisible pores, natural skin texture, subtle imperfections, realistic human skin, shot on medium format camera, RAW photo quality.\nPreserve original identity, do not change the face, same person as the input image.\nShot on Phase One medium format camera, 80mm lens, studio lighting.`;

// ===== MODEL GENERATION FUNCTIONS =====

async function generateWithNanoBanana(
  prompt: string,
  imageUrl?: string
): Promise<string | null> {
  try {
    const fullPrompt = prompt + SKIN_REALISM_SUFFIX;
    const input: Record<string, unknown> = { prompt: fullPrompt, resolution: "1K" };
    if (imageUrl) input.image_urls = [imageUrl];
    const model = imageUrl ? "fal-ai/nano-banana-pro/edit" : "fal-ai/nano-banana-pro";
    const result = (await fal.run(model, { input })) as FalResult;
    return result?.images?.[0]?.url || null;
  } catch (e) {
    console.error("Nano Banana failed:", e instanceof Error ? e.message : "");
    return null;
  }
}

async function generateWithRecraft(
  prompt: string,
  imageSize: string,
  imageUrl?: string
): Promise<string | null> {
  try {
    let fullPrompt = prompt + SKIN_REALISM_SUFFIX;
    if (imageUrl) {
      fullPrompt += ` Use the provided reference image as style and composition guidance. Match its visual style, lighting, and feel.`;
    }
    const result = (await fal.run("fal-ai/recraft-v3", {
      input: { prompt: fullPrompt, image_size: imageSize },
    })) as FalResult;
    return result?.images?.[0]?.url || null;
  } catch (e) {
    console.error("Recraft failed:", e instanceof Error ? e.message : "");
    return null;
  }
}

// ===== MAIN HANDLER =====

export async function POST(request: NextRequest) {
  try {
    const {
      adType, procedure, keyMessage, outputFormat,
      brandAssetNote, referenceImageDescription, referenceImageBase64,
      clientContext,
    } = await request.json();

    if (!adType || !procedure || !keyMessage || !outputFormat) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const clientName = extractClientName(clientContext);
    const hasImage = !!referenceImageBase64;
    const imageSize = FORMAT_TO_SIZE[outputFormat] || "square_hd";

    let userMessage = `Ad Category: ${adType}
Procedure/Service: ${procedure}
Key Message & Context: ${keyMessage}
Output Format: ${outputFormat}
Brand Asset Note: ${brandAssetNote || "None"}
Reference Image Provided: ${hasImage ? "Yes — user uploaded an image they want used/edited in the ad." : "No"}`;

    if (referenceImageDescription) {
      userMessage += `\nUser's instruction for the image: ${referenceImageDescription}`;
    }
    if (clientContext) {
      userMessage += `\n\n${clientContext}`;
    }

    // Upload reference image to FAL storage if provided
    let falImageUrl: string | undefined;
    if (hasImage) {
      falImageUrl = await uploadToFal(referenceImageBase64);
    }

    // =============================================
    // STEP 1: Claude writes the FULL AD prompt
    // =============================================
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 2048,
      system: FULL_AD_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    logUsage(clientName, "generate", "claude-3-haiku-20240307");

    const rawText = msg.content[0].type === "text" ? msg.content[0].text : "";
    if (!rawText) {
      return NextResponse.json({ error: "Failed to generate ad concept." }, { status: 500 });
    }

    let parsed: {
      full_ad_prompt: string;
      model: string;
      headline: string;
      subheadline: string;
      cta: string;
      offer: string;
    };

    try {
      // Aggressive cleanup: strip markdown, find JSON
      let cleaned = rawText
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .replace(/^[^{]*/, "") // strip anything before first {
        .trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleaned = jsonMatch[0];
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse Claude response. Raw text:", rawText.slice(0, 500));
      // FALLBACK: Build a simple prompt ourselves if Claude fails
      parsed = {
        full_ad_prompt: `A professional medical advertisement for ${adType}. ${procedure} clinic ad. ${keyMessage}. Bold headline text reading "${procedure.toUpperCase()}" in white serif font at the top. Subtext below: "${keyMessage.slice(0, 80)}". A white pill-shaped CTA button at the bottom reading "BOOK CONSULTATION". Professional advertising design, magazine quality layout, clean typography, all text perfectly rendered and legible. Photorealistic skin, natural lighting, high-end editorial quality.`,
        model: "nano_banana_pro",
        headline: procedure,
        subheadline: keyMessage.slice(0, 80),
        cta: "Book Consultation",
        offer: "",
      };
      console.log("Using fallback prompt due to parse failure");
    }

    console.log("Headline:", parsed.headline);

    // =============================================
    // STEP 2: Generate with BOTH models in parallel
    // =============================================
    // Each model produces 1 ad — user picks their favorite
    const [nanoBananaUrl, recraftUrl] = await Promise.all([
      generateWithNanoBanana(parsed.full_ad_prompt, falImageUrl),
      generateWithRecraft(parsed.full_ad_prompt, imageSize, falImageUrl),
    ]);

    // Log both model calls
    if (nanoBananaUrl) logUsage(clientName, "generate", "fal-ai/nano-banana-pro");
    if (recraftUrl) logUsage(clientName, "generate", "fal-ai/recraft-v3");

    // Build variations array — both models' outputs
    const variations: { imageUrl: string; bgImageUrl: string; model: string }[] = [];

    if (nanoBananaUrl) {
      variations.push({ imageUrl: nanoBananaUrl, bgImageUrl: nanoBananaUrl, model: "Nano Banana Pro" });
    }
    if (recraftUrl) {
      variations.push({ imageUrl: recraftUrl, bgImageUrl: recraftUrl, model: "Recraft V3" });
    }

    // Fallback: if both failed, try FLUX
    if (variations.length === 0) {
      console.log("Both models failed, trying FLUX fallback...");
      try {
        const result = (await fal.run("fal-ai/flux-pro/v1.1", {
          input: { prompt: parsed.full_ad_prompt, image_size: imageSize, num_images: 1, safety_tolerance: "2" },
        })) as FalResult;
        const url = result?.images?.[0]?.url;
        if (url) {
          variations.push({ imageUrl: url, bgImageUrl: url, model: "FLUX Pro" });
          logUsage(clientName, "generate", "fal-ai/flux-pro/v1.1");
        }
      } catch {
        return NextResponse.json({ error: "All image generation models failed." }, { status: 500 });
      }
    }

    if (variations.length === 0) {
      return NextResponse.json({ error: "Failed to generate any images." }, { status: 500 });
    }

    console.log(`Generated ${variations.length} variations: ${variations.map(v => v.model).join(", ")}`);

    return NextResponse.json({
      imageUrl: variations[0].imageUrl,
      bgImageUrl: variations[0].bgImageUrl,
      prompt: parsed.full_ad_prompt,
      adCopy: {
        headline: parsed.headline,
        subheadline: parsed.subheadline,
        cta: parsed.cta,
        offer: parsed.offer || "",
      },
      layout: {
        style: "full_overlay",
        headline_position: "top-center",
        headline_size: "3xl",
        headline_color: "#FFFFFF",
        headline_style: "mixed",
        subheadline_color: "rgba(255,255,255,0.85)",
        cta_style: "pill_white",
        cta_position: "bottom-center",
        accent_color: "#D4A574",
        scrim_style: "full_overlay",
        decorative: "none",
      },
      modelUsed: variations[0].model,
      variations: variations.map(v => ({ imageUrl: v.imageUrl, bgImageUrl: v.bgImageUrl })),
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Generation error:", errMsg);
    if (errMsg.includes("authentication") || errMsg.includes("api_key") || errMsg.includes("401")) {
      return NextResponse.json({ error: "API key issue. Check your environment variables." }, { status: 500 });
    }
    return NextResponse.json({ error: `Generation failed: ${errMsg}` }, { status: 500 });
  }
}
