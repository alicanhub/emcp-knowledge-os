import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function featureContext() {
  const appended = [];
  const document = {
    createElement: () => {
      const listeners = new Map();
      return {
        addEventListener: (type, callback) => listeners.set(type, callback),
        dispatch: (type) => listeners.get(type)?.(),
      };
    },
    head: { appendChild: (script) => appended.push(script) },
  };
  const context = {
    document,
    setTimeout,
    EMCPOperations: { flags: { preloadFeatures: false } },
    requestIdleCallback: () => {},
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync("js/features.js", "utf8"), context);
  return { features: context.EMCPFeatures, appended };
}

test("failed script and feature loads can be retried", async () => {
  const { features, appended } = featureContext();

  const firstAttempt = features.load("calculators");
  await Promise.resolve();
  assert.equal(appended.length, 1);
  appended[0].dispatch("error");
  await assert.rejects(firstAttempt, /Unable to load js\/calculators\.js/);

  const secondAttempt = features.load("calculators");
  await Promise.resolve();
  assert.equal(appended.length, 2, "navigation should append a fresh script");
  appended[1].dispatch("load");
  await secondAttempt;

  await features.load("calculators");
  assert.equal(appended.length, 2, "successful loads should remain cached");
});
