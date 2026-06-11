// One-time schema migration over HTTP (DO Managed Postgres has no web SQL editor).
// POST /api/admin/migrate?token=MIGRATE_TOKEN
import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!process.env.MIGRATE_TOKEN || token !== process.env.MIGRATE_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const sql = readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8");
    await getPool().query(sql);
    const tables = await getPool().query(
      `select table_name from information_schema.tables where table_schema='public' order by table_name`
    );
    return NextResponse.json({ ok: true, tables: tables.rows.map((r) => r.table_name) });
  } catch (e) {
    console.error("migrate failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "migration failed" }, { status: 500 });
  }
}
