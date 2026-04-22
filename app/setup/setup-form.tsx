"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SetupPayload = {
  repoFullName: string;
  githubToken: string;
  notionToken: string;
  notionDatabaseId: string;
  githubWebhookSecret: string;
  notionWebhookSecret: string;
};

const initialState: SetupPayload = {
  repoFullName: "",
  githubToken: "",
  notionToken: "",
  notionDatabaseId: "",
  githubWebhookSecret: "",
  notionWebhookSecret: ""
};

export function SetupForm() {
  const router = useRouter();
  const [form, setForm] = useState<SetupPayload>(initialState);
  const [saving, setSaving] = useState(false);

  const updateField = (key: keyof SetupPayload, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    try {
      const githubResult = await fetch("/api/auth/github", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: form.githubToken, repoFullName: form.repoFullName })
      });

      if (!githubResult.ok) {
        const payload = (await githubResult.json()) as { error?: string };
        throw new Error(payload.error ?? "GitHub verification failed");
      }

      const notionResult = await fetch("/api/auth/notion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: form.notionToken, databaseId: form.notionDatabaseId })
      });

      if (!notionResult.ok) {
        const payload = (await notionResult.json()) as { error?: string };
        throw new Error(payload.error ?? "Notion verification failed");
      }

      const saveResult = await fetch("/api/repos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form)
      });

      if (!saveResult.ok) {
        const payload = (await saveResult.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to save connection");
      }

      toast.success("Repository connection saved.");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Setup failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mx-auto max-w-3xl bg-[#111827]/90">
      <CardHeader>
        <CardTitle>Connect GitHub and Notion</CardTitle>
        <CardDescription>
          This deployment is a single-repo starter. Add one repository and one Notion database.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="repoFullName">Repository full name</Label>
            <Input
              id="repoFullName"
              value={form.repoFullName}
              onChange={(event) => updateField("repoFullName", event.target.value)}
              autoComplete="off"
              required
            />
            <p className="text-xs text-slate-400">Use owner/repo format, for example acme/ship-fast.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="githubToken">GitHub token</Label>
            <Input
              id="githubToken"
              type="password"
              value={form.githubToken}
              onChange={(event) => updateField("githubToken", event.target.value)}
              autoComplete="off"
              required
            />
            <p className="text-xs text-slate-400">
              Required scopes: repo, read:org, write:discussion. Store a token dedicated to this integration.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notionToken">Notion integration token</Label>
            <Input
              id="notionToken"
              type="password"
              value={form.notionToken}
              onChange={(event) => updateField("notionToken", event.target.value)}
              autoComplete="off"
              required
            />
            <p className="text-xs text-slate-400">
              Share your target database with the integration before saving.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notionDatabaseId">Notion database ID</Label>
            <Input
              id="notionDatabaseId"
              value={form.notionDatabaseId}
              onChange={(event) => updateField("notionDatabaseId", event.target.value)}
              autoComplete="off"
              required
            />
            <p className="text-xs text-slate-400">The UUID from your Notion database URL.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="githubWebhookSecret">GitHub webhook secret</Label>
              <Input
                id="githubWebhookSecret"
                type="password"
                value={form.githubWebhookSecret}
                onChange={(event) => updateField("githubWebhookSecret", event.target.value)}
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notionWebhookSecret">Notion webhook secret</Label>
              <Input
                id="notionWebhookSecret"
                type="password"
                value={form.notionWebhookSecret}
                onChange={(event) => updateField("notionWebhookSecret", event.target.value)}
                autoComplete="off"
                required
              />
            </div>
          </div>

          <Button className="w-full" type="submit" disabled={saving}>
            {saving ? "Verifying and saving..." : "Save connection"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
