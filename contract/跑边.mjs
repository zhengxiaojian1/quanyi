// 改前必读：/root/全忆-V20/设计.md
// 边：人 / 约定 / 帧与帧；检索时一跳带出关联帧
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mount } from "../读我.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "边-"));
const 源 = path.join(临时, "源.jsonl");
const 卡带 = path.join(临时, "卡");

fs.writeFileSync(源, [
  { seq: 1, t: "2026-10-01T10:00:00+08:00", who: "user", kind: "text", text: "默风说要做个桌宠" },
  { seq: 2, t: "2026-10-01T10:05:00+08:00", who: "her", kind: "text", text: "后来我们又聊了一次" },
  { seq: 3, t: "2026-10-01T10:10:00+08:00", who: "user", kind: "text", text: "等我有自己的电脑再战一场" },
].map((x) => JSON.stringify(x)).join("\n") + "\n");
execFileSync(process.execPath, [path.join(根, "造卡.mjs"), 源, 卡带], { stdio: "pipe" });
fs.writeFileSync(path.join(卡带, "称呼.json"), JSON.stringify({ 名字: "默风", 代词: "他" }));
execFileSync(process.execPath, [path.join(根, "呼吸.mjs"), 卡带], { stdio: "pipe" });

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

const h = mount(卡带, { 扩展: true });
const 人 = h.边("人:默风");
记("呼吸会连「人」的边", 人.length >= 1 && 人.some((e) => e.b === "帧:1"), JSON.stringify(人.map((e) => e.b)));
const 约 = h.边表().filter((e) => e.类型 === "约定");
记("承诺也连了边", 约.length === 1 && 约[0].b === "帧:3", JSON.stringify(约));

h.加边({ a: "帧:1", b: "帧:2", 类型: "因果", 强度: 1 });
记("帧与帧的边加得上", h.边("帧:1").some((e) => e.类型 === "因果"), "");

const 果 = h.recall("桌宠", 3);
记("检索会一跳带出关联帧", 果.some((x) => x.seq === 1) && 果.some((x) => x.seq === 2), JSON.stringify(果.map((x) => x.seq)));
记("查不存在的点返回空", h.边("帧:999").length === 0, "");
h.close();

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
