import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyGitHubAccess } from "@/lib/github";
import { requirePaidApiAccess } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(20),
  repoFullName: z.string().min(3)
});

export async function POST(request: NextRequest) {
  const denied = requirePaidApiAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const body = schema.parse(await request.json());
    const repo = await verifyGitHubAccess(body.token, body.repoFullName);

    return NextResponse.json({
      ok: true,
      repo
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub auth failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
