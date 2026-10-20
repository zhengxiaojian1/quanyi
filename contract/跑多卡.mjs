// 改前必读：/root/全忆-V20/设计.md
// 多卡带：按域检索、互不串号、brief 带上别的日子
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mount多 } from "../多卡.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "多卡-"));

const 工作源 = path.join(临时, "工作.jsonl");
fs.writeFileSync(工作源, [
  { seq: 1, t: "2026-10-01T10:00:00+08:00", who: "user", kind: "text", text: "今天开会讲开会" },
  { seq: 2, t: "2026-10-01T10:01:00+08:00", who: "her", kind: "text", text: "开会定在十二月。" },
  { seq: 3, t: "2026-10-01T10:02:00+08:00", who: "user", kind: "text", text: "好" },
].map((x) => JSON.stringify(x)).join("\n") + "\n");
const 工作卡 = path.join(临时, "工作");
execFileSync(process.execPath, [path.join(根, "造卡.mjs"), 工作源, 工作卡], { stdio: "pipe" });

const 多 = mount多([path.join(根, "卡带样例", "桌宠"), 工作卡]);

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

记("两盘都挂上了", 多.域.length === 2, 多.域.join(" / "));
记("按域检索：开会只在「工作」", (() => { const r = 多.recall("开会", { k: 3 }); return r[0]?.域 === "工作"; })(), "");
记("按域检索：电脑只在「桌宠」", (() => { const r = 多.recall("电脑", { k: 3 }); return r[0]?.域 === "桌宠"; })(), "");
记("域过滤真的生效", 多.recall("开会", { 域: "桌宠" }).length === 0, "");
记("取帧带域", (() => { const r = 多.recall("开会", { k: 1 })[0]; const f = 多.frame(r.域, r.seq); return f.ok && f.text.includes("开会"); })(), "");
记("不存在的域报读不动", 多.frame("没有这盘", 1).读不动 === true, "");
记("brief 带上别的日子", 多.brief({ 问: "开会" }).text.includes("别的日子"), "");

多.close();
fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
