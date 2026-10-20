// 改前必读：/root/全忆-V20/设计.md
// 通用会话读取器：DSH 日志 / 导出的 Markdown / 通用 JSON / JSONL / ChatGPT 导出
// 统一产出：[{seq, t, who, text}]
import fs from "node:fs";
import path from "node:path";
import { zstdDecompressSync } from "node:zlib";

const 魔 = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

function 解多帧(b) {
  const 位 = [];
  for (let i = 0; i <= b.length - 4; i++) if (b[i] === 0x28 && b[i + 1] === 0xb5 && b[i + 2] === 0x2f && b[i + 3] === 0xfd) 位.push(i);
  let 文 = "", 坏 = 0;
  for (let k = 0; k < 位.length; k++) {
    const 起 = 位[k], 止 = 位[k + 1] ?? b.length;
    try { 文 += zstdDecompressSync(b.subarray(起, 止)).toString("utf8"); } catch { 坏++; }
  }
  return { 文, 坏 };
}

const 文本 = (块) => (块 ?? []).filter((c) => c?.type === "text" && c.text).map((c) => c.text).join("\n").trim();

function 正角色(r) {
  const s = String(r ?? "").toLowerCase();
  if (["user", "human", "你", "他"].includes(s)) return "user";
  if (["assistant", "ai", "model", "bot", "gpt", "claude", "her", "她", "我"].includes(s)) return "her";
  return "";
}

function 通用消息(列) {
  const out = [];
  for (const m of 列) {
    if (!m || typeof m !== "object") continue;
    const who = 正角色(m.role ?? m.author ?? m.from ?? m.speaker ?? m.who);
    let 文 = "";
    if (typeof m.content === "string") 文 = m.content;
    else if (Array.isArray(m.content)) 文 = 文本(m.content);
    else if (typeof m.text === "string") 文 = m.text;
    else if (m.content?.parts) 文 = m.content.parts.filter((x) => typeof x === "string").join("\n");
    if (!who || !文.trim()) continue;
    out.push({ who, t: m.time ?? m.t ?? m.created_at ?? m.create_time ?? m.timestamp ?? null, text: 文.trim() });
  }
  return out;
}

function 读DSH(文) {
  const 事件 = 文.split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const out = [];
  for (const o of 事件) {
    if (o.type === "user/message" && o.data?.source?.kind === "user") {
      const t = 文本(o.data.content);
      if (t) out.push({ who: "user", t: o.time, text: t });
    } else if (o.type === "assistant/message") {
      const t = 文本(o.data?.message?.content);
      if (t) out.push({ who: "her", t: o.time, text: t });
    }
  }
  return out;
}

function 读Markdown(文) {
  const 头 = /^### (.+?) · (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})Z$/;
  const out = [];
  let 谁 = "", 时 = null, 体 = [];
  const 落 = () => {
    const t = 体.join("\n").trim();
    体 = [];
    if (!谁 || !t) return;
    out.push({ who: 谁, t: 时, text: t });
  };
  for (const 行 of 文.split("\n")) {
    const m = 行.match(头);
    if (m) { 落(); 谁 = /助手|assistant|ai/i.test(m[1]) ? "her" : "user"; 时 = m[2] + "T" + m[3] + "Z"; continue; }
    体.push(行);
  }
  落();
  return out;
}

function 读ChatGPT(j) {
  const out = [];
  const 列 = Array.isArray(j) ? j : (j.conversations ?? []);
  for (const c of 列) {
    const 映 = c?.mapping;
    if (!映) continue;
    const 按时间 = Object.values(映).filter((n) => n?.message).sort((a, b) => (a.message.create_time ?? 0) - (b.message.create_time ?? 0));
    for (const n of 按时间) {
      const m = n.message;
      const who = 正角色(m.author?.role);
      const 文 = (m.content?.parts ?? []).filter((x) => typeof x === "string").join("\n").trim();
      if (who && 文) out.push({ who, t: (m.create_time ?? 0) * 1000, text: 文 });
    }
  }
  return out;
}

export function 识别(路) {
  const 头 = fs.readFileSync(路).subarray(0, 4);
  if (头.equals(魔) || 路.endsWith(".zstd")) return "dsh";
  if (路.endsWith(".md")) return "markdown";
  if (路.endsWith(".jsonl")) return "jsonl";
  if (路.endsWith(".json")) return "json";
  return "未知";
}

export function 读任意(路) {
  const 格式 = 识别(路);
  const 原 = fs.readFileSync(路);
  let 消息 = [];
  let 坏帧 = 0;
  if (格式 === "dsh") {
    const { 文, 坏 } = 解多帧(原);
    坏帧 = 坏;
    消息 = 读DSH(文);
  } else if (格式 === "markdown") {
    消息 = 读Markdown(原.toString("utf8"));
  } else if (格式 === "jsonl") {
    消息 = 通用消息(原.toString("utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }));
  } else if (格式 === "json") {
    const j = JSON.parse(原.toString("utf8"));
    if (Array.isArray(j) && j[0]?.mapping) 消息 = 读ChatGPT(j);
    else if (j?.conversations) 消息 = 读ChatGPT(j);
    else if (Array.isArray(j?.messages)) 消息 = 通用消息(j.messages);
    else if (Array.isArray(j)) 消息 = 通用消息(j);
  }

  const 帧 = [];
  let seq = 0;
  for (const m of 消息) {
    seq++;
    帧.push({ seq, t: m.t ? new Date(m.t).toISOString() : new Date(0).toISOString(), who: m.who, kind: "text", text: m.text });
  }
  return { 格式, 帧, 坏帧, path: path.resolve(路) };
}

if (process.argv[1] && path.basename(process.argv[1]) === "读取器.mjs") {
  const 路 = process.argv[2];
  if (!路) { console.error("用法: node 读取器.mjs <文件>"); process.exit(2); }
  const r = 读任意(路);
  console.log("格式: " + r.格式 + " · 帧: " + r.帧.length + (r.坏帧 ? " · 坏帧: " + r.坏帧 : ""));
  for (const f of r.帧.slice(0, 3)) console.log("[" + f.seq + "] " + f.who + " · " + f.text.slice(0, 60));
}
