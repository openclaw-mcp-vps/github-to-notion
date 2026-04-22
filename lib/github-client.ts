import { Octokit } from "@octokit/rest";

export type GitHubIssueShape = {
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  htmlUrl: string;
  updatedAt: string;
  type: "issue" | "pull_request";
};

export function parseRepoFullName(repo: string): { owner: string; repo: string } {
  const [owner, name] = repo.split("/");

  if (!owner || !name) {
    throw new Error("Repository must use owner/repo format.");
  }

  return { owner, repo: name };
}

function client(token: string): Octokit {
  return new Octokit({ auth: token });
}

export async function listGitHubRepos(token: string): Promise<Array<{ id: number; name: string; fullName: string }>> {
  const octokit = client(token);

  const response = await octokit.repos.listForAuthenticatedUser({
    sort: "updated",
    per_page: 100
  });

  return response.data.map((repo) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name
  }));
}

export async function listRecentRepoItems(
  token: string,
  repoFullName: string,
  limit = 30
): Promise<GitHubIssueShape[]> {
  const octokit = client(token);
  const { owner, repo } = parseRepoFullName(repoFullName);

  const response = await octokit.issues.listForRepo({
    owner,
    repo,
    state: "all",
    sort: "updated",
    direction: "desc",
    per_page: Math.min(limit, 100)
  });

  return response.data.map((item) => ({
    number: item.number,
    title: item.title,
    body: item.body || "",
    state: item.state === "closed" ? "closed" : "open",
    htmlUrl: item.html_url,
    updatedAt: item.updated_at,
    type: item.pull_request ? "pull_request" : "issue"
  }));
}

export async function updateGitHubItemFromNotion(
  token: string,
  repoFullName: string,
  itemNumber: number,
  title: string,
  body: string,
  state: "open" | "closed"
): Promise<void> {
  const octokit = client(token);
  const { owner, repo } = parseRepoFullName(repoFullName);

  await octokit.issues.update({
    owner,
    repo,
    issue_number: itemNumber,
    title,
    body,
    state
  });
}

export async function createGitHubIssueFromNotion(
  token: string,
  repoFullName: string,
  title: string,
  body: string
): Promise<{ number: number; updatedAt: string }> {
  const octokit = client(token);
  const { owner, repo } = parseRepoFullName(repoFullName);

  const response = await octokit.issues.create({
    owner,
    repo,
    title,
    body
  });

  return {
    number: response.data.number,
    updatedAt: response.data.updated_at
  };
}

export async function addGitHubComment(
  token: string,
  repoFullName: string,
  issueNumber: number,
  body: string
): Promise<void> {
  const octokit = client(token);
  const { owner, repo } = parseRepoFullName(repoFullName);

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body
  });
}
