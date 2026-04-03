import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as fal from "@fal-ai/serverless-client";
import { compositeAdImage, FORMAT_TO_SIZE, DEFAULT_LAYOUT } from "@/lib/compositing";
import type { AdLayout, GenerateResponse } from "@/types/chat";

fal.config({ credentials: process.env.FAL_KEY });

const SYSTEM_PROMPT = `You are an elite AI art director and medical advertising specialist. You create high-converting static ad creatives for medical and aesthetic practices.

Your job: receive client inputs and produce a COMPLETE creative direction including the background image prompt, ad copy, visual layout design, and model selection.

You must respond with ONLY a valid JSON object — no markdown, no code fences, no explanation.

REQUIRED JSON FORMAT:
{
  "image_prompt": "80-180 word background image description",
  "headline": "2-8 word headline",
  "subheadline": "5-20 word supporting text",
  "cta": "2-4 word call to action",
  "offer": "promotional text or empty string",
  "model_selection": "standard or redux or edit",
  "layout": {
    "style": "editorial_top or centered_hero or bottom_heavy or split_left or minimal_center or full_overlay",
    "headline_position": "top-left or top-center or center or bottom-left or bottom-center",
    "headline_size": "xl or 2xl or 3xl or 4xl",
    "headline_color": "#hex color",
    "headline_style": "uppercase or mixed or italic",
    "subheadline_color": "rgba color string",
    "cta_style": "pill_white or pill_dark or outline or underline",
    "cta_position": "bottom-center or bottom-left or bottom-right",
    "accent_color": "#hex color",
    "scrim_style": "top_gradient or bottom_gradient or full_overlay or left_gradient or vignette or none",
    "decorative": "none or line_accent or border_frame or corner_marks"
  }
}

MODEL SELECTION RULES:
- "standard": No reference image provided, or reference is just inspiration. Default choice.
- "redux": Reference image provided and user wants to match its style/aesthetic/colors.
- "edit": Reference image provided and user wants to modify/transform the actual image content (e.g. "edit this photo", "add effects to this face", "change the background of this image").

LAYOUT DESIGN RULES — Be creative! Each ad should look DIFFERENT. Match the layout to the category and mood:

PLASTIC SURGERY: Use "centered_hero" or "minimal_center". Headline style "italic" or "mixed" with Playfair serif feel. Accent colors: dusty rose (#D4A574), champagne (#C9A96E), soft gold. CTA: "outline" or "underline". Decorative: "line_accent" or "corner_marks". Scrim: "vignette" or "full_overlay".

MED SPA / AESTHETICS: Use "editorial_top" or "split_left". Headline "mixed" case for elegance. Accent: rose gold (#B76E79), blush (#D4A0A0). CTA: "pill_white" or "underline". Decorative: "line_accent". Scrim: "top_gradient".

COSMETIC DENTISTRY: Use "centered_hero" or "bottom_heavy". Bright headline color (#FFFFFF). Headline "uppercase" for clean modern feel. Accent: sky blue (#5BA4CF). CTA: "pill_white". Scrim: "bottom_gradient".

CHIROPRACTIC: Use "split_left" or "editorial_top". Bold uppercase headline. Accent: warm red (#C45B4A) or teal (#3A8C7E). CTA: "pill_white" or "outline". Scrim: "left_gradient" or "top_gradient".

MEN'S HEALTH / TRT: Use "bottom_heavy" or "full_overlay". LARGE headline (4xl), aggressive uppercase. Accent: steel (#7A8B99) or gold (#C9A96E). CTA: "pill_dark" or "outline". Scrim: "bottom_gradient" or "full_overlay". Decorative: "none".

WEIGHT LOSS: Use "editorial_top" or "centered_hero". Energetic, bright. Headline "uppercase". Accent: vibrant green (#5EA66B) or orange (#D4854A). CTA: "pill_white". Scrim: "top_gradient".

PEPTIDE / ANTI-AGING: Use "minimal_center" or "editorial_top". Clinical luxury. Headline "mixed" or "italic". Accent: teal (#3A8C8C) or slate blue (#5B7B94). CTA: "outline" or "underline". Decorative: "corner_marks" or "border_frame".

OFFER / PROMOTION: Use "centered_hero" or "full_overlay". Big offer text, prominent CTA. Accent: gold (#C9A96E). CTA: "pill_white". Decorative: "border_frame". Headline can be the offer itself.

AUTHORITY / DOCTOR: Use "split_left" or "editorial_top". Professional, warm. Headline "mixed". Accent: navy (#2C3E6B) or gold. CTA: "underline" or "pill_dark". Scrim: "left_gradient".

PRACTICE BRANDING: Use "minimal_center" or "centered_hero". Headline "italic" for elegance. Accent: champagne or sage (#7A9B7A). CTA: "underline". Decorative: "corner_marks". Scrim: "vignette".

VARY YOUR DESIGNS: Never use the same combination twice. Alternate between headline sizes, positions, CTA styles, and decorative elements. Each generation should feel like a unique creative from a different designer.

IMAGE PROMPT GUIDELINES:
- Always end with: "Photorealistic, ultra high resolution, commercial advertising photography, no text or typography or words or letters, no watermarks, no logos."
- Leave generous space for text overlay based on the layout style you chose.
- Match the mood and color palette to the category.

AD COPY GUIDELINES:
- Headline: The scroll-stopping hook. Match tone to category.
- Subheadline: Supporting context. Brief and punchy.
- CTA: Direct action. "Book Now", "Learn More", "Free Consultation", etc.
- Offer: Only if the user mentions a deal/discount. Otherwise empty string "".`;

const MODEL_MAP: Record<string, string> = {
  standard: "fal-ai/flux-pro/v1.1",
  redux: "fal-ai/flux-pro/v1.1/redux",
  edit: "fal-ai/flux-kontext-pro",
};

interface FalResult {
  images: { url: string }[];
}

export const maxDuration = 60;

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

    let userMessage = `Ad Category: ${adType}
Procedure/Service: ${procedure}
Key Message & Context: ${keyMessage}
Output Format: ${outputFormat}
Brand Asset Note: ${brandAssetNote || "None"}
Reference Image Provided: ${referenceImageBase64 ? "Yes" : "No"}`;

    if (referenceImageDescription) {
      userMessage += `\nReference Image Description: ${referenceImageDescription}`;
    }

    if (clientContext) {
      userMessage += `\n\n${clientContext}`;
    }

    // Step 1: Claude generates ad copy + layout + model selection
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    if (!rawText) {
      return NextResponse.json({ error: "Failed to generate ad copy." }, { status: 500 });
    }

    let parsed: GenerateResponse;
    try {
      const cleaned = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse Claude response:", rawText);
      return NextResponse.json({ error: "Failed to parse ad copy. Retrying may help." }, { status: 500 });
    }

    // Validate and apply defaults to layout
    const layout: AdLayout = { ...DEFAULT_LAYOUT, ...(parsed.layout || {}) };

    // Step 2: Generate background image via FAL.ai
    const modelKey = parsed.model_selection || "standard";
    const falModel = MODEL_MAP[modelKey] || MODEL_MAP.standard;
    const imageSize = FORMAT_TO_SIZE[outputFormat] || "square_hd";

    const falInput: Record<string, unknown> = {
      prompt: parsed.image_prompt,
      image_size: imageSize,
      num_images: 1,
      safety_tolerance: "2",
    };

    if (referenceImageBase64 && (modelKey === "redux" || modelKey === "edit")) {
      falInput.image_url = `data:image/jpeg;base64,${referenceImageBase64}`;
    }

    const result = (await fal.run(falModel, { input: falInput })) as FalResult;
    const bgImageUrl = result?.images?.[0]?.url;

    if (!bgImageUrl) {
      return NextResponse.json({ error: "Failed to generate image." }, { status: 500 });
    }

    // Step 3: Composite text overlay onto image
    const adCopy = {
      headline: parsed.headline,
      subheadline: parsed.subheadline,
      cta: parsed.cta,
      offer: parsed.offer || "",
    };

    const { composited } = await compositeAdImage(bgImageUrl, adCopy, layout, outputFormat);

    return NextResponse.json({
      imageUrl: composited,
      bgImageUrl,
      prompt: parsed.image_prompt,
      adCopy,
      layout,
      modelUsed: falModel,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Generation error:", errMsg);

    if (errMsg.includes("authentication") || errMsg.includes("api_key") || errMsg.includes("401")) {
      return NextResponse.json({ error: "API key issue. Check your ANTHROPIC_API_KEY and FAL_KEY environment variables." }, { status: 500 });
    }
    return NextResponse.json({ error: `Generation failed: ${errMsg}` }, { status: 500 });
  }
}
