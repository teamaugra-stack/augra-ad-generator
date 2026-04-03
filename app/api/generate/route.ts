import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as fal from "@fal-ai/serverless-client";
import { compositeAdImage, FORMAT_TO_SIZE, DEFAULT_LAYOUT } from "@/lib/compositing";
import type { AdLayout, GenerateResponse } from "@/types/chat";

fal.config({ credentials: process.env.FAL_KEY });

const SYSTEM_PROMPT = `You are an elite AI art director and medical advertising specialist. You orchestrate multiple AI image generation models to produce the highest quality output for each specific request.

You must respond with ONLY a valid JSON object — no markdown, no code fences, no explanation.

REQUIRED JSON FORMAT:
{
  "image_prompt": "80-200 word image description (used for standard generation and as context for edits)",
  "edit_instruction": "concise edit instruction (used when editing an uploaded image — describe exactly what to change and what to keep)",
  "headline": "2-8 word headline",
  "subheadline": "5-20 word supporting text",
  "cta": "2-4 word call to action",
  "offer": "promotional text or empty string",
  "model_selection": "one of: flux_standard, flux_kontext, gpt_image, nano_banana_pro, nano_banana_2, seedream",
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

=== MODEL SELECTION — YOU MUST PICK THE BEST MODEL ===

You have 6 models. Each excels at different things. Pick the RIGHT one:

1. "flux_standard" — FLUX Pro v1.1. For: fresh image generation from scratch when NO reference image is provided. Fast (10s), great photorealism. DEFAULT when no image uploaded.

2. "flux_kontext" — FLUX Kontext. For: SIMPLE edits to an uploaded photo — change background, adjust lighting/colors, add atmosphere, swap environment. Preserves subject well. Fast (10s). Use when the edit is straightforward.

3. "gpt_image" — GPT Image 1.5 (OpenAI via FAL). For: COMPLEX medical/anatomical edits. Adding muscle layer overlays, injection point annotations, cross-section views, x-ray effects, medical illustration overlays on real photos. Best at understanding anatomy and adding labeled medical annotations. Takes 30-40s but produces the BEST medical overlays. USE THIS for anything involving "show anatomy", "injection points", "muscle layers", "what happens under the skin", "medical illustration overlay".

4. "nano_banana_pro" — Nano Banana Pro (Google Gemini 3 Pro). For: HIGH QUALITY image editing with good subject preservation. Excellent at complex edits that need reasoning. Good for adding overlays, effects, and transformations. 30-35s. Use when the edit is complex but not specifically medical/anatomical.

5. "nano_banana_2" — Nano Banana 2 (Google Gemini 3.1 Flash). For: HIGHEST QUALITY edits at 2K+ resolution with deep thinking. Best for the most complex compositions. 60-75s. Use when maximum quality is needed and user expects to wait.

6. "seedream" — Seedream V4.5 (ByteDance). For: ARTISTIC/STYLISTIC transformations. Futuristic effects, glow effects, scan-style overlays, artistic reinterpretations. Good text rendering. 60s. Use for creative/artistic edit requests.

DECISION TREE:
- No image uploaded → "flux_standard"
- Image uploaded + simple edit (background, lighting, color) → "flux_kontext"
- Image uploaded + medical/anatomy/injection/muscle/bone request → "gpt_image"
- Image uploaded + complex non-medical edit → "nano_banana_pro"
- Image uploaded + "highest quality" / "4K" / very complex → "nano_banana_2"
- Image uploaded + artistic/stylistic/futuristic effect → "seedream"
- If unsure → "nano_banana_pro" (best all-rounder for edits)

=== EDIT INSTRUCTION RULES ===

When model_selection is NOT "flux_standard", you MUST write a detailed edit_instruction that:
1. Starts with "Edit this image:" or "On this exact image:"
2. Explicitly states what to KEEP ("keep the original person, composition, and all existing elements exactly the same")
3. Explicitly states what to ADD or CHANGE
4. Is specific about placement and style

Example: "Edit this image: keep the original person's face, hands, and microneedling device exactly as they are. Add a semi-transparent anatomical overlay on the face showing the frontalis muscle on the forehead, corrugator muscle between the eyebrows, and orbicularis oculi around the eyes. Mark injection points with small red dots at each muscle group. Medical illustration style, clean and professional."

=== PHOTOREALISTIC SKIN & FACE REALISM ===

For image_prompt (fresh generation), ALWAYS include:
- Skin: subsurface scattering, visible pores, fine texture, natural colour variation
- Lighting: specific setup (octabox, golden hour, Rembrandt)
- Lens: 85mm-135mm, f/1.8-f/2.8, shallow depth of field
- Camera: Canon EOS R5 / Hasselblad / Phase One
- End with: "Photorealistic, ultra high resolution, commercial photography, subsurface skin scattering, visible pores, tack sharp eyes. NOT: plastic skin, waxy, airbrushed, poreless, digital art, 3D render, CGI, watermark, text, typography, logos."

=== LAYOUT DESIGN ===

ALWAYS use #FFFFFF (white) for headline_color on dark images. NEVER use dark text on dark images.
Be creative. Vary layouts per generation. Match to category tone.`;

interface FalResult {
  images: { url: string }[];
}

export const maxDuration = 120;

// Upload image to FAL storage for models that need a URL (not base64 data URI)
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
  const input: Record<string, unknown> = {
    prompt: editInstruction,
    resolution: "2K",
  };
  const model = imageUrl ? "fal-ai/nano-banana-pro/edit" : "fal-ai/nano-banana-pro";
  if (imageUrl) {
    input.image_urls = [imageUrl];
  }
  const result = (await fal.run(model, { input })) as FalResult;
  return result?.images?.[0]?.url || "";
}

async function generateWithNanoBanana2(editInstruction: string, imageUrl?: string): Promise<string> {
  const input: Record<string, unknown> = {
    prompt: editInstruction,
    resolution: "2K",
    thinking_level: "high",
  };
  const model = imageUrl ? "fal-ai/nano-banana-2/edit" : "fal-ai/nano-banana-2";
  if (imageUrl) {
    input.image_urls = [imageUrl];
  }
  const result = (await fal.run(model, { input })) as FalResult;
  return result?.images?.[0]?.url || "";
}

async function generateWithSeedream(editInstruction: string, imageUrl?: string): Promise<string> {
  const input: Record<string, unknown> = {
    prompt: editInstruction,
  };
  const model = imageUrl ? "fal-ai/bytedance/seedream/v4.5/edit" : "fal-ai/bytedance/seedream/v4.5/text-to-image";
  if (imageUrl) {
    input.image_urls = [imageUrl];
  } else {
    input.image_size = "square_hd";
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
Reference Image Provided: ${hasImage ? "Yes — user uploaded an image they want edited/used." : "No"}`;

    if (referenceImageDescription) {
      userMessage += `\nUser's instruction for the image: ${referenceImageDescription}`;
    }
    if (clientContext) {
      userMessage += `\n\n${clientContext}`;
    }

    // Step 1: Claude picks model + generates copy + layout
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
    const editPrompt = parsed.edit_instruction || parsed.image_prompt;

    // Upload image to FAL storage if needed (models need URL, not base64)
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

      // Fallback chain: try nano_banana_pro, then flux_standard
      if (modelKey !== "nano_banana_pro" && modelKey !== "flux_standard") {
        try {
          bgImageUrl = await generateWithNanoBananaPro(editPrompt, falImageUrl);
        } catch {
          bgImageUrl = await generateWithFluxStandard(parsed.image_prompt, imageSize);
        }
      } else if (modelKey !== "flux_standard") {
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
