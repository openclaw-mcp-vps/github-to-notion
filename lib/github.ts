import crypto from "node:crypto";
import { Octokit } from "@octokit/rest";

export interface GitHubIssuePayload {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: "open" | "closed";
  updated_at: string;
  user?: {
    login?: string;
  };
  pull_request?: {
    html_url?: string;
  };
}

export interface GitHubCommentPayload {
  id: number;
  body: string;
  html_url: string;
  user?: {
    login?: string;
  };
  created_at: string;
  updated_at: string;
}

export function getGitHubClient(token: string) {
  return new Octokit({ auth: token });
}

export function verifyGitHubSignature(rawBody: string, signature: string | null) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    return true;
  }

  if (!signature) {
    return false;
  }

  const digest = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const signatureBuffer = Buffer.from(signature, "utf8");
  const digestBuffer = Buffer.from(digest, "utf8");

  if (signatureBuffer.length !== digestBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, digestBuffer);
}

export function parseRepoFullName(repoFullName: string) {
  const [owner, repo] = repoFullName.split("/");

  if (!owner || !repo) {
    throw new Error(`Invalid repo format: ${repoFullName}. Expected owner/repo`);
  }

  return { owner, repo };
}

export async function fetchRepositorySnapshot(repoFullName: string, githubToken: string, maxItems = 100) {
  const { owner, repo } = parseRepoFullName(repoFullName);
  const octokit = getGitHubClient(githubToken);

  const issues = await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner,
    repo,
    state: "all",
    sort: "updated",
    direction: "desc",
    per_page: 100
  });

  return issues.slice(0, maxItems).map((issue) => {
    const itemType: "issue" | "pull_request" = issue.pull_request ? "pull_request" : "issue";

    return {
      itemType,
      item: {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body ?? null,
        html_url: issue.html_url,
        state: issue.state,
        updated_at: issue.updated_at ?? new Date().toISOString(),
        user: {
          login: issue.user?.login
        },
        pull_request: issue.pull_request
          ? {
              html_url: issue.pull_request.html_url
            }
          : undefined
      } as GitHubIssuePayload
    };
  });
}

export async function updateGitHubIssueState(params: {
  githubToken: string;
  repoFullName: string;
  issueNumber: number;
  state: "open" | "closed";
}) {
  const { owner, repo } = parseRepoFullName(params.repoFullName);
  const octokit = getGitHubClient(params.githubToken);

  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: params.issueNumber,
    state: params.state
  });
}

export async function createGitHubComment(params: {
  githubToken: string;
  repoFullName: string;
  issueNumber: number;
  body: string;
}) {
  const { owner, repo } = parseRepoFullName(params.repoFullName);
  const octokit = getGitHubClient(params.githubToken);

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: params.issueNumber,
    body: params.body
  });
}
