import test from "node:test";
import assert from "node:assert/strict";
import { checkScript, parseScriptJson } from "../compliance/script-checker.js";
import type { ScriptJson } from "../domain/types.js";

const validScript: ScriptJson = {
  hook: "My lender vanished three days before closing.",
  problem: "I had earnest money out and the seller was done waiting.",
  agitate: "Then I saw 4 points and a draw schedule nobody explained.",
  solution:
    "Now I check the dashboard first. In some cases, that is what keeps the deal moving.",
  cta: "If you want to see how I fund my deals, link in bio.",
  full_script:
    "My lender vanished three days before closing. I had earnest money out and the seller was done waiting. Then I saw 4 points and a draw schedule nobody explained. Now I check the dashboard first. In some cases, that is what keeps the deal moving. If you want to see how I fund my deals, link in bio.",
  estimated_runtime_seconds: 38,
  tone_note: "Fast and direct.",
  hook_type: "pain",
  content_pillar: "pain_point_story"
};

test("accepts a compliant Sarah script", () => {
  assert.deepEqual(checkScript(validScript), []);
});

test("blocks specific rate quotes and guarantee language", () => {
  const script = {
    ...validScript,
    full_script: `${validScript.full_script} You get 7.5% and guaranteed approval.`
  };
  const reasons = checkScript(script);
  assert.ok(reasons.includes("Specific rate quote found"));
  assert.ok(reasons.includes("Guaranteed approval language found"));
});

test("parses required script JSON fields", () => {
  const parsed = parseScriptJson(JSON.stringify(validScript));
  assert.equal(parsed.hook, validScript.hook);
});
