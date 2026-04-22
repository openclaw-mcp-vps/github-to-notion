import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requirePaidApiAccess } from "@/lib/http";
import { verifyNotionAccess } from "@/lib/notion";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(20),
  databaseId: z.string().min(20)
});

export async function POST(request: NextRequest) {
  const denied = requirePaidApiAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const body = schema.parse(await request.json());
    const database = await verifyNotionAccess(body.token, body.databaseId);

    return NextResponse.json({
      ok: true,
      database
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notion auth failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
