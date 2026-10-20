// 改前必读：/root/全忆-V20/设计.md
// 装插件前就聊了很久：把宿主会话日志整份导进卡带，不用用户导出
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zstdCompressSync } from "node:zlib";
import { mount } from "../读我.mjs";
import { 找日志, 读会话 } from "../从宿主导入.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "宿主-"));
const 家 = path.join(临时, "dsh");
const 会话 = path.join(家, "sessions", "--工作区--", "session-abc123");
fs.mkdirSync(会话, { recursive: true });

const 事件 = [
  { type: "session", version: 4, id: "session-abc123" },
  { type: "user/message", seq: 1, time: 1792200000000, data: { source: { kind: "user" }, content: [{ type: "text", text: "我想做个桌宠" }] } },
  { type: "assistant/message", seq: 2, time: 1792200001000, data: { message: { content: [{ type: "reasoning", text: "想想" }, { type: "text", text: "先别想美术，跑通再说。" }] } } },
  { type: "user/message", seq: 3, time: 1792200002000, data: { source: { kind: "user" }, content: [{ type: "text", text: "动了" }] } },
  { type: "assistant/message", seq: 4, time: 1792200003000, data: { message: { content: [{ type: "text", text: "有点像活着。" }] } } },
  { type: "user/message", seq: 5, time: 1792200004000, data: { source: { kind: "developer" }, content: [{ type: "text", text: "系统注入，不该进卡带" }] } },
];
fs.writeFileSync(path.join(会话, "session.v4.jsonl.zstd"), zstdCompressSync(Buffer.from(事件.map((x) => JSON.stringify(x)).join("\n") + "\n")));

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

const 路 = 找日志("session-abc123", 家);
记("按会话 id 找得到日志", !!路 && 路.endsWith("session.v4.jsonl.zstd"), 路 ?? "没找到");
const 读 = 读会话(路);
记("多帧 zstd 能读", 读.格式 === "dsh", 读.格式 + " · 坏帧 " + 读.坏帧);
const 帧 = 读.帧;
记("只留真正的对话（developer 注入被丢掉）", 帧.length === 4 && !帧.some((x) => x.text.includes("系统注入")), 帧.length + " 帧");
记("reasoning 不混进正文", !帧.some((x) => x.text.includes("想想")), "");

const 卡带 = path.join(临时, "卡带");
execFileSync(process.execPath, [path.join(根, "从宿主导入.mjs"), 路, 卡带], { stdio: "pipe" });
const h = mount(卡带);
记("整份历史进了卡带", h.manifest.帧数 === 4, "帧 " + h.manifest.帧数);
记("老对话能检索", h.recall("桌宠", 2).length > 0 && h.recall("桌宠", 2)[0].seq === 1, "");
h.close();

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
