import crypto from "node:crypto";
import { Client } from "@notionhq/client";
import type { GitHubCommentPayload, GitHubIssuePayload } from "@/lib/github";

interface DatabaseProperty {
  type: string;
}

type DatabaseProperties = Record<string, DatabaseProperty>;

const propertyCache = new Map<string, DatabaseProperties>();

export function getNotionClient(token: string) {
  return new Client({ auth: token });
}

function findPropertyName(properties: DatabaseProperties, validTypes: string[], preferredNames: string[]) {
  const preferredSet = new Set(preferredNames.map((name) => name.toLowerCase()));

  for (const [name, config] of Object.entries(properties)) {
    if (validTypes.includes(config.type) && preferredSet.has(name.toLowerCase())) {
      return name;
    }
  }

  for (const [name, config] of Object.entries(properties)) {
    if (validTypes.includes(config.type)) {
      return name;
    }
  }

  return null;
}

async function getDatabaseProperties(client: Client, databaseId: string) {
  const cached = propertyCache.get(databaseId);
  if (cached) {
    return cached;
  }

  const database = (await client.databases.retrieve({ database_id: databaseId })) as {
    properties: DatabaseProperties;
  };
  propertyCache.set(databaseId, database.properties);

  return database.properties;
}

function formatBodySnippet(body: string | null) {
  if (!body) {
    return "No description provided.";
  }

  return body.length > 1600 ? `${body.slice(0, 1600)}...` : body;
}

function buildGitHubProperties(params: {
  properties: DatabaseProperties;
  item: GitHubIssuePayload;
  itemType: "issue" | "pull_request";
}) {
  const { properties, item, itemType } = params;
  const titleProperty = findPropertyName(properties, ["title"], ["name", "title", "task"]);

  if (!titleProperty) {
    throw new Error("The selected Notion database is missing a title property.");
  }

  const statusProperty = findPropertyName(properties, ["status", "select"], ["status", "state"]);
  const numberProperty = findPropertyName(properties, ["number"], ["github number", "number"]);
  const urlProperty = findPropertyName(properties, ["url"], ["github url", "url", "link"]);
  const typeProperty = findPropertyName(properties, ["select", "rich_text"], ["type", "item type"]);
  const idProperty = findPropertyName(properties, ["rich_text"], ["github id", "external id"]);

  const pageProperties: Record<string, unknown> = {
    [titleProperty]: {
      title: [
        {
          type: "text",
          text: {
            content: `#${item.number} ${item.title}`.slice(0, 1900)
          }
        }
      ]
    }
  };

  if (statusProperty) {
    const stateName = item.state === "open" ? "Open" : "Closed";
    const statusType = properties[statusProperty]?.type;

    if (statusType === "status") {
      pageProperties[statusProperty] = {
        status: {
          name: stateName
        }
      };
    }

    if (statusType === "select") {
      pageProperties[statusProperty] = {
        select: {
          name: stateName
        }
      };
    }
  }

  if (numberProperty) {
    pageProperties[numberProperty] = {
      number: item.number
    };
  }

  if (urlProperty) {
    pageProperties[urlProperty] = {
      url: item.html_url
    };
  }

  if (typeProperty) {
    const typeFieldType = properties[typeProperty]?.type;

    if (typeFieldType === "select") {
      pageProperties[typeProperty] = {
        select: {
          name: itemType === "pull_request" ? "Pull Request" : "Issue"
        }
      };
    }

    if (typeFieldType === "rich_text") {
      pageProperties[typeProperty] = {
        rich_text: [
          {
            type: "text",
            text: {
              content: itemType === "pull_request" ? "Pull Request" : "Issue"
            }
          }
        ]
      };
    }
  }

  if (idProperty) {
    pageProperties[idProperty] = {
      rich_text: [
        {
          type: "text",
          text: {
            content: String(item.id)
          }
        }
      ]
    };
  }

  return pageProperties;
}

export async function upsertGitHubItemInNotion(params: {
  notionToken: string;
  notionDatabaseId: string;
  notionPageId?: string | null;
  item: GitHubIssuePayload;
  itemType: "issue" | "pull_request";
}) {
  const notion = getNotionClient(params.notionToken);
  const properties = await getDatabaseProperties(notion, params.notionDatabaseId);
  const pageProperties = buildGitHubProperties({ properties, item: params.item, itemType: params.itemType }) as Record<
    string,
    any
  >;

  if (params.notionPageId) {
    try {
      await notion.pages.update({
        page_id: params.notionPageId,
        properties: pageProperties as any
      });

      return params.notionPageId;
    } catch {
      const databaseTitle = findPropertyName(properties, ["title"], ["name", "title", "task"]);
      if (!databaseTitle) {
        throw new Error("Cannot update Notion page because title property is unavailable.");
      }

      await notion.pages.update({
        page_id: params.notionPageId,
        properties: {
          [databaseTitle]: pageProperties[databaseTitle]
        } as any
      });

      return params.notionPageId;
    }
  }

  const created = (await notion.pages.create({
    parent: {
      database_id: params.notionDatabaseId
    },
    properties: pageProperties as any,
    children: [
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: {
                content: `${params.itemType === "pull_request" ? "Pull Request" : "Issue"} synced from GitHub (${params.item.html_url})`
              }
            }
          ]
        }
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: {
                content: formatBodySnippet(params.item.body)
              }
            }
          ]
        }
      }
    ]
  })) as { id: string };

  return created.id;
}

export async function appendGitHubCommentToNotion(params: {
  notionToken: string;
  notionPageId: string;
  comment: GitHubCommentPayload;
}) {
  const notion = getNotionClient(params.notionToken);
  const content = `[from GitHub] @${params.comment.user?.login || "unknown"}: ${params.comment.body || "(empty comment)"}`.slice(0, 1900);

  const response = (await notion.blocks.children.append({
    block_id: params.notionPageId,
    children: [
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: {
                content
              }
            }
          ]
        }
      }
    ]
  })) as { results?: Array<{ id?: string }> };

  return response.results?.[0]?.id ?? null;
}

export function verifyNotionSignature(params: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
}) {
  const secret = process.env.NOTION_WEBHOOK_SECRET;

  if (!secret) {
    return true;
  }

  if (!params.signature || !params.timestamp) {
    return false;
  }

  const signedPayload = `${params.timestamp}.${params.rawBody}`;
  const digest = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  const expected = `sha256=${digest}`;

  const signatureBuffer = Buffer.from(params.signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

function extractPlainTextFromRichText(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const text = value
    .map((entry) => {
      if (typeof entry !== "object" || !entry || !("plain_text" in entry)) {
        return "";
      }

      const plainText = (entry as { plain_text?: string }).plain_text;
      return plainText ?? "";
    })
    .join("")
    .trim();

  return text || null;
}

export function extractStateAndCommentFromNotionPage(page: { properties?: Record<string, unknown> }) {
  const properties = page.properties ?? {};
  let state: "open" | "closed" | null = null;

  for (const [name, value] of Object.entries(properties)) {
    if (typeof value !== "object" || !value || !("type" in value)) {
      continue;
    }

    const property = value as { type: string; status?: { name?: string }; select?: { name?: string } };
    const lowerName = name.toLowerCase();

    if (["status", "state"].includes(lowerName)) {
      const text = (property.status?.name || property.select?.name || "").toLowerCase();

      if (["closed", "done", "complete", "completed"].includes(text)) {
        state = "closed";
      }

      if (["open", "todo", "in progress", "backlog"].includes(text)) {
        state = "open";
      }
    }
  }

  const possibleCommentFields = ["github comment", "new comment", "reply", "comment"];
  let comment: string | null = null;

  for (const [name, value] of Object.entries(properties)) {
    if (!possibleCommentFields.includes(name.toLowerCase())) {
      continue;
    }

    if (typeof value !== "object" || !value || !("type" in value)) {
      continue;
    }

    const property = value as {
      type: string;
      rich_text?: unknown;
      title?: unknown;
      plain_text?: string;
    };

    if (property.type === "rich_text") {
      comment = extractPlainTextFromRichText(property.rich_text);
    }

    if (property.type === "title") {
      comment = extractPlainTextFromRichText(property.title);
    }

    if (comment) {
      break;
    }
  }

  return { state, comment };
}
