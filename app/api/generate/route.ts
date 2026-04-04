import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as fal from "@fal-ai/serverless-client";
import {
  compositeAdImage, compositeAdImageV2, convertTypographyToLegacyLayout,
  FORMAT_TO_SIZE, DEFAULT_LAYOUT,
} from "@/lib/compositing";
import { CONCEPT_SYSTEM_PROMPT, TYPOGRAPHY_SYSTEM_PROMPT, GENERATE_SYSTEM_PROMPT } from "@/lib/prompts";
import { logUsage, extractClientName } from "@/lib/usage";
import type { AdLayout, ConceptResponse, TypographyDesign } from "@/types/chat";

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

// ===== IMAGE GENERATION FUNCTIONS =====

async function generateWithNanoBananaPro(prompt: string, imageUrl?: string, count: number = 1): Promise<string[]> {
  const input: Record<string, unknown> = { prompt, resolution: "2K" };
  const model = imageUrl ? "fal-ai/nano-banana-pro/edit" : "fal-ai/nano-banana-pro";
  if (imageUrl) input.image_urls = [imageUrl];
  // Nano Banana doesn't support num_images > 1, run in parallel
  if (count > 1 && !imageUrl) {
    const results = await Promise.all(
      Array.from({ length: count }, () => fal.run(model, { input }) as Promise<FalResult>)
    );
    return results.flatMap(r => r?.images?.map(i => i.url) || []).filter(Boolean);
  }
  const result = (await fal.run(model, { input })) as FalResult;
  return result?.images?.map(i => i.url).filter(Boolean) || [];
}

async function generateWithGPTImage(prompt: string, imageUrl?: string): Promise<string[]> {
  const input: Record<string, unknown> = { prompt, quality: "high", size: "1024x1024" };
  if (imageUrl) input.image_urls = [imageUrl];
  const result = (await fal.run("fal-ai/gpt-image-1.5/edit", { input })) as FalResult;
  return result?.images?.map(i => i.url).filter(Boolean) || [];
}

async function generateWithKontext(imageUrl: string, editInstruction: string, imageSize: string): Promise<string[]> {
  const result = (await fal.run("fal-ai/flux-pro/kontext", {
    input: { image_url: imageUrl, prompt: editInstruction, image_size: imageSize, num_images: 1 },
  })) as FalResult;
  return result?.images?.map(i => i.url).filter(Boolean) || [];
}

async function generateWithSeedream(prompt: string, imageUrl?: string): Promise<string[]> {
  const input: Record<string, unknown> = { prompt };
  const model = imageUrl ? "fal-ai/bytedance/seedream/v4.5/edit" : "fal-ai/bytedance/seedream/v4.5/text-to-image";
  if (imageUrl) input.image_urls = [imageUrl];
  else input.image_size = "square_hd";
  const result = (await fal.run(model, { input })) as FalResult;
  return result?.images?.map(i => i.url).filter(Boolean) || [];
}

async function generateWithFluxFallback(prompt: string, imageSize: string, count: number = 1): Promise<string[]> {
  const result = (await fal.run("fal-ai/flux-pro/v1.1", {
    input: { prompt, image_size: imageSize, num_images: count, safety_tolerance: "2" },
  })) as FalResult;
  return result?.images?.map(i => i.url).filter(Boolean) || [];
}

// ===== MAIN HANDLER =====

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
Reference Image Provided: ${hasImage ? "Yes — user uploaded an image they want edited/used." : "No"}`;

    if (referenceImageDescription) {
      userMessage += `\nUser's instruction for the image: ${referenceImageDescription}`;
    }
    if (clientContext) {
      userMessage += `\n\n${clientContext}`;
    }

    // Upload reference image to FAL storage if provided
    let falImageUrl: string | undefined;
    if (hasImage) {
      falImageUrl = await uploadToFal(referenceImageBase64);
    }

    const anthropic = new Anthropic();

    // =============================================
    // PASS 1: Creative Concept Generation
    // =============================================
    let conceptResponse: ConceptResponse | null = null;
    let selectedConcept;

    try {
      const conceptMsg = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 4096,
        system: CONCEPT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      logUsage(clientName, "generate", "claude-3-haiku-20240307");

      const rawConcept = conceptMsg.content[0].type === "text" ? conceptMsg.content[0].text : "";
      const cleanedConcept = rawConcept.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const jsonMatch = cleanedConcept.match(/\{[\s\S]*\}/);
      conceptResponse = JSON.parse(jsonMatch ? jsonMatch[0] : cleanedConcept);
      selectedConcept = conceptResponse!.concepts[0];
      console.log("Pass 1 — Concept:", selectedConcept?.concept_name);
    } catch (e) {
      console.error("Pass 1 (Concept) failed, falling back to legacy:", e instanceof Error ? e.message : "");
    }

    // =============================================
    // FALLBACK: If Pass 1 failed, use legacy single-shot
    // =============================================
    if (!conceptResponse || !selectedConcept) {
      console.log("Using legacy single-shot pipeline");
      const legacyMsg = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 2048,
        system: GENERATE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });
      logUsage(clientName, "generate", "claude-3-haiku-20240307");

      const rawLegacy = legacyMsg.content[0].type === "text" ? legacyMsg.content[0].text : "";
      const cleanedLegacy = rawLegacy.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const legacyMatch = cleanedLegacy.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(legacyMatch ? legacyMatch[0] : cleanedLegacy);

      const layout: AdLayout = { ...DEFAULT_LAYOUT, ...(parsed.layout || {}) };
      const adCopy = { headline: parsed.headline, subheadline: parsed.subheadline, cta: parsed.cta, offer: parsed.offer || "" };

      // Generate images with Nano Banana Pro (new default)
      let bgUrls: string[] = [];
      try {
        bgUrls = await generateWithNanoBananaPro(parsed.image_prompt, falImageUrl, 2);
      } catch {
        bgUrls = await generateWithFluxFallback(parsed.image_prompt, imageSize, 2);
      }
      logUsage(clientName, "generate", "fal-ai/nano-banana-pro");

      const variations = await Promise.all(
        bgUrls.map(async (bgUrl) => {
          try {
            const { composited } = await compositeAdImage(bgUrl, adCopy, layout, outputFormat);
            return { imageUrl: composited, bgImageUrl: bgUrl };
          } catch { return { imageUrl: bgUrl, bgImageUrl: bgUrl }; }
        })
      );

      return NextResponse.json({
        imageUrl: variations[0]?.imageUrl || "",
        bgImageUrl: variations[0]?.bgImageUrl || "",
        prompt: parsed.image_prompt,
        adCopy,
        layout,
        modelUsed: "nano_banana_pro",
        variations,
      });
    }

    // =============================================
    // PASS 2: Image Generation (Nano Banana Pro default)
    // =============================================
    const modelKey = selectedConcept.model_selection || "nano_banana_pro";
    let bgImageUrls: string[] = [];

    try {
      switch (modelKey) {
        case "flux_kontext":
          bgImageUrls = falImageUrl
            ? await generateWithKontext(falImageUrl, selectedConcept.edit_instruction || selectedConcept.image_prompt, imageSize)
            : await generateWithNanoBananaPro(selectedConcept.image_prompt, undefined, 2);
          break;
        case "gpt_image":
          bgImageUrls = await generateWithGPTImage(selectedConcept.edit_instruction || selectedConcept.image_prompt, falImageUrl);
          break;
        case "seedream":
          bgImageUrls = await generateWithSeedream(selectedConcept.image_prompt, falImageUrl);
          break;
        case "nano_banana_pro":
        default:
          bgImageUrls = await generateWithNanoBananaPro(
            selectedConcept.image_prompt,
            falImageUrl,
            hasImage ? 1 : 2
          );
          break;
      }
    } catch (modelErr) {
      console.error(`Model ${modelKey} failed:`, modelErr instanceof Error ? modelErr.message : "");
      try {
        bgImageUrls = await generateWithNanoBananaPro(selectedConcept.image_prompt, falImageUrl, 1);
      } catch {
        bgImageUrls = await generateWithFluxFallback(selectedConcept.image_prompt, imageSize, 2);
      }
    }

    if (bgImageUrls.length === 0) {
      return NextResponse.json({ error: "Failed to generate images." }, { status: 500 });
    }

    logUsage(clientName, "generate", `fal-ai/${modelKey === "nano_banana_pro" ? "nano-banana-pro" : modelKey}`);
    console.log(`Pass 2 — Generated ${bgImageUrls.length} images with ${modelKey}`);

    // =============================================
    // PASS 3: Typography Design
    // =============================================
    let typographyDesign: TypographyDesign | null = null;

    try {
      const typographyInput = JSON.stringify({
        concept: selectedConcept.concept_name,
        visual_metaphor: selectedConcept.visual_metaphor,
        text_placement_strategy: selectedConcept.text_placement_strategy,
        palette: selectedConcept.suggested_palette,
        ad_copy: conceptResponse.ad_copy,
        trust_line: conceptResponse.trust_line,
        category: adType,
        output_format: outputFormat,
      });

      const typographyMsg = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 2048,
        system: TYPOGRAPHY_SYSTEM_PROMPT,
        messages: [{ role: "user", content: typographyInput }],
      });

      logUsage(clientName, "generate", "claude-3-haiku-20240307");

      const rawTypo = typographyMsg.content[0].type === "text" ? typographyMsg.content[0].text : "";
      const cleanedTypo = rawTypo.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const typoMatch = cleanedTypo.match(/\{[\s\S]*\}/);
      typographyDesign = JSON.parse(typoMatch ? typoMatch[0] : cleanedTypo);
      console.log("Pass 3 — Typography designed, position:", typographyDesign?.text_position);
    } catch (e) {
      console.error("Pass 3 (Typography) failed, using legacy layout:", e instanceof Error ? e.message : "");
    }

    // =============================================
    // COMPOSITING: Apply typography or legacy layout
    // =============================================
    const adCopy = conceptResponse.ad_copy;
    let layout: AdLayout;

    const variations = await Promise.all(
      bgImageUrls.map(async (bgUrl) => {
        try {
          if (typographyDesign) {
            const { composited } = await compositeAdImageV2(bgUrl, typographyDesign, outputFormat);
            return { imageUrl: composited, bgImageUrl: bgUrl };
          } else {
            layout = DEFAULT_LAYOUT;
            const { composited } = await compositeAdImage(bgUrl, adCopy, layout, outputFormat);
            return { imageUrl: composited, bgImageUrl: bgUrl };
          }
        } catch {
          return { imageUrl: bgUrl, bgImageUrl: bgUrl };
        }
      })
    );

    // Convert typography to legacy layout for EditChat compatibility
    layout = typographyDesign ? convertTypographyToLegacyLayout(typographyDesign) : DEFAULT_LAYOUT;

    return NextResponse.json({
      imageUrl: variations[0]?.imageUrl || "",
      bgImageUrl: variations[0]?.bgImageUrl || "",
      prompt: selectedConcept.image_prompt,
      adCopy,
      layout,
      modelUsed: modelKey,
      variations,
      concepts: conceptResponse.concepts,
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
