import { Client } from "@notionhq/client";
import type {
  CreatePageParameters,
  QueryDatabaseParameters,
  UpdatePageParameters
} from "@notionhq/client/build/src/api-endpoints";

type DatabasePropertyMap = Record<string, { type: string }>;

export type NotionDatabaseItem = {
  id: string;
  title: string;
};

export type NotionSyncShape = {
  title: string;
  body: string;
  state: "open" | "closed";
  number: number;
  type: "issue" | "pull_request";
  htmlUrl: string;
  updatedAt: string;
  repo: string;
};

function client(token: string): Client {
  return new Client({ auth: token });
}

function plainTextFromRichText(value: Array<{ plain_text?: string }>): string {
  return value.map((part) => part.plain_text || "").join("").trim();
}

function detectTitleProperty(properties: DatabasePropertyMap): string | null {
  for (const [name, value] of Object.entries(properties)) {
    if (value.type === "title") {
      return name;
    }
  }

  return null;
}

function getPropertyName(properties: DatabasePropertyMap, candidates: string[]): string | null {
  for (const candidate of candidates) {
    const match = Object.keys(properties).find(
      (key) => key.toLowerCase() === candidate.toLowerCase()
    );

    if (match) {
      return match;
    }
  }

  return null;
}

async function getDatabaseProperties(token: string, databaseId: string): Promise<DatabasePropertyMap> {
  const notion = client(token);
  const database = await notion.databases.retrieve({ database_id: databaseId });

  if (!("properties" in database)) {
    throw new Error("Selected Notion database does not expose properties.");
  }

  return database.properties as DatabasePropertyMap;
}

function buildNotionProperties(
  properties: DatabasePropertyMap,
  payload: NotionSyncShape
): Record<string, any> {
  const output: Record<string, any> = {};
  const titleProperty = detectTitleProperty(properties);

  if (!titleProperty) {
    throw new Error("No title property found in selected Notion database.");
  }

  output[titleProperty] = {
    title: [{ type: "text", text: { content: payload.title } }]
  };

  const numberField = getPropertyName(properties, ["GitHub Number", "Number", "Issue Number"]);
  if (numberField && properties[numberField]?.type === "number") {
    output[numberField] = { number: payload.number };
  }

  const idField = getPropertyName(properties, ["GitHub ID", "GitHub Ref", "External ID"]);
  if (idField && properties[idField]?.type === "rich_text") {
    output[idField] = {
      rich_text: [{ type: "text", text: { content: `${payload.type}:${payload.number}` } }]
    };
  }

  const typeField = getPropertyName(properties, ["Type", "Item Type"]);
  if (typeField && properties[typeField]?.type === "select") {
    output[typeField] = { select: { name: payload.type === "pull_request" ? "Pull Request" : "Issue" } };
  }

  const statusField = getPropertyName(properties, ["Status", "State"]);
  if (statusField) {
    const statusName = payload.state === "open" ? "In Progress" : "Done";
    const fieldType = properties[statusField]?.type;

    if (fieldType === "status") {
      output[statusField] = { status: { name: statusName } };
    }

    if (fieldType === "select") {
      output[statusField] = { select: { name: statusName } };
    }
  }

  const urlField = getPropertyName(properties, ["GitHub URL", "URL", "Link"]);
  if (urlField && properties[urlField]?.type === "url") {
    output[urlField] = { url: payload.htmlUrl };
  }

  const repoField = getPropertyName(properties, ["Repo", "Repository"]);
  if (repoField && properties[repoField]?.type === "rich_text") {
    output[repoField] = {
      rich_text: [{ type: "text", text: { content: payload.repo } }]
    };
  }

  const updatedAtField = getPropertyName(properties, ["Updated At", "Last Sync", "Synced At"]);
  if (updatedAtField && properties[updatedAtField]?.type === "date") {
    output[updatedAtField] = {
      date: { start: payload.updatedAt }
    };
  }

  return output;
}

export async function listNotionDatabases(token: string): Promise<NotionDatabaseItem[]> {
  const notion = client(token);

  const response = await notion.search({
    filter: { property: "object", value: "database" },
    sort: {
      direction: "descending",
      timestamp: "last_edited_time"
    },
    page_size: 100
  });

  return response.results.map((item) => {
    const database = item as { id: string; title?: Array<{ plain_text?: string }> };
    const title = plainTextFromRichText(database.title ?? []) || "Untitled Database";

    return {
      id: database.id,
      title
    };
  });
}

export async function upsertNotionPageFromGitHub(
  token: string,
  databaseId: string,
  payload: NotionSyncShape,
  notionPageId?: string
): Promise<string> {
  const notion = client(token);
  const properties = await getDatabaseProperties(token, databaseId);
  const pageProperties = buildNotionProperties(properties, payload);

  if (notionPageId) {
    const params: UpdatePageParameters = {
      page_id: notionPageId,
      properties: pageProperties as UpdatePageParameters["properties"]
    };

    await notion.pages.update(params);
    return notionPageId;
  }

  const params: CreatePageParameters = {
    parent: { database_id: databaseId },
    properties: pageProperties as CreatePageParameters["properties"],
    children: payload.body
      ? [
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: payload.body.slice(0, 2000) } }]
            }
          }
        ]
      : []
  };

  const created = await notion.pages.create(params);
  return created.id;
}

export async function appendNotionComment(
  token: string,
  pageId: string,
  commentBody: string,
  author: string,
  commentId: string
): Promise<void> {
  const notion = client(token);

  await notion.blocks.children.append({
    block_id: pageId,
    children: [
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: {
                content: `[GitHub Comment ${commentId}] ${author}: ${commentBody}`.slice(0, 2000)
              }
            }
          ]
        }
      }
    ]
  });
}

type NotionPage = Awaited<ReturnType<Client["pages"]["retrieve"]>>;

export async function getNotionPage(token: string, pageId: string): Promise<NotionPage> {
  const notion = client(token);
  return notion.pages.retrieve({ page_id: pageId });
}

export function extractSyncFieldsFromNotionPage(page: NotionPage): {
  title: string;
  body: string;
  state: "open" | "closed";
  number: number | null;
  type: "issue" | "pull_request";
  updatedAt: string;
} {
  if (!("properties" in page)) {
    throw new Error("Page does not expose properties for sync.");
  }

  const properties = page.properties as Record<string, any>;
  let title = "";
  let body = "";
  let state: "open" | "closed" = "open";
  let number: number | null = null;
  let type: "issue" | "pull_request" = "issue";

  for (const [name, value] of Object.entries(properties)) {
    if (value?.type === "title" && !title) {
      title = plainTextFromRichText(value.title ?? []);
    }

    if (
      value?.type === "rich_text" &&
      ["Description", "Body", "Summary"].includes(name) &&
      body.length === 0
    ) {
      body = plainTextFromRichText(value.rich_text ?? []);
    }

    if (value?.type === "status") {
      const statusName = value.status?.name?.toLowerCase() ?? "";
      if (["done", "closed", "complete", "completed"].some((term) => statusName.includes(term))) {
        state = "closed";
      }
    }

    if (value?.type === "select") {
      if (name.toLowerCase().includes("status")) {
        const statusName = value.select?.name?.toLowerCase() ?? "";
        if (["done", "closed", "complete", "completed"].some((term) => statusName.includes(term))) {
          state = "closed";
        }
      }

      if (name.toLowerCase().includes("type")) {
        const typeValue = value.select?.name?.toLowerCase() ?? "";
        if (typeValue.includes("pull")) {
          type = "pull_request";
        }
      }
    }

    if (value?.type === "number" && name.toLowerCase().includes("number") && number === null) {
      number = value.number ?? null;
    }

    if (value?.type === "rich_text" && name.toLowerCase().includes("github id") && number === null) {
      const ref = plainTextFromRichText(value.rich_text ?? []);
      const match = ref.match(/:(\d+)$/);
      if (match) {
        number = Number(match[1]);
      }
    }
  }

  return {
    title: title || "Untitled",
    body,
    state,
    number,
    type,
    updatedAt: page.last_edited_time
  };
}

export async function findPageByGitHubRef(
  token: string,
  databaseId: string,
  ref: string
): Promise<string | null> {
  const notion = client(token);
  const database = await notion.databases.retrieve({ database_id: databaseId });

  if (!("properties" in database)) {
    return null;
  }

  const properties = database.properties as DatabasePropertyMap;
  const refField = getPropertyName(properties, ["GitHub ID", "GitHub Ref", "External ID"]);

  if (!refField) {
    return null;
  }

  const fieldType = properties[refField].type;

  if (fieldType !== "rich_text") {
    return null;
  }

  const query: QueryDatabaseParameters = {
    database_id: databaseId,
    filter: {
      property: refField,
      rich_text: {
        equals: ref
      }
    },
    page_size: 1
  };

  const response = await notion.databases.query(query);

  if (response.results.length === 0) {
    return null;
  }

  return response.results[0]?.id ?? null;
}
