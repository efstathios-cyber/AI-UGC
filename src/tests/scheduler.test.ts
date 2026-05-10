import test from "node:test";
import assert from "node:assert/strict";
import { nextFilmingSetting, pillarForDate } from "../content/scheduler.js";

test("maps weekdays to Sarah content pillars", () => {
  assert.equal(pillarForDate(new Date("2026-05-04T12:00:00Z")), "pain_point_story");
  assert.equal(pillarForDate(new Date("2026-05-05T12:00:00Z")), "education");
  assert.equal(pillarForDate(new Date("2026-05-06T12:00:00Z")), "process_walkthrough");
  assert.equal(pillarForDate(new Date("2026-05-10T12:00:00Z")), "myth_bust");
});

test("rotates filming settings without repeating the prior setting", () => {
  const first = nextFilmingSetting();
  const second = nextFilmingSetting(first);
  assert.notEqual(first, second);
});
