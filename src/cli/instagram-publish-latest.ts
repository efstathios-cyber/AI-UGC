import { promises as fs } from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "../config/env.js";
import { InstagramGraphClient } from "../meta/instagram-graph.js";

loadLocalEnv();

const outputDir = process.env.OUTPUT_DIR ?? "./storage";
const handoffsDir = path.join(outputDir, "handoffs");
const accessToken = process.env.META_ACCESS_TOKEN ?? process.env.META_PAGE_ACCESS_TOKEN;
const igUserId = process.env.META_IG_USER_ID;

if (!accessToken) {
  throw new Error("Set META_ACCESS_TOKEN or META_PAGE_ACCESS_TOKEN before publishing");
}

if (!igUserId) {
  throw new Error("Set META_IG_USER_ID before publishing");
}

const latest = await latestHandoff(handoffsDir);
const metadata = JSON.parse(
  await fs.readFile(path.join(latest, "metadata.json"), "utf8")
) as { sourceVideoUrl?: string };
const caption = await fs.readFile(path.join(latest, "caption.txt"), "utf8");

if (!metadata.sourceVideoUrl) {
  throw new Error(
    `Latest handoff has no sourceVideoUrl metadata. Generate a new video before publishing: ${latest}`
  );
}

const client = new InstagramGraphClient();
const result = await client.publishReel({
  igUserId,
  accessToken,
  videoUrl: metadata.sourceVideoUrl,
  caption,
  shareToFeed: process.env.INSTAGRAM_SHARE_TO_FEED !== "false"
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
