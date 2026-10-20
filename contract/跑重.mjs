// 改前必读：/root/全忆-V20/设计.md
// 重：显著 / 情感 / 取次 / 衰减；检索按它排序
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mount } from "../读我.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "重-"));
const 源 = path.join(临时, "源.jsonl");
const 卡带 = path.join(临时, "卡");

fs.writeFileSync(源, [
  { seq: 1, t: "2026-10-01T10:00:00+08:00", who: "user", kind: "text", text: "今天又提到桌宠" },
  { seq: 2, t: "2026-10-01T10:01:00+08:00", who: "user", kind: "text", text: "今天又提到桌宠" },
].map((x) => JSON.stringify(x)).join("\n") + "\n");
execFileSync(process.execPath, [path.join(根, "造卡.mjs"), 源, 卡带], { stdio: "pipe" });

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

let h = mount(卡带);
const 前 = h.recall("桌宠", 2);
记("同分时按 seq 排", 前[0].seq === 1, JSON.stringify(前.map((x) => x.seq)));
h.加重(2, { 显著: 1, 情感: 0.6 });
记("加重之后它排第一", h.recall("桌宠", 2)[0].seq === 2, "");
记("重值算得出来", h.重值(2) > 3, "值 " + h.重值(2).toFixed(2));
h.加重(2, { 取次加: 1 });
记("取次会累加", h.重表().get(2).取次 === 1, String(h.重表().get(2).取次));
h.close();

// 衰减：把时间改成 60 天前，取次 4 ⇒ 有效 1 ⇒ 0.3
const 重路 = path.join(卡带, "facts", "重.jsonl");
const 行 = fs.readFileSync(重路, "utf8").trim().split("\n").map(JSON.parse);
行.push({ seq: 3, 显著: 0, 情感: 0, 置信: 0.5, 取次: 4, t: new Date(Date.now() - 60 * 864e5).toISOString() });
fs.writeFileSync(重路, 行.map((x) => JSON.stringify(x)).join("\n") + "\n");
h = mount(卡带);
记("取次会随半衰期衰减（60 天 ≈ 1/4）", Math.abs(h.重值(3) - 0.3) < 0.06, "值 " + h.重值(3).toFixed(3));
h.close();

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
