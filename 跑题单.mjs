// 改前必读：/root/全忆-V20/设计.md
// 题单：每题 {问, 目标seq}，量 top1 / top3 / 覆盖，题单冻结（sha256）
// 用法：node 跑题单.mjs <卡带> <题单.jsonl>
import { createHash } from "node:crypto";
import fs from "node:fs";
import { mount } from "./读我.mjs";

const [卡带, 题单路] = process.argv.slice(2);
if (!卡带 || !题单路) { console.error("用法: node 跑题单.mjs <卡带> <题单.jsonl>"); process.exit(2); }
const 原文 = fs.readFileSync(题单路);
const 题 = 原文.toString("utf8").split("\n").filter(Boolean).map((l, i) => {
  try { return JSON.parse(l); } catch { console.error("第 " + (i + 1) + " 行不是 JSON"); process.exit(2); }
});
console.log("题单 " + 题.length + " 题 · sha256 " + createHash("sha256").update(原文).digest("hex").slice(0, 16));

const h = mount(卡带);
let top1 = 0, top3 = 0, 命中 = 0;
const 行们 = [];
for (const { 问, 目标seq } of 题) {
  const r = h.recall(问, 10);
  const i = r.findIndex((x) => x.seq === Number(目标seq));
  const 名次 = i < 0 ? "-" : String(i + 1);
  if (i === 0) top1++;
  if (i >= 0 && i < 3) top3++;
  if (i >= 0) 命中++;
  行们.push([String(问).slice(0, 26), String(目标seq), 名次]);
}
h.close();

const 宽 = Math.max(...行们.map((x) => [...x[0]].length), 4);
console.log("问".padEnd(宽 + 2) + "目标  名次");
for (const [问, 目标, 名次] of 行们) console.log(问.padEnd(宽 + 2) + 目标.padEnd(6) + 名次);
console.log("\ntop1 " + top1 + "/" + 题.length + "（" + Math.round((top1 / 题.length) * 100) + "%）"
  + " · top3 " + top3 + "/" + 题.length + "（" + Math.round((top3 / 题.length) * 100) + "%）"
  + " · 前 10 名覆盖 " + 命中 + "/" + 题.length);
