import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as fal from "@fal-ai/serverless-client";
import { compositeAdImage, FORMAT_TO_SIZE, DEFAULT_LAYOUT } from "@/lib/compositing";
import { GENERATE_SYSTEM_PROMPT } from "@/lib/prompts";
import { logUsage, extractClientName } from "@/lib/usage";
import type { AdLayout, GenerateResponse } from "@/types/chat";

fal.config({ credentials: process.env.FAL_KEY });

interface FalResult {
  images: { url: string }[];
}

export const maxDuration = 120;

async function uploadToFal(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const file = new File([buffer], "input.jpg", { type: "image/jpeg" });
  return await fal.storage.upload(file);
}

async function generateWithFluxStandard(prompt: string, imageSize: string): Promise<string> {
  const result = (await fal.run("fal-ai/flux-pro/v1.1", {
    input: { prompt, image_size: imageSize, num_images: 1, safety_tolerance: "2" },
  })) as FalResult;
  return result?.images?.[0]?.url || "";
}

async function generateWithKontext(imageUrl: string, editInstruction: string, imageSize: string): Promise<string> {
  const result = (await fal.run("fal-ai/flux-pro/kontext", {
    input: { image_url: imageUrl, prompt: editInstruction, image_size: imageSize, num_images: 1 },
  })) as FalResult;
  return result?.images?.[0]?.url || "";
}

async function generateWithGPTImage(editInstruction: string, imageUrl?: string): Promise<string> {
  const input: Record<string, unknown> = {
    prompt: editInstruction,
    quality: "high",
    size: "1024x1024",
  };
  if (imageUrl) {
    input.image_urls = [imageUrl];
  }
  const result = (await fal.run("fal-ai/gpt-image-1.5/edit", { input })) as FalResult;
  return result?.images?.[0]?.url || "";
}

async function generateWithNanoBananaPro(editInstruction: string, imageUrl?: string): Promise<string> {
  const input: Record<string, unknown> = { prompt: editInstruction, resolution: "2K" };
  const model = imageUrl ? "fal-ai/nano-banana-pro/edit" : "fal-ai/nano-banana-pro";
  if (imageUrl) input.image_urls = [imageUrl];
  const result = (await fal.run(model, { input })) as FalResult;
  return result?.images?.[0]?.url || "";
}

async function generateWithNanoBanana2(editInstruction: string, imageUrl?: string): Promise<string> {
  const input: Record<string, unknown> = { prompt: editInstruction, resolution: "2K", thinking_level: "high" };
  const model = imageUrl ? "fal-ai/nano-banana-2/edit" : "fal-ai/nano-banana-2";
  if (imageUrl) input.image_urls = [imageUrl];
  const result = (await fal.run(model, { input })) as FalResult;
  return result?.images?.[0]?.url || "";
}

async function generateWithSeedream(editInstruction: string, imageUrl?: string): Promise<string> {
  const input: Record<string, unknown> = { prompt: editInstruction };
  const model = imageUrl ? "fal-ai/bytedance/seedream/v4.5/edit" : "fal-ai/bytedance/seedream/v4.5/text-to-image";
  if (imageUrl) input.image_urls = [imageUrl];
  else input.image_size = "square_hd";
  const result = (await fal.run(model, { input })) as FalResult;
  return result?.images?.[0]?.url || "";
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

    let userMessage = `Ad Category: ${adType}
Procedure/Service: ${procedure}
Key Message & Context: ${keyMessage}
Output Format: ${outputFormat}
Brand Asset Note: ${brandAssetNote || "None"}
Reference Image Provided: ${hasImage ? "Yes — user uploaded an image they want edited/used." : "No"}`;

    if (referenceImageDescription) {
      userMessage += `\nUser's instruction for the image: ${referenceImageDescription}`;
    }
    if (clientContext) {
      userMessage += `\n\n${clientContext}`;
    }

    // Step 1: Claude orchestrates — picks model, format, generates copy + layout
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 2048,
      system: GENERATE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    logUsage(clientName, "generate", "claude-3-haiku-20240307");

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    if (!rawText) {
      return NextResponse.json({ error: "Failed to generate ad copy." }, { status: 500 });
    }

    let parsed: GenerateResponse & { edit_instruction?: string };
    try {
      const cleaned = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse Claude response:", rawText);
      return NextResponse.json({ error: "Failed to parse ad copy. Retrying may help." }, { status: 500 });
    }

    const layout: AdLayout = { ...DEFAULT_LAYOUT, ...(parsed.layout || {}) };
    const imageSize = FORMAT_TO_SIZE[outputFormat] || "square_hd";
    const modelKey = parsed.model_selection || "flux_standard";
    const editPrompt = parsed.edit_instruction || parsed.image_prompt;

    // Upload image to FAL storage if needed
    let falImageUrl: string | undefined;
    if (hasImage) {
      falImageUrl = await uploadToFal(referenceImageBase64);
    }

    // Step 2: Route to selected model
    let bgImageUrl = "";

    try {
      switch (modelKey) {
        case "flux_kontext":
          bgImageUrl = falImageUrl
            ? await generateWithKontext(falImageUrl, editPrompt, imageSize)
            : await generateWithFluxStandard(parsed.image_prompt, imageSize);
          break;
        case "gpt_image":
          bgImageUrl = await generateWithGPTImage(editPrompt, falImageUrl);
          break;
        case "nano_banana_pro":
          bgImageUrl = await generateWithNanoBananaPro(editPrompt, falImageUrl);
          break;
        case "nano_banana_2":
          bgImageUrl = await generateWithNanoBanana2(editPrompt, falImageUrl);
          break;
        case "seedream":
          bgImageUrl = await generateWithSeedream(editPrompt, falImageUrl);
          break;
        case "flux_standard":
        default:
          bgImageUrl = await generateWithFluxStandard(parsed.image_prompt, imageSize);
          break;
      }
    } catch (modelError) {
      const modelErrMsg = modelError instanceof Error ? modelError.message : String(modelError);
      console.error(`Model ${modelKey} failed: ${modelErrMsg}. Falling back...`);
      if (modelKey !== "nano_banana_pro" && modelKey !== "flux_standard") {
        try { bgImageUrl = await generateWithNanoBananaPro(editPrompt, falImageUrl); }
        catch { bgImageUrl = await generateWithFluxStandard(parsed.image_prompt, imageSize); }
      } else if (modelKey !== "flux_standard") {
        bgImageUrl = await generateWithFluxStandard(parsed.image_prompt, imageSize);
      } else { throw modelError; }
    }

    if (!bgImageUrl) {
      return NextResponse.json({ error: "Failed to generate image." }, { status: 500 });
    }

    // Log FAL model usage
    const falModelMap: Record<string, string> = {
      flux_standard: "fal-ai/flux-pro/v1.1",
      flux_kontext: hasImage ? "fal-ai/flux-pro/kontext" : "fal-ai/flux-pro/v1.1",
      gpt_image: "fal-ai/gpt-image-1.5/edit",
      nano_banana_pro: hasImage ? "fal-ai/nano-banana-pro/edit" : "fal-ai/nano-banana-pro",
      nano_banana_2: hasImage ? "fal-ai/nano-banana-2/edit" : "fal-ai/nano-banana-2",
      seedream: hasImage ? "fal-ai/bytedance/seedream/v4.5/edit" : "fal-ai/bytedance/seedream/v4.5/text-to-image",
    };
    logUsage(clientName, "generate", falModelMap[modelKey] || "fal-ai/flux-pro/v1.1");

    // Step 3: Composite text overlay
    const adCopy = {
      headline: parsed.headline,
      subheadline: parsed.subheadline,
      cta: parsed.cta,
      offer: parsed.offer || "",
    };

    const { composited } = await compositeAdImage(bgImageUrl, adCopy, layout, outputFormat);

    return NextResponse.json({
      imageUrl: composited,
      bgImageUrl: bgImageUrl.startsWith("data:") ? "(embedded)" : bgImageUrl,
      prompt: editPrompt,
      adCopy,
      layout,
      modelUsed: modelKey,
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
