import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as fal from "@fal-ai/serverless-client";
import { compositeAdImage, FORMAT_TO_SIZE } from "@/lib/compositing";
import type { ChatMessage, AdState } from "@/types/chat";

fal.config({ credentials: process.env.FAL_KEY });

const CHAT_SYSTEM_PROMPT = `You are a creative ad editor assistant. The user has already generated a medical/aesthetic ad and now wants to make edits.

You have the current ad state (image prompt, ad copy, layout properties). The user will request changes.

You must respond with ONLY a valid JSON object — no markdown, no code fences:

{
  "reply": "friendly 1-2 sentence explanation of what you changed",
  "action_type": "text_edit or image_edit or full_regen",
  "updated_ad_copy": { "headline": "...", "subheadline": "...", "cta": "...", "offer": "..." },
  "updated_layout": { full layout object with ALL fields },
  "image_instruction": "only for image_edit: prompt for FAL to modify the image",
  "new_image_prompt": "only for full_regen: complete new image prompt"
}

ACTION TYPE RULES:
- "text_edit": User wants to change text content (headline, CTA, offer, subheadline) OR layout/styling (colors, positions, sizes, decorative elements, CTA style). NO new image generation needed — just re-composite the text overlay. This is fast.
- "image_edit": User wants to change the BACKGROUND IMAGE (lighting, subject, colors, mood, environment). Needs a new FAL.ai call.
- "full_regen": User wants to completely start over with a different concept.

IMPORTANT: Always return ALL fields in updated_ad_copy and updated_layout, even if unchanged. Copy the current values for unchanged fields.

For text_edit: Only modify the specific fields the user mentions. Keep everything else identical.
For image_edit: Update the image_instruction with a clear description. Keep ad copy and layout unless the user also wants those changed.
For full_regen: Create entirely new image_prompt, ad copy, and layout.

Layout fields you can modify:
- style: editorial_top, centered_hero, bottom_heavy, split_left, minimal_center, full_overlay
- headline_position: top-left, top-center, center, bottom-left, bottom-center
- headline_size: xl, 2xl, 3xl, 4xl
- headline_color: any hex color
- headline_style: uppercase, mixed, italic
- subheadline_color: any rgba color
- cta_style: pill_white, pill_dark, outline, underline
- cta_position: bottom-center, bottom-left, bottom-right
- accent_color: any hex color
- scrim_style: top_gradient, bottom_gradient, full_overlay, left_gradient, vignette, none
- decorative: none, line_accent, border_frame, corner_marks`;

interface FalResult {
  images: { url: string }[];
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { messages, adState }: { messages: ChatMessage[]; adState: AdState } =
      await request.json();

    if (!messages?.length || !adState) {
      return NextResponse.json({ error: "Missing messages or ad state." }, { status: 400 });
    }

    // Build context message with current ad state
    const contextMessage = `CURRENT AD STATE:
Image Prompt: ${adState.imagePrompt}
Headline: ${adState.adCopy.headline}
Subheadline: ${adState.adCopy.subheadline}
CTA: ${adState.adCopy.cta}
Offer: ${adState.adCopy.offer || "(none)"}
Layout: ${JSON.stringify(adState.layout)}
Output Format: ${adState.outputFormat}
Category: ${adState.originalInputs.adType}`;

    // Build Claude messages
    const claudeMessages = [
      { role: "user" as const, content: contextMessage },
      { role: "assistant" as const, content: "I have the current ad state. What changes would you like?" },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    // Call Claude
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

    // Handle image generation if needed
    if (parsed.action_type === "image_edit" || parsed.action_type === "full_regen") {
      const prompt = parsed.action_type === "full_regen"
        ? parsed.new_image_prompt || adState.imagePrompt
        : parsed.image_instruction || adState.imagePrompt;

      const imageSize = FORMAT_TO_SIZE[adState.outputFormat] || "square_hd";

      const falResult = (await fal.run("fal-ai/flux-pro/v1.1", {
        input: { prompt, image_size: imageSize, num_images: 1, safety_tolerance: "2" },
      })) as FalResult;

      bgImageUrl = falResult?.images?.[0]?.url || bgImageUrl;
    }

    // Composite text onto (new or existing) background
    const { composited } = await compositeAdImage(
      bgImageUrl,
      updatedAdCopy,
      updatedLayout,
      adState.outputFormat
    );

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
