export interface AdLayout {
  style:
    | "editorial_top"
    | "centered_hero"
    | "bottom_heavy"
    | "split_left"
    | "split_right"
    | "minimal_center"
    | "full_overlay";
  headline_position:
    | "top-left"
    | "top-center"
    | "center"
    | "bottom-left"
    | "bottom-center";
  headline_size: "xl" | "2xl" | "3xl" | "4xl";
  headline_color: string;
  headline_style: "uppercase" | "mixed" | "italic";
  subheadline_color: string;
  cta_style: "pill_white" | "pill_dark" | "outline" | "underline";
  cta_position: "bottom-center" | "bottom-left" | "bottom-right";
  accent_color: string;
  scrim_style:
    | "top_gradient"
    | "bottom_gradient"
    | "full_overlay"
    | "left_gradient"
    | "vignette"
    | "none";
  decorative:
    | "none"
    | "line_accent"
    | "border_frame"
    | "corner_marks";
}

export interface AdCopyData {
  headline: string;
  subheadline: string;
  cta: string;
  offer: string;
}

export interface GenerateResponse {
  image_prompt: string;
  headline: string;
  subheadline: string;
  cta: string;
  offer: string;
  layout: AdLayout;
  model_selection: "flux_standard" | "flux_kontext" | "gpt_image" | "nano_banana_pro" | "nano_banana_2" | "seedream";
  edit_instruction?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AdState {
  currentBgImageUrl: string;
  adCopy: AdCopyData;
  layout: AdLayout;
  imagePrompt: string;
  modelUsed: string;
  outputFormat: string;
  originalInputs: {
    adType: string;
    procedure: string;
    keyMessage: string;
    brandAssetNote: string;
  };
  referenceImageBase64?: string;
}

export interface ChatAction {
  type: "text_edit" | "image_edit" | "full_regen";
  updatedAdCopy: AdCopyData;
  updatedLayout: AdLayout;
  imageInstruction?: string;
  newImagePrompt?: string;
}

export interface ChatResponse {
  reply: string;
  updatedImageUrl: string;
  updatedBgImageUrl?: string;
  updatedAdCopy: AdCopyData;
  updatedLayout: AdLayout;
}

export interface ClientData {
  name: string;
  businessName: string;
  brandTone: string;
  services: string;
  website: string;
  logoUrl: string;
  targetAudience: string;
  objections: string;
  wordsToAvoid: string;
  ideasToAvoid: string;
  onboardingDoc: string;
  serviceCategories?: string[];
}

export interface TypographySegment {
  text: string;
  font_family: string; // "Inter" | "Playfair" | "BebasNeue" | "DancingScript" | "Outfit" | "RobotoSlab" | "Oswald"
  font_weight: number; // 400 or 700
  font_style: "normal" | "italic";
  font_size_factor: number; // multiplier: 1.0 = normal, 2.0 = double
  color: string; // hex or rgba
  letter_spacing: string;
  text_transform: "uppercase" | "lowercase" | "none";
}

export interface TypographyDesign {
  headline_segments: TypographySegment[];
  subheadline: {
    text: string;
    font_family: string;
    font_weight: number;
    color: string;
    font_size: number;
  };
  cta: {
    text: string;
    style: "pill_white" | "pill_dark" | "outline" | "underline" | "none";
    font_family: string;
  };
  offer?: {
    text: string;
    color: string;
    background: string;
  };
  text_position: "top-left" | "top-center" | "center" | "bottom-left" | "bottom-center" | "left-strip" | "right-strip" | "split-top-bottom";
  text_alignment: "left" | "center" | "right";
  scrim_style: string;
  accent_color: string;
  decorative: string;
}

export interface CreativeConcept {
  concept_name: string;
  visual_metaphor: string;
  emotional_angle: string;
  image_prompt: string;
  negative_prompt: string;
  edit_instruction?: string;
  text_placement_strategy: string;
  suggested_palette: { primary: string; accent: string; text: string };
  model_selection: string;
}

export interface ConceptResponse {
  concepts: CreativeConcept[];
  ad_copy: AdCopyData;
  trust_line: string;
}
