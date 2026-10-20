// 改前必读：/root/全忆-V20/设计.md
// JSONL → 卡带 v0.2：流式读入，按小时分片（单片 ≤ 8 MB），布隆 + 偏移索引 + 哈希链
// 用法：node 造卡.mjs <源.jsonl> <卡带目录> [--self 文件]

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs";
import { 拍 } from "./快照.mjs";
import { 开, 大事, 收 } from "./黑匣子.mjs";
import path from "node:path";
import { createInterface } from "node:readline";

const [源, 目标] = process.argv.slice(2);
if (!源 || !目标) { console.error("用法: node 造卡.mjs <源.jsonl> <卡带目录> [--self 文件]"); process.exit(2); }

const 规范 = (o) => JSON.stringify(o);
const sha256 = (s) => "sha256:" + createHash("sha256").update(s, "utf8").digest("hex");
const 片上限字节 = 8 * 1048576;

const 花位 = 32768, 花字节 = 花位 / 8;   // 每片 4 KB，全部拼成一个文件
function 置花(花, g) {
  for (const 种 of [0, 0x9e3779b9, 0x85ebca6b]) {
    let h = 2166136261 ^ 种;
    for (let i = 0; i < g.length; i++) { h ^= g.charCodeAt(i); h = Math.imul(h, 16777619); }
    const b = (h >>> 0) % 花位;
    花[b >> 3] |= 1 << (b & 7);
  }
}
function 灌花(花, 文) {
  const 净 = String(文 ?? "").replace(/[^\p{Script=Han}A-Za-z0-9]/gu, "");
  for (let i = 0; i < 净.length - 1; i++) 置花(花, 净.slice(i, i + 2));
}

fs.mkdirSync(path.join(目标, "raw"), { recursive: true });
fs.mkdirSync(path.join(目标, "index", "片内"), { recursive: true });
fs.mkdirSync(path.join(目标, "index"), { recursive: true });
fs.mkdirSync(path.join(目标, "diary"), { recursive: true });
fs.mkdirSync(path.join(目标, "facts"), { recursive: true });

if (fs.existsSync(path.join(目标, "manifest.json"))) { try { 拍(目标); } catch { /* 拍不上就算了 */ } }

// 目标已存在时，保住身份文件（重建不许把 self.md / 称呼 弄丢）
const 旧身份 = {};
for (const 名 of ["self.md", "称呼.json"]) {
  const p = path.join(目标, 名);
  if (fs.existsSync(p)) 旧身份[名] = fs.readFileSync(p);
}

const 片 = [];
const 花总 = [];
let 当前 = null, prev = "", 帧数 = 0, 首 = null, 末 = null, 末Seq = 0;

function 落片() {
  if (!当前) return;
  fs.writeFileSync(当前.路径, 当前.体, "utf8");
  花总.push(当前.花);
  fs.writeFileSync(path.join(目标, "index", "片内", 当前.天 + "-" + 当前.时 + ".json"),
    JSON.stringify({ seqs: 当前.seqs, offsets: 当前.offsets, 字节: 当前.字节 }));
  片.push({ 文件: 当前.文件, 天: 当前.天, 时: 当前.时, from: 当前.seqs[0], to: 当前.seqs[当前.seqs.length - 1] });
  当前 = null;
}

const rl = createInterface({ input: createReadStream(源), crlfDelay: Infinity });
for await (const 行 of rl) {
  if (!行.trim()) continue;
  const o = JSON.parse(行);
  const 序 = Number.isFinite(o.seq) ? o.seq : 帧数 + 1;
  const 基 = { seq: 序, t: o.t, who: o.who, kind: o.kind };
  if (o.tool) 基.tool = o.tool;
  基.text = o.text ?? "";
  const sha = sha256(规范(基));
  const 记录 = { ...基, sha, prev };

  const 天 = 基.t.slice(0, 10), 时 = 基.t.slice(11, 13);
  if (!当前 || 当前.天 !== 天 || 当前.时 !== 时 || 当前.字节 > 片上限字节) 落片();
  if (!当前) {
    const [年, 月] = 天.split("-");
    const 目录 = path.join(目标, "raw", 年 + "-" + 月, 天.slice(8));
    fs.mkdirSync(目录, { recursive: true });
    当前 = { 天, 时, 文件: path.join("raw", 年 + "-" + 月, 天.slice(8), 时 + ".jsonl"), 路径: path.join(目录, 时 + ".jsonl"), 体: "", seqs: [], offsets: [], 字节: 0, 花: Buffer.alloc(花字节) };
  }
  灌花(当前.花, 基.text);
  当前.offsets.push(当前.字节);
  当前.seqs.push(基.seq);
  const 行文 = 规范(记录) + "\n";
  当前.体 += 行文;
  当前.字节 += Buffer.byteLength(行文, "utf8");

  prev = sha; 帧数++; 末Seq = 基.seq;
  if (首 === null) 首 = 基.t;
  末 = 基.t;
}
落片();

// 保险：片区间从片内索引补齐（否则 frame() 找不到这一片）
for (const p of 片) {
  if (p.from !== void 0 && p.to !== void 0) continue;
  try {
    const 内 = JSON.parse(fs.readFileSync(path.join(目标, "index", "片内", p.天 + "-" + p.时 + ".json"), "utf8"));
    if (内.seqs?.length) { p.from = 内.seqs[0]; p.to = 内.seqs[内.seqs.length - 1]; }
  } catch { /* 补不上就算了 */ }
}

const manifest = {
  格式: "全忆卡带", 版本: "0.2",
  帧数, 首, 末,
  天: [...new Set(片.map((p) => p.天))].sort(),
  片, nextSeq: 末Seq + 1,
  生成: new Date().toISOString(),
};
fs.writeFileSync(path.join(目标, "index", "花.bin"), Buffer.concat(花总));
fs.writeFileSync(path.join(目标, "manifest.json"), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(目标, "journal.jsonl"), "");
for (const [名, 料] of Object.entries(旧身份)) fs.writeFileSync(path.join(目标, 名), 料);

const 称参 = process.argv.indexOf("--称呼");
if (称参 > 0) {
  fs.writeFileSync(path.join(目标, "称呼.json"), JSON.stringify({ 对方: process.argv[称参 + 1], 代词: "他" }, null, 2));
}
const 参 = process.argv.indexOf("--self");
if (参 > 0) fs.copyFileSync(process.argv[参 + 1], path.join(目标, "self.md"));
else if (!fs.existsSync(path.join(目标, "self.md"))) fs.writeFileSync(path.join(目标, "self.md"), "# 她\n\n（样例卡带，self 未设置）\n");

const 峰 = process.resourceUsage().maxRSS;
try { const { 建倒排 } = await import("./倒排.mjs"); 建倒排(目标); } catch { /* 倒排失败不影响卡带 */ }
开(目标, "装卡");
大事(目标, "装卡", { 帧数 });
收(目标);
console.log("装卡完成：" + 目标);
console.log("帧 " + 帧数 + " · 天 " + manifest.天.length + " · 片 " + 片.length);
console.log("首 " + 首 + " → 末 " + 末);
console.log("峰值 RSS " + (峰 / 1024).toFixed(1) + " MB");
