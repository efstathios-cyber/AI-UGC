export interface InstagramPublishInput {
  igUserId: string;
  accessToken: string;
  videoUrl: string;
  caption: string;
  shareToFeed?: boolean;
}

export interface InstagramPublishResult {
  containerId: string;
  mediaId: string;
}

export class InstagramGraphClient {
  constructor(
    private readonly graphVersion = process.env.META_GRAPH_VERSION ?? "v24.0"
  ) {}

  async publishReel(input: InstagramPublishInput): Promise<InstagramPublishResult> {
    const containerId = await this.createReelContainer(input);
    await this.waitForContainer(containerId, input.accessToken);
    const mediaId = await this.publishContainer(
      input.igUserId,
      containerId,
      input.accessToken
    );

    return { containerId, mediaId };
  }

  async createReelContainer(input: InstagramPublishInput): Promise<string> {
    const response = await this.post(`${input.igUserId}/media`, {
      media_type: "REELS",
      video_url: input.videoUrl,
      caption: input.caption,
      share_to_feed: String(input.shareToFeed ?? true),
      access_token: input.accessToken
    });

    const id = stringField(response, "id");
    if (!id) {
      throw new Error(`Instagram container response did not include id: ${JSON.stringify(response)}`);
    }

    return id;
  }

  async waitForContainer(containerId: string, accessToken: string): Promise<void> {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const status = await this.get(containerId, {
        fields: "status_code,status",
        access_token: accessToken
      });
      const statusCode = stringField(status, "status_code");

      if (statusCode === "FINISHED") return;
      if (statusCode === "ERROR") {
        throw new Error(`Instagram container processing failed: ${JSON.stringify(status)}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    throw new Error("Instagram container processing timed out");
  }

  async publishContainer(
    igUserId: string,
    containerId: string,
    accessToken: string
  ): Promise<string> {
    const response = await this.post(`${igUserId}/media_publish`, {
      creation_id: containerId,
      access_token: accessToken
    });

    const id = stringField(response, "id");
    if (!id) {
      throw new Error(`Instagram publish response did not include id: ${JSON.stringify(response)}`);
    }

    return id;
  }

  async exchangeLongLivedUserToken(input: {
    appId: string;
    appSecret: string;
    shortLivedUserToken: string;
  }): Promise<Record<string, unknown>> {
    return this.get("oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: input.appId,
      client_secret: input.appSecret,
      fb_exchange_token: input.shortLivedUserToken
    });
  }

  async discoverInstagramAccounts(accessToken: string): Promise<Record<string, unknown>> {
    return this.get("me/accounts", {
      fields: "id,name,instagram_business_account{id,username}",
      access_token: accessToken
    });
  }

  private async post(path: string, body: Record<string, string>): Promise<Record<string, unknown>> {
    const response = await fetch(this.url(path), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body)
    });

    return parseGraphResponse(response);
  }

  private async get(path: string, query: Record<string, string>): Promise<Record<string, unknown>> {
    const url = new URL(this.url(path));
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url);
    return parseGraphResponse(response);
  }

  private url(path: string): string {
    return `https://graph.facebook.com/${this.graphVersion}/${path.replace(/^\//, "")}`;
  }
}

async function parseGraphResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    throw new Error(`Meta Graph API failed: ${response.status} ${JSON.stringify(data)}`);
  }

  if (data.error) {
    throw new Error(`Meta Graph API error: ${JSON.stringify(data.error)}`);
  }

  return data;
}

function stringField(source: Record<string, unknown>, field: string): string | undefined {
  const value = source[field];
  return typeof value === "string" ? value : undefined;
}
