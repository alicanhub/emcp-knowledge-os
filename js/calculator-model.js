(function (global) {
  "use strict";
  const ratio = (value, base) =>
    Number.isFinite(value) && Number.isFinite(base) && base !== 0
      ? (value / base) * 100
      : null;
  const developmentProfit = (gdv, cost) => ({
    profit: gdv - cost,
    returnOnCost: ratio(gdv - cost, cost),
  });
  function monthlyPayment(principal, annualRate, years) {
    const rate = annualRate / 100 / 12,
      months = years * 12;
    if (
      !Number.isFinite(principal) ||
      !Number.isFinite(rate) ||
      !Number.isFinite(months) ||
      months <= 0
    )
      return null;
    return rate
      ? (principal * rate * Math.pow(1 + rate, months)) /
          (Math.pow(1 + rate, months) - 1)
      : principal / months;
  }
  const arrangementFee = (loan, feeRate) => loan * (feeRate / 100);
  const interestRollup = (loan, annualRate, months) =>
    loan * (annualRate / 100) * (months / 12);
  const concrete = (length, width, depth) => length * width * depth;
  const paint = (length, height, coats) => length * height * coats;
  const flooring = (length, width, waste) => length * width * (1 + waste / 100);
  const plasterboard = (area, sheetArea, waste) =>
    Math.ceil((area * (1 + waste / 100)) / sheetArea);
  const insulation = (area, waste) => area * (1 + waste / 100);
  const tiles = (area, tileArea, waste) =>
    Math.ceil((area * (1 + waste / 100)) / tileArea);
  function snapshot(inputs) {
    const development = developmentProfit(inputs.dealGdv, inputs.dealCost);
    return {
      ltv: ratio(inputs.dealLoan, inputs.dealPropertyValue),
      ltc: ratio(inputs.dealLoan, inputs.dealCost),
      ltgdv: ratio(inputs.dealLoan, inputs.dealGdv),
      profit: development.profit,
      returnOnCost: development.returnOnCost,
      rentalYield: ratio(inputs.dealRent, inputs.dealPropertyValue),
      equity: inputs.dealCost - inputs.dealLoan,
    };
  }
  global.EMCPCalculatorModel = {
    ratio,
    developmentProfit,
    monthlyPayment,
    arrangementFee,
    interestRollup,
    concrete,
    paint,
    flooring,
    plasterboard,
    insulation,
    tiles,
    snapshot,
  };
})(window);
