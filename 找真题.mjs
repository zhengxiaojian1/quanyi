// 改前必读：/root/全忆-V20/设计.md
// 找真题：从真实对话里找「同一件事问了第二次」，第二次之前的那些帧就是目标
// 用法：node 找真题.mjs <卡带> [--出 文件.jsonl]
import fs from "node:fs";
import path from "node:path";
import { mount } from "./读我.mjs";

const [卡带, ...余] = process.argv.slice(2);
if (!卡带) { console.error("用法: node 找真题.mjs <卡带> [--出 文件]"); process.exit(2); }
const 出 = 余.includes("--出") ? 余[余.indexOf("--出") + 1] : null;

const h = mount(卡带);
const 话 = path.join(卡带, "对话.jsonl");
if (!fs.existsSync(话)) { console.error("没有 对话.jsonl：还没记过对话"); process.exit(2); }
const 行 = fs.readFileSync(话, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const 他说 = 行.filter((x) => x.who === "user" && String(x.text ?? "").trim().length >= 4);

const 字 = (s) => new Set((String(s).match(/[\u4e00-\u9fa5]{2}|[A-Za-z]{3,}/g) ?? []).map((x) => x.toLowerCase()));
const 像 = (a, b) => {
  const A = 字(a), B = 字(b);
  if (!A.size || !B.size) return 0;
  let 同 = 0;
  for (const x of A) if (B.has(x)) 同++;
  return 同 / Math.min(A.size, B.size);
};

const 真题 = [];
for (let i = 0; i < 他说.length; i++) {
  for (let j = i + 1; j < 他说.length; j++) {
    if (像(他说[i].text, 他说[j].text) < 0.6) continue;
    const 起 = new Date(他说[i].t).getTime(), 止 = new Date(他说[j].t).getTime();
    // 目标：两次问话之间的助手帧（只扫涉及的那几天，不扫全卡带）
    const 目标 = [];
    const 从 = 他说[i].t.slice(0, 10), 到 = 他说[j].t.slice(0, 10);
    const 天们 = [...new Set((h.manifest.片 ?? []).map((p) => p.天).filter((d) => d >= 从 && d <= 到))];
    for (const 天 of 天们) for (const f of h.天帧(天)) {
      if (f.who !== "her") continue;
      const t = new Date(f.t).getTime();
      if (t > 起 && t <= 止) 目标.push(f.seq);
    }
    真题.push({ 问: 他说[j].text.slice(0, 120), 首次: 他说[i].t, 二次: 他说[j].t, 目标seq: 目标.slice(0, 3) });
    break;
  }
}
h.close();

const 文 = 真题.map((x) => JSON.stringify(x)).join("\n") + (真题.length ? "\n" : "");
if (出) fs.writeFileSync(出, 文, "utf8");
console.log("共 " + 他说.length + " 句他说的话，找到 " + 真题.length + " 对「又问了一次」");
for (const x of 真题.slice(0, 10)) console.log("· " + x.问.slice(0, 40) + "  → 目标 " + JSON.stringify(x.目标seq));
if (!真题.length) console.log("（对话还太少；等真实用上几周再跑）");
