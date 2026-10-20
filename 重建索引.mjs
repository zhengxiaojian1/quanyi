// 改前必读：/root/全忆-V20/设计.md
// 从 raw 重建 index/（片内偏移 + 布隆）。raw 是真相，索引只是派生。
// 用法：node 重建索引.mjs <卡带>
import fs from "node:fs";
import path from "node:path";
import { createDecipheriv, scryptSync } from "node:crypto";
import { 双字组 } from "./读我.mjs";
import { 加密 } from "./锁.mjs";

const 卡带 = process.argv[2];
if (!卡带) { console.error("用法: node 重建索引.mjs <卡带>"); process.exit(2); }
const 根 = path.resolve(卡带);
const manifest = JSON.parse(fs.readFileSync(path.join(根, "manifest.json"), "utf8"));

let 钥匙 = null;
if (manifest.加密) {
  const 口令 = process.env.QUANYI_KEY;
  if (!口令) { console.error("卡带上锁了：设置 QUANYI_KEY"); process.exit(2); }
  钥匙 = scryptSync(口令, Buffer.from(manifest.加密.盐, "base64"), 32);
}
function 读(路) {
  const b = fs.readFileSync(路);
  if (!钥匙) return b;
  const iv = b.subarray(0, 12), tag = b.subarray(12, 28), ct = b.subarray(28);
  const d = createDecipheriv("aes-256-gcm", 钥匙, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

const 花位 = 32768, 花字节 = 4096;
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

fs.mkdirSync(path.join(根, "index", "片内"), { recursive: true });
const 花总 = [];
let 数 = 0;
for (const p of manifest.片) {
  const 冲 = 读(path.join(根, p.文件));
  const 文本 = 冲.toString("utf8");
  const 行 = 文本.split("\n");
  const seqs = [], offsets = [];
  let 字节 = 0;
  const 花 = Buffer.alloc(花字节);
  for (const l of 行) {
    if (!l) continue;
    const o = JSON.parse(l);
    seqs.push(o.seq);
    offsets.push(字节);
    字节 += Buffer.byteLength(l + "\n", "utf8");
    灌花(花, o.text);
  }
  fs.writeFileSync(path.join(根, "index", "片内", p.天 + "-" + p.时 + ".json"),
    JSON.stringify({ seqs, offsets, 字节 }));
  花总.push(花);
  p.from = seqs[0];
  p.to = seqs[seqs.length - 1];
  数++;
}

let 花体 = Buffer.concat(花总);
if (钥匙) 花体 = 加密(花体, 钥匙);
fs.writeFileSync(path.join(根, "index", "花.bin"), 花体);
manifest.重建于 = new Date().toISOString();
fs.writeFileSync(path.join(根, "manifest.json"), JSON.stringify(manifest, null, 2));
try { const { 建倒排 } = await import("./倒排.mjs"); 建倒排(卡带); } catch {}
console.log("重建完成：" + 数 + " 片");
