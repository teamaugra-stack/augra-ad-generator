import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as fal from "@fal-ai/serverless-client";
import { logUsage } from "@/lib/usage";
import type { ChatMessage, AdState } from "@/types/chat";

fal.config({ credentials: process.env.FAL_KEY });

interface FalResult {
  images: { url: string }[];
}

export const maxDuration = 120;

const CHAT_PROMPT = `You are an ad editor. The user has a generated ad and wants changes.

Respond with ONLY valid JSON:

{"reply":"1-2 sentence explanation","action_type":"image_edit or text_only","edit_prompt":"the full prompt to send to the image model describing the desired changes"}

action_type rules:
- "image_edit": ANY visual change. This includes changing text, colors, layout, background, lighting, style, adding/removing elements. This is the DEFAULT for almost everything.
- "text_only": ONLY use when user asks a question or wants info, not an actual edit.

For image_edit, write the edit_prompt as:
"Edit this advertisement image: [describe what to keep] [describe what to change]. The result should be a complete, finished advertisement with all text perfectly rendered and legible. Professional advertising design, magazine quality layout."

ALWAYS include the current ad's text content in the edit_prompt so it stays in the image.
ALWAYS specify the aspect ratio in the edit_prompt.`;

export async function POST(request: NextRequest) {
  try {
    const { messages, adState, preferredModel, clientName: reqClientName }: {
      messages: ChatMessage[];
      adState: AdState;
      preferredModel?: string;
      clientName?: string;
    } = await request.json();

    if (!messages?.length || !adState) {
      return NextResponse.json({ error: "Missing messages or ad state." }, { status: 400 });
    }

    const clientName = reqClientName || "anonymous";

    const contextMessage = `CURRENT AD:
Headline: ${adState.adCopy.headline}
Subheadline: ${adState.adCopy.subheadline}
CTA: ${adState.adCopy.cta}
Offer: ${adState.adCopy.offer || "(none)"}
Output Format: ${adState.outputFormat}
Category: ${adState.originalInputs.adType}
Current Image URL: ${adState.currentBgImageUrl}`;

    const claudeMessages = [
      { role: "user" as const, content: contextMessage },
      { role: "assistant" as const, content: "I have the current ad. What changes would you like?" },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    // Ask Claude what to edit
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 2048,
      system: CHAT_PROMPT,
      messages: claudeMessages,
    });

    logUsage(clientName, "chat", "claude-3-haiku-20240307");

    const rawText = response.content[0].type === "text" ? response.content[0].text : "";

    let parsed: { reply: string; action_type: string; edit_prompt: string };
    try {
      const cleaned = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    } catch {
      // Fallback: treat the whole response as a text reply
      return NextResponse.json({
        reply: rawText.slice(0, 200) || "I understood your request. Please try again.",
        updatedImageUrl: adState.currentBgImageUrl,
        updatedBgImageUrl: adState.currentBgImageUrl,
        updatedAdCopy: adState.adCopy,
        updatedLayout: adState.layout,
      });
    }

    // If text_only, just return the reply
    if (parsed.action_type === "text_only") {
      return NextResponse.json({
        reply: parsed.reply,
        updatedImageUrl: adState.currentBgImageUrl,
        updatedBgImageUrl: adState.currentBgImageUrl,
        updatedAdCopy: adState.adCopy,
        updatedLayout: adState.layout,
      });
    }

    // IMAGE EDIT: Call Nano Banana Pro with the current image + edit prompt
    let newImageUrl = adState.currentBgImageUrl;

    // Add aspect ratio to the edit prompt
    const formatSuffix = adState.outputFormat.includes("9:16")
      ? " Vertical 9:16 story format."
      : adState.outputFormat.includes("4:5")
        ? " Portrait 4:5 format."
        : " Square 1:1 format.";

    const skinRealism = "\n\nEnhance this image to achieve extremely realistic professional skin texture. Preserve the original face, identity, and proportions exactly. Add natural skin pores, subtle imperfections, realistic micro-texture, and true-to-life skin detail. Professional fashion photography look, photorealistic skin, ultra-detailed, natural lighting, RAW photo quality. Shot on Phase One medium format camera, 80mm lens.";

    const fullEditPrompt = parsed.edit_prompt + formatSuffix + skinRealism;

    // Determine which model to use
    const model = preferredModel || "nano_banana_pro";

    try {
      if (model === "gpt_image") {
        const result = (await fal.run("fal-ai/gpt-image-1.5/edit", {
          input: { image_urls: [adState.currentBgImageUrl], prompt: fullEditPrompt, quality: "high", size: "1024x1024" },
        })) as FalResult;
        newImageUrl = result?.images?.[0]?.url || newImageUrl;
      } else if (model === "seedream") {
        const result = (await fal.run("fal-ai/bytedance/seedream/v4.5/edit", {
          input: { image_urls: [adState.currentBgImageUrl], prompt: fullEditPrompt },
        })) as FalResult;
        newImageUrl = result?.images?.[0]?.url || newImageUrl;
      } else {
        // Default: Nano Banana Pro edit
        const result = (await fal.run("fal-ai/nano-banana-pro/edit", {
          input: { image_urls: [adState.currentBgImageUrl], prompt: fullEditPrompt, resolution: "1K" },
        })) as FalResult;
        newImageUrl = result?.images?.[0]?.url || newImageUrl;
      }
      logUsage(clientName, "chat", `fal-ai/nano-banana-pro/edit`);
    } catch (e) {
      console.error("Edit model failed:", e instanceof Error ? e.message : "");
      return NextResponse.json({
        reply: "The edit failed to generate. Please try rephrasing your request.",
        updatedImageUrl: adState.currentBgImageUrl,
        updatedBgImageUrl: adState.currentBgImageUrl,
        updatedAdCopy: adState.adCopy,
        updatedLayout: adState.layout,
      });
    }

    return NextResponse.json({
      reply: parsed.reply,
      updatedImageUrl: newImageUrl,
      updatedBgImageUrl: newImageUrl,
      updatedAdCopy: adState.adCopy,
      updatedLayout: adState.layout,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Chat error:", errMsg);
    return NextResponse.json({ error: `Edit failed: ${errMsg}` }, { status: 500 });
  }
}
