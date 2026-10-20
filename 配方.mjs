// 改前必读：/root/全忆-V20/设计.md
// 配方机：能力 = 原语 + 固定算子的组合；配方是数据，不是代码
// 用法：node 配方.mjs <卡带> <配方.json> --问 "..." [--全部]
import fs from "node:fs";
import path from "node:path";
import { mount } from "./读我.mjs";

export const 算子表 = {
  最早: ({ 句柄, 问 }) => 句柄.recall(问, 20).sort((a, b) => a.seq - b.seq).slice(0, 3),
  最近: ({ 句柄, 问 }) => 句柄.recall(问, 20).sort((a, b) => b.seq - a.seq).slice(0, 3),
  变了没: ({ 句柄, 问 }) => {
    const 中 = 句柄.recall(问, 30).sort((a, b) => a.seq - b.seq);
    if (中.length < 2) return [];
    const 词 = String(问).replace(/\s+/g, "").match(/.{2}/g) ?? [];
    const 真 = 中.filter((x) => 词.some((g) => String(x.摘录 ?? "").includes(g)));
    if (真.length < 2) return [];
    const 早 = 真[0], 晚 = 真[真.length - 1];
    return [{ ...早, 备注: "最早一次" }, { ...晚, 备注: "最近一次" }];
  },
  多久没提: ({ 句柄, 问 }) => {
    const 中 = 句柄.recall(问, 20);
    if (!中.length) return [];
    const 晚 = 中.sort((a, b) => b.seq - a.seq)[0];
    const 天 = Math.round((Date.now() - new Date(晚.t).getTime()) / 864e5);
    return [{ ...晚, 备注: "最近一次 " + 天 + " 天前" }];
  },
  计数: ({ 句柄, 问 }) => {
    const 中 = 句柄.recall(问, 50);
    if (!中.length) return [];
    const 他 = 中.filter((x) => x.who === "user").length;
    return [{ 备注: "提过 " + 中.length + " 次（他 " + 他 + " · 她 " + (中.length - 他) + "）", 摘录: 中[0].摘录 }];
  },
  趋势: ({ 句柄, 问 }) => {
    const 中 = 句柄.recall(问, 50).sort((a, b) => new Date(a.t) - new Date(b.t));
    if (中.length < 4) return [];
    const 半 = Math.floor(中.length / 2);
    const 早 = 中.slice(0, 半).length, 晚 = 中.slice(半).length;
    const 判 = 晚 > 早 * 1.3 ? "越来越多" : 晚 < 早 * 0.7 ? "越来越少" : "差不多";
    return [{ 备注: "前一半 " + 早 + " 次，后一半 " + 晚 + " 次：**" + 判 + "**", 摘录: 中[中.length - 1].摘录 }];
  },
  时间线: ({ 句柄, 问 }) => {
    const 中 = 句柄.recall(问, 50);
    if (!中.length) return [];
    const 天 = new Map();
    for (const x of 中) { const d = String(x.t).slice(0, 10); 天.set(d, (天.get(d) ?? 0) + 1); }
    return [...天].sort().slice(-5).map(([d, n]) => ({ 备注: d + "：" + n + " 次" }));
  },
  两件事比: ({ 句柄, 问, 参 }) => {
    const 问2 = 参?.问2 ?? "";
    if (!问2) return [];
    const a = 句柄.recall(问, 20).sort((x, y) => x.seq - y.seq)[0];
    const b = 句柄.recall(问2, 20).sort((x, y) => x.seq - y.seq)[0];
    if (!a || !b) return [];
    const 先 = a.seq < b.seq ? "「" + 问 + "」先" : "「" + 问2 + "」先";
    return [{ 备注: 先 + "（" + a.seq + " vs " + b.seq + "）", 摘录: a.摘录 }, { 备注: "另一件在 [" + b.seq + "]", 摘录: b.摘录 }];
  },
  谁说过: ({ 句柄, 问 }) => {
    const 中 = 句柄.recall(问, 20);
    const 计 = new Map();
    for (const x of 中) 计.set(x.who, (计.get(x.who) ?? 0) + 1);
    return [{ 备注: [...计].map(([w, n]) => (w === "user" ? "他" : "她") + " " + n + " 次").join(" · ") }];
  },
};

export function 读配方(卡带) {
  const 目录 = path.join(卡带, "配方");
  if (!fs.existsSync(目录)) return [];
  const 出 = [];
  for (const f of fs.readdirSync(目录)) {
    if (!f.endsWith(".json")) continue;
    try {
      const r = JSON.parse(fs.readFileSync(path.join(目录, f), "utf8"));
      if (r && r.算子 && 算子表[r.算子]) 出.push({ ...r, 文件: f });
    } catch { /* 坏配方跳过 */ }
  }
  return 出;
}

export function 选配方(配方们, 问) {
  const q = String(问 ?? "");
  return 配方们.filter((r) => (r.触发 ?? []).some((k) => q.includes(k)));
}

export function 跑配方(句柄, 配方, 问) {
  const 算子 = 算子表[配方.算子];
  if (!算子) return { ok: false, why: "没有这个算子：" + 配方.算子 };
  let 条 = 算子({ 句柄, 问, 参: 配方.参数 ?? {} }) ?? [];
  if (配方.过滤 === "只他说的") 条 = 条.filter((x) => x.who === "user");
  else if (配方.过滤 === "只她说的") 条 = 条.filter((x) => x.who === "her");
  if (Number(配方.取) > 0) 条 = 条.slice(0, Number(配方.取));
  return {
    ok: true,
    名: 配方.名,
    算子: 配方.算子,
    条: 条.filter(Boolean).map((x) => ({
      seq: x.seq ?? null,
      备注: x.备注 ?? "",
      摘录: x.摘录 ?? "",
      t: x.t ?? null,
    })),
  };
}

if (process.argv[1] && process.argv[1].split("/").pop() === "配方.mjs") {
  const [卡带, 配方路, ...余] = process.argv.slice(2);
  if (!卡带 || !配方路) { console.error("用法: node 配方.mjs <卡带> <配方.json> --问 \"...\""); process.exit(2); }
  const i = 余.indexOf("--问");
  const 问 = i >= 0 ? 余[i + 1] : "";
  const 配方 = JSON.parse(fs.readFileSync(配方路, "utf8"));
  const h = mount(卡带);
  const r = 跑配方(h, 配方, 问);
  h.close();
  if (!r.ok) { console.error(r.why); process.exit(2); }
  console.log(JSON.stringify(r, null, 2));
}
