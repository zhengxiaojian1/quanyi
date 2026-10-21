// 改前必读：/root/全忆-V20/设计.md
// 出题：从卡带里采样若干帧，让模型写「用户会怎么问」，目标 seq 已知
// 用法：node 出题.mjs <卡带> <出到.jsonl> [--几 30]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mount } from "./读我.mjs";

const [卡带, 出路, ...余] = process.argv.slice(2);
if (!卡带 || !出路) { console.error("用法: node 出题.mjs <卡带> <出到.jsonl> [--几 30]"); process.exit(2); }
const 几 = Number(余[余.indexOf("--几") + 1]) || 30;

const 名 = process.env.QUANYI_ADAPTER === "openai" ? "openai.mjs" : "deepseek.mjs";
const 插头 = await import(pathToFileURL(path.join(import.meta.dirname, "adapters", 名)).href);
if (!插头.有钥匙()) { console.error("没钥匙：设 DEEPSEEK_KEY_FILE 或 DEEPSEEK_API_KEY"); process.exit(2); }

const h = mount(卡带);
const 总 = h.manifest.帧数 ?? 0;
const 步 = Math.max(1, Math.floor(总 / 几));
const 候选 = [];
for (let seq = 1; seq <= 总; seq += 步) {
  const f = h.frame(seq);
  if (!f.ok) continue;
  const 长 = String(f.text ?? "").length;
  if (长 < 120 || 长 > 1200) continue;
  if (/^#|^\s*$/.test(String(f.text))) continue;
  候选.push({ seq, text: String(f.text) });
  if (候选.length >= 几 * 2) break;
}

const 出 = [];
for (const c of 候选) {
  try {
    const r = await 插头.说({
      系统: "你在帮人回忆。给下面这段「助手说过的话」，写一句用户会问的话，使这段话正好是答案。要求：口语、不要照抄原文的专有名词、用这段话本来的语言提问（英文内容就用英文问）、只输出这一句。",
      消息: [{ role: "user", content: c.text.slice(0, 800) }],
      温度: 0.7, 最大: 80, 思考: false,
    });
    const 问 = String(r.text ?? "").split("\n")[0].trim().replace(/^["「]|["」]$/g, "");
    if (问.length >= 6) 出.push({ 问, 目标seq: c.seq, 目标前30字: c.text.slice(0, 30) });
    if (出.length >= 几) break;
  } catch (e) { console.error("第 " + c.seq + " 帧出题失败：" + e.message); }
}
h.close();
fs.writeFileSync(出路, 出.map((x) => JSON.stringify(x)).join("\n") + "\n", "utf8");
console.log("出了 " + 出.length + " 题 → " + 出路);
