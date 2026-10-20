// 改前必读：/root/全忆-V20/设计.md
// 到点：他说到那个条件，就把约定端出来一次；提过就冷 7 天
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mount } from "../读我.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "到点-"));
const 卡带 = path.join(临时, "卡");
fs.cpSync(path.join(根, "卡带样例", "桌宠"), 卡带, { recursive: true });
for (const f of fs.readdirSync(path.join(卡带, "facts"))) fs.rmSync(path.join(卡带, "facts", f));
execFileSync(process.execPath, [path.join(根, "呼吸.mjs"), 卡带], { stdio: "pipe" });

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };
const h = mount(卡带);

const 中 = h.brief({ 问: "我终于有自己的电脑了" });
记("说到条件就端出来", 中.text.includes("【到点了】") && 中.text.includes("再战一场"), "");
记("无关的话不端", !h.brief({ 问: "今天天气不错" }).text.includes("【到点了】"), "");
记("情绪上头不端", !h.brief({ 问: "烦死了" }).text.includes("【到点了】"), "");

const 承诺 = fs.readFileSync(path.join(卡带, "facts", "承诺.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const 源 = 承诺[0]?.src?.[0];
h.记提过(源);
记("提过一次就冷 7 天", !h.brief({ 问: "我终于有自己的电脑了" }).text.includes("【到点了】"), "src " + 源);
h.close();

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
