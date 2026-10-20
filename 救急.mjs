// 改前必读：/root/全忆-V20/设计.md
// 救急：一条命令查会话日志坏没坏；--修 就顺手修（先备份）
// 用法：node 救急.mjs [--修] [目录]   （默认 /root/.dsh/sessions）
import fs from "node:fs";
import { 扫修 } from "./修会话日志.mjs";

const 参 = process.argv.slice(2);
const 真修 = 参.includes("--修");
const 目录们 = 参.filter((x) => !x.startsWith("--"));
const 目标 = 目录们.length ? 目录们 : ["/root/.dsh/sessions"];

for (const 目录 of 目标) if (!fs.existsSync(目录)) { console.error("目录不存在：" + 目录); process.exit(2); }

const 先 = await 扫修(目标, {});
console.log("扫了 " + 先.文件们 + " 个会话；有问题 " + 先.问题 + " 个；共需修 " + 先.总修 + " 条");
for (const r of 先.汇总) console.log("  · 待修 " + r.修 + " 条 · 坏行 " + r.坏 + " · " + r.路);

if (!先.问题) { console.log("✅ 日志都是好的，不用修"); process.exit(0); }
if (!真修) { console.log("确认无误后：node 救急.mjs --修"); process.exit(0); }

const 后 = await 扫修(目标, { 真修: true });
console.log("\n已修 " + 后.总修 + " 条");
const 验 = await 扫修(目标, {});
console.log(验.问题 ? "❌ 还有 " + 验.问题 + " 个会话有问题" : "✅ 全部干净");
process.exit(验.问题 ? 1 : 0);
