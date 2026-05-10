import { promises as fs } from "node:fs";
import path from "node:path";
import type { MediaAsset, SeedDancePrompt } from "../domain/types.js";
import { imageReferenceToSeedDanceUrl } from "../media/image-reference.js";
import { hasMp4AudioTrack } from "../media/mp4-inspector.js";

export interface SeedDanceClient {
  createSpokenVideo(prompt: SeedDancePrompt): Promise<MediaAsset>;
}

export class MockSeedDanceClient implements SeedDanceClient {
  constructor(private readonly outputDir: string) {}

  async createSpokenVideo(prompt: SeedDancePrompt): Promise<MediaAsset> {
    await fs.mkdir(this.outputDir, { recursive: true });
    const videoPath = path.join(this.outputDir, "mock-seed-dance-output.mp4");
    await fs.writeFile(videoPath, mockMp4WithAudioAndVideo());

    return {
      videoPath,
      durationSeconds: prompt.durationSeconds,
      aspectRatio: prompt.aspectRatio,
      hasAudio: true,
      qaSignals: {
        identityMatch: true,
        scriptAccurate: true,
        noLogos: true,
        noTextOverlays: true,
        naturalCamera: true,
        audioUsable: true
      }
    };
  }
}

export class SeedDanceApiClient implements SeedDanceClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly outputDir: string
  ) {}

  async createSpokenVideo(prompt: SeedDancePrompt): Promise<MediaAsset> {
    const createResponse = await fetch(this.createTaskUrl(), {
      method: "POST",
      headers: {
        Authorization: this.authorizationHeader(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(this.buildTaskBody(prompt))
    });

    if (!createResponse.ok) {
      throw new Error(`Seed Dance job creation failed: ${createResponse.status} ${await createResponse.text()}`);
    }

    const created = (await createResponse.json()) as Record<string, unknown>;
    const taskId = extractString(created, ["id", "task_id", "taskId", "output.task_id"]);
    if (!taskId) {
      throw new Error(`Seed Dance response did not include a task ID: ${JSON.stringify(created)}`);
    }

    const completed = await this.waitForCompletion(taskId);

    await fs.mkdir(this.outputDir, { recursive: true });
    const videoPath = path.join(this.outputDir, `${taskId}.mp4`);
    const mediaResponse = await fetch(completed.videoUrl);
    if (!mediaResponse.ok || !mediaResponse.body) {
      throw new Error(`Seed Dance media download failed: ${mediaResponse.status}`);
    }

    const bytes = new Uint8Array(await mediaResponse.arrayBuffer());
    await fs.writeFile(videoPath, bytes);
    const hasAudioTrack = hasMp4AudioTrack(videoPath);

    return {
      videoPath,
      sourceUrl: completed.videoUrl,
      providerTaskId: taskId,
      durationSeconds: completed.durationSeconds,
      aspectRatio: completed.aspectRatio,
      hasAudio: hasAudioTrack,
      qaSignals: completed.qaSignals
    };
  }

  private async waitForCompletion(jobId: string): Promise<{
    videoUrl: string;
    durationSeconds: number;
    aspectRatio: string;
    hasAudio: boolean;
    qaSignals?: MediaAsset["qaSignals"];
  }> {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const response = await fetch(this.retrieveTaskUrl(jobId), {
        headers: { Authorization: this.authorizationHeader() }
      });

      if (!response.ok) {
        throw new Error(`Seed Dance status check failed: ${response.status} ${await response.text()}`);
      }

      const status = (await response.json()) as Record<string, unknown> & {
        state?: "queued" | "running" | "succeeded" | "completed" | "failed";
        status?: "queued" | "running" | "succeeded" | "completed" | "failed";
        error?: string;
        qaSignals?: MediaAsset["qaSignals"];
      };
      const state =
        status.state ??
        status.status ??
        normalizeTaskStatus(extractString(status, ["output.task_status"]));

      if (state === "failed") {
        throw new Error(`Seed Dance job failed: ${status.error ?? "unknown error"}`);
      }

      const videoUrl = extractString(status, [
        "videoUrl",
        "video_url",
        "url",
        "content.video_url",
        "content.videoUrl",
        "output.video_url",
        "output.videoUrl",
        "output.urls.0",
        "result.video_url",
        "result.videoUrl"
      ]);

      if ((state === "completed" || state === "succeeded") && videoUrl) {
        return {
          videoUrl,
          durationSeconds:
            extractNumber(status, ["durationSeconds", "duration_seconds", "duration"]) ?? 12,
          aspectRatio: extractString(status, ["aspectRatio", "aspect_ratio", "ratio"]) ?? "9:16",
          hasAudio:
            extractBoolean(status, ["hasAudio", "has_audio", "generate_audio"]) ?? true,
          qaSignals: status.qaSignals
        };
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    throw new Error("Seed Dance job timed out");
  }

  private createTaskUrl(): string {
    return this.baseUrl.replace(/\/$/, "");
  }

  private retrieveTaskUrl(jobId: string): string {
    return `${this.createTaskUrl()}/${encodeURIComponent(jobId)}`;
  }

  private authorizationHeader(): string {
    return this.apiKey.toLowerCase().startsWith("bearer ")
      ? this.apiKey
      : `Bearer ${this.apiKey}`;
  }

  buildTaskBody(prompt: SeedDancePrompt): Record<string, unknown> {
    const content: unknown[] = [
      {
        type: "text",
        text: [
          `Dialogue to speak exactly: "${prompt.fullScript}"`,
          "The audio must contain audible spoken English dialogue synchronized to the speaker's mouth.",
          "Do not make a silent video. Do not use music-only audio.",
          "",
          `Visual identity: ${prompt.visualIdentity}`,
          `Setting: ${prompt.filmingSetting}`,
          `Camera style: ${prompt.cameraStyle}`,
          `Performance: ${prompt.spokenPerformanceDirection}`,
          `Timing: ${prompt.segmentTimingGuidance}`,
          "Generate a vertical Instagram Reel with audible English dialogue, natural lip sync, no captions, no text overlays, and no logos."
        ].join("\n")
      }
    ];

    if (prompt.identityReferenceImage) {
      content.push({
        type: "image_url",
        image_url: { url: imageReferenceToSeedDanceUrl(prompt.identityReferenceImage) },
        role: process.env.SEED_DANCE_IMAGE_ROLE ?? "reference_image"
      });
    }

    return {
      model: this.model,
      content,
      generate_audio: process.env.SEED_DANCE_GENERATE_AUDIO === "false" ? false : true,
      ratio: prompt.aspectRatio,
      duration: prompt.durationSeconds,
      watermark: false
    };
  }

}

function mockMp4WithAudioAndVideo(): Buffer {
  return Buffer.concat([
    box("ftyp", Buffer.alloc(8)),
    box("moov", Buffer.concat([
      box("trak", box("mdia", handlerBox("vide"))),
      box("trak", box("mdia", handlerBox("soun")))
    ]))
  ]);
}

function handlerBox(handler: "soun" | "vide"): Buffer {
  return box("hdlr", Buffer.concat([Buffer.alloc(8), Buffer.from(handler, "ascii"), Buffer.alloc(4)]));
}

function box(type: string, payload: Buffer): Buffer {
  const output = Buffer.alloc(8 + payload.length);
  output.writeUInt32BE(output.length, 0);
  output.write(type, 4, "ascii");
  payload.copy(output, 8);
  return output;
}

function extractString(source: unknown, paths: string[]): string | undefined {
  for (const pathKey of paths) {
    const value = extractValue(source, pathKey);
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function extractNumber(source: unknown, paths: string[]): number | undefined {
  for (const pathKey of paths) {
    const value = extractValue(source, pathKey);
    if (typeof value === "number") return value;
  }
  return undefined;
}

function extractBoolean(source: unknown, paths: string[]): boolean | undefined {
  for (const pathKey of paths) {
    const value = extractValue(source, pathKey);
    if (typeof value === "boolean") return value;
  }
  return undefined;
}

function extractValue(source: unknown, pathKey: string): unknown {
  if (!source || typeof source !== "object") return undefined;
  let current: unknown = source;
  for (const key of pathKey.split(".")) {
    if (Array.isArray(current) && /^\d+$/.test(key)) {
      current = current[Number(key)];
      continue;
    }

    if (!current || typeof current !== "object" || !(key in current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function normalizeTaskStatus(
  status: string | undefined
): "queued" | "running" | "succeeded" | "completed" | "failed" | undefined {
  switch (status) {
    case "Pending":
      return "queued";
    case "Running":
      return "running";
    case "Success":
      return "succeeded";
    case "Failure":
    case "Expired":
      return "failed";
    default:
      return undefined;
  }
}
