import {
  cameraStyle,
  filmingSettingDescriptions,
  sarahVisualIdentity,
  spokenPerformanceDirection
} from "../content/brand.js";
import type { ContentPlan, ScriptJson, SeedDancePrompt } from "../domain/types.js";
import { runtimeWindow } from "../config/runtime.js";

export function buildSeedDancePrompt(
  plan: ContentPlan,
  script: ScriptJson,
  identityReferenceImage: string
): SeedDancePrompt {
  const runtime = runtimeWindow();
  return {
    identityReferenceImage,
    fullScript: script.full_script,
    segmentTimingGuidance:
      `Compress Hook, Problem, Agitate, Solution, CTA into ${runtime.target} seconds. Generate one complete spoken Reel with matching lip sync and natural pacing.`,
    visualIdentity: sarahVisualIdentity,
    filmingSetting: filmingSettingDescriptions[plan.filmingSetting],
    cameraStyle,
    spokenPerformanceDirection,
    aspectRatio: "9:16",
    durationSeconds: runtime.target,
    resolution: (process.env.SEED_DANCE_RESOLUTION as "480p" | "720p" | "1080p" | undefined) ?? "720p"
  };
}
