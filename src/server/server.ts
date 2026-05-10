import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFileSync, existsSync, statSync, createReadStream } from "node:fs";
import { promises as fsp } from "node:fs";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "../config/env.js";
import { runtimeWindow } from "../config/runtime.js";
import { sanitizeScript } from "../compliance/script-checker.js";
import type { ScriptJson, SeedDancePrompt } from "../domain/types.js";
import { SeedDanceApiClient, MockSeedDanceClient } from "../providers/seed-dance.js";
import { ManualHandoffPublisher } from "../publishers/manual-handoff.js";

const BANNED_PHRASES = ["game-changer", "game changer", "revolutionary", "seamless", "cutting-edge", "amazing"];
const GUARANTEE_PATTERNS = [/\bguaranteed\b/i, /\bguarantee\b/i, /\bwill approve\b/i, /\bapproved every time\b/i];

function checkGeneratedScript(script: ScriptJson): string[] {
  const text = [script.hook, script.problem, script.agitate, script.solution, script.cta, script.full_script].join("\n");
  const lower = text.toLowerCase();
  const reasons: string[] = [];

  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) reasons.push(`Banned phrase: "${phrase}"`);
  }
  if (text.includes("—") || text.includes("–")) reasons.push("Script contains em/en dash");
  for (const pat of GUARANTEE_PATTERNS) {
    if (pat.test(text)) { reasons.push("Guarantee language detected"); break; }
  }
  if (!/\blink in bio\b/i.test(script.cta)) reasons.push("CTA must include 'link in bio'");
  if (script.estimated_runtime_seconds < 20 || script.estimated_runtime_seconds > 60) {
    reasons.push(`Runtime ${script.estimated_runtime_seconds}s is outside the 20-60s range`);
  }
  return reasons;
}

loadLocalEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "../../");
const PUBLIC = join(ROOT, "public");
const STORAGE_ROOT = process.env.VERCEL ? "/tmp" : ROOT;

function makeSeedDanceClient() {
  const apiKey = process.env.SEED_DANCE_API_KEY;
  const baseUrl = process.env.SEED_DANCE_BASE_URL;
  const model = process.env.SEED_DANCE_MODEL ?? "dreamina-seedance-2-0-260128";
  const mediaDir = join(STORAGE_ROOT, "storage", "media");
  if (apiKey && baseUrl) return new SeedDanceApiClient(apiKey, baseUrl, model, mediaDir);
  return new MockSeedDanceClient(mediaDir);
}

// ─────────────────────────────────────────────────────────────────────────────

interface PersonaInput {
  name: string;
  niche: string;
  tone: string;
  backstory: string;
  visualDescription: string;
  filmingSetting: string;
}

interface GenerateRequest {
  prompt: string;
  persona: PersonaInput;
}

interface HiggsfieldPrompt {
  combinedPrompt: string;
  characterDescription: string;
  settingDescription: string;
  cameraStyle: string;
  performanceNotes: string;
  script: string;
  aspectRatio: "9:16";
  durationSeconds: number;
}

const FILMING_SETTINGS: Record<string, string> = {
  home_gym: "a home gym with natural light, gym equipment visible in background, no professional lighting",
  coffee_shop: "a coffee shop table with warm ambient light, laptop open nearby, casual background",
  outdoors: "outdoors in natural daylight, casual urban or nature setting, authentic environment",
  car: "seated in an SUV or truck, window light casting natural shadows, on-the-go energy",
  kitchen: "a home kitchen with natural window light, everyday domestic setting, counter in background",
  home_studio: "a minimal home setup, clean background, soft window light only, no ring light look"
};

const CAMERA_STYLE =
  "iPhone portrait mode feel, handheld slightly shaky, medium shot waist to head, natural depth of field, no filters, no studio lighting, no text overlays, no logos";

function buildSystemPrompt(persona: PersonaInput): string {
  const backstory = persona.backstory?.trim()
    ? persona.backstory
    : `${persona.name} creates authentic ${persona.niche} content for a growing audience.`;

  return `You write first-person UGC scripts for ${persona.name}.

${persona.name} context:
${backstory}
Niche: ${persona.niche}
Voice and tone: ${persona.tone}

They create content that feels genuine and personal, never like an ad. They sound like they are telling a trusted friend something important.

Script structure for a 35-40 second Reel:
Hook (0-3s): One bold statement or painful question that stops the scroll.
Problem (3-10s): Expand the pain point. Make the listener feel it.
Agitate (10-20s): Make it worse with a relatable, specific detail.
Solution (20-35s): How they solved it. Specific, grounded, no hype.
CTA (35-40s): Soft and curiosity-based. Must include the exact phrase "link in bio".

Writing rules:
Short punchy sentences only.
No em dashes. No en dashes. No semicolons.
No hype words: game-changer, revolutionary, seamless, amazing, cutting-edge.
Specific numbers always: "3 weeks" not "a long time". First-person POV always. Contractions always.
Never sounds like selling. Always sounds like talking to a trusted friend.

Return ONLY a raw JSON object with exactly these fields:
hook, problem, agitate, solution, cta, full_script, estimated_runtime_seconds, tone_note, hook_type, content_pillar

content_pillar must be one of: pain_point_story, education, process_walkthrough, myth_bust
hook_type: a short string like provocative_question, bold_claim, painful_story, surprising_fact
estimated_runtime_seconds: a number between 35 and 40
No preamble. No markdown. Return only the raw JSON object.`;
}

async function generateScript(persona: PersonaInput, userPrompt: string): Promise<ScriptJson> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1";
  const setting = FILMING_SETTINGS[persona.filmingSetting] ?? persona.filmingSetting;

  if (!apiKey) {
    const topic = userPrompt.slice(0, 50);
    return {
      hook: `I spent months doing ${topic} completely wrong.`,
      problem: `Everyone online was giving the same generic advice. Nobody talked about what actually holds you back.`,
      agitate: `I kept getting the same results. Same frustration. Same wasted time and money with nothing to show for it.`,
      solution: `Then I changed one thing. In 6 weeks the results were there. Specific, measurable, real. Not from more effort, from the right approach.`,
      cta: `If you want to see exactly what I changed and how I did it, link in bio.`,
      full_script: `I spent months doing ${topic} completely wrong. Everyone online was giving the same generic advice. Nobody talked about what actually holds you back. I kept getting the same results. Same frustration. Same wasted time and money with nothing to show for it. Then I changed one thing. In 6 weeks the results were there. Specific, measurable, real. Not from more effort, from the right approach. If you want to see exactly what I changed and how I did it, link in bio.`,
      estimated_runtime_seconds: 38,
      tone_note: `${persona.tone} — personal, direct, specific`,
      hook_type: "painful_story",
      content_pillar: "pain_point_story"
    };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: buildSystemPrompt(persona) },
        {
          role: "user",
          content: [
            `Write a UGC Reel script about: ${userPrompt}`,
            `Filming setting: ${setting}`,
            "Target runtime: 35-40 seconds.",
            "CTA must include the exact phrase 'link in bio'.",
            "No em dashes, en dashes, or semicolons.",
            "Return only the raw JSON object."
          ].join(" ")
        }
      ],
      text: { format: { type: "json_object" } }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };

  const raw =
    data.output_text ??
    data.output?.flatMap((item) => item.content ?? []).find((c) => c.text)?.text;

  if (!raw) throw new Error("OpenAI response missing JSON text");

  return JSON.parse(raw) as ScriptJson;
}

function buildSeedDancePrompt(persona: PersonaInput, script: ScriptJson): SeedDancePrompt {
  const setting = FILMING_SETTINGS[persona.filmingSetting] ?? persona.filmingSetting;
  const characterDescription = persona.visualDescription?.trim()
    ? persona.visualDescription
    : `${persona.name}, a ${persona.niche} content creator`;
  return {
    identityReferenceImage: "",
    fullScript: script.full_script,
    segmentTimingGuidance: `Deliver Hook, Problem, Agitate, Solution, CTA in ${script.estimated_runtime_seconds} seconds. One continuous Reel, natural pacing.`,
    visualIdentity: characterDescription,
    filmingSetting: setting,
    cameraStyle: CAMERA_STYLE,
    spokenPerformanceDirection: `${persona.tone}. Speaks directly to camera like telling a trusted friend something important. High energy, zero filler, personal not scripted.`,
    aspectRatio: "9:16",
    durationSeconds: runtimeWindow().target,
  };
}

function buildHiggsfieldPrompt(persona: PersonaInput, script: ScriptJson): HiggsfieldPrompt {
  const setting = FILMING_SETTINGS[persona.filmingSetting] ?? persona.filmingSetting;
  const characterDescription = persona.visualDescription?.trim()
    ? persona.visualDescription
    : `${persona.name}, a ${persona.niche} content creator`;

  const performanceNotes = `${persona.tone}. Speaks directly to camera like telling a trusted friend something important. High energy, zero filler, personal not scripted.`;

  const combinedPrompt = [
    `${characterDescription} speaking directly to camera.`,
    ``,
    `Setting: ${setting}.`,
    ``,
    `Camera: ${CAMERA_STYLE}.`,
    ``,
    `Performance: ${performanceNotes}`,
    ``,
    `Spoken dialogue (lip sync this exactly):`,
    `"${script.full_script}"`
  ].join("\n");

  return {
    combinedPrompt,
    characterDescription,
    settingDescription: setting,
    cameraStyle: CAMERA_STYLE,
    performanceNotes,
    script: script.full_script,
    aspectRatio: "9:16",
    durationSeconds: script.estimated_runtime_seconds
  };
}

// ── Video library ────────────────────────────────────────────────────────────

interface VideoEntry {
  id: string;
  timestamp: number;
  date: string;
  videoUrl: string;
  hook: string;
  caption: string;
  fullScript: string;
  contentPillar: string;
  runtimeSeconds: number;
  source: "handoff" | "media";
}

async function listVideos(): Promise<VideoEntry[]> {
  const videos: VideoEntry[] = [];

  // ── Handoff packages (have captions + scripts) ──
  const handoffsDir = join(STORAGE_ROOT, "storage", "handoffs");
  if (existsSync(handoffsDir)) {
    const dirs = await fsp.readdir(handoffsDir).catch(() => [] as string[]);
    for (const dir of dirs) {
      const videoPath = join(handoffsDir, dir, "reel.mp4");
      if (!existsSync(videoPath)) continue;

      const captionRaw = existsSync(join(handoffsDir, dir, "caption.txt"))
        ? readFileSync(join(handoffsDir, dir, "caption.txt"), "utf8").trim()
        : "";
      const notesRaw = existsSync(join(handoffsDir, dir, "posting-notes.md"))
        ? readFileSync(join(handoffsDir, dir, "posting-notes.md"), "utf8").trim()
        : "";

      const hook = captionRaw.split("\n").find((l) => l.trim()) ?? dir;
      const pillarMatch = notesRaw.match(/Content pillar:\s*(.+)/);
      const runtimeMatch = notesRaw.match(/Runtime estimate:\s*(\d+)s/);
      const scriptMatch = notesRaw.match(/## Full Script\n\n([\s\S]+?)$/);
      const tsMatch = dir.match(/handoff-(\d+)/);
      const timestamp = tsMatch ? parseInt(tsMatch[1]) : 0;

      videos.push({
        id: dir,
        timestamp,
        date: new Date(timestamp).toISOString(),
        videoUrl: `/storage/handoffs/${dir}/reel.mp4`,
        hook,
        caption: captionRaw,
        fullScript: scriptMatch ? scriptMatch[1].trim() : "",
        contentPillar: pillarMatch ? pillarMatch[1].trim() : "",
        runtimeSeconds: runtimeMatch ? parseInt(runtimeMatch[1]) : 0,
        source: "handoff"
      });
    }
  }

  // ── Raw media files (no metadata) ──
  const mediaDir = join(STORAGE_ROOT, "storage", "media");
  if (existsSync(mediaDir)) {
    const files = await fsp.readdir(mediaDir).catch(() => [] as string[]);
    for (const file of files) {
      if (!file.endsWith(".mp4") || file === "mock-seed-dance-output.mp4") continue;
      const stat = statSync(join(mediaDir, file));
      const timestamp = stat.mtimeMs;
      videos.push({
        id: file,
        timestamp,
        date: new Date(timestamp).toISOString(),
        videoUrl: `/storage/media/${file}`,
        hook: file.replace(".mp4", ""),
        caption: "",
        fullScript: "",
        contentPillar: "",
        runtimeSeconds: 0,
        source: "media"
      });
    }
  }

  return videos.sort((a, b) => b.timestamp - a.timestamp);
}

function serveVideoFile(req: IncomingMessage, res: ServerResponse, filePath: string): void {
  if (!existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }

  const stat = statSync(filePath);
  const fileSize = stat.size;
  const ext = extname(filePath).toLowerCase();
  const mimeType = ext === ".mp4" ? "video/mp4" : ext === ".mp3" ? "audio/mpeg" : "application/octet-stream";
  const rangeHeader = req.headers["range"];

  if (rangeHeader) {
    const [startStr, endStr] = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": mimeType
    });
    createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": mimeType,
      "Accept-Ranges": "bytes"
    });
    createReadStream(filePath).pipe(res);
  }
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString()));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function serveFile(res: ServerResponse, filePath: string): void {
  if (!existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(readFileSync(filePath));
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}

// ── Router ───────────────────────────────────────────────────────────────────

async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const { pathname } = url;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  if (req.method === "GET") {
    if (pathname === "/" || pathname === "/index.html") {
      serveFile(res, join(PUBLIC, "index.html"));
      return;
    }
    if (pathname === "/create" || pathname === "/create.html") {
      serveFile(res, join(PUBLIC, "create.html"));
      return;
    }
    if (pathname === "/library" || pathname === "/library.html") {
      serveFile(res, join(PUBLIC, "library.html"));
      return;
    }
    if (pathname === "/api/videos") {
      try {
        const videos = await listVideos();
        json(res, 200, videos);
      } catch (err) {
        json(res, 500, { error: String(err) });
      }
      return;
    }
    if (pathname.startsWith("/storage/")) {
      const relativePath = pathname.slice("/storage/".length);
      const filePath = join(STORAGE_ROOT, "storage", relativePath);
      // Prevent directory traversal
      if (!filePath.startsWith(join(STORAGE_ROOT, "storage"))) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      serveVideoFile(req, res, filePath);
      return;
    }
  }

  if (req.method === "POST" && pathname === "/api/generate-video") {
    try {
      const body = await readBody(req);
      const { script, persona } = JSON.parse(body) as { script: ScriptJson; persona: PersonaInput };
      if (!script?.full_script) { json(res, 400, { error: "script is required" }); return; }

      const sdPrompt = buildSeedDancePrompt(persona, script);
      const client = makeSeedDanceClient();
      const media = await client.createSpokenVideo(sdPrompt);
      const publisher = new ManualHandoffPublisher(join(STORAGE_ROOT, "storage", "handoffs"));
      const pkg = await publisher.createPackage(script, media);
      const videoUrl = media.sourceUrl ?? `/storage/handoffs/${basename(pkg.packageDir)}/reel.mp4`;
      json(res, 200, {
        status: "done",
        videoUrl,
        date: new Date().toISOString(),
        hook: script.hook
      });
    } catch (err) {
      console.error("Video generation failed:", err);
      json(res, 500, { error: String(err) });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/generate") {
    try {
      const body = await readBody(req);
      const { prompt, persona } = JSON.parse(body) as GenerateRequest;

      if (!prompt?.trim()) {
        json(res, 400, { error: "prompt is required" });
        return;
      }
      if (!persona?.name?.trim()) {
        json(res, 400, { error: "persona.name is required" });
        return;
      }

      const rawScript = await generateScript(persona, prompt);
      const script = sanitizeScript(rawScript);
      const complianceReasons = checkGeneratedScript(script);
      const higgsfield = buildHiggsfieldPrompt(persona, script);

      json(res, 200, {
        script,
        compliance: { passed: complianceReasons.length === 0, reasons: complianceReasons },
        higgsfield
      });
    } catch (err) {
      console.error(err);
      json(res, 500, { error: String(err) });
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
}

export default handler;

if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT ?? 3002);
  createServer(handler).listen(PORT, () => {
    console.log(`Forge server → http://localhost:${PORT}`);
    console.log(`Library      → http://localhost:${PORT}/library`);
    console.log(`Generate     → http://localhost:${PORT}/create`);
  });
}
