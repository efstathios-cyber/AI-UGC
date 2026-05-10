import { promises as fs } from "node:fs";
import path from "node:path";
import type { HandoffPackage, MediaAsset, ScriptJson } from "../domain/types.js";

export class ManualHandoffPublisher {
  constructor(private readonly outputDir: string) {}

  async createPackage(script: ScriptJson, media: MediaAsset): Promise<HandoffPackage> {
    const packageDir = path.join(this.outputDir, `handoff-${Date.now()}`);
    await fs.mkdir(packageDir, { recursive: true });

    const videoPath = path.join(packageDir, "reel.mp4");
    const captionPath = path.join(packageDir, "caption.txt");
    const notesPath = path.join(packageDir, "posting-notes.md");
    const metadataPath = path.join(packageDir, "metadata.json");

    await fs.copyFile(media.videoPath, videoPath);
    await fs.writeFile(captionPath, buildCaption(script), "utf8");
    await fs.writeFile(notesPath, buildNotes(script), "utf8");
    await fs.writeFile(
      metadataPath,
      JSON.stringify(
        {
          sourceVideoUrl: media.sourceUrl,
          providerTaskId: media.providerTaskId,
          localSourcePath: media.videoPath,
          handoffVideoPath: videoPath,
          captionPath,
          notesPath,
          generatedAt: new Date().toISOString()
        },
        null,
        2
      ),
      "utf8"
    );

    return {
      packageDir,
      videoPath,
      captionPath,
      notesPath,
      metadataPath
    };
  }
}

function buildCaption(script: ScriptJson): string {
  return `${script.hook}\n\n${script.cta}\n\n#realestateinvesting #fixandflip #hardmoney #realestatefunding`;
}

function buildNotes(script: ScriptJson): string {
  return [
    "# Instagram Handoff",
    "",
    "- Format: Reel, 9:16",
    "- Account: Sarah brand account",
    "- CTA: soft curiosity-based",
    `- Content pillar: ${script.content_pillar}`,
    `- Runtime estimate: ${script.estimated_runtime_seconds}s`,
    "",
    "## Full Script",
    "",
    script.full_script
  ].join("\n");
}
