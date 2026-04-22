"use client";

import useSWR from "swr";

import { Label } from "@/components/ui/label";

type Repo = {
  id: number;
  name: string;
  fullName: string;
};

type RepoResponse = {
  repos?: Repo[];
  error?: string;
};

type RepoSelectorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const fetcher = async (url: string): Promise<RepoResponse> => {
  const response = await fetch(url);
  const json = (await response.json()) as RepoResponse;

  if (!response.ok) {
    throw new Error(json.error || "Failed to load repositories.");
  }

  return json;
};

export function RepoSelector({ value, onChange, disabled }: RepoSelectorProps) {
  const { data, error, isLoading } = useSWR<RepoResponse>("/api/github/repos", fetcher);
  const repos = data?.repos ?? [];

  return (
    <div className="space-y-2">
      <Label htmlFor="repo-selector">GitHub Repository</Label>
      <select
        id="repo-selector"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || isLoading}
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-[#2f81f7]/50 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <option value="">Select a repository</option>
        {repos.map((repo) => (
          <option key={repo.id} value={repo.fullName}>
            {repo.fullName}
          </option>
        ))}
      </select>
      {isLoading ? <p className="text-xs text-muted-foreground">Loading repositories...</p> : null}
      {error ? <p className="text-xs text-[#da3633]">{error.message}</p> : null}
      {!isLoading && !error && repos.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No repositories returned. Check token scope (`repo` for private repos).
        </p>
      ) : null}
    </div>
  );
}
