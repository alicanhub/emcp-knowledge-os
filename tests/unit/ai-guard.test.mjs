import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("js/ai-guard.js", "utf8");
const load = () => {
  const context = { window: null, Date };
  context.window = context;
  vm.runInNewContext(source, context);
  return context.EMCPAIGuard;
};

test("AI guard bounds prompt size", () => {
  const guard = load();
  assert.equal(guard.check("x".repeat(1001), 1).reason, "too_long");
  assert.equal(guard.check("valid", 1).allowed, true);
});

test("AI guard rate limits bursts and recovers", () => {
  const guard = load();
  for (let index = 0; index < 10; index++)
    assert.equal(guard.check(`q${index}`, 1000).allowed, true);
  assert.equal(guard.check("overflow", 1000).reason, "rate_limited");
  assert.equal(guard.check("later", 100_000).allowed, true);
});
