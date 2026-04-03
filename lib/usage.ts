import { sql } from "@vercel/postgres";

// Cost per API call (approximate)
const MODEL_COSTS: Record<string, number> = {
  "claude-3-haiku-20240307": 0.001,
  "fal-ai/flux-2-pro": 0.06,
  "fal-ai/flux-2-pro/edit": 0.06,
  "fal-ai/flux-pro/v1.1": 0.05,
  "fal-ai/flux-pro/kontext": 0.05,
  "fal-ai/gpt-image-1.5/edit": 0.10,
  "fal-ai/nano-banana-pro": 0.15,
  "fal-ai/nano-banana-pro/edit": 0.15,
  "fal-ai/nano-banana-2": 0.15,
  "fal-ai/nano-banana-2/edit": 0.15,
  "fal-ai/bytedance/seedream/v4.5/text-to-image": 0.04,
  "fal-ai/bytedance/seedream/v4.5/edit": 0.04,
};

let tableEnsured = false;

async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS usage_logs (
        id SERIAL PRIMARY KEY,
        client_name VARCHAR(255) NOT NULL DEFAULT 'anonymous',
        route VARCHAR(50) NOT NULL,
        model VARCHAR(100) NOT NULL,
        estimated_cost DECIMAL(10,6) NOT NULL DEFAULT 0,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    tableEnsured = true;
  } catch (e) {
    console.error("Failed to ensure usage_logs table:", e);
  }
}

/**
 * Fire-and-forget usage logging. Never blocks or throws.
 */
export function logUsage(clientName: string, route: string, model: string): void {
  const cost = MODEL_COSTS[model] || 0.01;
  const client = clientName || "anonymous";

  // Don't await — fire and forget
  ensureTable()
    .then(() =>
      sql`INSERT INTO usage_logs (client_name, route, model, estimated_cost) VALUES (${client}, ${route}, ${model}, ${cost})`
    )
    .catch((e) => console.error("Usage log failed:", e));
}

/**
 * Extract client business name from the clientContext string.
 */
export function extractClientName(clientContext?: string): string {
  if (!clientContext) return "anonymous";
  const match = clientContext.match(/BUSINESS:\s*(.+)/i);
  return match ? match[1].trim() : "anonymous";
}
