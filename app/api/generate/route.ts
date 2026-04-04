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
Reference Image Provided: ${hasImage ? "Yes — user uploaded an image." : "No"}`;

    if (referenceImageDescription) {
      userMessage += `\nUser's instruction for the image: ${referenceImageDescription}`;
    }
    if (clientContext) {
      userMessage += `\n\n${clientContext}`;
    }

    // Upload reference image if provided
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
      const cleaned = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    } catch {
      console.error("Failed to parse Claude response:", rawText.slice(0, 300));
      return NextResponse.json({ error: "Failed to parse ad concept. Try again." }, { status: 500 });
    }

    console.log("Claude selected model:", parsed.model);
    console.log("Headline:", parsed.headline);

    // =============================================
    // STEP 2: Generate the COMPLETE ad in ONE model call
    // =============================================
    const modelKey = parsed.model || "nano_banana_pro";
    let imageUrls: string[] = [];

    // Generate 2 variations
    const generateOne = async (prompt: string): Promise<string | null> => {
      try {
        if (modelKey === "recraft_v3") {
          const result = (await fal.run("fal-ai/recraft-v3", {
            input: { prompt, image_size: imageSize },
          })) as FalResult;
          return result?.images?.[0]?.url || null;
        } else {
          // Default: Nano Banana Pro
          const input: Record<string, unknown> = { prompt, resolution: "1K" };
          if (falImageUrl) {
            input.image_urls = [falImageUrl];
          }
          const result = (await fal.run(
            falImageUrl ? "fal-ai/nano-banana-pro/edit" : "fal-ai/nano-banana-pro",
            { input }
          )) as FalResult;
          return result?.images?.[0]?.url || null;
        }
      } catch (e) {
        console.error("Generation failed:", e instanceof Error ? e.message : "");
        return null;
      }
    };

    // Generate 2 variations in parallel
    const results = await Promise.all([
      generateOne(parsed.full_ad_prompt),
      generateOne(parsed.full_ad_prompt),
    ]);

    imageUrls = results.filter((url): url is string => url !== null);

    // Fallback: try one more time with FLUX if both failed
    if (imageUrls.length === 0) {
      console.log("Both generations failed, trying FLUX fallback...");
      try {
        const result = (await fal.run("fal-ai/flux-pro/v1.1", {
          input: { prompt: parsed.full_ad_prompt, image_size: imageSize, num_images: 1, safety_tolerance: "2" },
        })) as FalResult;
        const url = result?.images?.[0]?.url;
        if (url) imageUrls = [url];
      } catch {
        return NextResponse.json({ error: "All image generation models failed." }, { status: 500 });
      }
    }

    logUsage(clientName, "generate", modelKey === "recraft_v3" ? "fal-ai/recraft-v3" : "fal-ai/nano-banana-pro");

    // Build variations array
    const variations = imageUrls.map(url => ({
      imageUrl: url,
      bgImageUrl: url,
    }));

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
      modelUsed: modelKey,
      variations,
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
