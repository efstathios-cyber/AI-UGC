import type { ContentPillar, FilmingSetting } from "../domain/types.js";

const weekdayPillars: Record<number, ContentPillar> = {
  0: "myth_bust",
  1: "pain_point_story",
  2: "education",
  3: "process_walkthrough",
  4: "pain_point_story",
  5: "education",
  6: "process_walkthrough"
};

const settings: FilmingSetting[] = [
  "renovated_home_exterior",
  "flip_in_progress_interior",
  "coffee_shop_table",
  "truck_or_suv"
];

export function pillarForDate(date: Date): ContentPillar {
  return weekdayPillars[date.getDay()];
}

export function nextFilmingSetting(previous?: FilmingSetting): FilmingSetting {
  if (!previous) {
    return settings[0];
  }

  const currentIndex = settings.indexOf(previous);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % settings.length;
  return settings[nextIndex];
}
