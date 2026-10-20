// 改前必读：/root/全忆-V20/设计.md
// 导入卡带：一份 导入.jsonl → 卡带 + 日记，一步完成
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mount } from "../读我.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "导入-"));
const 卡带 = path.join(临时, "她");
fs.mkdirSync(卡带);
fs.writeFileSync(path.join(卡带, "self.md"), "# 她\n\n我在陪默风做桌宠。\n");
fs.writeFileSync(path.join(卡带, "导入.jsonl"), [
  { seq: 1, t: "2026-10-01T10:00:00+08:00", who: "user", kind: "text", text: "我想做个桌宠" },
  { seq: 2, t: "2026-10-01T10:01:00+08:00", who: "her", kind: "text", text: "先别想美术，跑通再说" },
  { seq: 3, t: "2026-10-01T10:02:00+08:00", who: "user", kind: "text", text: "动了" },
].map((x) => JSON.stringify(x)).join("\n") + "\n");

execFileSync(process.execPath, [path.join(根, "导入卡带.mjs"), 卡带], { stdio: "pipe" });

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

const h = mount(卡带);
记("导入后卡带能挂", h.manifest.帧数 === 3, "帧 " + h.manifest.帧数);
记("原文取得到", (() => { const f = h.frame(3); return f.ok && f.校验 && f.text === "动了"; })(), "");
记("self.md 没被覆盖", fs.readFileSync(path.join(卡带, "self.md"), "utf8").includes("我在陪默风做桌宠"), "");
记("已经呼吸过（有日记）", fs.readdirSync(path.join(卡带, "diary")).some((x) => x.endsWith(".md")), "");
记("导入件改名留档", fs.existsSync(path.join(卡带, "导入.已用.jsonl")), "");
记("brief 里能看到这段", h.brief({ 问: "桌宠" }).text.includes("【最近的日子】") || h.brief({}).text.includes("桌宠"), "");
h.close();

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
