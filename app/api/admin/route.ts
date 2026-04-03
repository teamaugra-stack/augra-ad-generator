import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey || key !== adminKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Ensure table exists
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

    // Per-client summary
    const clientSummary = await sql`
      SELECT
        client_name,
        COUNT(*) FILTER (WHERE route = 'generate') AS generations,
        COUNT(*) FILTER (WHERE route = 'chat') AS edits,
        COUNT(*) AS total_calls,
        COALESCE(SUM(estimated_cost), 0) AS total_cost
      FROM usage_logs
      GROUP BY client_name
      ORDER BY total_cost DESC
    `;

    // Model breakdown
    const modelBreakdown = await sql`
      SELECT
        model,
        COUNT(*) AS call_count,
        COALESCE(SUM(estimated_cost), 0) AS total_cost
      FROM usage_logs
      GROUP BY model
      ORDER BY total_cost DESC
    `;

    // Grand totals
    const totals = await sql`
      SELECT
        COUNT(*) AS total_calls,
        COALESCE(SUM(estimated_cost), 0) AS total_cost,
        MIN(timestamp) AS first_log,
        MAX(timestamp) AS last_log
      FROM usage_logs
    `;

    // Recent activity (last 50)
    const recent = await sql`
      SELECT client_name, route, model, estimated_cost, timestamp
      FROM usage_logs
      ORDER BY timestamp DESC
      LIMIT 50
    `;

    return NextResponse.json({
      clients: clientSummary.rows,
      models: modelBreakdown.rows,
      totals: totals.rows[0],
      recent: recent.rows,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Admin query error:", errMsg);
    return NextResponse.json({ error: `Database error: ${errMsg}` }, { status: 500 });
  }
}
