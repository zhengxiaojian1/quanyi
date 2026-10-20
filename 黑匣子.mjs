// 改前必读：/root/全忆-V20/设计.md
// 黑匣子（极简）：每进程 ≤3 笔 —— 开 / 大动作 / 收；只记数，不记正文；文件 ≤400 行轮转
// 判据：上一代最后一笔是「收」才算正常退出；kill -9 时不会有「收」
import fs from "node:fs";
import path from "node:path";

const 上限 = 400;
let 开了 = false;

function 写(根, 笔) {
  const p = path.join(根, "facts", "黑匣子.jsonl");
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, JSON.stringify({ t: new Date().toISOString(), pid: process.pid, ...笔 }) + "\n", "utf8");
    const 行们 = fs.readFileSync(p, "utf8").split("\n").filter(Boolean);
    if (行们.length > 上限) fs.writeFileSync(p, 行们.slice(-Math.floor(上限 / 2)).join("\n") + "\n", "utf8");
  } catch { /* 黑匣子坏了不许拖累主流程 */ }
}

export function 开(根, 做什么) {
  if (开了) return;
  开了 = true;
  写(根, { 笔: "开", 做什么, rssMB: Math.round((process.memoryUsage?.().rss ?? 0) / 1048576) });
}

export function 大事(根, 动作, 数 = {}) {
  写(根, { 笔: "做", 动作, ...数 });
}

export function 收(根) {
  if (!开了) return;
  开了 = false;
  写(根, { 笔: "收", rssMB: Math.round((process.memoryUsage?.().rss ?? 0) / 1048576) });
}

// 这个 pid 还活着吗（判“本代在跑”还是“上一代崩了”）
export function 进程还在(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e?.code === "EPERM"; }
}

// 上一代正常收尾了吗？（null = 没有记录）
export function 上一代收了吗(根) {
  const p = path.join(根, "facts", "黑匣子.jsonl");
  if (!fs.existsSync(p)) return null;
  const 行们 = fs.readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  let 末开 = -1;
  for (let i = 行们.length - 1; i >= 0; i--) if (行们[i].笔 === "开") { 末开 = i; break; }
  if (末开 < 0) return null;
  return 行们.slice(末开 + 1).some((x) => x.笔 === "收");
}

// 上一代的身份（pid + 开始时刻），报错时用
export function 上一代(根) {
  const p = path.join(根, "facts", "黑匣子.jsonl");
  if (!fs.existsSync(p)) return null;
  const 行们 = fs.readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  for (let i = 行们.length - 1; i >= 0; i--) if (行们[i].笔 === "开") return 行们[i];
  return null;
}

if (process.argv[1] && path.basename(process.argv[1]) === "黑匣子.mjs") {
  const 卡带 = process.argv[2];
  if (!卡带) { console.error("用法: node 黑匣子.mjs <卡带>"); process.exit(2); }
  const 收没 = 上一代收了吗(卡带);
  const 末 = 上一代(卡带);
  if (收没 === null) { console.log("没有黑匣子记录"); process.exit(0); }
  if (收没) console.log("✅ 上一代正常收尾 · pid " + 末.pid + " · 开于 " + 末.t + " · " + (末.做什么 ?? ""));
  else if (进程还在(末.pid)) console.log("⏳ 本代在跑（pid " + 末.pid + " 还活着）· 尾笔未收是正常的 · 开于 " + 末.t + " · " + (末.做什么 ?? ""));
  else { console.log("❌ 上一代没收尾（pid 已不在，可能是 kill -9 / V8 abort）· pid " + 末.pid + " · 开于 " + 末.t + " · " + (末.做什么 ?? "")); process.exit(1); }
}
