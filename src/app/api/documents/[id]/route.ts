// GET /api/documents/:id — download a generated document (PDF).
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const rows = await query<{ filename: string; content: Buffer }>(
    "select filename, content from documents where id=$1",
    [params.id]
  );
  if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  const isPdf = rows[0].filename.toLowerCase().endsWith(".pdf");
  return new NextResponse(new Uint8Array(rows[0].content), {
    headers: {
      "content-type": isPdf ? "application/pdf" : "text/plain; charset=utf-8",
      "content-disposition": `inline; filename="${rows[0].filename}"`
    }
  });
}
