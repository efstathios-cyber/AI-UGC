import type { ScriptJson } from "../domain/types.js";
import { runtimeWindow } from "../config/runtime.js";

const bannedPhrases = [
  "game-changer",
  "game changer",
  "revolutionary",
  "seamless",
  "cutting-edge",
  "amazing"
];

const guaranteePatterns = [
  /\bguaranteed\b/i,
  /\bguarantee\b/i,
  /\bapproved every time\b/i,
  /\bwill approve\b/i
];

const unqualifiedSpeedPatterns = [
  /\bclose in \d+\s*(day|days|hour|hours)\b/i,
  /\bfund in \d+\s*(day|days|hour|hours)\b/i,
  /\bapproval in \d+\s*(day|days|hour|hours)\b/i
];

const companyPatterns = [
  /\brocket mortgage\b/i,
  /\bkiavi\b/i,
  /\blima one\b/i,
  /\bcivic\b/i,
  /\bvisio\b/i
];

export function parseScriptJson(raw: string): ScriptJson {
  const parsed = JSON.parse(raw) as Partial<ScriptJson>;
  const required: Array<keyof ScriptJson> = [
    "hook",
    "problem",
    "agitate",
    "solution",
    "cta",
    "full_script",
    "estimated_runtime_seconds",
    "tone_note",
    "hook_type",
    "content_pillar"
  ];

  for (const key of required) {
    if (parsed[key] === undefined || parsed[key] === null) {
      throw new Error(`Script JSON missing required field: ${key}`);
    }
  }

  if (typeof parsed.estimated_runtime_seconds !== "number") {
    throw new Error("estimated_runtime_seconds must be a number");
  }

  return parsed as ScriptJson;
}

export function sanitizeScript(script: ScriptJson): ScriptJson {
  return {
    ...script,
    hook: sanitizeText(script.hook),
    problem: sanitizeText(script.problem),
    agitate: sanitizeText(script.agitate),
    solution: sanitizeText(script.solution),
    cta: sanitizeText(script.cta),
    full_script: sanitizeText(script.full_script),
    tone_note: sanitizeText(script.tone_note),
    hook_type: sanitizeText(script.hook_type)
  };
}

export function checkScript(script: ScriptJson): string[] {
  const text = [
    script.hook,
    script.problem,
    script.agitate,
    script.solution,
    script.cta,
    script.full_script
  ].join("\n");
  const lower = text.toLowerCase();
  const reasons: string[] = [];

  for (const phrase of bannedPhrases) {
    if (lower.includes(phrase)) {
      reasons.push(`Banned phrase found: ${phrase}`);
    }
  }

  if (text.includes("—") || text.includes("–")) {
    reasons.push("Script contains an em/en dash");
  }

  for (const pattern of guaranteePatterns) {
    if (pattern.test(text)) {
      reasons.push("Guaranteed approval language found");
      break;
    }
  }

  for (const pattern of companyPatterns) {
    if (pattern.test(text)) {
      reasons.push("Company name found");
      break;
    }
  }

  for (const pattern of unqualifiedSpeedPatterns) {
    if (pattern.test(text) && !/\bas fast as\b|\bin some cases\b/i.test(text)) {
      reasons.push("Unqualified speed claim found");
      break;
    }
  }

  if (/\b\d+(\.\d+)?\s*%/.test(text) || /\b\d+(\.\d+)? percent\b/i.test(text)) {
    reasons.push("Specific rate quote found");
  }

  if (!/\blink in bio\b/i.test(script.cta)) {
    reasons.push("CTA must be soft and curiosity-based with link in bio language");
  }

  const runtime = runtimeWindow();
  if (
    script.estimated_runtime_seconds < runtime.min ||
    script.estimated_runtime_seconds > runtime.max
  ) {
    reasons.push(`Estimated runtime must be ${runtime.min}-${runtime.max} seconds`);
  }

  return reasons;
}

function sanitizeText(value: string): string {
  return value
    .replace(/[—–]/g, ",")
    .replace(/\b(got funded in) (\d+\s*(?:day|days|hour|hours))\b/gi, "$1 as fast as $2")
    .replace(/\b(close in) (\d+\s*(?:day|days|hour|hours))\b/gi, "$1 as fast as $2")
    .replace(/\b(fund in) (\d+\s*(?:day|days|hour|hours))\b/gi, "$1 as fast as $2")
    .replace(/\b(approval in) (\d+\s*(?:day|days|hour|hours))\b/gi, "$1 as fast as $2")
    .replace(/\s+/g, " ")
    .trim();
}
