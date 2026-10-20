// 改前必读：/root/全忆-V20/设计.md
// 自长：把宿主会话日志里「人和她说过的话」补成帧（可补历史，也可只补本轮）
// 用法：node 自长.mjs <卡带> [--会话 <id>] [--上限 200]
import fs from "node:fs";
import path from "node:path";
import { mount } from "./读我.mjs";
import { 找日志, 读会话 } from "./从宿主导入.mjs";

const [卡带, ...余] = process.argv.slice(2);
const 取 = (k, d) => { const i = 余.indexOf(k); return i >= 0 ? 余[i + 1] : d; };
if (!卡带) { console.error("用法: node 自长.mjs <卡带> [--会话 <id>] [--上限 200]"); process.exit(2); }

const 上限 = Number(取("--上限", 200));
const 锁 = path.join(卡带, "facts", ".自长锁");
fs.mkdirSync(path.join(卡带, "facts"), { recursive: true });

// 文件锁：上一个还活着就让路
try {
  if (fs.existsSync(锁)) {
    const 旧 = JSON.parse(fs.readFileSync(锁, "utf8"));
    if (旧?.pid && 旧.pid !== process.pid) { try { process.kill(旧.pid, 0); process.exit(0); } catch { /* 死了，接管 */ } }
  }
  fs.writeFileSync(锁, JSON.stringify({ pid: process.pid, t: new Date().toISOString() }) + "\n", "utf8");
} catch { /* 锁失败就单干 */ }

function 收工(码 = 0) { try { fs.rmSync(锁, { force: true }); } catch { /* 忽略 */ } process.exit(码); }

let 句柄;
try { 句柄 = mount(卡带); } catch (e) { console.error("卡带打不开：" + e.message); 收工(2); }
if (句柄.manifest.加密) 收工(0);   // 上锁的卡带只读

// 要补哪些会话：参数优先，其次 对话账 里出现过的
const 会话们 = new Set();
const 参数 = 取("--会话");
if (参数) 会话们.add(参数);
try {
  const p = path.join(卡带, "对话.jsonl");
  if (fs.existsSync(p)) for (const l of fs.readFileSync(p, "utf8").split("\n").filter(Boolean)) {
    try { const o = JSON.parse(l); if (o.会话) 会话们.add(o.会话); } catch { /* 跳过 */ }
  }
} catch { /* 忽略 */ }
const 末 = new Date(句柄.manifest.末 ?? 0).getTime();

// 取材：宿主日志里的人和她的原话（不要脚手架/系统注入）
function 可收(x) {
  const t = String(x.text ?? "").trim();
  if (!t) return false;
  if (/^[[<]/.test(t)) return false;
  if (/<compacted-summary>|system-reminder|skill-catalog|runtime-context/.test(t)) return false;
  return x.who === "user" || x.who === "her";
}

let 收 = [];
for (const 号 of [...会话们].slice(0, 3)) {
  const 路 = fs.existsSync(号) ? 号 : 找日志(号);
  if (!路) continue;
  let 帧们 = [];
  try { 帧们 = 读会话(路).帧; } catch { continue; }
  for (const x of 帧们) {
    if (!可收(x)) continue;
    if (new Date(x.t).getTime() <= 末) continue;
    收.push({ t: x.t, who: x.who, text: String(x.text).trim() });
    if (收.length >= 上限) break;
  }
  if (收.length >= 上限) break;
}

let 加 = [];
if (收.length) { try { 加 = 句柄.追加帧(收); } catch (e) { console.error("长帧失败：" + e.message); 收工(1); } }
console.log(JSON.stringify({ 会话: [...会话们].slice(0, 3).length, 收: 收.length, 加: 加.length, 帧数: 句柄.manifest.帧数 }));
收工(0);
