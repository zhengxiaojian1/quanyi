// 查会话日志：逐帧流式，报每种事件几条、哪些消息缺 source.kind
// 用法：node 查会话日志.mjs <session.v4.jsonl.zstd>
import fs from "node:fs";
import { zstdDecompressSync } from "node:zlib";

const 路 = process.argv[2];
if (!路) { console.error("用法: node 查会话日志.mjs <session.v4.jsonl.zstd>"); process.exit(2); }
const 魔 = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
const fd = fs.openSync(路, "r");
const 大小 = fs.fstatSync(fd).size;
const 块 = 4 * 1024 * 1024;
const 冲 = Buffer.alloc(块 + 3);
const 位 = [];
let 读 = 0;
while (读 < 大小) {
  const n = fs.readSync(fd, 冲, 0, Math.min(块 + 3, 大小 - 读), 读);
  if (n <= 0) break;
  for (let i = 0; i + 3 < n; i++) {
    if (冲[i] === 0x28 && 冲[i + 1] === 0xb5 && 冲[i + 2] === 0x2f && 冲[i + 3] === 0xfd) {
      const abs = 读 + i;
      if (位[位.length - 1] !== abs) 位.push(abs);
    }
  }
  if (n < 块 + 3) break;
  读 += n - 3;
}
const 型 = {};
let 坏 = 0, 缺 = 0;
const 缺样 = [];
for (let k = 0; k < 位.length; k++) {
  const 起 = 位[k], 止 = (位[k + 1] ?? 大小) - 起;
  const b = Buffer.alloc(止);
  fs.readSync(fd, b, 0, 止, 起);
  let 文 = "";
  try { 文 = zstdDecompressSync(b).toString("utf8"); } catch { 坏++; continue; }
  for (const l of 文.split("\n")) {
    if (!l) continue;
    let o;
    try { o = JSON.parse(l); } catch { 坏++; continue; }
    型[o.type] = (型[o.type] ?? 0) + 1;
    const 候选 = o.type === "user/message" ? [o.data] : (o.data?.message ? [o.data.message] : []);
    for (const m of 候选) {
      const s = m?.source;
      if (!s || typeof s.kind !== "string") {
        缺++;
        if (缺样.length < 10) 缺样.push(o.type + " seq=" + o.seq + " data键=" + Object.keys(o.data ?? {}).join(",") + " source=" + JSON.stringify(s));
      }
    }
  }
}
fs.closeSync(fd);
console.log("帧 " + 位.length + " · 坏行/坏帧 " + 坏 + " · 缺 source " + 缺);
console.log("事件类型：" + JSON.stringify(型));
for (const x of 缺样) console.log("  缺 · " + x);
