// 改前必读：/root/全忆-V20/设计.md
// 倒排：双字组 → 分片号，检索时先定位分片，不再整卡扫
// 用法：node 倒排.mjs <卡带>        （建到 index/倒排.json）
import fs from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import path from "node:path";

export const 桶数 = 64;
export function 桶号(词) {
  let h = 2166136261;
  for (let i = 0; i < 词.length; i++) { h ^= 词.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 桶数;
}

// 词 → seq 的分桶倒排：查询时只读用到的那几个桶
export function 建倒排序(根) {
  const manifest = JSON.parse(fs.readFileSync(path.join(根, "manifest.json"), "utf8"));
  const 桶 = Array.from({ length: 桶数 }, () => new Map());
  for (const p of manifest.片 ?? []) {
    const 全 = path.join(根, p.文件);
    if (!fs.existsSync(全)) continue;
    for (const l of fs.readFileSync(全, "utf8").split("\n")) {
      if (!l) continue;
      let r;
      try { r = JSON.parse(l); } catch { continue; }
      const seq = r.seq;
      for (const g of new Set(双字组(String(r.text ?? "")))) {
        const m = 桶[桶号(g)];
        let 列 = m.get(g);
        if (!列) { 列 = []; m.set(g, 列); }
        if (列[列.length - 1] !== seq) 列.push(seq);
      }
    }
  }
  const 目录 = path.join(根, "index", "倒排");
  fs.rmSync(目录, { recursive: true, force: true });
  fs.mkdirSync(目录, { recursive: true });
  let 词数 = 0;
  桶.forEach((m, i) => {
    词数 += m.size;
    const 序 = [...m].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    fs.writeFileSync(path.join(目录, i + ".json.gz"), gzipSync(Buffer.from(JSON.stringify(Object.fromEntries(序)))), "utf8");
  });
  return { 词: 词数, 桶: 桶数 };
}

export function 建倒排(根) {
  const manifest = JSON.parse(fs.readFileSync(path.join(根, "manifest.json"), "utf8"));
  const 片 = manifest.片 ?? [];
  const 表 = new Map();
  片.forEach((p, i) => {
    const 全 = path.join(根, p.文件);
    if (!fs.existsSync(全)) return;
    for (const l of fs.readFileSync(全, "utf8").split("\n")) {
      if (!l) continue;
      let r;
      try { r = JSON.parse(l); } catch { continue; }
      const 文 = String(r.text ?? "");
      for (const g of new Set(双字组(文))) {
        let 列 = 表.get(g);
        if (!列) { 列 = []; 表.set(g, 列); }
        if (列[列.length - 1] !== i) 列.push(i);
      }
    }
  });
  const 目录 = path.join(根, "index");
  fs.mkdirSync(目录, { recursive: true });
  fs.writeFileSync(path.join(目录, "倒排.json"), JSON.stringify(Object.fromEntries(表)), "utf8");
  try { 建倒排序(根); } catch { /* 分桶失败不影响老索引 */ }
  return { 词: 表.size, 片: 片.length };
}

function 双字组(s) {
  const 净 = String(s ?? "").replace(/\s+/g, "");
  const out = [];
  for (let i = 0; i + 1 < 净.length; i++) out.push(净.slice(i, i + 2));
  return out;
}

if (process.argv[1] && path.basename(process.argv[1]) === "倒排.mjs") {
  const 卡带 = process.argv[2];
  if (!卡带) { console.error("用法: node 倒排.mjs <卡带>"); process.exit(2); }
  const r = 建倒排(卡带);
  console.log("倒排建好：词 " + r.词 + " · 片 " + r.片);
}
