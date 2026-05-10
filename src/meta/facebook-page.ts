export interface FacebookVideoPostInput {
  pageId: string;
  pageAccessToken: string;
  fileUrl?: string;
  localFilePath?: string;
  description: string;
  title?: string;
  published?: boolean;
}

export interface FacebookVideoPostResult {
  id?: string;
  post_id?: string;
  success?: boolean;
  raw: Record<string, unknown>;
}

export class FacebookPageClient {
  constructor(
    private readonly graphVersion = process.env.META_GRAPH_VERSION ?? "v24.0"
  ) {}

  async postVideo(input: FacebookVideoPostInput): Promise<FacebookVideoPostResult> {
    const response = input.fileUrl
      ? await fetch(
          `https://graph-video.facebook.com/${this.graphVersion}/${input.pageId}/videos`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              access_token: input.pageAccessToken,
              file_url: input.fileUrl,
              description: input.description,
              title: input.title ?? "Sarah UGC Reel",
              published: String(input.published ?? true)
            })
          }
        )
      : await this.uploadLocalVideo(input);

    const raw = await parseGraphResponse(response);
    return {
      id: stringField(raw, "id"),
      post_id: stringField(raw, "post_id"),
      success: booleanField(raw, "success"),
      raw
    };
  }

  private async uploadLocalVideo(input: FacebookVideoPostInput): Promise<Response> {
    if (!input.localFilePath) {
      throw new Error("Either fileUrl or localFilePath must be provided");
    }

    const file = await BunFile.fromPath(input.localFilePath);
    const form = new FormData();
    form.append("access_token", input.pageAccessToken);
    form.append("description", input.description);
    form.append("title", input.title ?? "Sarah UGC Reel");
    form.append("published", String(input.published ?? true));
    form.append("source", file.blob(), file.name);

    return fetch(`https://graph-video.facebook.com/${this.graphVersion}/${input.pageId}/videos`, {
      method: "POST",
      body: form
    });
  }
}

class BunFile {
  static async fromPath(filePath: string): Promise<{ blob: () => Blob; name: string }> {
    const { readFile } = await import("node:fs/promises");
    const { basename } = await import("node:path");
    const bytes = await readFile(filePath);
    return {
      blob: () => new Blob([bytes]),
      name: basename(filePath)
    };
  }
}

async function parseGraphResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    throw new Error(`Facebook video post failed: ${response.status} ${JSON.stringify(data)}`);
  }

  if (data.error) {
    throw new Error(`Facebook video post error: ${JSON.stringify(data.error)}`);
  }

  return data;
}

function stringField(source: Record<string, unknown>, field: string): string | undefined {
  const value = source[field];
  return typeof value === "string" ? value : undefined;
}

function booleanField(source: Record<string, unknown>, field: string): boolean | undefined {
  const value = source[field];
  return typeof value === "boolean" ? value : undefined;
}
