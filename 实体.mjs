// 改前必读：/root/全忆-V20/设计.md
// 实体（第一层）：只做「同一个人/同一件事的不同叫法」的归并
import fs from "node:fs";
import path from "node:path";

export function 读实体(根) {
  const p = path.join(根, "facts", "实体.jsonl");
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

export function 写实体(根, 列) {
  const p = path.join(根, "facts", "实体.jsonl");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, 列.map((x) => JSON.stringify(x)).join("\n") + "\n", "utf8");
  return 列;
}

// 合并：名字或别名有交集，就算同一个实体
export function 合并实体(根, 新们) {
  const 旧 = 读实体(根);
  const 归 = (x) => ({ 类型: x.类型 ?? "人", 名: String(x.名 ?? "").trim(), 别名: [...new Set((x.别名 ?? []).map((s) => String(s).trim()).filter(Boolean))], 自: x.自 ?? null, 到: x.到 ?? null });
  const 全 = [...旧.map(归), ...(新们 ?? []).map(归)].filter((x) => x.名);
  const 组 = [];
  for (const x of 全) {
    const 名集 = new Set([x.名, ...x.别名]);
    const 中 = 组.find((g) => [g.名, ...g.别名].some((n) => 名集.has(n)));
    if (中) { 中.别名 = [...new Set([...中.别名, ...x.别名, x.名].filter((n) => n !== 中.名))]; if (x.类型 && !中.类型) 中.类型 = x.类型; }
    else 组.push({ ...x, 别名: [...x.别名] });
  }
  return 写实体(根, 组);
}

export function 解析实体(文) {
  const m = String(文 ?? "").match(/\[[\s\S]*\]/);
  if (!m) return [];
  let 列;
  try { 列 = JSON.parse(m[0]); } catch { return []; }
  if (!Array.isArray(列)) return [];
  return 列
    .filter((x) => x && typeof x === "object" && x.名)
    .map((x) => ({ 类型: x.类型 === "项目" ? "项目" : "人", 名: String(x.名).slice(0, 20), 别名: (Array.isArray(x.别名) ? x.别名 : []).map((s) => String(s).slice(0, 20)).slice(0, 4) }))
    .slice(0, 12);
}

export async function 抽实体({ 说, 帧 }) {
  const 样 = 帧.slice(0, 40).map((f) => String(f.text ?? "").slice(0, 80)).join("\n");
  if (!样.trim()) return [];
  const r = await 说({
    系统: "从下面的对话里找出「人」和「项目/东西」。输出 JSON 数组，每项 {类型:\"人\"或\"项目\", 名, 别名:[别的叫法]}。别名只写你确信是同一个的。没有就输出 []。",
    消息: [{ role: "user", content: 样 }],
    温度: 0, 最大: 400, 思考: false,
  });
  return 解析实体(r.text);
}

// 查询里出现某个名字/别名 → 把同一实体的其它叫法也带上
export function 展开实体(根, 查询) {
  const q = String(查询 ?? "");
  const 出 = [];
  for (const x of 读实体(根)) {
    const 名们 = [x.名, ...(x.别名 ?? [])].filter(Boolean);
    if (!名们.some((n) => q.includes(n))) continue;
    for (const n of 名们) if (!q.includes(n)) 出.push(n);
  }
  return [...new Set(出)];
}
