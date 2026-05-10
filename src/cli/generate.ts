import path from "node:path";
import { loadLocalEnv } from "../config/env.js";
import { UgcPipeline } from "../pipeline/pipeline.js";
import { ManualHandoffPublisher } from "../publishers/manual-handoff.js";
import {
  MockScriptGenerator,
  OpenAIScriptGenerator,
  type ScriptGenerator
} from "../providers/script-generator.js";
import {
  MockSeedDanceClient,
  SeedDanceApiClient,
  type SeedDanceClient
} from "../providers/seed-dance.js";

loadLocalEnv();

const outputDir = process.env.OUTPUT_DIR ?? "./storage";
const identityReferenceImage = process.env.SARAH_IDENTITY_IMAGE ?? "./sarah.jpg";

const scriptGenerator: ScriptGenerator = process.env.OPENAI_API_KEY
  ? new OpenAIScriptGenerator(process.env.OPENAI_API_KEY)
  : new MockScriptGenerator();

const seedDance: SeedDanceClient =
  process.env.SEED_DANCE_API_KEY && process.env.SEED_DANCE_BASE_URL
    ? new SeedDanceApiClient(
        process.env.SEED_DANCE_API_KEY,
        process.env.SEED_DANCE_BASE_URL,
        process.env.SEED_DANCE_MODEL ?? "dreamina-seedance-2-0-260128",
        path.join(outputDir, "media")
      )
    : new MockSeedDanceClient(path.join(outputDir, "media"));

const pipeline = new UgcPipeline(
  scriptGenerator,
  seedDance,
  new ManualHandoffPublisher(path.join(outputDir, "handoffs"))
);

const result = await pipeline.run({ identityReferenceImage });

if (result.blockReasons.length > 0) {
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result, null, 2));
}
