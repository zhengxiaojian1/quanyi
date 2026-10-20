// 改前必读：/root/全忆-V20/设计.md
// 新卡带：一条命令建一张（从会话 / 从文件 / 空卡带），顺手呼吸 + 自检
// 用法：
//   node 新卡带.mjs <名字> --从会话 <sessionId>
//   node 新卡带.mjs <名字> --从文件 <导出.jsonl>
//   node 新卡带.mjs <名字> --空
//   （默认放到 /sdcard/Download/卡带/<名字>，可用 --到 <目录> 改）
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const [名, ...余] = process.argv.slice(2);
const 取 = (k) => { const i = 余.indexOf(k); return i >= 0 ? 余[i + 1] : undefined; };
if (!名) { console.error("用法: node 新卡带.mjs <名字> --从会话 <id> | --从文件 <路径> | --空"); process.exit(2); }

const 根 = 取("--到") ?? "/sdcard/Download/卡带";
const 目标 = path.join(根, 名);
if (fs.existsSync(path.join(目标, "manifest.json"))) { console.error("已经有这张卡带了：" + 目标); process.exit(2); }
fs.mkdirSync(目标, { recursive: true });

const 会话 = 取("--从会话");
const 文件 = 取("--从文件");
const 空 = 余.includes("--空");

if (会话) {
  execFileSync(process.execPath, [path.join(此处, "从宿主导入.mjs"), 会话, 目标], { stdio: "inherit" });
} else if (文件) {
  execFileSync(process.execPath, [path.join(此处, "造卡.mjs"), 文件, 目标], { stdio: "inherit" });
} else if (空) {
  const 源 = path.join(目标, ".空.jsonl");
  fs.writeFileSync(源, JSON.stringify({ seq: 1, t: new Date().toISOString(), who: "her", kind: "text", text: "（这张卡带从今天开始。）" }) + "\n");
  execFileSync(process.execPath, [path.join(此处, "造卡.mjs"), 源, 目标], { stdio: "pipe" });
  fs.rmSync(源, { force: true });
} else {
  console.error("要说清从哪来：--从会话 <id> / --从文件 <路径> / --空");
  process.exit(2);
}

// 她是谁（模板，让人改）
const self路 = path.join(目标, "self.md");
if (!fs.existsSync(self路) || fs.readFileSync(self路, "utf8").length < 40) {
  fs.writeFileSync(self路, "# 她\n\n（这里写：我在陪谁做什么。两三句就够，用第一人称。）\n");
}

// 默认配方
const 配方源 = path.join(此处, "卡带样例", "桌宠", "配方");
if (fs.existsSync(配方源)) fs.cpSync(配方源, path.join(目标, "配方"), { recursive: true });

execFileSync(process.execPath, [path.join(此处, "呼吸.mjs"), 目标], { stdio: "pipe" });
try { execFileSync(process.execPath, [path.join(此处, "自检.mjs"), 目标], { stdio: "inherit" }); } catch { /* 自检会自己报 */ }

console.log("\n新卡带：" + 目标);
console.log("下一步：改 " + path.join(目标, "self.md") + "（写她是谁）");
console.log("用它：把 plugin/cordis.patch.yml 的 卡带 指到这个目录，或 export QUANYI_CARD=" + 目标);
