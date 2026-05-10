import { loadLocalEnv } from "../config/env.js";
import { pillarForDate, nextFilmingSetting } from "../content/scheduler.js";
import type { ContentPlan, ScriptJson } from "../domain/types.js";
import { buildSeedDancePrompt } from "../pipeline/prompt-builder.js";
import { SeedDanceApiClient } from "../providers/seed-dance.js";

loadLocalEnv();

const date = new Date();
const plan: ContentPlan = {
  id: "preview",
  date: date.toISOString().slice(0, 10),
  contentPillar: pillarForDate(date),
  filmingSetting: nextFilmingSetting(),
  state: "prompted"
};

const script: ScriptJson = {
  hook: "Want a fix-and-flip loan without lender chaos?",
  problem: "The process can eat your deal alive.",
  agitate: "I got burned by hidden fees and missed closings.",
  solution: "Now I use lenders who show every step up front.",
  cta: "Curious how I cut out the drama? Link in bio.",
  full_script:
    "Want a fix-and-flip loan without lender chaos? The process can eat your deal alive. I got burned by hidden fees and missed closings. Now I use lenders who show every step up front. Curious how I cut out the drama? Link in bio.",
  estimated_runtime_seconds: 5,
  tone_note: "Direct, fast, confident, no hype.",
  hook_type: "Pain point question",
  content_pillar: plan.contentPillar
};

const client = new SeedDanceApiClient(
  "preview",
  process.env.SEED_DANCE_BASE_URL ?? "https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks",
  process.env.SEED_DANCE_MODEL ?? "dreamina-seedance-2-0-260128",
  process.env.OUTPUT_DIR ?? "./storage"
);

const prompt = buildSeedDancePrompt(
  plan,
  script,
  process.env.SEED_DANCE_PREVIEW_IMAGE ??
    "https://inllprcvvrgwfewymwve.supabase.co/storage/v1/object/public/propflow-photos/20d8c9cd-a469-4def-ba37-fc9f4740be71/1-photo_1_2026-02-08_12-26-11.jpg"
);

const payload = client.buildTaskBody(prompt);
console.log(JSON.stringify(redactLargeDataUrls(payload), null, 2));

function redactLargeDataUrls(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactLargeDataUrls);
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = redactLargeDataUrls(nested);
    }
    return output;
  }

  if (typeof value === "string" && value.startsWith("data:image/")) {
    return `${value.slice(0, 32)}...<base64 image redacted>`;
  }

  return value;
}
