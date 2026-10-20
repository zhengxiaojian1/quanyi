// 改前必读：/root/全忆-V20/设计.md
// 只读驱动：把卡带接进一个 agent 循环（本地假循环版，不碰宿主）
// 用法：node driver.mjs <卡带> [--干跑]
import path from "node:path";
import fs from "node:fs";
import { mount } from "./读我.mjs";

export function 造驱动({ 卡带, 预算 = 600, 扩展 = false }) {
  const 句柄 = mount(卡带, { 扩展 });
  const 读数 = { 轮: 0, 注入token: 0, 工具: 0, 记提过: 0 };
  const 这个 = {
    句柄,
    取料(用户话) {
      读数.轮++;
      const b = 句柄.brief({ 问: 用户话, 预算 });
      读数.注入token += b.token估;
      return b;
    },
    调工具(名, 参数 = {}) {
      if (名 !== "recall" && 名 !== "frame") throw new Error("没有这个工具：" + 名);
      读数.工具++;
      if (名 === "recall") return 句柄.recall(参数.q ?? "", 参数.k ?? 5);
      return 句柄.frame(参数.seq);
    },
    建议会话() {
      const 最后 = 句柄.manifest.last_session ?? null;
      if (!最后) return { 动作: "新建", 因为: "卡带里还没有会话记录" };
      if (最后.host !== 句柄.当前设备 || 最后.model !== 句柄.当前模型) {
        return { 动作: "新建", 因为: "换了设备或模型（" + 最后.host + "/" + 最后.model + " → " + 句柄.当前设备 + "/" + 句柄.当前模型 + "）", 上次会话: 最后.会话 };
      }
      return { 动作: "恢复", 会话: 最后.会话, 因为: "还是同一台设备、同一个模型" };
    },
    记会话(号) { return 句柄.记会话(号); },
    // 每轮：把「对话账里比末帧新的」落成帧（当天就能查）
    长帧() {
      const 路 = path.join(卡带, "对话.jsonl");
      if (!fs.existsSync(路)) return 0;
      const 末 = new Date(句柄.manifest.末 ?? 0).getTime();
      const 新 = fs.readFileSync(路, "utf8").split("\n").filter(Boolean)
        .map((l) => { try { return JSON.parse(l); } catch { return null; } })
        .filter((x) => x && x.text && new Date(x.t).getTime() > 末);
      if (!新.length) return 0;
      句柄.追加帧(新.map((x) => ({ t: x.t, who: x.who, text: x.text })));
      return 新.length;
    },
    记对话(角色, 话, 会话, id) { return 句柄.记对话({ who: 角色, text: 话, 会话, id }); },
    接回包({ 最多 = 4, 会话 } = {}) {
      const 建 = 这个.建议会话();
      if (建.动作 === "恢复") return "";
      const 近 = 句柄.最近对话(最多, 会话);
      if (!近.length) return "";
      const 行 = ["（接续）你们上次停在这里："];
      for (const x of 近) 行.push((x.who === "user" ? "他：" : "我：") + String(x.text).slice(0, 120));
      return 行.join("\n");
    },
    压制(seqs, 原因) { return 句柄.压制(seqs, 原因); },
    被压制(seq) { return 句柄.被压制(seq); },

    收尾(用了 = []) {
      for (const s of 用了) { 句柄.记提过(s); 句柄.加重(s, { 取次加: 1 }); 读数.记提过++; }
    },
    读数,
    关() { 句柄.close(); },
  };
  return 这个;
}

if (process.argv[1] && process.argv[1].split("/").pop() === "driver.mjs") {
  const 卡带 = process.argv[2];
  if (!卡带) { console.error("用法: node driver.mjs <卡带>"); process.exit(2); }
  const 驱 = 造驱动({ 卡带 });
  const 对话 = [
    { 说: "我们之前在做什么", 用: [1] },
    { 说: "那个卡住的地方是哪", 用: [73] },
    { 说: "把 73 的原文给我", 工具: { 名: "frame", 参数: { seq: 73 } }, 用: [73] },
    { 说: "算了，烦死了", 用: [] },
    { 说: "2D 的极限", 工具: { 名: "recall", 参数: { q: "2D 的极限", k: 2 } }, 用: [73] },
  ];
  for (const 轮 of 对话) {
    console.log("\n════ 他：" + 轮.说);
    const b = 驱.取料(轮.说);
    console.log("── 递上去 " + b.token估 + " token ──");
    console.log(b.text.split("\n").slice(0, 6).join("\n"));
    if (轮.工具) {
      const r = 驱.调工具(轮.工具.名, 轮.工具.参数);
      console.log("── 工具 " + 轮.工具.名 + " → " + (Array.isArray(r) ? r.map((x) => x.seq).join(",") : (r.ok ? "有原文、校验 " + r.校验 : "读不动")));
    }
    驱.收尾(轮.用);
  }
  console.log("\n读数：" + JSON.stringify(驱.读数));
  驱.关();
}
