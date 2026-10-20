// 改前必读：/root/全忆-V20/设计.md
// 通用读取器：同一个入口吃四种格式，产出同一种帧
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { zstdCompressSync } from "node:zlib";
import { 读任意, 识别 } from "../读取器.mjs";

const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "读取器-"));
let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

// 1) Markdown 导出
const md = path.join(临时, "a.md");
fs.writeFileSync(md, [
  "### 🤖 助手 · 2026-10-01 10:00:00Z", "", "先别想美术。", "",
  "### 👤 用户 · 2026-10-01 10:01:00Z", "", "动了。", "",
].join("\n"));
const r1 = 读任意(md);
记("Markdown 认得角色", r1.格式 === "markdown" && r1.帧[0].who === "her" && r1.帧[1].who === "user", JSON.stringify(r1.帧.map((x) => x.who)));

// 2) 通用 JSONL
const jl = path.join(临时, "b.jsonl");
fs.writeFileSync(jl, [
  JSON.stringify({ role: "user", content: "你好", time: "2026-10-02T10:00:00Z" }),
  JSON.stringify({ role: "assistant", content: [{ type: "text", text: "在。" }] }),
].join("\n") + "\n");
const r2 = 读任意(jl);
记("JSONL 认得", r2.格式 === "jsonl" && r2.帧.length === 2 && r2.帧[1].text === "在。", "");

// 3) 通用 JSON（messages）
const js = path.join(临时, "c.json");
fs.writeFileSync(js, JSON.stringify({ messages: [{ role: "human", content: "嗨" }, { role: "ai", content: "嗯" }] }));
const r3 = 读任意(js);
记("JSON messages 认得（human/ai 也认）", r3.帧.length === 2 && r3.帧[0].who === "user" && r3.帧[1].who === "her", "");

// 4) ChatGPT 导出
const cg = path.join(临时, "d.json");
fs.writeFileSync(cg, JSON.stringify([{ title: "t", mapping: {
  a: { message: { author: { role: "user" }, content: { parts: ["我想做个桌宠"] }, create_time: 1 } },
  b: { message: { author: { role: "assistant" }, content: { parts: ["先跑通"] }, create_time: 2 } },
} }]));
const r4 = 读任意(cg);
记("ChatGPT 导出认得（按 create_time 排）", r4.帧.length === 2 && r4.帧[0].text === "我想做个桌宠" && r4.帧[1].who === "her", "");

// 5) DSH 多帧 zstd
const ds = path.join(临时, "e.zstd");
fs.writeFileSync(ds, zstdCompressSync(Buffer.from([
  { type: "user/message", time: 1792200000000, data: { source: { kind: "user" }, content: [{ type: "text", text: "问题" }] } },
  { type: "assistant/message", time: 1792200001000, data: { message: { content: [{ type: "reasoning", text: "想" }, { type: "text", text: "回答" }] } } },
].map((x) => JSON.stringify(x)).join("\n") + "\n")));
const r5 = 读任意(ds);
记("DSH 日志认得，reasoning 不进正文", r5.格式 === "dsh" && r5.帧.length === 2 && r5.帧[1].text === "回答", "");

const 怪 = path.join(临时, "x.bin");
fs.writeFileSync(怪, Buffer.from([1, 2, 3, 4]));
记("认不出来就说未知，不瞎猜", 识别(怪) === "未知", 识别(怪));

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
