// 改前必读：/root/全忆-V20/设计.md
// DeepSeek 插头（第一根）。零依赖，只用 fetch。
// 三个已知坑写在这里，不写进卡带。

import fs from "node:fs";

export const 名 = "deepseek";
export const 上限 = { 上下文: 1_000_000, 输出: 256_000 };

export function 配置() {
  let 钥匙 = process.env.DEEPSEEK_API_KEY ?? "";
  // 优先从文件读：口令不进命令行、不进会话记录
  if (!钥匙 && process.env.DEEPSEEK_KEY_FILE) {
    try { 钥匙 = fs.readFileSync(process.env.DEEPSEEK_KEY_FILE, "utf8").trim(); } catch { 钥匙 = ""; }
  }
  return {
    base: process.env.DEEPSEEK_BASE ?? "https://api.deepseek.com/anthropic",
    模型: process.env.DEEPSEEK_MODEL ?? "deepseek-flash",
    钥匙,
  };
}

export function 有钥匙() { return 配置().钥匙.length > 0; }

/** 方言：Anthropic 兼容格式（DeepSeek 的 /anthropic 端点） */
export function 构造请求({ 系统 = "", 消息 = [], 温度 = 0.7, 最大 = 2048, 思考 = false }) {
  const c = 配置();
  const body = {
    model: c.模型,
    max_tokens: 最大,
    temperature: 温度,
    messages: 消息.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
  };
  if (系统) body.system = 系统;
  // 坑①：开/关思考必须成对，否则 200 + 空 content
  if (思考) body.thinking = { type: "enabled" };
  else { body.thinking = { type: "disabled" }; body.reasoning_effort = "off"; }
  return {
    url: c.base.replace(/\/$/, "") + "/v1/messages",
    headers: {
      "content-type": "application/json",
      "x-api-key": c.钥匙,
      "anthropic-version": "2023-06-01",
    },
    body,
  };
}

export async function 探() {
  if (!有钥匙()) return { ok: false, why: "没有 DEEPSEEK_API_KEY（插头未接电）" };
  try {
    const r = await 说({ 消息: [{ role: "user", content: "ping" }], 最大: 1, 思考: false });
    return { ok: true, 样本: r.text.slice(0, 20) };
  } catch (e) {
    return { ok: false, why: String(e?.message ?? e) };
  }
}

export async function 说({ 系统 = "", 消息 = [], 温度 = 0.7, 最大 = 2048, 思考 = false }) {
  const 求 = 构造请求({ 系统, 消息, 温度, 最大, 思考 });
  const res = await fetch(求.url, {
    method: "POST", headers: 求.headers, body: JSON.stringify(求.body),
    signal: AbortSignal.timeout(Number(process.env.DEEPSEEK_TIMEOUT_MS ?? 60000)),
  });
  if (!res.ok) throw new Error("HTTP " + res.status + " " + (await res.text()).slice(0, 200));
  const j = await res.json();
  const text = (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("");
  // 坑②：200 + 空 content 必须抛错，不许静默返回空
  if (!text.trim()) throw new Error("空 content（检查 thinking 与 reasoning_effort 是否成对）");
  return { text, usage: j.usage ?? null };
}

export async function 嵌入() { return null; } // DeepSeek 暂无嵌入端点；没有就返回 null，不假装
