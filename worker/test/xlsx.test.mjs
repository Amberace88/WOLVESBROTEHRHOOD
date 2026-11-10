/* Node tests for worker/src/lib/xlsx.js — run: node worker/test/xlsx.test.mjs [path-to-wob.xlsx] */
import fs from "node:fs";
import assert from "node:assert/strict";
import { zipEntries, readFirstSheet, parseWOB, parseWOBFile, excelDate, parseSheet, parseSharedStrings, jsonStatValue } from "../src/lib/xlsx.js";

const file = process.argv[2] || new URL("./fixtures/wob-prices-with-taxes-2026-09-28.xlsx", import.meta.url).pathname;
let pass = 0; const t = async (name, fn) => { await fn(); pass++; console.log("PASS", name); };

await t("excelDate", () => { assert.equal(excelDate(46293), "2026-09-28"); assert.equal(excelDate(25569), "1970-01-01"); });
await t("sharedStrings with rich text + entities", () => {
  assert.deepEqual(parseSharedStrings('<sst><si><t>a &amp; b</t></si><si><r><t>x</t></r><r><t xml:space="preserve"> y</t></r><rPh><t>skip</t></rPh></si><si><t/></si></sst>'), ["a & b", "x y", ""]);
});
await t("parseSheet types", () => {
  const rows = parseSheet('<sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><v>1.5</v></c><c r="D1" s="3"/></row><row r="3"><c r="B3" t="inlineStr"><is><t>hi</t></is></c><c r="AA3" t="b"><v>1</v></c></row></sheetData>', ["head"]);
  assert.equal(rows[0][0], "head"); assert.equal(rows[0][2], 1.5); assert.equal(rows[0][3], null); assert.deepEqual(rows[1], []); assert.equal(rows[2][1], "hi"); assert.equal(rows[2][26], true);
});
await t("zip rejects non-zip", () => { assert.throws(() => zipEntries(new TextEncoder().encode("<html>nope</html>"))); });
const buf = fs.readFileSync(file);
await t("zip central directory", () => { const z = zipEntries(buf); assert.ok(z.has("xl/worksheets/sheet1.xml")); assert.ok(z.has("xl/sharedStrings.xml")); });
await t("first sheet rows", async () => { const rows = await readFirstSheet(buf); assert.equal(rows[0][0], "in EUR"); assert.equal(rows.length, 31); });
const res = await parseWOBFile(buf);
await t("WOB date + countries", () => {
  assert.match(res.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(Object.keys(res.countries).length, 27);
  assert.ok(res.eu27 && res.ea);
});
if (/2026-09-28/.test(file)) await t("WOB values match openpyxl research (2026-09-28)", () => {
  assert.equal(res.date, "2026-09-28");
  const exp = { LV: [2.038, 2.133, 0.944] /* 2132.5 → half-up (research used Python round-half-even: 2.132) */, LT: [1.954, 2.253, 0.816], EE: [1.928, 2.239, 0.986], PL: [1.853, 2.060, 0.746], FI: [2.331, 2.523, null], SE: [1.595, 2.135, null], DE: [2.345, 2.437, 1.117] };
  for (const [cc, [a, b, c]] of Object.entries(exp)) assert.deepEqual([res.countries[cc].e95, res.countries[cc].diesel, res.countries[cc].lpg], [a, b, c], cc);
  assert.deepEqual([res.eu27.e95, res.eu27.diesel, res.eu27.lpg], [2.104, 2.237, 0.871]);
  assert.equal(res.countries.AT.lpg, null); // tukša šūna → null, ne 0
});
await t("WOB rejects changed layout", () => {
  assert.throws(() => parseWOB([["in USD", "Euro-super 95"], [46293, "1000 l"]]), /currency/);
  assert.throws(() => parseWOB([["in EUR", "Euro-super 95", "Automotive gas oil", "LPG"], [46293, "t", "1000 l", "1000 l"]]), /unit/);
});
await t("JSON-stat2 lookup (SSB 09654 shape)", () => {
  const js = { id: ["PetroleumProd", "ContentsCode", "Tid"], size: [2, 1, 1], value: [21.37, 19.62],
    dimension: { PetroleumProd: { category: { index: { "031": 0, "035": 1 } } }, ContentsCode: { category: { index: { Priser: 0 } } }, Tid: { category: { index: { "2026M09": 0 } } } } };
  assert.equal(jsonStatValue(js, { PetroleumProd: "031", ContentsCode: "Priser", Tid: "2026M09" }), 21.37);
  assert.equal(jsonStatValue(js, { PetroleumProd: "035" }), 19.62);
  assert.equal(jsonStatValue(js, { PetroleumProd: "999" }), null);
});
console.log(`${pass} tests passed · LV ${JSON.stringify(res.countries.LV)} · EU27 ${JSON.stringify(res.eu27)} · date ${res.date}`);
