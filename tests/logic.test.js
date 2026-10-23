"use strict";
const test = require("node:test");
const assert = require("node:assert");
const L = require("../src/logic.js");

function sampleItems() {
  return [
    { sku: "BIG", unitCost: 100, annualQty: 60 },   // 6000
    { sku: "MID", unitCost: 50, annualQty: 20 },    // 1000
    { sku: "SMALL", unitCost: 10, annualQty: 50 },  // 500
    { sku: "TINY", unitCost: 5, annualQty: 40 },    // 200
    { sku: "DEAD", unitCost: 30, annualQty: 0 }     // 0
  ];
}

test("annual value computation and sorting", () => {
  const out = L.classifyItems(sampleItems(), {});
  assert.strictEqual(out.totalValue, 7700);
  assert.strictEqual(out.items[0].sku, "BIG");
  assert.strictEqual(out.items[0].annualValue, 6000);
  assert.strictEqual(out.items[0].valueSharePercent, 77.92);
});

test("cumulative percent classification at default 80/95 thresholds", () => {
  const out = L.classifyItems(sampleItems(), {});
  const bySku = {};
  out.items.forEach(i => { bySku[i.sku] = i; });
  assert.strictEqual(bySku.BIG.abc, "A");    // cumulative 77.92 <= 80
  assert.strictEqual(bySku.MID.abc, "B");    // cumulative 90.91 <= 95
  assert.strictEqual(bySku.SMALL.abc, "C");  // cumulative 97.4 > 95
  assert.strictEqual(bySku.TINY.abc, "C");
});

test("adjustable thresholds change the classes", () => {
  const out = L.classifyItems(sampleItems(), { aThreshold: 70, bThreshold: 85 });
  const bySku = {};
  out.items.forEach(i => { bySku[i.sku] = i; });
  assert.strictEqual(bySku.BIG.abc, "B");  // 77.92 > 70, <= 85
  assert.strictEqual(bySku.MID.abc, "C");  // 90.91 > 85
});

test("XYZ variability classes from monthly columns", () => {
  assert.strictEqual(L.xyzClass([10, 10, 11, 9, 10, 10]), "X");
  assert.strictEqual(L.xyzClass([2, 18, 2, 18, 2, 18]), "Y"); // CV 0.8
  assert.strictEqual(L.xyzClass([0, 0, 40, 0, 0, 0]), "Z");
  assert.strictEqual(L.xyzClass([]), null);
  const cv = L.coefficientOfVariation([10, 10, 10, 10]);
  assert.strictEqual(cv, 0);
});

test("dead stock flag for zero movement items", () => {
  const out = L.classifyItems(sampleItems(), {});
  const dead = out.items.find(i => i.sku === "DEAD");
  assert.strictEqual(dead.deadStock, true);
  assert.ok(dead.flags.includes("dead-stock"));
  const big = out.items.find(i => i.sku === "BIG");
  assert.strictEqual(big.deadStock, false);
});

test("pareto data build and class summary", () => {
  const out = L.classifyItems(sampleItems(), {});
  const pareto = L.paretoData(out);
  assert.strictEqual(pareto.length, 5);
  assert.strictEqual(pareto[0].cumulativePercent, 77.92);
  assert.strictEqual(pareto[4].cumulativePercent, 100);
  const summary = L.summarizeClasses(out);
  assert.strictEqual(summary.A.count, 1);
  assert.strictEqual(summary.B.count, 1);
  assert.strictEqual(summary.C.count, 3);
  assert.strictEqual(summary.A.value, 6000);
});

test("classifyCSV detects monthly columns and combined class", () => {
  const csv = "sku,unit_cost,annual_qty,jan,feb,mar\nW-1,20,120,10,10,10\nW-2,2,10,0,9,0\nW-3,5,200,16,17,16";
  const out = L.classifyCSV(csv, {});
  assert.deepStrictEqual(out.columns.monthly, ["jan", "feb", "mar"]);
  const w1 = out.items.find(i => i.sku === "W-1");
  assert.strictEqual(w1.xyz, "X");
  assert.strictEqual(w1.combined, "AX");
  const csvOut = L.buildClassifiedCSV(out);
  assert.ok(csvOut.includes("combined"));
  assert.ok(csvOut.includes("AX"));
});

test("monthly column detection", () => {
  assert.strictEqual(L.isMonthlyColumn("jan"), true);
  assert.strictEqual(L.isMonthlyColumn("m3"), true);
  assert.strictEqual(L.isMonthlyColumn("2026-04"), true);
  assert.strictEqual(L.isMonthlyColumn("annual_qty"), false);
  assert.strictEqual(L.isMonthlyColumn("sku"), false);
});
