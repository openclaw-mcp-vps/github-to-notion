import { NextRequest, NextResponse } from "next/server";
import { getRepoConfigBySession, upsertRepoConfig } from "@/lib/database";
import { getAppSession, refreshPaidStatus } from "@/lib/session";

interface AuthRequestBody {
  githubToken?: string;
  repoFullName?: string;
  notionToken?: string;
  notionDatabaseId?: string;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    const clientId = process.env.GITHUB_CLIENT_ID;

    if (!clientId) {
      return NextResponse.json(
        {
          message:
            "Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to use OAuth. You can also configure a Personal Access Token in the dashboard."
        },
        { status: 400 }
      );
    }

    const callbackUrl = `${request.nextUrl.origin}/api/auth/github`;
    const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("scope", "repo read:org");
    authorizeUrl.searchParams.set("redirect_uri", callbackUrl);

    return NextResponse.redirect(authorizeUrl);
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ message: "GitHub OAuth is not configured." }, { status: 400 });
  }

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code
    })
  });

  if (!tokenResponse.ok) {
    return NextResponse.json({ message: "GitHub OAuth token exchange failed." }, { status: 502 });
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    error_description?: string;
  };

  if (!tokenData.access_token) {
    return NextResponse.json({ message: tokenData.error_description || "GitHub did not return an access token." }, { status: 400 });
  }

  return NextResponse.json({
    accessToken: tokenData.access_token,
    message: "OAuth succeeded. Paste this token in dashboard setup or complete your own secure token handoff flow."
  });
}

export async function POST(request: NextRequest) {
  const session = await getAppSession();
  const paid = await refreshPaidStatus(session);

  if (!paid) {
    return NextResponse.json({ message: "Upgrade required." }, { status: 402 });
  }

  const body = (await request.json()) as AuthRequestBody;
  const current = await getRepoConfigBySession(session.sid as string);

  const repoFullName = body.repoFullName || current?.repoFullName;
  const githubToken = body.githubToken || current?.githubToken;
  const notionToken = body.notionToken || current?.notionToken;
  const notionDatabaseId = body.notionDatabaseId || current?.notionDatabaseId;

  if (!repoFullName || !githubToken || !notionToken || !notionDatabaseId) {
    return NextResponse.json(
      {
        message: "repoFullName, githubToken, notionToken, and notionDatabaseId are required to initialize sync."
      },
      { status: 400 }
    );
  }

  const config = await upsertRepoConfig({
    sessionId: session.sid as string,
    repoFullName,
    githubToken,
    notionToken,
    notionDatabaseId
  });

  return NextResponse.json({
    ok: true,
    config: {
      repoFullName: config.repoFullName,
      notionDatabaseId: config.notionDatabaseId
    }
  });
}
