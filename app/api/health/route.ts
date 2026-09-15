import { getDatabase } from "@netlify/database";

export const dynamic = "force-dynamic";

/** Public health probe. Must prove a real DB round-trip (API_CONTRACT §12). */
export async function GET() {
  try {
    const db = getDatabase();
    const rows = await db.sql<{ ok: number }>`SELECT 1 AS ok`;
    const ok = rows.length === 1 && Number(rows[0]?.ok) === 1;
    return Response.json(
      { status: ok ? "ok" : "degraded", database: ok ? "up" : "unexpected" },
      { status: ok ? 200 : 503 },
    );
  } catch (error) {
    console.error("[health] database check failed", error);
    return Response.json({ status: "error", database: "down" }, { status: 503 });
  }
}
