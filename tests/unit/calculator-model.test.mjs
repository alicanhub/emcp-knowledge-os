import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { window: null };
context.window = context;
vm.runInNewContext(fs.readFileSync("js/calculator-model.js", "utf8"), context);
const model = context.EMCPCalculatorModel;

test("finance ratios and zero bases", () => {
  assert.equal(model.ratio(700000, 1000000), 70);
  assert.equal(model.ratio(1, 0), null);
});
test("amortising payment", () =>
  assert.equal(model.monthlyPayment(500000, 6.5, 20).toFixed(2), "3727.87"));
test("construction quantities round correctly", () => {
  assert.equal(model.concrete(8, 4, 0.15), 4.8);
  assert.equal(model.plasterboard(85, 2.88, 10), 33);
  assert.equal(model.tiles(35, 0.09, 10), 428);
});
test("deal snapshot returns consistent metrics", () => {
  const result = model.snapshot({
    dealLoan: 700000,
    dealPropertyValue: 1000000,
    dealCost: 900000,
    dealGdv: 1250000,
    dealRent: 60000,
  });
  assert.deepEqual(
    { ...result },
    {
      ltv: 70,
      ltc: (700000 / 900000) * 100,
      ltgdv: 56.00000000000001,
      profit: 350000,
      returnOnCost: (350000 / 900000) * 100,
      rentalYield: 6,
      equity: 200000,
    },
  );
});
