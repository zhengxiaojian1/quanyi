// 改前必读：/root/全忆-V20/设计.md
// 事实路由：问「约定/说好/提醒」时直接端未清账的出处，不靠词面碰运气
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mount } from "../读我.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "路由-"));
const 卡带 = path.join(临时, "卡");
fs.cpSync(path.join(根, "卡带样例", "桌宠"), 卡带, { recursive: true });
for (const f of fs.readdirSync(path.join(卡带, "facts"))) fs.rmSync(path.join(卡带, "facts", f));
execFileSync(process.execPath, [path.join(根, "呼吸.mjs"), 卡带], { stdio: "pipe" });

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };
const h = mount(卡带);

记("问「约定」直接端出那句原话", h.recall("我们约定了什么", 3)[0]?.seq === 82, JSON.stringify(h.recall("我们约定了什么", 3).map((x) => x.seq)));
记("「提醒我」也走这条路", h.recall("提醒我一下", 3).some((x) => x.seq === 82), "");
记("「说好的事」也走", h.recall("说好的事", 3).some((x) => x.seq === 82), "");
记("无关的问题不触发路由", h.recall("量子纠缠", 3).length === 0, "");
记("普通问题照旧走词法", h.recall("参数改成多少", 3)[0]?.seq === 21, JSON.stringify(h.recall("参数改成多少", 3).map((x) => x.seq)));
h.close();

// 没有承诺的卡带：不崩、不瞎给
const 空 = path.join(临时, "空");
fs.mkdirSync(空);
fs.writeFileSync(path.join(临时, "e.jsonl"), JSON.stringify({ seq: 1, t: "2026-10-01T10:00:00+08:00", who: "user", kind: "text", text: "随便聊聊" }) + "\n");
execFileSync(process.execPath, [path.join(根, "造卡.mjs"), path.join(临时, "e.jsonl"), 空], { stdio: "pipe" });
const h2 = mount(空);
记("没有承诺时问约定不会崩", Array.isArray(h2.recall("我们约定了什么", 3)), "");
h2.close();

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
