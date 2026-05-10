import type { MediaAsset } from "../domain/types.js";
import { runtimeWindow } from "../config/runtime.js";
import { hasMp4AudioTrack, hasMp4VideoTrack } from "../media/mp4-inspector.js";

export function checkMedia(media: MediaAsset): string[] {
  const reasons: string[] = [];

  if (media.aspectRatio !== "9:16") {
    reasons.push("Media aspect ratio must be 9:16");
  }

  if (!media.hasAudio) {
    reasons.push("Seed Dance output must include spoken audio");
  }

  if (!hasMp4VideoTrack(media.videoPath)) {
    reasons.push("Seed Dance output must include a video track");
  }

  if (!hasMp4AudioTrack(media.videoPath)) {
    reasons.push("Seed Dance output must include an audio track");
  }

  const runtime = runtimeWindow();
  if (media.durationSeconds < runtime.min || media.durationSeconds > runtime.max) {
    reasons.push(`Media duration must be ${runtime.min}-${runtime.max} seconds`);
  }

  const signals = media.qaSignals;
  if (signals) {
    if (signals.identityMatch === false) reasons.push("Sarah identity did not match");
    if (signals.scriptAccurate === false) reasons.push("Spoken script drift detected");
    if (signals.noLogos === false) reasons.push("Logo detected");
    if (signals.noTextOverlays === false) reasons.push("Text overlay detected");
    if (signals.naturalCamera === false) reasons.push("Camera style failed QA");
    if (signals.audioUsable === false) reasons.push("Audio failed QA");
  }

  return reasons;
}
