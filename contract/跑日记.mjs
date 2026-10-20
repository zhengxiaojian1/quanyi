// 改前必读：/root/全忆-V20/设计.md
// 日记与呼吸的自测：先红后绿的那种牙
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mount } from "../读我.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "日记-"));
const 卡带 = path.join(临时, "卡带");
fs.cpSync(path.join(根, "卡带样例", "桌宠"), 卡带, { recursive: true });
fs.rmSync(path.join(卡带, "diary"), { recursive: true, force: true });
fs.mkdirSync(path.join(卡带, "diary"), { recursive: true });
for (const f of fs.readdirSync(path.join(卡带, "facts"))) fs.rmSync(path.join(卡带, "facts", f));
execFileSync(process.execPath, [path.join(根, "呼吸.mjs"), 卡带], { stdio: "pipe" });

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };
const 句柄 = mount(卡带);

const 日记 = fs.readdirSync(path.join(卡带, "diary")).filter((f) => f.endsWith(".md"));
记("每天一篇日记", 日记.length === 句柄.manifest.天.length, 日记.length + " 篇");

let 指针齐 = true, 坏 = 0;
for (const f of 日记) {
  const 文 = fs.readFileSync(path.join(卡带, "diary", f), "utf8");
  const m = 文.match(/↩\s*([\d,\s]+)/);
  if (!m) { 指针齐 = false; continue; }
  for (const n of m[1].split(/[,\s]+/).filter(Boolean).map(Number)) {
    const fr = 句柄.frame(n);
    if (!fr.ok || !fr.校验) 坏++;
  }
}
记("每篇日记都有指针，且指到的帧可校验", 指针齐 && 坏 === 0, "坏指针 " + 坏);

const b = 句柄.brief({ 问: "2D 的极限" });
记("brief 里有「最近的日子」", b.text.includes("【最近的日子】"), "");
记("brief 不超预算", b.token估 <= 600, "估 " + b.token估 + " token");
记("brief 里有未清的账", b.text.includes("【未清的账】") && b.text.includes("电脑"), "");

const 承诺 = fs.readFileSync(path.join(卡带, "facts", "承诺.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
记("承诺带条件「电脑」", 承诺.some((x) => (x.触发?.条件 ?? []).some((k) => String(k).includes("电脑")) && x.态 === "未兑现"), "共 " + 承诺.length + " 条");

const top = 句柄.recall("2D 的极限", 1)[0];
记("检索首条是那句原话（seq 73）", top?.seq === 73, "top=" + top?.seq);

const top2 = 句柄.recall("桌宠卡住的地方", 5);
记("改述查询被日记桥接住（首条是 73）", top2[0]?.seq === 73, "命中 seq: " + top2.map((x) => x.seq).join(","));

句柄.close();
fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
