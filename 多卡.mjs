// 改前必读：/root/全忆-V20/设计.md
// 多卡带：同时挂几张，按域检索。一盘是一段人生。
// 用法：node 多卡.mjs <卡带1> <卡带2> ... recall "词" [域]
import path from "node:path";
import { mount } from "./读我.mjs";

export function mount多(路径列, { 名 = [] } = {}) {
  const 卡 = 路径列.map((p, i) => {
    const h = mount(p);
    const 域 = 名[i] || h.manifest.名 || path.basename(path.resolve(p));
    return { 域, h };
  });

  function recall(查询, { 域 = null, k = 5 } = {}) {
    const 果 = [];
    for (const c of 卡) {
      if (域 && c.域 !== 域) continue;
      for (const r of c.h.recall(查询, k)) 果.push({ ...r, 域: c.域 });
    }
    果.sort((a, b) => b.分数 - a.分数 || a.域.localeCompare(b.域) || a.seq - b.seq);
    return 果.slice(0, k);
  }

  function frame(域, seq) {
    const c = 卡.find((x) => x.域 === 域);
    return c ? c.h.frame(seq) : { ok: false, 读不动: true, why: "没有这个域：" + 域 };
  }

  function brief({ 问 = "", 域 = null } = {}) {
    const 主 = 卡.filter((c) => !域 || c.域 === 域)[0];
    if (!主) return { text: "（没有这个域：" + 域 + "）", token估: 0 };
    const 基 = 主.h.brief({ 问 });
    const 别 = recall(问, { 域, k: 5 }).filter((x) => x.域 !== 主.域).slice(0, 2);
    if (!别.length) return 基;
    const 附 = ["", "【别的日子】", ...别.map((x) => "- [" + x.域 + "/" + x.seq + "] " + x.摘录)].join("\n");
    const text = 基.text + 附;
    return { text, token估: 基.token估 + 20 };
  }

  function close() { for (const c of 卡) c.h.close(); }
  return { 卡, 域: 卡.map((c) => c.域), recall, frame, brief, close };
}

if (process.argv[1] && path.basename(process.argv[1]) === "多卡.mjs") {
  const 参 = process.argv.slice(2);
  const 分 = 参.indexOf("recall");
  const 卡列 = (分 >= 0 ? 参.slice(0, 分) : 参).filter((x) => x !== "recall");
  if (!卡列.length) { console.error("用法: node 多卡.mjs <卡带...> recall \"词\" [域]"); process.exit(2); }
  const 多 = mount多(卡列);
  if (分 >= 0) {
    for (const r of 多.recall(参[分 + 1] ?? "", { 域: 参[分 + 2] ?? null })) console.log("[" + r.域 + "/" + r.seq + "] " + r.分数 + " · " + r.摘录);
  } else {
    console.log(JSON.stringify({ 域: 多.域 }, null, 2));
  }
  多.close();
}
