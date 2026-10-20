// 改前必读：/root/全忆-V20/设计.md
// 快照：拍、回滚、只留最近 3 份；造卡重建前会自动拍
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { 拍, 列, 回滚 } from "../快照.mjs";

const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "快照-"));
const 卡 = path.join(临时, "卡");
fs.cpSync("/root/全忆-V20/卡带样例/桌宠", 卡, { recursive: true });
let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

拍(卡, "第一张");
记("拍了一张", fs.existsSync(path.join(卡, ".快照", "第一张", "manifest.json")), "");
fs.writeFileSync(path.join(卡, "self.md"), "被改坏了");
回滚(卡, "第一张");
记("回滚把 self.md 复原", !fs.readFileSync(path.join(卡, "self.md"), "utf8").includes("改坏"), "");
记("回滚前先保了当前", 列(卡).some((x) => x.startsWith("回滚前-")), 列(卡).join(","));

for (let i = 0; i < 5; i++) 拍(卡, "批-" + i);
记("只留最近 3 份", 列(卡).filter((x) => x.startsWith("批-")).length <= 3, 列(卡).length + " 张");

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
