import { Client } from "@notionhq/client";
import type { GitHubCommentItem, GitHubWorkItem } from "@/lib/github";

const REQUIRED_DATABASE_PROPERTIES: Record<string, any> = {
  "GitHub ID": { rich_text: {} },
  Type: {
    select: {
      options: [
        { name: "Issue", color: "blue" },
        { name: "Pull Request", color: "purple" },
        { name: "Comment", color: "green" }
      ]
    }
  },
  Number: { number: { format: "number" } },
  Status: {
    select: {
      options: [
        { name: "Open", color: "green" },
        { name: "Closed", color: "red" },
        { name: "Merged", color: "purple" }
      ]
    }
  },
  URL: { url: {} },
  Repo: { rich_text: {} },
  Body: { rich_text: {} },
  "Last Author": { rich_text: {} },
  "Synced At": { date: {} }
};

function createClient(token: string) {
  return new Client({ auth: token });
}

function normalize(str: string) {
  return str.trim().toLowerCase();
}

function findProperty(properties: Record<string, any>, candidates: string[]) {
  const normalizedCandidates = candidates.map(normalize);
  const key = Object.keys(properties).find((propertyName) =>
    normalizedCandidates.includes(normalize(propertyName))
  );

  return key ?? null;
}

function getPlainText(value: any) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((part) => part?.plain_text ?? part?.text?.content ?? "")
    .join("")
    .trim();
}

async function getDatabase(client: Client, databaseId: string) {
  return (await client.databases.retrieve({ database_id: databaseId })) as any;
}

export async function ensureNotionSchema(token: string, databaseId: string) {
  const notion = createClient(token);
  const database = await getDatabase(notion, databaseId);
  const existingProperties = database.properties as Record<string, any>;

  const missing: Record<string, any> = {};

  for (const [propertyName, propertyValue] of Object.entries(REQUIRED_DATABASE_PROPERTIES)) {
    if (!existingProperties[propertyName]) {
      missing[propertyName] = propertyValue;
    }
  }

  if (Object.keys(missing).length > 0) {
    await notion.databases.update({
      database_id: databaseId,
      properties: missing
    });
  }

  const refreshed = await getDatabase(notion, databaseId);
  const titlePropertyName =
    Object.keys(refreshed.properties).find((name) => refreshed.properties[name].type === "title") ??
    "Name";

  return {
    database,
    titlePropertyName,
    properties: refreshed.properties as Record<string, any>
  };
}

export async function verifyNotionAccess(token: string, databaseId: string) {
  const notion = createClient(token);
  const database = (await notion.databases.retrieve({ database_id: databaseId })) as any;
  const schema = await ensureNotionSchema(token, databaseId);

  return {
    databaseId,
    title: getPlainText(database.title),
    titlePropertyName: schema.titlePropertyName
  };
}

function buildPageProperties(input: {
  titlePropertyName: string;
  repoFullName: string;
  githubItem: GitHubWorkItem;
}) {
  const statusName =
    input.githubItem.state === "merged"
      ? "Merged"
      : input.githubItem.state === "closed"
        ? "Closed"
        : "Open";

  return {
    [input.titlePropertyName]: {
      title: [{ text: { content: input.githubItem.title.slice(0, 2000) } }]
    },
    "GitHub ID": {
      rich_text: [{ text: { content: `${input.githubItem.type}:${input.githubItem.githubId}` } }]
    },
    Type: {
      select: { name: input.githubItem.type === "pull_request" ? "Pull Request" : "Issue" }
    },
    Number: {
      number: input.githubItem.number
    },
    Status: {
      select: { name: statusName }
    },
    URL: {
      url: input.githubItem.url
    },
    Repo: {
      rich_text: [{ text: { content: input.repoFullName } }]
    },
    Body: {
      rich_text: [{ text: { content: input.githubItem.body.slice(0, 2000) } }]
    },
    "Last Author": {
      rich_text: [{ text: { content: input.githubItem.author } }]
    },
    "Synced At": {
      date: { start: new Date().toISOString() }
    }
  };
}

export async function upsertNotionPageFromGitHub(input: {
  token: string;
  databaseId: string;
  repoFullName: string;
  githubItem: GitHubWorkItem;
  existingPageId?: string | null;
}) {
  const notion = createClient(input.token);
  const schema = await ensureNotionSchema(input.token, input.databaseId);

  const properties = buildPageProperties({
    titlePropertyName: schema.titlePropertyName,
    repoFullName: input.repoFullName,
    githubItem: input.githubItem
  });

  let pageId = input.existingPageId ?? null;

  if (!pageId) {
    const search = (await notion.databases.query({
      database_id: input.databaseId,
      filter: {
        property: "GitHub ID",
        rich_text: {
          equals: `${input.githubItem.type}:${input.githubItem.githubId}`
        }
      },
      page_size: 1
    })) as any;

    pageId = search.results?.[0]?.id ?? null;
  }

  if (pageId) {
    await notion.pages.update({
      page_id: pageId,
      properties
    });

    return pageId;
  }

  const created = (await notion.pages.create({
    parent: { database_id: input.databaseId },
    properties,
    children: input.githubItem.body
      ? [
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: input.githubItem.body.slice(0, 2000)
                  }
                }
              ]
            }
          }
        ]
      : undefined
  })) as any;

  return created.id as string;
}

export async function appendCommentToNotion(input: {
  token: string;
  pageId: string;
  comment: GitHubCommentItem;
}) {
  const notion = createClient(input.token);

  const created = (await notion.blocks.children.append({
    block_id: input.pageId,
    children: [
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: {
                content: `GH_COMMENT:${input.comment.githubId} @${input.comment.author} ${new Date(input.comment.createdAt).toISOString()}\n${input.comment.body}`.slice(
                  0,
                  2000
                )
              }
            }
          ]
        }
      }
    ]
  })) as any;

  return created.results?.[0]?.id as string;
}

export async function updateNotionCommentBlock(input: {
  token: string;
  blockId: string;
  comment: GitHubCommentItem;
}) {
  const notion = createClient(input.token);

  await notion.blocks.update({
    block_id: input.blockId,
    paragraph: {
      rich_text: [
        {
          type: "text",
          text: {
            content: `GH_COMMENT:${input.comment.githubId} @${input.comment.author} ${new Date(input.comment.updatedAt).toISOString()}\n${input.comment.body}`.slice(
              0,
              2000
            )
          }
        }
      ]
    }
  } as any);
}

export async function archiveNotionBlock(input: { token: string; blockId: string }) {
  const notion = createClient(input.token);
  await notion.blocks.delete({ block_id: input.blockId });
}

export async function readNotionPageForSync(input: {
  token: string;
  pageId: string;
  databaseId: string;
}) {
  const notion = createClient(input.token);
  const schema = await ensureNotionSchema(input.token, input.databaseId);
  const page = (await notion.pages.retrieve({ page_id: input.pageId })) as any;

  const properties = page.properties as Record<string, any>;
  const titleProp = properties[schema.titlePropertyName];
  const githubIdProp = properties[findProperty(properties, ["GitHub ID"]) ?? "GitHub ID"];
  const typeProp = properties[findProperty(properties, ["Type"]) ?? "Type"];
  const numberProp = properties[findProperty(properties, ["Number"]) ?? "Number"];
  const statusProp = properties[findProperty(properties, ["Status"]) ?? "Status"];
  const bodyProp = properties[findProperty(properties, ["Body"]) ?? "Body"];

  const githubIdRaw = getPlainText(githubIdProp?.rich_text);
  const [itemTypeRaw, githubIdValue] = githubIdRaw.includes(":")
    ? githubIdRaw.split(":")
    : ["", ""];

  const itemType =
    itemTypeRaw === "pull_request" || itemTypeRaw === "issue"
      ? itemTypeRaw
      : typeProp?.select?.name === "Pull Request"
        ? "pull_request"
        : "issue";

  return {
    pageId: page.id as string,
    title: getPlainText(titleProp?.title),
    body: getPlainText(bodyProp?.rich_text),
    status: statusProp?.select?.name ?? "Open",
    number: typeof numberProp?.number === "number" ? numberProp.number : null,
    githubId: githubIdValue || null,
    itemType
  };
}

export async function updateNotionPageGitHubLink(input: {
  token: string;
  pageId: string;
  githubItem: GitHubWorkItem;
}) {
  const notion = createClient(input.token);

  await notion.pages.update({
    page_id: input.pageId,
    properties: {
      "GitHub ID": {
        rich_text: [{ text: { content: `${input.githubItem.type}:${input.githubItem.githubId}` } }]
      },
      Number: {
        number: input.githubItem.number
      },
      URL: {
        url: input.githubItem.url
      },
      Type: {
        select: { name: input.githubItem.type === "pull_request" ? "Pull Request" : "Issue" }
      },
      Status: {
        select: { name: input.githubItem.state === "closed" ? "Closed" : "Open" }
      },
      "Synced At": {
        date: { start: new Date().toISOString() }
      }
    }
  });
}
