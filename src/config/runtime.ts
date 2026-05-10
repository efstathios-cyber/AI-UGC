export interface RuntimeWindow {
  min: number;
  max: number;
  target: number;
}

export function runtimeWindow(): RuntimeWindow {
  const configured = Number(process.env.SEED_DANCE_DURATION_SECONDS);
  if (Number.isFinite(configured) && configured > 0) {
    return {
      min: Math.max(1, configured - 1),
      max: configured + 1,
      target: configured
    };
  }

  if (process.env.SEED_DANCE_API_KEY) {
    return { min: 4, max: 6, target: 5 };
  }

  return { min: 35, max: 40, target: 38 };
}
