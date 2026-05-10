import { promises as fs } from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "../config/env.js";
import { FacebookPageClient } from "../meta/facebook-page.js";

loadLocalEnv();

const outputDir = process.env.OUTPUT_DIR ?? "./storage";
const handoffsDir = path.join(outputDir, "handoffs");
const pageId = process.env.FACEBOOK_PAGE_ID ?? process.env.META_PAGE_ID;
const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? process.env.META_PAGE_ACCESS_TOKEN;

if (!pageId) {
  throw new Error("Set FACEBOOK_PAGE_ID or META_PAGE_ID before posting to Facebook");
}

if (!pageAccessToken) {
  throw new Error("Set FACEBOOK_PAGE_ACCESS_TOKEN or META_PAGE_ACCESS_TOKEN before posting to Facebook");
}

const latest = await latestHandoff(handoffsDir);
const metadataPath = path.join(latest, "metadata.json");
const metadata = (await fileExists(metadataPath))
  ? (JSON.parse(await fs.readFile(metadataPath, "utf8")) as { sourceVideoUrl?: string })
  : {};
const caption = await fs.readFile(path.join(latest, "caption.txt"), "utf8");

const client = new FacebookPageClient();
const result = await client.postVideo({
  pageId,
  pageAccessToken,
  fileUrl: metadata.sourceVideoUrl,
  localFilePath: path.join(latest, "reel.mp4"),
  description: caption,
  title: process.env.FACEBOOK_VIDEO_TITLE ?? "Sarah UGC Reel",
  published: process.env.FACEBOOK_PUBLISHED !== "false"
});

console.log(JSON.stringify({ handoffDir: latest, ...result }, null, 2));

async function latestHandoff(dir: string): Promise<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const handoffs = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("handoff-"))
      .map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        const stat = await fs.stat(fullPath);
        return { fullPath, mtimeMs: stat.mtimeMs };
      })
  );

  handoffs.sort((a, b) => b.mtimeMs - a.mtimeMs);
  if (!handoffs[0]) {
    throw new Error(`No handoff packages found in ${dir}`);
  }

  return handoffs[0].fullPath;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
