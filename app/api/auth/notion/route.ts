import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { optionalEnv } from "@/lib/env";
import { updateState } from "@/lib/storage";

const STATE_COOKIE = "gtn_notion_oauth_state";

function makeRedirectUri(request: NextRequest): string {
  return (
    optionalEnv("NOTION_OAUTH_REDIRECT_URL") ||
    `${request.nextUrl.protocol}//${request.nextUrl.host}/api/auth/notion`
  );
}

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const clientId = optionalEnv("NOTION_CLIENT_ID");
  const clientSecret = optionalEnv("NOTION_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Set NOTION_CLIENT_ID and NOTION_CLIENT_SECRET before using OAuth." },
      { status: 500 }
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  const incomingState = request.nextUrl.searchParams.get("state");
  const redirectUri = makeRedirectUri(request);

  if (!code) {
    const state = randomUUID();
    const authUrl = new URL("https://api.notion.com/v1/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("owner", "user");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set({
      name: STATE_COOKIE,
      value: state,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/"
    });

    return response;
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;

  if (!incomingState || !expectedState || incomingState !== expectedState) {
    return NextResponse.json({ error: "Notion OAuth state mismatch." }, { status: 400 });
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri
    })
  });

  if (!tokenResponse.ok) {
    return NextResponse.json({ error: "Notion token exchange failed." }, { status: 502 });
  }

  const payload = (await tokenResponse.json()) as {
    access_token?: string;
    workspace_name?: string;
    duplicated_template_id?: string;
  };

  if (!payload.access_token) {
    return NextResponse.json({ error: "Notion OAuth token missing." }, { status: 502 });
  }

  await updateState((state) => {
    state.config.notionToken = payload.access_token as string;
  });

  const response = NextResponse.redirect(new URL("/setup?notion=connected", request.url));
  response.cookies.set({
    name: STATE_COOKIE,
    value: "",
    maxAge: 0,
    path: "/"
  });

  return response;
}
