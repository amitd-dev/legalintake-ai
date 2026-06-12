// GET /api/matters — leads with their notes/documents for the paralegal workspace.
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const matters = await query(`
      select l.id, l.created_at, l.name, l.phone, l.email, l.case_type, l.case_summary,
             l.urgency, l.qualification_status, l.source,
             (select count(*) from consultation_notes n where n.lead_id = l.id)        as note_count,
             (select coalesce(json_agg(json_build_object(
                 'id', d.id, 'type', d.type, 'filename', d.filename,
                 'status', d.status, 'created_at', d.created_at) order by d.created_at desc), '[]'::json)
              from documents d where d.lead_id = l.id)                                  as documents,
             (select n.structured from consultation_notes n
               where n.lead_id = l.id order by n.created_at desc limit 1)               as latest_note
      from leads l
      order by l.created_at desc
      limit 25
    `);
    return NextResponse.json({ matters });
  } catch (e) {
    console.error("/api/matters", e);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
}
