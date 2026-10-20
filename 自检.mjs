// 改前必读：/root/全忆-V20/设计.md
// 自检：挂卡带之前先看它坏没坏 —— 坏了当场报，别等它把会话写坏
// 用法：node 自检.mjs <卡带> [--全量]
import fs from "node:fs";
import path from "node:path";
import { mount } from "./读我.mjs";

const [目录, ...余] = process.argv.slice(2);
if (!目录) { console.error("用法: node 自检.mjs <卡带> [--全量]"); process.exit(2); }
const 全量 = 余.includes("--全量");

const 果 = [];
const 记 = (名, 好, 注 = "") => 果.push({ 名, 好, 注 });

function 数行(路) {
  let n = 0;
  const fd = fs.openSync(路, "r");
  const b = Buffer.alloc(1 << 20);
  let 读, 余文 = "";
  while ((读 = fs.readSync(fd, b, 0, b.length, null)) > 0) {
    const s = 余文 + b.subarray(0, 读).toString("utf8");
    const 行 = s.split("\n");
    余文 = 行.pop();
    n += 行.length;
  }
  if (余文) n++;
  fs.closeSync(fd);
  return n;
}

const 清单 = path.join(目录, "manifest.json");
if (!fs.existsSync(清单)) { 记("manifest.json 在", false); 输出(); }
let m;
try { m = JSON.parse(fs.readFileSync(清单, "utf8")); 记("manifest.json 能解析", true); }
catch (e) { 记("manifest.json 能解析", false, e.message); 输出(); }

记("格式是全忆卡带", m.格式 === "全忆卡带", String(m.格式));

// raw 行数
const 片们 = m.片 ?? [];
let 总行 = 0;
for (const 片 of 片们) {
  const 路 = path.join(目录, 片.文件);
  if (!fs.existsSync(路)) { 记("分片在：" + 片.文件, false); continue; }
  总行 += 数行(路);
}
记("帧数与 raw 行数对得上", 总行 === (m.帧数 ?? 0), "raw " + 总行 + " · manifest " + (m.帧数 ?? 0));

// sha 链抽样 + 全文校验
const h = mount(目录);
const 要 = 全量 ? (m.帧数 ?? 0) : Math.min(200, m.帧数 ?? 0);
let 校坏 = 0, 检了 = 0;
const 步 = Math.max(1, Math.floor((m.帧数 ?? 1) / 要));
for (let seq = 1; seq <= (m.帧数 ?? 0); seq += 步) {
  const f = h.frame(seq);
  检了++;
  if (!f.ok || f.校验 !== true) 校坏++;
}
记("原文可逐字校验（抽样 " + 检了 + " 帧）", 校坏 === 0, 校坏 ? 校坏 + " 帧不对" : "");

// 索引
try { const b = h.brief({}); 记("brief 能出", b.text.length > 0, "估算 " + b.token估 + " token"); }
catch (e) { 记("brief 能出", false, e.message); }

// 日记
let 日记数 = 0, 日记坏 = 0;
const 日目录 = path.join(目录, "diary");
if (fs.existsSync(日目录)) for (const f of fs.readdirSync(日目录)) {
  if (!f.endsWith(".md")) continue;
  const 文 = fs.readFileSync(path.join(日目录, f), "utf8");
  日记数++;
  if (!/^#\s/m.test(文)) 日记坏++;
}
记("日记可解析", 日记坏 === 0, 日记数 + " 篇" + (日记坏 ? " · 坏 " + 日记坏 : ""));

// 事实账
let 账坏 = 0, 账行 = 0;
const 账目录 = path.join(目录, "facts");
if (fs.existsSync(账目录)) for (const f of fs.readdirSync(账目录)) {
  if (!f.endsWith(".jsonl")) continue;
  for (const l of fs.readFileSync(path.join(账目录, f), "utf8").split("\n").filter(Boolean)) {
    账行++;
    try { JSON.parse(l); } catch { 账坏++; }
  }
}
记("事实账每行都能解析", 账坏 === 0, 账行 + " 行" + (账坏 ? " · 坏 " + 账坏 : ""));

h.close();
输出();

function 输出() {
  let 坏 = 0;
  for (const x of 果) { if (!x.好) 坏++; console.log((x.好 ? "✓ " : "✗ ") + x.名 + (x.注 ? "  " + x.注 : "")); }
  console.log("\n" + (坏 ? "❌ " + 坏 + " 项有问题" : "✅ 全部通过") + "（" + 果.length + " 项）");
  process.exit(坏 ? 1 : 0);
}
