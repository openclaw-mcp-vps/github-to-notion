"use client";

import useSWR from "swr";

import { Label } from "@/components/ui/label";

type Database = {
  id: string;
  title: string;
};

type DatabaseResponse = {
  databases?: Database[];
  error?: string;
};

type DatabaseSelectorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const fetcher = async (url: string): Promise<DatabaseResponse> => {
  const response = await fetch(url);
  const json = (await response.json()) as DatabaseResponse;

  if (!response.ok) {
    throw new Error(json.error || "Failed to load databases.");
  }

  return json;
};

export function DatabaseSelector({ value, onChange, disabled }: DatabaseSelectorProps) {
  const { data, error, isLoading } = useSWR<DatabaseResponse>("/api/notion/databases", fetcher);
  const databases = data?.databases ?? [];

  return (
    <div className="space-y-2">
      <Label htmlFor="database-selector">Notion Database</Label>
      <select
        id="database-selector"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || isLoading}
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-[#2f81f7]/50 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <option value="">Select a database</option>
        {databases.map((database) => (
          <option key={database.id} value={database.id}>
            {database.title}
          </option>
        ))}
      </select>
      {isLoading ? <p className="text-xs text-muted-foreground">Loading databases...</p> : null}
      {error ? <p className="text-xs text-[#da3633]">{error.message}</p> : null}
      {!isLoading && !error && databases.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No databases returned. Share the database with your Notion integration first.
        </p>
      ) : null}
    </div>
  );
}
