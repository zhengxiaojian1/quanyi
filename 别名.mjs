// 改前必读：/root/全忆-V20/设计.md
// 别名：让模型离线把“换说法”沉淀成词表，检索时零成本展开
import fs from "node:fs";
import path from "node:path";

export function 解析别名(文) {
  const 出 = {};
  const 文2 = String(文 ?? "");
  const m = 文2.match(/\[[\s\S]*\]/);
  if (!m) return 出;
  let 列;
  try { 列 = JSON.parse(m[0]); } catch { return 出; }
  if (!Array.isArray(列)) return 出;
  for (const 组 of 列) {
    if (!Array.isArray(组) || 组.length < 2) continue;
    const 词 = String(组[0] ?? "").trim();
    if (!词 || 词.length > 8) continue;
    const 别 = 组.slice(1).map((x) => String(x ?? "").trim()).filter((x) => x && x !== 词 && x.length <= 8).slice(0, 3);
    if (别.length) 出[词] = 别;
  }
  return 出;
}

export async function 抽别名({ 说, 帧, 已有 = {} }) {
  const 样 = 帧.slice(0, 40).map((f) => String(f.text ?? "").slice(0, 80)).join("\n");
  if (!样.trim()) return {};
  const r = await 说({
    系统: "从下面的对话里找出「同一个东西的不同说法」。只输出 JSON 数组，每组第一个是常见说法，后面 1-3 个是别的说法。最多 12 组。没有就输出 []。",
    消息: [{ role: "user", content: 样 }],
    温度: 0, 最大: 400, 思考: false,
  });
  return { ...已有, ...解析别名(r.text) };
}

export function 合并别名(根, 新) {
  const p = path.join(根, "facts", "别名.json");
  let 旧 = {};
  if (fs.existsSync(p)) { try { 旧 = JSON.parse(fs.readFileSync(p, "utf8")); } catch { 旧 = {}; } }
  const 合 = { ...旧 };
  for (const [k, v] of Object.entries(新 ?? {})) {
    const 集 = new Set([...(合[k] ?? []), ...(v ?? [])].slice(0, 4));
    合[k] = [...集];
  }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(合, null, 2) + "\n", "utf8");
  return 合;
}

export function 读别名(根) {
  const p = path.join(根, "facts", "别名.json");
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return {}; }
}
