export type ContentPillar =
  | "pain_point_story"
  | "education"
  | "process_walkthrough"
  | "myth_bust";

export type FilmingSetting =
  | "renovated_home_exterior"
  | "flip_in_progress_interior"
  | "coffee_shop_table"
  | "truck_or_suv";

export type PipelineState =
  | "planned"
  | "scripted"
  | "script_checked"
  | "prompted"
  | "seed_dance_generating"
  | "media_checked"
  | "ready_for_handoff"
  | "blocked";

export interface ContentPlan {
  id: string;
  date: string;
  contentPillar: ContentPillar;
  filmingSetting: FilmingSetting;
  state: PipelineState;
}

export interface ScriptJson {
  hook: string;
  problem: string;
  agitate: string;
  solution: string;
  cta: string;
  full_script: string;
  estimated_runtime_seconds: number;
  tone_note: string;
  hook_type: string;
  content_pillar: ContentPillar;
}

export interface SeedDancePrompt {
  identityReferenceImage: string;
  fullScript: string;
  segmentTimingGuidance: string;
  visualIdentity: string;
  filmingSetting: string;
  cameraStyle: string;
  spokenPerformanceDirection: string;
  aspectRatio: "9:16";
  durationSeconds: number;
  resolution?: "480p" | "720p" | "1080p";
}

export interface MediaAsset {
  videoPath: string;
  sourceUrl?: string;
  providerTaskId?: string;
  durationSeconds: number;
  aspectRatio: "9:16" | string;
  hasAudio: boolean;
  qaSignals?: {
    identityMatch?: boolean;
    scriptAccurate?: boolean;
    noLogos?: boolean;
    noTextOverlays?: boolean;
    naturalCamera?: boolean;
    audioUsable?: boolean;
  };
}

export interface HandoffPackage {
  packageDir: string;
  videoPath: string;
  captionPath: string;
  notesPath: string;
  metadataPath: string;
  thumbnailPath?: string;
}

export interface PipelineResult {
  plan: ContentPlan;
  script?: ScriptJson;
  prompt?: SeedDancePrompt;
  media?: MediaAsset;
  handoff?: HandoffPackage;
  blockReasons: string[];
}
