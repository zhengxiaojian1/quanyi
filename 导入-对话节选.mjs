// 改前必读：/root/全忆-V20/设计.md
// 把 f0 导出的 Markdown 节选导成 JSONL（只认「### 🤖 助手 · 时间Z」这种消息头）
// 用法：node 导入-对话节选.mjs <输入.md> <输出.jsonl> [--谁 her]
import fs from "node:fs";
import readline from "node:readline";

const [源, 出, ...余] = process.argv.slice(2);
if (!源 || !出) { console.error("用法: node 导入-对话节选.mjs <输入.md> <输出.jsonl> [--谁 her]"); process.exit(2); }
const 谁 = 余.indexOf("--谁") >= 0 ? 余[余.indexOf("--谁") + 1] : "her";

const 头 = /^### (.+?) · (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})Z$/;
const rl = readline.createInterface({ input: fs.createReadStream(源), crlfDelay: Infinity });

const 出流 = fs.createWriteStream(出);
let seq = 0, 条 = 0, 体 = [], 时 = null;

function 落() {
  if (!时) return;
  const 文 = 体.join("\n").trim();
  体 = [];
  if (!文) return;
  seq++;
  条++;
  出流.write(JSON.stringify({ seq, t: 时, who: 谁, kind: "text", text: 文 }) + "\n");
}

for await (const 行 of rl) {
  const m = 行.match(头);
  if (m) { 落(); 时 = m[2] + "T" + m[3] + "Z"; continue; }
  体.push(行);
}
落();
出流.end();
await new Promise((r) => 出流.on("close", r));
console.log("导出 " + 条 + " 帧 → " + 出);
