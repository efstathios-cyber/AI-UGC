import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { UgcPipeline } from "../pipeline/pipeline.js";
import { ManualHandoffPublisher } from "../publishers/manual-handoff.js";
import { MockScriptGenerator } from "../providers/script-generator.js";
import { MockSeedDanceClient } from "../providers/seed-dance.js";

test("blocks when sarah identity image is missing", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ugc-pipeline-"));
  const pipeline = new UgcPipeline(
    new MockScriptGenerator(),
    new MockSeedDanceClient(path.join(tempDir, "media")),
    new ManualHandoffPublisher(path.join(tempDir, "handoff"))
  );

  const result = await pipeline.run({
    identityReferenceImage: path.join(tempDir, "missing-sarah.jpg")
  });

  assert.equal(result.plan.state, "blocked");
  assert.match(result.blockReasons[0], /Missing identity reference image/);
});

test("creates a manual handoff package when checks pass", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ugc-pipeline-"));
  const identityPath = path.join(tempDir, "sarah.jpg");
  await fs.writeFile(identityPath, "mock image");

  const pipeline = new UgcPipeline(
    new MockScriptGenerator(),
    new MockSeedDanceClient(path.join(tempDir, "media")),
    new ManualHandoffPublisher(path.join(tempDir, "handoff"))
  );

  const result = await pipeline.run({ identityReferenceImage: identityPath });

  assert.equal(result.plan.state, "ready_for_handoff");
  assert.equal(result.blockReasons.length, 0);
  assert.ok(result.handoff?.videoPath);
  await fs.access(result.handoff!.captionPath);

  const sourceBytes = await readFile(result.media!.videoPath);
  const handoffBytes = await readFile(result.handoff!.videoPath);
  assert.deepEqual(handoffBytes, sourceBytes);
});
