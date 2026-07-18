import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { self: null };
context.self = context;
vm.runInNewContext(fs.readFileSync("js/learning-engine.js", "utf8"), context);

function setup(initial = {}) {
  let value = structuredClone(initial);
  const storage = {
      get: () => structuredClone(value),
      set: (_key, next) => {
        value = structuredClone(next);
        return true;
      },
    },
    engine = context.EMCPLearningEngine.create({
      storage,
      now: () => "2026-07-18T12:00:00.000Z",
    });
  return { engine, value: () => value };
}

test("tracks the complete learning status lifecycle", () => {
  const { engine } = setup();
  for (const status of ["saved", "in-progress", "completed", "mastered"])
    assert.equal(engine.set("LTV", status).status, status);
  assert.equal(engine.get("LTV").status, "mastered");
  assert.equal(engine.percentage("LTV"), 100);
  assert.equal(engine.set("LTV", "published"), false);
});

test("records visits without weakening an achieved status", () => {
  const { engine } = setup();
  engine.set("ROI", "completed");
  engine.visit("ROI");
  engine.visit("ROI");
  assert.equal(engine.get("ROI").status, "completed");
  assert.equal(engine.get("ROI").visits, 2);
});

test("defensively parses progress and creates a personal timeline", () => {
  const { engine } = setup({
    Broken: { status: "invalid" },
    LTV: { status: "saved", updatedAt: "2026-01-01", visits: 1 },
    ROI: { status: "mastered", updatedAt: "2026-02-01", visits: 4 },
  });
  assert.equal(engine.get("Broken"), null);
  const timeline = engine.timeline([{ term: "ROI" }, { term: "LTV" }]);
  assert.deepEqual(
    Array.from(timeline, (item) => item.entry.term),
    ["LTV", "ROI"],
  );
});
