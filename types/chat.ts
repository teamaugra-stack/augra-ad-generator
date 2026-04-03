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
  model_selection: "flux_standard" | "flux_kontext" | "gpt_image" | "nano_banana" | "seedream";
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
