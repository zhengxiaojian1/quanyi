// 改前必读：/root/全忆-V20/设计.md
// 一步扩展到底帮不帮忙：同一批问题，开/关各跑一遍，只看名次
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mount } from "../读我.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "扩展-"));
const 卡带 = path.join(临时, "卡");
fs.cpSync(path.join(根, "卡带样例", "桌宠"), 卡带, { recursive: true });
for (const f of fs.readdirSync(path.join(卡带, "facts"))) fs.rmSync(path.join(卡带, "facts", f));
execFileSync(process.execPath, [path.join(根, "呼吸.mjs"), 卡带], { stdio: "pipe" });

const 题 = [
  ["我们做的是什么", 1],
  ["卡在哪", 73],
  ["约定了什么", 82],
  ["她劝过我什么", 45],
  ["为什么卡住", 72],
  ["最后是谁先说到顶", 70],
  ["参数改成多少", 21],
  ["构建报错了", 26],
  ["我什么时候回来的", 53],
  ["什么时候说好再战", 82],
];

const 关 = mount(卡带, { 扩展: false });
const 开 = mount(卡带, { 扩展: true });

let 关中 = 0, 开中 = 0, 关和 = 0, 开和 = 0;
console.log("问题".padEnd(22) + "关(名次)  开(名次)");
for (const [q, 目] of 题) {
  const 名次 = (h) => { const r = h.recall(q, 10); const i = r.findIndex((x) => x.seq === 目); return i < 0 ? "-" : String(i + 1); };
  const a = 名次(关), b = 名次(开);
  if (a !== "-") { 关中++; 关和 += Number(a); }
  if (b !== "-") { 开中++; 开和 += Number(b); }
  console.log(q.padEnd(22) + String(a).padEnd(9) + b);
}

console.log("\n前 10 名里命中：" + "关 " + 关中 + "/" + 题.length + " · 开 " + 开中 + "/" + 题.length);
console.log("平均名次（只算命中的）：关 " + (关中 ? (关和 / 关中).toFixed(1) : "-") + " · 开 " + (开中 ? (开和 / 开中).toFixed(1) : "-"));
关.close(); 开.close();
fs.rmSync(临时, { recursive: true, force: true });
