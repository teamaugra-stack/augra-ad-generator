import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as fal from "@fal-ai/serverless-client";
import { compositeAdImage, FORMAT_TO_SIZE } from "@/lib/compositing";
import { CHAT_SYSTEM_PROMPT } from "@/lib/prompts";
import { logUsage } from "@/lib/usage";
import type { ChatMessage, AdState } from "@/types/chat";

fal.config({ credentials: process.env.FAL_KEY });

interface FalResult {
  images: { url: string }[];
}

export const maxDuration = 120;

async function ensureFalUrl(imageUrl: string): Promise<string> {
  if (imageUrl.includes("fal.media")) return imageUrl;
  const res = await fetch(imageUrl);
  const buf = Buffer.from(await res.arrayBuffer());
  const file = new File([buf], "current.jpg", { type: "image/jpeg" });
  return await fal.storage.upload(file);
}

async function editWithModel(
  model: string,
  falUrl: string,
  editInstruction: string,
  imageSize: string
): Promise<string> {
  let result: FalResult;

  switch (model) {
    case "gpt_image":
      result = (await fal.run("fal-ai/gpt-image-1.5/edit", {
        input: { image_urls: [falUrl], prompt: editInstruction, quality: "high", size: "1024x1024" },
      })) as FalResult;
      break;
    case "seedream":
      result = (await fal.run("fal-ai/bytedance/seedream/v4.5/edit", {
        input: { image_urls: [falUrl], prompt: editInstruction },
      })) as FalResult;
      break;
    case "flux_kontext":
      result = (await fal.run("fal-ai/flux-pro/kontext", {
        input: { image_url: falUrl, prompt: editInstruction, image_size: imageSize, num_images: 1 },
      })) as FalResult;
      break;
    case "nano_banana_pro":
    default:
      result = (await fal.run("fal-ai/nano-banana-pro/edit", {
        input: { image_urls: [falUrl], prompt: editInstruction, resolution: "2K" },
      })) as FalResult;
      break;
  }

  return result?.images?.[0]?.url || "";
}

function pickModel(editInstruction: string, preferredModel?: string): string {
  if (preferredModel && preferredModel !== "auto") return preferredModel;

  const isMedical = /anatom|medical|overlay|x-ray|inside|muscle|bone|inject|cross.?section|illustrat|layer/i.test(editInstruction);
  const isArtistic = /artistic|futuristic|glow|scan|neon|style|creative|editorial/i.test(editInstruction);
  const isSimple = /background|lighting|bright|dark|color|warm|cool/i.test(editInstruction);

  if (isMedical) return "gpt_image";
  if (isArtistic) return "seedream";
  if (isSimple) return "flux_kontext";
  return "nano_banana_pro";
}

export async function POST(request: NextRequest) {
  try {
    const { messages, adState, preferredModel, clientName: reqClientName }: {
      messages: ChatMessage[];
      adState: AdState;
      preferredModel?: string;
      clientName?: string;
    } = await request.json();

    const clientName = reqClientName || "anonymous";

    if (!messages?.length || !adState) {
      return NextResponse.json({ error: "Missing messages or ad state." }, { status: 400 });
    }

    const contextMessage = `CURRENT AD STATE:
Image Prompt: ${adState.imagePrompt}
Headline: ${adState.adCopy.headline}
Subheadline: ${adState.adCopy.subheadline}
CTA: ${adState.adCopy.cta}
Offer: ${adState.adCopy.offer || "(none)"}
Layout: ${JSON.stringify(adState.layout)}
Output Format: ${adState.outputFormat}
Category: ${adState.originalInputs.adType}`;

    const claudeMessages = [
      { role: "user" as const, content: contextMessage },
      { role: "assistant" as const, content: "I have the current ad state. What changes would you like?" },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 2048,
      system: CHAT_SYSTEM_PROMPT,
      messages: claudeMessages,
    });

    logUsage(clientName, "chat", "claude-3-haiku-20240307");

    const rawText = response.content[0].type === "text" ? response.content[0].text : "";
    if (!rawText) {
      return NextResponse.json({ error: "Failed to get edit response." }, { status: 500 });
    }

    let parsed: {
      reply: string;
      action_type: "text_edit" | "image_edit" | "full_regen";
      updated_ad_copy: { headline: string; subheadline: string; cta: string; offer: string };
      updated_layout: Record<string, unknown>;
      image_instruction?: string;
      new_image_prompt?: string;
    };

    try {
      // Clean up common Claude formatting issues
      let cleaned = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      // Try to extract JSON if there's text before/after it
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleaned = jsonMatch[0];
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse chat response:", rawText);
      // Fallback: return a text-only response with the raw reply
      const { composited } = await compositeAdImage(adState.currentBgImageUrl, adState.adCopy, adState.layout, adState.outputFormat);
      return NextResponse.json({
        reply: rawText.slice(0, 200) || "I understood your request but had trouble formatting the response. Please try again.",
        updatedImageUrl: composited,
        updatedBgImageUrl: adState.currentBgImageUrl,
        updatedAdCopy: adState.adCopy,
        updatedLayout: adState.layout,
      });
    }

    const updatedAdCopy = parsed.updated_ad_copy || adState.adCopy;
    const updatedLayout = { ...adState.layout, ...(parsed.updated_layout || {}) };
    let bgImageUrl = adState.currentBgImageUrl;
    const imageSize = FORMAT_TO_SIZE[adState.outputFormat] || "square_hd";

    // Handle image edits
    if (parsed.action_type === "image_edit" || parsed.action_type === "full_regen") {
      if (parsed.action_type === "image_edit" && adState.currentBgImageUrl) {
        const editInstruction = parsed.image_instruction || adState.imagePrompt;
        const falUrl = await ensureFalUrl(adState.currentBgImageUrl);
        const model = pickModel(editInstruction, preferredModel);

        let usedModel = model;
        try {
          const newUrl = await editWithModel(model, falUrl, editInstruction, imageSize);
          if (newUrl) bgImageUrl = newUrl;
        } catch (editErr) {
          console.error(`Model ${model} failed:`, editErr);
          try {
            usedModel = "flux_kontext";
            const newUrl = await editWithModel("flux_kontext", falUrl, editInstruction, imageSize);
            if (newUrl) bgImageUrl = newUrl;
          } catch {
            console.error("All edit models failed");
          }
        }
        // Log the FAL model that was actually used
        const falModelIds: Record<string, string> = {
          gpt_image: "fal-ai/gpt-image-1.5/edit",
          seedream: "fal-ai/bytedance/seedream/v4.5/edit",
          flux_kontext: "fal-ai/flux-pro/kontext",
          nano_banana_pro: "fal-ai/nano-banana-pro/edit",
        };
        logUsage(clientName, "chat", falModelIds[usedModel] || "fal-ai/nano-banana-pro/edit");
      } else {
        // Full regen
        const prompt = parsed.new_image_prompt || adState.imagePrompt;
        try {
          const falResult = (await fal.run("fal-ai/nano-banana-pro", {
            input: { prompt, resolution: "2K" },
          })) as FalResult;
          bgImageUrl = falResult?.images?.[0]?.url || bgImageUrl;
        } catch {
          const falResult = (await fal.run("fal-ai/flux-pro/v1.1", {
            input: { prompt, image_size: imageSize, num_images: 1, safety_tolerance: "2" },
          })) as FalResult;
          bgImageUrl = falResult?.images?.[0]?.url || bgImageUrl;
        }
      }
    }

    // Always composite
    const { composited } = await compositeAdImage(bgImageUrl, updatedAdCopy, updatedLayout, adState.outputFormat);

    return NextResponse.json({
      reply: parsed.reply,
      updatedImageUrl: composited,
      updatedBgImageUrl: bgImageUrl,
      updatedAdCopy,
      updatedLayout,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Chat error:", errMsg);
    return NextResponse.json({ error: `Edit failed: ${errMsg}` }, { status: 500 });
  }
}
