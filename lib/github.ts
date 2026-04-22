import { Octokit } from "@octokit/rest";

export type WorkItemType = "issue" | "pull_request";

export type GitHubWorkItem = {
  type: WorkItemType;
  githubId: string;
  number: number;
  title: string;
  body: string;
  state: "open" | "closed" | "merged";
  url: string;
  author: string;
  updatedAt: string;
};

export type GitHubCommentItem = {
  githubId: string;
  issueNumber: number;
  body: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  url: string;
};

function createClient(token: string) {
  return new Octokit({ auth: token });
}

export function parseRepoFullName(repoFullName: string) {
  const [owner, repo] = repoFullName.split("/");
  if (!owner || !repo) {
    throw new Error("Repository must be in owner/repo format.");
  }

  return { owner, repo };
}

function toWorkItem(issue: any): GitHubWorkItem {
  const isPr = Boolean(issue.pull_request);

  return {
    type: isPr ? "pull_request" : "issue",
    githubId: String(issue.id),
    number: issue.number,
    title: issue.title,
    body: issue.body ?? "",
    state: issue.state,
    url: issue.html_url,
    author: issue.user?.login ?? "unknown",
    updatedAt: issue.updated_at
  };
}

export async function verifyGitHubAccess(token: string, repoFullName: string) {
  const { owner, repo } = parseRepoFullName(repoFullName);
  const octokit = createClient(token);

  const { data } = await octokit.rest.repos.get({ owner, repo });

  return {
    owner,
    repo,
    fullName: data.full_name,
    defaultBranch: data.default_branch,
    visibility: data.private ? "private" : "public",
    url: data.html_url
  };
}

export async function fetchRecentGitHubItems(input: {
  token: string;
  owner: string;
  repo: string;
  perPage?: number;
}) {
  const octokit = createClient(input.token);
  const { data } = await octokit.rest.issues.listForRepo({
    owner: input.owner,
    repo: input.repo,
    state: "all",
    sort: "updated",
    direction: "desc",
    per_page: input.perPage ?? 50
  });

  return data.map(toWorkItem);
}

export async function fetchIssueComments(input: {
  token: string;
  owner: string;
  repo: string;
  issueNumber: number;
}) {
  const octokit = createClient(input.token);

  const { data } = await octokit.rest.issues.listComments({
    owner: input.owner,
    repo: input.repo,
    issue_number: input.issueNumber,
    per_page: 100
  });

  return data.map(
    (comment): GitHubCommentItem => ({
      githubId: String(comment.id),
      issueNumber: input.issueNumber,
      body: comment.body ?? "",
      author: comment.user?.login ?? "unknown",
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      url: comment.html_url
    })
  );
}

export async function createIssueFromNotion(input: {
  token: string;
  owner: string;
  repo: string;
  title: string;
  body: string;
}) {
  const octokit = createClient(input.token);

  const { data } = await octokit.rest.issues.create({
    owner: input.owner,
    repo: input.repo,
    title: input.title,
    body: input.body
  });

  return toWorkItem(data);
}

export async function updateWorkItemFromNotion(input: {
  token: string;
  owner: string;
  repo: string;
  itemType: WorkItemType;
  number: number;
  title?: string;
  body?: string;
  state?: "open" | "closed";
}) {
  const octokit = createClient(input.token);

  if (input.itemType === "issue") {
    const { data } = await octokit.rest.issues.update({
      owner: input.owner,
      repo: input.repo,
      issue_number: input.number,
      title: input.title,
      body: input.body,
      state: input.state
    });

    return toWorkItem(data);
  }

  const { data } = await octokit.rest.pulls.update({
    owner: input.owner,
    repo: input.repo,
    pull_number: input.number,
    title: input.title,
    body: input.body,
    state: input.state
  });

  const state: "open" | "closed" | "merged" = data.merged_at
    ? "merged"
    : data.state === "closed"
      ? "closed"
      : "open";

  return {
    type: "pull_request" as const,
    githubId: String(data.id),
    number: data.number,
    title: data.title,
    body: data.body ?? "",
    state,
    url: data.html_url,
    author: data.user?.login ?? "unknown",
    updatedAt: data.updated_at
  };
}

export async function createCommentFromNotion(input: {
  token: string;
  owner: string;
  repo: string;
  issueNumber: number;
  body: string;
}) {
  const octokit = createClient(input.token);

  const { data } = await octokit.rest.issues.createComment({
    owner: input.owner,
    repo: input.repo,
    issue_number: input.issueNumber,
    body: input.body
  });

  return {
    githubId: String(data.id),
    issueNumber: input.issueNumber,
    body: data.body ?? "",
    author: data.user?.login ?? "unknown",
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    url: data.html_url
  };
}

export async function updateCommentFromNotion(input: {
  token: string;
  owner: string;
  repo: string;
  commentId: number;
  body: string;
}) {
  const octokit = createClient(input.token);

  const { data } = await octokit.rest.issues.updateComment({
    owner: input.owner,
    repo: input.repo,
    comment_id: input.commentId,
    body: input.body
  });

  return {
    githubId: String(data.id),
    issueNumber: data.issue_url.split("/").pop() ? Number(data.issue_url.split("/").pop()) : 0,
    body: data.body ?? "",
    author: data.user?.login ?? "unknown",
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    url: data.html_url
  };
}
