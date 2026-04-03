import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import * as fal from "@fal-ai/serverless-client";
import { compositeAdImage, FORMAT_TO_SIZE, DEFAULT_LAYOUT } from "@/lib/compositing";
import type { AdLayout, GenerateResponse } from "@/types/chat";

fal.config({ credentials: process.env.FAL_KEY });

const SYSTEM_PROMPT = `You are an elite AI art director and medical advertising specialist. You orchestrate multiple AI image generation models to produce the highest quality output for each specific request.

You must respond with ONLY a valid JSON object — no markdown, no code fences, no explanation.

REQUIRED JSON FORMAT:
{
  "image_prompt": "80-200 word image description (used for standard generation)",
  "edit_instruction": "concise edit instruction (used when editing an uploaded image)",
  "headline": "2-8 word headline",
  "subheadline": "5-20 word supporting text",
  "cta": "2-4 word call to action",
  "offer": "promotional text or empty string",
  "model_selection": "one of: flux_standard, flux_kontext, gpt_image, nano_banana, seedream",
  "layout": {
    "style": "editorial_top or centered_hero or bottom_heavy or split_left or minimal_center or full_overlay",
    "headline_position": "top-left or top-center or center or bottom-left or bottom-center",
    "headline_size": "xl or 2xl or 3xl or 4xl",
    "headline_color": "#FFFFFF",
    "headline_style": "uppercase or mixed or italic",
    "subheadline_color": "rgba(255,255,255,0.9)",
    "cta_style": "pill_white or pill_dark or outline or underline",
    "cta_position": "bottom-center or bottom-left or bottom-right",
    "accent_color": "#hex color",
    "scrim_style": "top_gradient or bottom_gradient or full_overlay or left_gradient or vignette",
    "decorative": "none or line_accent or border_frame or corner_marks"
  }
}

=== MODEL SELECTION — CRITICAL DECISION ===

You have 5 models. Pick the BEST one for the specific request:

1. "flux_standard" — FLUX Pro v1.1. Best for: fresh image generation from scratch when no reference image is provided. Fast, high photorealism. Use when: generating backgrounds, environments, product shots, lifestyle scenes.

2. "flux_kontext" — FLUX Kontext. Best for: editing an uploaded photo with SIMPLE changes (change background, adjust lighting, change colors, add atmosphere). Preserves the original subject well. Use when: user uploads a photo and wants background/lighting/color changes.

3. "gpt_image" — GPT Image 1.5 (OpenAI). Best for: COMPLEX image editing, medical/anatomical overlays, adding illustration elements to photos, "show the inside of", X-ray effects, cross-section views, annotated medical imagery, adding visual effects that require understanding of anatomy. Use when: user asks for anything medical/anatomical, "show what's under the skin", "animate the face to show muscles", "add injection points", or any complex conceptual edit.

4. "nano_banana" — Nano Banana Pro (Google Gemini). Best for: HIGHEST QUALITY output at 4K, complex multi-element compositions, when you need the best possible quality and the user is willing to wait. Also excellent for text rendering in images. Use when: maximum quality is needed, complex scenes, or when other models would struggle with the composition.

5. "seedream" — Seedream V4.5 (ByteDance). Best for: stylistic editing, artistic transformations, multi-reference subject consistency, and text-heavy imagery. Cheapest option with great quality. Use when: artistic/stylistic edits, brand-consistent variations, or when text in the image matters.

DECISION RULES:
- Reference image uploaded + "edit this" / "use this image" / "keep the person" → flux_kontext
- Reference image + medical/anatomical/science request → gpt_image
- Reference image + complex overlay/illustration request → gpt_image
- No reference image + standard ad generation → flux_standard
- Request mentions "highest quality" / "4K" / complex scene → nano_banana
- Request is artistic/stylistic + reference image → seedream
- When in doubt between models, prefer gpt_image for complex edits, flux_standard for fresh generation

=== PHOTOREALISTIC SKIN & FACE REALISM ===

When generating prompts involving human faces/portraits, ALWAYS include:
- Skin physics: subsurface skin scattering, visible skin pores, fine skin texture, natural skin colour variation
- Lighting: specify setup (octabox, golden hour, Rembrandt, etc.)
- Lens: 85mm-135mm portrait lens, f/1.8-f/2.8, shallow depth of field
- Camera: shot on Canon EOS R5 / Hasselblad / Phase One
- Always: tack sharp eyes, natural catch lights, RAW photo aesthetic
- End prompts with: "Photorealistic, ultra high resolution, commercial advertising photography, subsurface skin scattering, visible skin pores, tack sharp eyes. NOT: plastic skin, waxy skin, airbrushed, poreless, digital art, 3D render, CGI, illustration, oversaturated, watermark, text, typography, logos."

=== LAYOUT DESIGN ===

ALWAYS use high-contrast text colors. Default to #FFFFFF (white) for headline_color. NEVER use dark blue, dark green, or any dark color for text on dark images. If the image is bright/white, use dark text (#1a1a1a).

Be creative with layouts. Match to category:
- Surgery/Medical: centered_hero or minimal_center, italic headlines, dusty rose/gold accents, vignette scrim
- Men's Health/TRT: bottom_heavy, 4xl uppercase, steel/gold, full_overlay scrim
- Med Spa: editorial_top, mixed case, rose gold, top_gradient
- Dental: centered_hero, uppercase, sky blue accent, bottom_gradient
- Wellness/Chiro: split_left, uppercase, teal/red, left_gradient
- Promotions: full_overlay, border_frame, gold accent
- Authority: split_left, mixed, navy accent, left_gradient

AD COPY: Headline = scroll-stopping hook. Subheadline = brief supporting context. CTA = direct action. Offer = only if mentioned.`;

interface FalResult {
  images: { url: string }[];
}

export const maxDuration = 120;

async function generateWithFluxStandard(
  prompt: string,
  imageSize: string
): Promise<string> {
  const result = (await fal.run("fal-ai/flux-pro/v1.1", {
    input: { prompt, image_size: imageSize, num_images: 1, safety_tolerance: "2" },
  })) as FalResult;
  return result?.images?.[0]?.url || "";
}

async function generateWithKontext(
  imageBase64: string,
  editInstruction: string,
  imageSize: string
): Promise<string> {
  const result = (await fal.run("fal-ai/flux-pro/kontext", {
    input: {
      image_url: `data:image/jpeg;base64,${imageBase64}`,
      prompt: editInstruction,
      image_size: imageSize,
      num_images: 1,
    },
  })) as FalResult;
  return result?.images?.[0]?.url || "";
}

async function generateWithGPTImage(
  prompt: string,
  imageBase64?: string
): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  if (imageBase64) {
    // Edit existing image
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const imageFile = new File([imageBuffer], "input.png", { type: "image/png" });

    const result = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt,
      size: "1024x1024",
    });

    if (result.data?.[0]?.b64_json) {
      // Upload to a temporary URL by returning as data URI
      return `data:image/png;base64,${result.data[0].b64_json}`;
    }
    return result.data?.[0]?.url || "";
  } else {
    // Generate from scratch
    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      quality: "high",
    });

    if (result.data?.[0]?.b64_json) {
      return `data:image/png;base64,${result.data[0].b64_json}`;
    }
    return result.data?.[0]?.url || "";
  }
}

async function generateWithNanoBanana(
  prompt: string,
  imageBase64?: string,
  imageSize?: string
): Promise<string> {
  const input: Record<string, unknown> = {
    prompt,
    image_size: imageSize || "square_hd",
  };

  const model = imageBase64
    ? "fal-ai/nano-banana-pro/edit"
    : "fal-ai/nano-banana-pro";

  if (imageBase64) {
    input.image_url = `data:image/jpeg;base64,${imageBase64}`;
  }

  const result = (await fal.run(model, { input })) as FalResult;
  return result?.images?.[0]?.url || "";
}

async function generateWithSeedream(
  prompt: string,
  imageBase64?: string,
  imageSize?: string
): Promise<string> {
  const input: Record<string, unknown> = {
    prompt,
    image_size: imageSize || "square_hd",
  };

  const model = imageBase64
    ? "fal-ai/bytedance/seedream/v4.5/edit"
    : "fal-ai/bytedance/seedream/v4.5/text-to-image";

  if (imageBase64) {
    input.image_url = `data:image/jpeg;base64,${imageBase64}`;
  }

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

    const hasImage = !!referenceImageBase64;

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

    // Step 1: Claude orchestrates — picks model, generates copy + layout
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

    const layout: AdLayout = { ...DEFAULT_LAYOUT, ...(parsed.layout || {}) };
    const imageSize = FORMAT_TO_SIZE[outputFormat] || "square_hd";
    const modelKey = parsed.model_selection || "flux_standard";

    // Step 2: Route to the selected model
    let bgImageUrl = "";
    const editPrompt = parsed.edit_instruction || parsed.image_prompt;

    try {
      switch (modelKey) {
        case "flux_kontext":
          if (hasImage) {
            bgImageUrl = await generateWithKontext(referenceImageBase64, editPrompt, imageSize);
          } else {
            bgImageUrl = await generateWithFluxStandard(parsed.image_prompt, imageSize);
          }
          break;

        case "gpt_image":
          bgImageUrl = await generateWithGPTImage(
            editPrompt,
            hasImage ? referenceImageBase64 : undefined
          );
          break;

        case "nano_banana":
          bgImageUrl = await generateWithNanoBanana(
            editPrompt,
            hasImage ? referenceImageBase64 : undefined,
            imageSize
          );
          break;

        case "seedream":
          bgImageUrl = await generateWithSeedream(
            editPrompt,
            hasImage ? referenceImageBase64 : undefined,
            imageSize
          );
          break;

        case "flux_standard":
        default:
          bgImageUrl = await generateWithFluxStandard(parsed.image_prompt, imageSize);
          break;
      }
    } catch (modelError) {
      const modelErrMsg = modelError instanceof Error ? modelError.message : String(modelError);
      console.error(`Model ${modelKey} failed:`, modelErrMsg);

      // Fallback to flux_standard if selected model fails
      if (modelKey !== "flux_standard") {
        console.log("Falling back to flux_standard...");
        bgImageUrl = await generateWithFluxStandard(parsed.image_prompt, imageSize);
      } else {
        throw modelError;
      }
    }

    if (!bgImageUrl) {
      return NextResponse.json({ error: "Failed to generate image." }, { status: 500 });
    }

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
      prompt: modelKey.includes("edit") || modelKey === "gpt_image" ? editPrompt : parsed.image_prompt,
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
