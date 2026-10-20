// 改前必读：/root/全忆-V20/设计.md
// 合卡：把几张卡带的原文并成一张（按时间重排、去重、重编号），身份文件保留目标那张的
// 用法：node 合卡.mjs <目标卡带> <源卡带> [更多源…]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { 拍 } from "./快照.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const [目标, ...源们] = process.argv.slice(2);
if (!目标 || !源们.length) { console.error("用法: node 合卡.mjs <目标卡带> <源卡带> [更多源…]"); process.exit(2); }

const 卡们 = [目标, ...源们].filter((c) => fs.existsSync(path.join(c, "manifest.json")));
if (卡们.length < 2) { console.error("至少要两张能打开的卡带"); process.exit(2); }

// 收原文：所有 raw 行，按 (t, who, text) 去重
const 见 = new Set();
const 行们 = [];
const 走 = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) 走(p);
    else if (e.name.endsWith(".jsonl")) for (const l of fs.readFileSync(p, "utf8").split("\n").filter(Boolean)) {
      let o; try { o = JSON.parse(l); } catch { continue; }
      if (!o.text || !o.t || !o.who) continue;
      const k = o.t + "|" + o.who + "|" + String(o.text).trim();
      if (见.has(k)) continue;
      见.add(k);
      行们.push({ t: o.t, who: o.who, kind: "text", text: o.text });
    }
  }
};
for (const c of 卡们) 走(path.join(c, "raw"));
行们.sort((a, b) => new Date(a.t) - new Date(b.t));

const 临 = fs.mkdtempSync(path.join(os.tmpdir(), "合卡-"));
const 源 = path.join(临, "源.jsonl");
fs.writeFileSync(源, 行们.map((x) => JSON.stringify(x)).join("\n") + "\n");
const 新卡 = path.join(临, "新卡");
execFileSync(process.execPath, [path.join(此处, "造卡.mjs"), 源, 新卡], { stdio: "pipe" });

// 先拍目标，再把 raw/index/manifest 换掉（身份文件、日记、账保留）
try { 拍(目标); } catch { /* 忽略 */ }
for (const e of ["raw", "index", "manifest.json"]) fs.rmSync(path.join(目标, e), { recursive: true, force: true });
for (const e of ["raw", "index", "manifest.json"]) fs.cpSync(path.join(新卡, e), path.join(目标, e), { recursive: true });
fs.rmSync(临, { recursive: true, force: true });

const m = JSON.parse(fs.readFileSync(path.join(目标, "manifest.json"), "utf8"));
console.log("合完：" + 目标 + " → " + m.帧数 + " 帧（来自 " + 卡们.length + " 张卡）");
