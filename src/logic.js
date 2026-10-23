"use strict";
// ABC Stock Classifier: core logic (pure functions, no DOM).

function parseCSV(text) {
  const rows = [];
  let row = [], cur = "", inQ = false;
  const s = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else { inQ = false; } }
      else { cur += c; }
    } else if (c === '"') { inQ = true; }
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c === "\r") { /* skip */ }
    else { cur += c; }
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  const clean = rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ""; }); });
  if (!clean.length) { return { headers: [], rows: [] }; }
  const headers = clean[0].map(function (h) { return String(h).trim(); });
  const out = clean.slice(1).map(function (r) {
    const o = {};
    headers.forEach(function (h, idx) { o[h] = r[idx] !== undefined ? String(r[idx]).trim() : ""; });
    return o;
  });
  return { headers: headers, rows: out };
}
function csvEscape(v) {
  const s = String(v === null || v === undefined ? "" : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCSV(headers, rows) {
  return [headers.join(",")].concat(rows.map(function (r) {
    return headers.map(function (h) { return csvEscape(r[h]); }).join(",");
  })).join("\n");
}
function findColumn(headers, candidates) {
  const low = headers.map(function (h) { return h.toLowerCase(); });
  for (const c of candidates) { const i = low.indexOf(c); if (i >= 0) { return headers[i]; } }
  for (const c of candidates) { const i = low.findIndex(function (h) { return h.indexOf(c) !== -1; }); if (i >= 0) { return headers[i]; } }
  return null;
}
function round2(n) { return Math.round(n * 100) / 100; }

function coefficientOfVariation(values) {
  const nums = values.map(Number).filter(function (v) { return !isNaN(v); });
  if (nums.length < 2) { return null; }
  const mean = nums.reduce(function (a, b) { return a + b; }, 0) / nums.length;
  if (mean === 0) { return null; }
  const variance = nums.reduce(function (a, v) { return a + Math.pow(v - mean, 2); }, 0) / nums.length;
  return Math.sqrt(variance) / mean;
}

function xyzClass(values) {
  const cv = coefficientOfVariation(values || []);
  if (cv === null) { return null; }
  if (cv <= 0.5) { return "X"; }
  if (cv <= 1.0) { return "Y"; }
  return "Z";
}

function isMonthlyColumn(header) {
  const h = String(header).toLowerCase().trim();
  return /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(_|$|uary|ruary|ch|il|e|y|ust|ember|ober)/.test(h)
    || /^m\d{1,2}$/.test(h) || /^month[_-]?\d{1,2}$/.test(h) || /^\d{4}[-/]\d{2}$/.test(h) || /^q\d{4}/.test(h);
}

function classifyItems(items, options) {
  const opts = options || {};
  const aThreshold = opts.aThreshold !== undefined ? Number(opts.aThreshold) : 80;
  const bThreshold = opts.bThreshold !== undefined ? Number(opts.bThreshold) : 95;
  const enriched = items.map(function (it) {
    const unitCost = Number(it.unitCost) || 0;
    const annualQty = Number(it.annualQty) || 0;
    const monthly = (it.monthly || []).map(Number).filter(function (v) { return !isNaN(v); });
    return {
      sku: it.sku || "", unitCost: unitCost, annualQty: annualQty,
      annualValue: round2(unitCost * annualQty),
      monthly: monthly,
      deadStock: annualQty === 0 && (monthly.length === 0 || monthly.every(function (v) { return v === 0; }))
    };
  });
  enriched.sort(function (a, b) { return b.annualValue - a.annualValue; });
  const total = enriched.reduce(function (a, it) { return a + it.annualValue; }, 0);
  let running = 0;
  const values = enriched.map(function (it) { return it.annualValue; }).sort(function (a, b) { return a - b; });
  const p90 = values.length ? values[Math.min(values.length - 1, Math.floor(values.length * 0.9))] : 0;
  enriched.forEach(function (it) {
    running += it.annualValue;
    it.cumulativePercent = total > 0 ? round2((running / total) * 100) : 0;
    it.valueSharePercent = total > 0 ? round2((it.annualValue / total) * 100) : 0;
    if (it.cumulativePercent <= aThreshold) { it.abc = "A"; }
    else if (it.cumulativePercent <= bThreshold) { it.abc = "B"; }
    else { it.abc = "C"; }
    it.xyz = xyzClass(it.monthly);
    it.combined = it.xyz ? it.abc + it.xyz : it.abc;
    it.highValue = total > 0 && it.annualValue >= p90 && it.annualValue > 0;
    it.flags = [];
    if (it.deadStock) { it.flags.push("dead-stock"); }
    if (it.highValue) { it.flags.push("high-value"); }
    if (it.abc === "A" && it.xyz === "Z") { it.flags.push("volatile-a-item"); }
  });
  return { items: enriched, totalValue: round2(total), aThreshold: aThreshold, bThreshold: bThreshold };
}

function summarizeClasses(classified) {
  const summary = { A: { count: 0, value: 0 }, B: { count: 0, value: 0 }, C: { count: 0, value: 0 } };
  classified.items.forEach(function (it) {
    summary[it.abc].count += 1;
    summary[it.abc].value = round2(summary[it.abc].value + it.annualValue);
  });
  Object.keys(summary).forEach(function (k) {
    summary[k].valueSharePercent = classified.totalValue > 0 ? round2((summary[k].value / classified.totalValue) * 100) : 0;
  });
  return summary;
}

function paretoData(classified) {
  return classified.items.map(function (it) {
    return { sku: it.sku, annualValue: it.annualValue, cumulativePercent: it.cumulativePercent, abc: it.abc };
  });
}

function classifyCSV(text, options) {
  const parsed = parseCSV(text);
  const headers = parsed.headers;
  const skuCol = findColumn(headers, ["sku", "item", "product", "code"]);
  const costCol = findColumn(headers, ["unit cost", "unit_cost", "cost", "price"]);
  const qtyCol = findColumn(headers, ["annual qty", "annual_qty", "annual quantity", "annual usage", "qty", "quantity", "usage"]);
  const monthlyCols = headers.filter(function (h) { return isMonthlyColumn(h); });
  const items = parsed.rows.map(function (r) {
    return {
      sku: skuCol ? r[skuCol] : "",
      unitCost: costCol ? r[costCol] : 0,
      annualQty: qtyCol ? r[qtyCol] : 0,
      monthly: monthlyCols.map(function (c) { return r[c]; })
    };
  });
  // If there is no annual qty column but monthly columns exist, sum them.
  if (!qtyCol && monthlyCols.length) {
    items.forEach(function (it) { it.annualQty = it.monthly.reduce(function (a, v) { return a + (Number(v) || 0); }, 0); });
  }
  const classified = classifyItems(items, options);
  classified.columns = { sku: skuCol, cost: costCol, qty: qtyCol, monthly: monthlyCols };
  return classified;
}

function buildClassifiedCSV(classified) {
  const headers = ["sku", "unit_cost", "annual_qty", "annual_value", "value_share_percent", "cumulative_percent", "abc", "xyz", "combined", "flags"];
  const rows = classified.items.map(function (it) {
    return { sku: it.sku, unit_cost: it.unitCost, annual_qty: it.annualQty, annual_value: it.annualValue, value_share_percent: it.valueSharePercent, cumulative_percent: it.cumulativePercent, abc: it.abc, xyz: it.xyz || "", combined: it.combined, flags: it.flags.join("; ") };
  });
  return toCSV(headers, rows);
}

const api = { parseCSV, toCSV, findColumn, coefficientOfVariation, xyzClass, isMonthlyColumn, classifyItems, summarizeClasses, paretoData, classifyCSV, buildClassifiedCSV };
if (typeof module !== "undefined" && module.exports) { module.exports = api; }
if (typeof window !== "undefined") { window.AbcStockClassifier = api; }
