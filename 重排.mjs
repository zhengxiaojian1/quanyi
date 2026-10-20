// 改前必读：/root/全忆-V20/设计.md
// 在线重排（窄版）：用户明说找不到时，让模型从候选里挑几条
import fs from "node:fs";
import path from "node:path";

export function 解析重排(文, 上限) {
  const 数 = String(文 ?? "").match(/\d+/g) ?? [];
  const 出 = [];
  for (const x of 数) { const n = Number(x); if (n >= 1 && n <= 上限 && !出.includes(n - 1)) 出.push(n - 1); }
  return 出.slice(0, 3);
}

export async function 重排({ 问, 候选, 说 }) {
  if (!Array.isArray(候选) || 候选.length < 2) return [];
  const 列 = 候选.slice(0, 8).map((x, i) => (i + 1) + ". " + String(x.摘录 ?? x.text ?? "").slice(0, 70)).join("\n");
  const r = await 说({
    系统: "下面是几条候选摘录。挑出最能回答问题的前 3 个，只输出编号（逗号分隔，例如 2,5,1）。",
    消息: [{ role: "user", content: "问题：" + 问 + "\n\n" + 列 }],
    温度: 0, 最大: 30, 思考: false,
  });
  return 解析重排(r.text, Math.min(8, 候选.length));
}

if (process.argv[1] && path.basename(process.argv[1]) === "重排.mjs") {
  console.log("重排：给插件用，命令行不单独跑");
}
