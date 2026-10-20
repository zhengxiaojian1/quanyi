// 改前必读：/root/全忆-V20/设计.md
// 把“随便粘的一段对话”导成 JSONL（给没有宿主日志的人用）
// 用法：node 粘贴导入.mjs <输入.txt> <输出.jsonl> [--他 我] [--她 助手]
import fs from "node:fs";

const [源, 出, ...余] = process.argv.slice(2);
if (!源 || !出) { console.error("用法: node 粘贴导入.mjs <输入.txt> <输出.jsonl> [--他 我] [--她 助手]"); process.exit(2); }
const 他名 = "user", 她名 = "her";   // 卡带里只认这两个 who

const 新时 = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");
let 文 = fs.readFileSync(源, "utf8").replace(/\r\n/g, "\n");

// ① 认说话人前缀，认不出来就按“隔段交替”猜
const 前缀 = /^\s*(?:([👤🤖🧑‍💻🦊])\s*)?(我|你|用户|User|Human|助手|AI|Assistant|模型|GPT|DeepSeek)\s*[:：]\s*/i;
const 行们 = 文.split("\n");
const 帧 = [];
let 当 = null;
const 谁是 = (标) => /^(我|用户|User|Human)$/i.test(标) ? 他名 : 她名;

let 有前缀 = false;
for (const 行 of 行们) if (前缀.test(行)) { 有前缀 = true; break; }

if (有前缀) {
  for (const 行 of 行们) {
    const m = 行.match(前缀);
    if (m) {
      if (当 && 当.text.trim()) 帧.push(当);
      当 = { who: 谁是((m[2] || "").trim()), text: 行.slice(m[0].length), t: 新时() };
    } else if (当) 当.text += "\n" + 行;
  }
  if (当 && 当.text.trim()) 帧.push(当);
} else {
  // ② 没有前缀：空行分段，隔段交替
  const 段 = 文.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  let 人 = 他名;
  for (const s of 段) { 帧.push({ who: 人, text: s, t: 新时() }); 人 = 人 === 他名 ? 她名 : 他名; }
}

const 成 = 帧.filter((f) => f.text && f.text.trim().length);
let 序 = 0;
const 行们出 = 成.map((f) => JSON.stringify({ seq: ++序, t: f.t, who: f.who, kind: "text", text: f.text.trim() }));
fs.writeFileSync(出, 行们出.join("\n") + "\n", "utf8");
console.log(JSON.stringify({ 帧: 成.length, user: 成.filter((f) => f.who === 他名).length, her: 成.filter((f) => f.who === 她名).length, 认前缀: 有前缀 }));
