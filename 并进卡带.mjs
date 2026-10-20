// 改前必读：/root/全忆-V20/设计.md
// 把一段会话并进已有卡带：时间序重建，老 seq 不变（因为卡带本来就按时序存的）
// 用法：
//   node 并进卡带.mjs <卡带> <会话id|文件> [--源 jsonl] [--干跑]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { 拍 } from "./快照.mjs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { 读任意 } from "./读取器.mjs";
import { 找日志 } from "./从宿主导入.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const [卡带, 来源, ...余] = process.argv.slice(2);
if (!卡带 || !来源) { console.error("用法: node 并进卡带.mjs <卡带> <会话id|文件> [--干跑]"); process.exit(2); }
const 干跑 = 余.includes("--干跑");

function 读卡带帧(根) {
  const out = [];
  const 走 = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) 走(p);
      else if (e.isFile() && p.endsWith(".jsonl")) {
        for (const l of fs.readFileSync(p, "utf8").split("\n")) if (l) { try { out.push(JSON.parse(l)); } catch { /* 坏行跳过 */ } }
      }
    }
  };
  const raw = path.join(根, "raw");
  if (fs.existsSync(raw)) 走(raw);
  return out;
}

const 旧 = 读卡带帧(卡带);
const 路 = 找日志(来源);
if (!路) { console.error("没找到会话：" + 来源); process.exit(2); }
const 新 = 读任意(路).帧;
console.log("卡带 " + 旧.length + " 帧 · 来源 " + 新.length + " 帧（" + 读任意(路).格式 + "）");

const 键 = (f) => f.t + "|" + f.who + "|" + String(f.text).slice(0, 80);
const 有 = new Set(旧.map(键));
const 加 = 新.filter((f) => !有.has(键(f)));
console.log("去重后新增 " + 加.length + " 帧");
if (!加.length) { console.log("没有新东西，不动"); process.exit(0); }
if (干跑) { console.log("（干跑，未写入）"); process.exit(0); }

const 全 = [...旧.map((f) => ({ t: f.t, who: f.who, kind: f.kind ?? "text", text: f.text })), ...加.map((f) => ({ t: f.t, who: f.who, kind: f.kind ?? "text", text: f.text }))]
  .sort((a, b) => new Date(a.t) - new Date(b.t));

const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "并入-"));
const 源 = path.join(临时, "并.jsonl");
fs.writeFileSync(源, 全.map((f, i) => JSON.stringify({ seq: i + 1, ...f })).join("\n") + "\n");
const 新卡 = path.join(临时, "卡");
try { if (fs.existsSync(path.join(卡带, "manifest.json"))) 拍(卡带); } catch { /* 忽略 */ }
execFileSync(process.execPath, [path.join(此处, "造卡.mjs"), 源, 新卡], { stdio: "pipe" });

// 只换 raw / index / manifest，日记和账保留
for (const 件 of ["raw", "index", "manifest.json"]) {
  const 目标 = path.join(卡带, 件);
  fs.rmSync(目标, { recursive: true, force: true });
  fs.cpSync(path.join(新卡, 件), 目标, { recursive: true });
}
fs.rmSync(临时, { recursive: true, force: true });
console.log("并入完成：卡带现在 " + 全.length + " 帧");
console.log("建议再跑一次：node 呼吸.mjs \"" + 卡带 + "\"");
