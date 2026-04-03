// Maps service categories to icons and group tags for the selector UI
// Categories come dynamically from ClickUp client data or default list

export interface CategoryMeta {
  icon: string;
  tag: string;
  group: "surgical" | "non_surgical" | "aesthetic" | "wellness" | "marketing";
}

const CATEGORY_MAP: Record<string, CategoryMeta> = {
  // Surgical
  "Orthopedic Surgery": { icon: "\u{1FA7A}", tag: "SURGICAL \u00B7 GENERAL", group: "surgical" },
  "Spine Surgery": { icon: "\u{1F9B4}", tag: "SURGICAL \u00B7 SPINE", group: "surgical" },
  "Trauma Surgery": { icon: "\u{1FA79}", tag: "SURGICAL \u00B7 TRAUMA", group: "surgical" },
  "Hand Surgery": { icon: "\u{270B}", tag: "SURGICAL \u00B7 HAND", group: "surgical" },
  "Pediatric Orthopedics": { icon: "\u{1F9EC}", tag: "SURGICAL \u00B7 PEDIATRIC", group: "surgical" },
  "Plastic Surgery": { icon: "\u{2728}", tag: "SURGICAL \u00B7 COSMETIC", group: "surgical" },
  "Facial Surgery": { icon: "\u{1F48E}", tag: "SURGICAL \u00B7 FACIAL", group: "surgical" },
  "Breast Surgery": { icon: "\u{2728}", tag: "SURGICAL \u00B7 BREAST", group: "surgical" },
  "Body Contouring": { icon: "\u{2728}", tag: "SURGICAL \u00B7 BODY", group: "surgical" },

  // Non-Surgical / Sports
  "Sports Medicine": { icon: "\u{26A1}", tag: "NON-SURGICAL \u00B7 SPORTS", group: "non_surgical" },
  "Chiropractic Care": { icon: "\u{1F9B4}", tag: "NON-SURGICAL \u00B7 CHIRO", group: "non_surgical" },
  "Chiropractic / Physical Therapy": { icon: "\u{1F9B4}", tag: "NON-SURGICAL \u00B7 CHIRO", group: "non_surgical" },

  // Aesthetic
  "Med Spa / Aesthetics": { icon: "\u{2728}", tag: "AESTHETIC \u00B7 SPA", group: "aesthetic" },
  "Injectables & Fillers": { icon: "\u{1F489}", tag: "AESTHETIC \u00B7 INJECT", group: "aesthetic" },
  "Skin Treatments": { icon: "\u{2728}", tag: "AESTHETIC \u00B7 SKIN", group: "aesthetic" },
  "Cosmetic Dentistry": { icon: "\u{1F601}", tag: "DENTAL \u00B7 COSMETIC", group: "aesthetic" },
  "Hair Restoration": { icon: "\u{2728}", tag: "AESTHETIC \u00B7 HAIR", group: "aesthetic" },

  // Wellness
  "Regenerative Medicine": { icon: "\u{1F52C}", tag: "WELLNESS \u00B7 REGEN", group: "wellness" },
  "Anti-Aging & Hormone Optimization": { icon: "\u{2726}", tag: "WELLNESS \u00B7 HORMONES", group: "wellness" },
  "Peptide / Anti-Aging / Functional Medicine": { icon: "\u{1F9EA}", tag: "WELLNESS \u00B7 PEPTIDE", group: "wellness" },
  "Peptide / Anti-Aging": { icon: "\u{1F9EA}", tag: "WELLNESS \u00B7 PEPTIDE", group: "wellness" },
  "IV Therapy": { icon: "\u{1F9EA}", tag: "WELLNESS \u00B7 IV", group: "wellness" },
  "Functional Medicine": { icon: "\u{1F52C}", tag: "WELLNESS \u00B7 FUNCTIONAL", group: "wellness" },
  "Weight Loss": { icon: "\u{26A1}", tag: "WELLNESS \u00B7 WEIGHT", group: "wellness" },
  "Men's Health / TRT": { icon: "\u{1F4AA}", tag: "WELLNESS \u00B7 TRT", group: "wellness" },

  // Marketing
  "Offer or Promotion": { icon: "\u{25C8}", tag: "MARKETING \u00B7 PROMO", group: "marketing" },
  "Authority / Doctor Positioning": { icon: "\u{1F464}", tag: "BRANDING \u00B7 TRUST", group: "marketing" },
  "Practice Branding": { icon: "\u{25C9}", tag: "BRANDING \u00B7 IDENTITY", group: "marketing" },
};

const GROUP_LABELS: Record<string, string> = {
  surgical: "Surgical",
  non_surgical: "Non-Surgical & Therapy",
  aesthetic: "Aesthetic & Cosmetic",
  wellness: "Wellness & Optimization",
  marketing: "Marketing & Branding",
};

export function getCategoryMeta(name: string): CategoryMeta {
  return CATEGORY_MAP[name] || { icon: "\u{25C6}", tag: "GENERAL", group: "marketing" };
}

export function groupCategories(categories: string[]): { group: string; label: string; items: string[] }[] {
  const grouped: Record<string, string[]> = {};

  for (const cat of categories) {
    const meta = getCategoryMeta(cat);
    if (!grouped[meta.group]) grouped[meta.group] = [];
    grouped[meta.group].push(cat);
  }

  const order = ["surgical", "non_surgical", "aesthetic", "wellness", "marketing"];
  return order
    .filter((g) => grouped[g]?.length)
    .map((g) => ({
      group: g,
      label: GROUP_LABELS[g] || g,
      items: grouped[g],
    }));
}
