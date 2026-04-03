import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as fal from "@fal-ai/serverless-client";
import { compositeAdImage, FORMAT_TO_SIZE } from "@/lib/compositing";
import { CHAT_SYSTEM_PROMPT } from "@/lib/prompts";
import type { ChatMessage, AdState } from "@/types/chat";

fal.config({ credentials: process.env.FAL_KEY });

interface FalResult {
  images: { url: string }[];
}

export const maxDuration = 120;

// Upload an image URL to FAL storage so editing models can access it
async function ensureFalUrl(imageUrl: string): Promise<string> {
  // If already a FAL URL, return as-is
  if (imageUrl.includes("fal.media")) return imageUrl;

  // Fetch and re-upload to FAL storage
  const res = await fetch(imageUrl);
  const buf = Buffer.from(await res.arrayBuffer());
  const file = new File([buf], "current.jpg", { type: "image/jpeg" });
  return await fal.storage.upload(file);
}

export async function POST(request: NextRequest) {
  try {
    const { messages, adState }: { messages: ChatMessage[]; adState: AdState } =
      await request.json();

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
Category: ${adState.originalInputs.adType}
Current Background Image URL: ${adState.currentBgImageUrl}`;

    const claudeMessages = [
      { role: "user" as const, content: contextMessage },
      { role: "assistant" as const, content: "I have the current ad state and image. What changes would you like?" },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 2048,
      system: CHAT_SYSTEM_PROMPT,
      messages: claudeMessages,
    });

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
      const cleaned = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse chat response:", rawText);
      return NextResponse.json({ error: "Failed to parse edit. Try rephrasing." }, { status: 500 });
    }

    const updatedAdCopy = parsed.updated_ad_copy || adState.adCopy;
    const updatedLayout = { ...adState.layout, ...(parsed.updated_layout || {}) };
    let bgImageUrl = adState.currentBgImageUrl;

    if (parsed.action_type === "image_edit" || parsed.action_type === "full_regen") {
      const imageSize = FORMAT_TO_SIZE[adState.outputFormat] || "square_hd";

      if (parsed.action_type === "image_edit" && adState.currentBgImageUrl) {
        // ALWAYS edit the existing image — never generate from scratch
        const editInstruction = parsed.image_instruction || adState.imagePrompt;

        // Ensure the current bg image is in FAL storage
        const falUrl = await ensureFalUrl(adState.currentBgImageUrl);

        // Pick model based on edit complexity
        const isMedical = /anatom|medical|overlay|x-ray|inside|muscle|bone|inject|cross.?section|illustrat|layer/i.test(editInstruction);
        const isArtistic = /artistic|futuristic|glow|scan|neon|style|creative/i.test(editInstruction);

        try {
          if (isMedical) {
            const falResult = (await fal.run("fal-ai/gpt-image-1.5/edit", {
              input: { image_urls: [falUrl], prompt: editInstruction, quality: "high", size: "1024x1024" },
            })) as FalResult;
            bgImageUrl = falResult?.images?.[0]?.url || bgImageUrl;
          } else if (isArtistic) {
            const falResult = (await fal.run("fal-ai/bytedance/seedream/v4.5/edit", {
              input: { image_urls: [falUrl], prompt: editInstruction },
            })) as FalResult;
            bgImageUrl = falResult?.images?.[0]?.url || bgImageUrl;
          } else {
            // Default: Nano Banana Pro for general edits (better than Kontext)
            const falResult = (await fal.run("fal-ai/nano-banana-pro/edit", {
              input: { image_urls: [falUrl], prompt: editInstruction, resolution: "2K" },
            })) as FalResult;
            bgImageUrl = falResult?.images?.[0]?.url || bgImageUrl;
          }
        } catch (editErr) {
          console.error("Primary edit model failed, trying Kontext:", editErr);
          try {
            const falResult = (await fal.run("fal-ai/flux-pro/kontext", {
              input: { image_url: falUrl, prompt: editInstruction, image_size: imageSize, num_images: 1 },
            })) as FalResult;
            bgImageUrl = falResult?.images?.[0]?.url || bgImageUrl;
          } catch {
            // Last resort: regenerate from prompt
            const falResult = (await fal.run("fal-ai/flux-pro/v1.1", {
              input: { prompt: editInstruction, image_size: imageSize, num_images: 1, safety_tolerance: "2" },
            })) as FalResult;
            bgImageUrl = falResult?.images?.[0]?.url || bgImageUrl;
          }
        }
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
