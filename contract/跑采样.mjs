// 改前必读：/root/全忆-V20/设计.md
// 常见词截断时按时间分层采样：首片、末片都要覆盖
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mount } from "../读我.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "采样-"));
const 源 = path.join(临时, "源.jsonl");
const 卡带 = path.join(临时, "卡带");

const 行 = [];
for (let i = 1; i <= 500; i++) {
  const t = new Date(Date.UTC(2026, 0, 1, 0, 0, 0) + (i - 1) * 3600e3).toISOString();
  行.push(JSON.stringify({ seq: i, t, who: i % 2 ? "user" : "her", kind: "text", text: "共同的词 第" + i + "帧" }));
}
fs.writeFileSync(源, 行.join("\n") + "\n");
execFileSync(process.execPath, [path.join(根, "造卡.mjs"), 源, 卡带], { stdio: "pipe" });

// 这条测的是「没有倒排时」的 Bloom + 分层采样；有倒排时走的是另一条快路
fs.rmSync(path.join(卡带, "index", "倒排.json"), { force: true });
fs.rmSync(path.join(卡带, "index", "倒排"), { recursive: true, force: true });
const h = mount(卡带);
const 果 = h.recall("共同的词", 5);
const 读 = h.检索读数();

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

记("500 片全部候选", 读.片数 === 500 && 读.候选 === 500, JSON.stringify(读));
记("超过 250 就采样", 读.采样 === true && 读.读了 === 250, "读了 " + 读.读了);
记("采样覆盖首片", 读.首片?.includes("01/01/00") === true, 读.首片 ?? "");
记("采样覆盖末片", 读.末片?.includes("01/21/19") === true, 读.末片 ?? "");
记("采样后仍有结果", 果.length > 0, "命中 " + 果.length);
记("结果可校验", 果.every((x) => h.frame(x.seq).校验 === true), "");

h.close();
fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
