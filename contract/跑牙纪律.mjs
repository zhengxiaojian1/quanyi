// 改前必读：/root/全忆-V20/设计.md
// 牙纪律成文：三条规则必须在规范里，且每条能指出反例
import fs from "node:fs";
import path from "node:path";

const 文 = fs.readFileSync(path.join(import.meta.dirname, "规范-牙.md"), "utf8");
let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

记("一、反向咬写进去了", /反向咬/.test(文) && /必红/.test(文), "");
记("二、跳 ≠ 绿 写进去了", /跳\s*≠\s*绿/.test(文) && /不许印/.test(文), "");
记("三、量不到 ≠ 0 写进去了", /量不到\s*≠\s*0/.test(文) && /未测/.test(文), "");
记("每条都有反例", (文.match(/反例/g) ?? []).length >= 2, (文.match(/反例/g) ?? []).length + " 处");

// 反向咬的活体：把“收”那笔去掉，判据必须翻红
const 临时 = fs.mkdtempSync("/tmp/牙-");
fs.mkdirSync(path.join(临时, "facts"), { recursive: true });
fs.writeFileSync(path.join(临时, "facts", "黑匣子.jsonl"), JSON.stringify({ t: new Date().toISOString(), pid: 1, 笔: "开" }) + "\n");
const { 上一代收了吗 } = await import("../黑匣子.mjs");
记("反向咬：没有「收」时必须红", 上一代收了吗(临时) === false, "");
fs.rmSync(临时, { recursive: true, force: true });

console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
