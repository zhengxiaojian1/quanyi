// 改前必读：/root/全忆-V20/设计.md
// 即时性：插件每轮的开销必须小到用户感觉不到；慢了就是插件的问题
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mount } from "../读我.mjs";
import { 整形 } from "../整形.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "即时-"));
const 卡带 = path.join(临时, "卡");
fs.cpSync(path.join(根, "卡带样例", "桌宠"), 卡带, { recursive: true });

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

const h = mount(卡带);
const t0 = Date.now();
for (let i = 0; i < 20; i++) h.brief({ 问: "桌宠卡住的地方" + i });
const 均 = (Date.now() - t0) / 20;
记("brief 平均 < 50ms", 均 < 50, 均.toFixed(1) + "ms");

const t1 = Date.now();
for (let i = 0; i < 20; i++) h.recall("2D 的极限", 5);
const 均查 = (Date.now() - t1) / 20;
记("recall 平均 < 20ms", 均查 < 20, 均查.toFixed(1) + "ms");
h.close();

// 大上下文整形：800 条 × 3000 字
const 长 = Array.from({ length: 800 }, (_, i) => ({ role: i % 2 ? "user" : "assistant", content: "话".repeat(3000) }));
const t2 = Date.now();
整形({ messages: 长, 预算: 60000, 留最近: 12, 回忆块: "x" });
const 整毫秒 = Date.now() - t2;
记("800 条大消息整形 < 100ms", 整毫秒 < 100, 整毫秒 + "ms");

// 小上下文：快路应该几乎零开销
const 短 = Array.from({ length: 5 }, (_, i) => ({ role: "user", content: "话".repeat(200) }));
const t3 = Date.now();
for (let i = 0; i < 100; i++) 整形({ messages: 短, 预算: 60000, 留最近: 12 });
记("短上下文 100 次整形 < 20ms", Date.now() - t3 < 20, (Date.now() - t3) + "ms");

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
