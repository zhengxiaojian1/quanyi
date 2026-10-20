// 改前必读：/root/全忆-V20/设计.md
// v19 记忆库 → V20 卡带：只搬「她真说过的话」，不搬脚手架
// 用法：node 迁移-v19.mjs <v19根目录> <新卡带> [--干跑]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const [源, 目标, ...余] = process.argv.slice(2);
if (!源 || !目标) { console.error("用法: node 迁移-v19.mjs <v19根目录> <新卡带> [--干跑]"); process.exit(2); }
const 干跑 = 余.includes("--干跑");
const 事件路 = path.join(源, "library", "events.jsonl");
if (!fs.existsSync(事件路)) { console.error("没有 library/events.jsonl：" + 事件路); process.exit(2); }

const 计 = { 总: 0, 迁: 0, 跳脚手架: 0, 跳空: 0, 跳重复: 0 };
const 帧 = [];
const 见过 = new Set();

const 是脚手架 = (t) => {
  const x = t.trim();
  return /^##\s|^\{"|^```|^<[a-z]/i.test(x)
    || /^\[runtime-context\]/i.test(x)
    || /Current runtime context/i.test(x)
    || /\[compact-checkpoint/i.test(x)
    || /^<compacted-summary>/i.test(x)
    || /automatically generated checkpoint/i.test(x);
};
const 角色 = (种) => {
  if (种 === "user/message") return { who: "user", kind: "text" };
  if (种 === "assistant/message") return { who: "her", kind: "text" };
  if (种 === "tool/call" || 种 === "tool/result") return { who: "her", kind: "tool" };
  return null;
};

const rl = readline.createInterface({ input: fs.createReadStream(事件路), crlfDelay: Infinity });
for await (const 行 of rl) {
  if (!行.trim()) continue;
  计.总++;
  let o;
  try { o = JSON.parse(行); } catch { continue; }
  const 角 = 角色(o.帧种);
  if (!角) continue;
  const 文 = String(o.正文 ?? "").trim();
  if (!文 || 文.length < 2) { 计.跳空++; continue; }
  if (是脚手架(文)) { 计.跳脚手架++; continue; }
  const t = new Date(Number(o.at ?? 0)).toISOString();
  const 键 = t + "|" + 角.who + "|" + 文.slice(0, 60);
  if (见过.has(键)) { 计.跳重复++; continue; }
  见过.add(键);
  帧.push({ t, who: 角.who, kind: 角.kind, text: 文 });
  计.迁++;
}
帧.sort((a, b) => new Date(a.t) - new Date(b.t));

console.log("v19 事件 " + 计.总 + " 条 → 迁 " + 计.迁 + " 帧");
console.log("跳过：脚手架 " + 计.跳脚手架 + " · 空 " + 计.跳空 + " · 重复 " + 计.跳重复);
const 出帧 = 余.includes("--出帧") ? 余[余.indexOf("--出帧") + 1] : null;
if (出帧) fs.writeFileSync(出帧, 帧.map((f, i) => JSON.stringify({ seq: i + 1, ...f })).join("\n") + "\n", "utf8");
if (出帧) console.log("帧写到：" + 出帧 + "（可喂给 并进卡带.mjs）");
if (出帧) { console.log("只出帧，不建卡"); process.exit(0); }
if (干跑) { console.log("（干跑，未建卡）"); process.exit(0); }
if (!帧.length) { console.error("没有可迁的帧"); process.exit(1); }

const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "迁v19-"));
const 源路 = path.join(临时, "帧.jsonl");
fs.writeFileSync(源路, 帧.map((f, i) => JSON.stringify({ seq: i + 1, ...f })).join("\n") + "\n");
execFileSync(process.execPath, [path.join(此处, "造卡.mjs"), 源路, 目标], { stdio: "inherit" });
fs.rmSync(临时, { recursive: true, force: true });
console.log("卡带建好：" + 目标);
console.log("再跑一次：node 呼吸.mjs \"" + 目标 + "\"");
