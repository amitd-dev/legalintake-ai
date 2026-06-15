// POST /api/admin/reset?token=MIGRATE_TOKEN&confirm=yes
// Wipes all demo/transactional data for a clean-slate demo. Token-protected and
// requires confirm=yes so it can never fire by accident. Schema (tables) is left
// intact — this only clears rows.
import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

const TABLES = [
  "leads",
  "conversations",
  "messages",
  "bookings",
  "events",
  "consultation_notes",
  "documents",
  "research_memos",
  "campaigns",
  "time_entries",
  "invoices",
  "deadlines",
  "discovery_reviews"
];

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const confirm = req.nextUrl.searchParams.get("confirm");
  if (!process.env.MIGRATE_TOKEN || token !== process.env.MIGRATE_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (confirm !== "yes") {
    return NextResponse.json(
      { error: "confirmation required", hint: "add &confirm=yes to wipe all demo data" },
      { status: 400 }
    );
  }
  try {
    // CASCADE handles FK order; RESTART IDENTITY resets any sequences.
    await getPool().query(`truncate table ${TABLES.join(", ")} restart identity cascade`);
    return NextResponse.json({ ok: true, cleared: TABLES });
  } catch (e) {
    console.error("reset failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "reset failed" }, { status: 500 });
  }
}
