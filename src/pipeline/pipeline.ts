import { existsSync } from "node:fs";
import { pillarForDate, nextFilmingSetting } from "../content/scheduler.js";
import { checkScript, sanitizeScript } from "../compliance/script-checker.js";
import type { ContentPlan, FilmingSetting, PipelineResult } from "../domain/types.js";
import { isRemoteImageReference } from "../media/image-reference.js";
import type { ScriptGenerator } from "../providers/script-generator.js";
import type { SeedDanceClient } from "../providers/seed-dance.js";
import { ManualHandoffPublisher } from "../publishers/manual-handoff.js";
import { buildSeedDancePrompt } from "./prompt-builder.js";

export interface PipelineOptions {
  date?: Date;
  previousFilmingSetting?: FilmingSetting;
  identityReferenceImage: string;
}

export class UgcPipeline {
  constructor(
    private readonly scriptGenerator: ScriptGenerator,
    private readonly seedDance: SeedDanceClient,
    private readonly publisher: ManualHandoffPublisher
  ) {}

  async run(options: PipelineOptions): Promise<PipelineResult> {
    const date = options.date ?? new Date();
    const plan: ContentPlan = {
      id: `plan-${date.toISOString().slice(0, 10)}-${Date.now()}`,
      date: date.toISOString().slice(0, 10),
      contentPillar: pillarForDate(date),
      filmingSetting: nextFilmingSetting(options.previousFilmingSetting),
      state: "planned"
    };

    const blockReasons: string[] = [];
    if (
      !isRemoteImageReference(options.identityReferenceImage) &&
      !existsSync(options.identityReferenceImage)
    ) {
      plan.state = "blocked";
      return {
        plan,
        blockReasons: [`Missing identity reference image: ${options.identityReferenceImage}`]
      };
    }

    const script = sanitizeScript(await this.scriptGenerator.generate(plan));
    plan.state = "scripted";

    const scriptReasons = checkScript(script);
    if (scriptReasons.length > 0) {
      plan.state = "blocked";
      return { plan, script, blockReasons: scriptReasons };
    }

    plan.state = "script_checked";
    const prompt = buildSeedDancePrompt(plan, script, options.identityReferenceImage);
    plan.state = "prompted";

    const media = await this.seedDance.createSpokenVideo(prompt);
    plan.state = "seed_dance_generating";

    plan.state = "media_checked";
    const handoff = await this.publisher.createPackage(script, media);
    plan.state = "ready_for_handoff";

    return {
      plan,
      script,
      prompt,
      media,
      handoff,
      blockReasons
    };
  }
}
