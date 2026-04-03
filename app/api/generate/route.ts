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
  "image_prompt": "80-200 word background image description",
  "headline": "2-8 word headline",
  "subheadline": "5-20 word supporting text",
  "cta": "2-4 word call to action",
  "offer": "promotional text or empty string",
  "model_selection": "standard or edit",
  "edit_instruction": "only when model_selection is edit — a concise instruction describing what to change about the uploaded image while keeping the rest",
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

MODEL SELECTION RULES — CRITICAL:
- "standard": No reference image provided. Generate a fresh image from scratch using image_prompt. This is the default.
- "edit": A reference image IS provided. The user has uploaded an actual image they want to USE, KEEP, or EDIT. Use the Kontext editing model which preserves the original image and applies targeted changes. Set edit_instruction to describe what to change (e.g. "change the background to a luxury clinic", "add dramatic blue lighting", "make the environment look more premium"). The edit_instruction should be specific about WHAT to change while emphasizing what to KEEP.

IMPORTANT: If the user says anything like "use this image", "edit this", "keep the person", "change the background", "modify this photo", or uploads any reference image with intent to use it — ALWAYS select "edit". The image_prompt field is still used for standard generation. The edit_instruction field is used for the Kontext model.

=== PHOTOREALISTIC SKIN & FACE REALISM SKILL ===

When generating ANY prompt involving human faces or portraits, you MUST apply these realism techniques. This is the difference between fake-looking AI output and photorealistic commercial photography.

SKIN PHYSICS — Always include 3-5 of these:
- subsurface skin scattering, visible skin pores, fine skin texture, natural skin colour variation
- translucent skin quality, warm undertones, skin luminosity, light diffusion through dermis
- natural skin imperfections, subtle skin roughness, micro skin texture

LIGHTING — Always specify a setup:
- For clinical/premium: "soft diffused studio lighting, large octabox key light, subtle fill light, natural catch light in eyes, colour temperature 5500K"
- For lifestyle: "golden hour natural light, directional window light, soft bokeh background, warm ambient fill"
- For dramatic/masculine: "Rembrandt lighting, single key light at 45 degrees, deep shadow fill, specular highlight on cheekbones"
- Universal: "accurate light falloff, physically accurate shadows, soft shadow transitions, realistic specular highlights"

LENS PHYSICS — Always include:
- "85mm portrait lens" or "105mm telephoto" (NEVER wide angle for faces)
- "shallow depth of field, f/1.8-f/2.8 aperture, background bokeh"
- "shot on Canon EOS R5" or "Hasselblad medium format" or "Phase One"
- "tack sharp eyes, sharp eyelashes, RAW photo aesthetic"

NEGATIVE PROMPT TERMS — Always end image_prompt with:
"Photorealistic, ultra high resolution, commercial advertising photography, subsurface skin scattering, visible skin pores, fine skin texture, tack sharp eyes, natural catch lights, RAW photo aesthetic. NOT: plastic skin, waxy skin, airbrushed skin, poreless skin, digital art, 3D render, CGI, illustration, oversaturated, symmetrical face, glass eyes, watermark, text, typography, logos."

=== LAYOUT DESIGN RULES ===

Be creative! Each ad should look DIFFERENT. Match the layout to the category and mood:

PLASTIC SURGERY: Use "centered_hero" or "minimal_center". Headline style "italic" or "mixed". Accent colors: dusty rose (#D4A574), champagne (#C9A96E). CTA: "outline" or "underline". Decorative: "line_accent" or "corner_marks". Scrim: "vignette" or "full_overlay".

MED SPA / AESTHETICS: Use "editorial_top" or "split_left". Headline "mixed". Accent: rose gold (#B76E79), blush (#D4A0A0). CTA: "pill_white" or "underline". Decorative: "line_accent". Scrim: "top_gradient".

COSMETIC DENTISTRY: Use "centered_hero" or "bottom_heavy". Headline "uppercase". Accent: sky blue (#5BA4CF). CTA: "pill_white". Scrim: "bottom_gradient".

CHIROPRACTIC / ORTHOPEDIC: Use "split_left" or "editorial_top". Bold uppercase. Accent: warm red (#C45B4A) or teal (#3A8C7E). CTA: "pill_white" or "outline". Scrim: "left_gradient".

MEN'S HEALTH / TRT: Use "bottom_heavy" or "full_overlay". LARGE headline (4xl), aggressive uppercase. Accent: steel (#7A8B99) or gold (#C9A96E). CTA: "pill_dark" or "outline". Scrim: "bottom_gradient". Decorative: "none".

WEIGHT LOSS: Use "editorial_top" or "centered_hero". Headline "uppercase". Accent: green (#5EA66B) or orange (#D4854A). CTA: "pill_white". Scrim: "top_gradient".

PEPTIDE / ANTI-AGING: Use "minimal_center" or "editorial_top". Headline "mixed" or "italic". Accent: teal (#3A8C8C) or slate blue (#5B7B94). CTA: "outline" or "underline". Decorative: "corner_marks".

OFFER / PROMOTION: Use "centered_hero" or "full_overlay". Big offer text. Accent: gold (#C9A96E). CTA: "pill_white". Decorative: "border_frame".

AUTHORITY / DOCTOR: Use "split_left" or "editorial_top". Headline "mixed". Accent: navy (#2C3E6B) or gold. CTA: "underline". Scrim: "left_gradient".

PRACTICE BRANDING: Use "minimal_center". Headline "italic". Accent: champagne or sage (#7A9B7A). CTA: "underline". Decorative: "corner_marks". Scrim: "vignette".

VARY YOUR DESIGNS. Each generation should feel unique.

AD COPY GUIDELINES:
- Headline: The scroll-stopping hook.
- Subheadline: Supporting context, brief and punchy.
- CTA: Direct action.
- Offer: Only if user mentions a deal/discount, otherwise empty string "".`;

const MODEL_MAP: Record<string, string> = {
  standard: "fal-ai/flux-pro/v1.1",
  edit: "fal-ai/flux-pro/kontext",
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

    const hasImage = !!referenceImageBase64;

    let userMessage = `Ad Category: ${adType}
Procedure/Service: ${procedure}
Key Message & Context: ${keyMessage}
Output Format: ${outputFormat}
Brand Asset Note: ${brandAssetNote || "None"}
Reference Image Provided: ${hasImage ? "Yes — the user has uploaded an image. Determine if they want to EDIT it or just use it as inspiration based on their description below." : "No"}`;

    if (referenceImageDescription) {
      userMessage += `\nWhat the user wants to do with the image: ${referenceImageDescription}`;
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

    let parsed: GenerateResponse & { edit_instruction?: string };
    try {
      const cleaned = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse Claude response:", rawText);
      return NextResponse.json({ error: "Failed to parse ad copy. Retrying may help." }, { status: 500 });
    }

    // Validate and apply defaults to layout
    const layout: AdLayout = { ...DEFAULT_LAYOUT, ...(parsed.layout || {}) };

    // Step 2: Generate or edit image via FAL.ai
    const modelKey = parsed.model_selection || "standard";
    // Force "edit" if user uploaded an image and Claude picked edit
    const falModel = MODEL_MAP[modelKey] || MODEL_MAP.standard;
    const imageSize = FORMAT_TO_SIZE[outputFormat] || "square_hd";

    let bgImageUrl: string;

    if (modelKey === "edit" && hasImage) {
      // KONTEXT MODEL: Send the actual image + edit instruction
      // The image is preserved and only the specified changes are applied
      const editPrompt = parsed.edit_instruction || parsed.image_prompt;

      const result = (await fal.run("fal-ai/flux-pro/kontext", {
        input: {
          image_url: `data:image/jpeg;base64,${referenceImageBase64}`,
          prompt: editPrompt,
          image_size: imageSize,
          num_images: 1,
        },
      })) as FalResult;

      bgImageUrl = result?.images?.[0]?.url || "";
    } else {
      // STANDARD MODEL: Generate fresh from prompt
      const result = (await fal.run("fal-ai/flux-pro/v1.1", {
        input: {
          prompt: parsed.image_prompt,
          image_size: imageSize,
          num_images: 1,
          safety_tolerance: "2",
        },
      })) as FalResult;

      bgImageUrl = result?.images?.[0]?.url || "";
    }

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
      prompt: modelKey === "edit" ? (parsed.edit_instruction || parsed.image_prompt) : parsed.image_prompt,
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
