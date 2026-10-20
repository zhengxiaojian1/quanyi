// 改前必读：/root/全忆-V20/设计.md
// 通用插头：OpenAI 兼容的 /v1/chat/completions
// 覆盖：DeepSeek / Qwen / Moonshot / GLM / vLLM / Ollama / LM Studio / Together…
import fs from "node:fs";

export const 名 = "openai";
export const 上限 = { 上下文: null, 输出: null };   // 由模型自己报，不猜

export function 配置() {
  let 钥匙 = process.env.OPENAI_API_KEY ?? "";
  for (const 文件 of [process.env.OPENAI_KEY_FILE, process.env.DEEPSEEK_KEY_FILE]) {
    if (!钥匙 && 文件) { try { 钥匙 = fs.readFileSync(文件, "utf8").trim(); } catch { 钥匙 = ""; } }
  }
  return {
    base: process.env.OPENAI_BASE ?? "https://api.deepseek.com",
    模型: process.env.OPENAI_MODEL ?? process.env.DEEPSEEK_MODEL ?? "deepseek-flash",
    钥匙,
  };
}

export function 有钥匙() { return 配置().钥匙.length > 0; }

export function 构造请求({ 系统 = "", 消息 = [], 温度 = 0.7, 最大 = 2048, 思考 = false }) {
  const c = 配置();
  const messages = 系统 ? [{ role: "system", content: 系统 }, ...消息] : 消息.slice();
  return {
    url: c.base.replace(/\/$/, "") + "/v1/chat/completions",
    headers: { "content-type": "application/json", authorization: "Bearer " + c.钥匙 },
    body: {
      model: c.模型, messages, temperature: 温度, max_tokens: 最大,
      // 关思考：这是标准 OpenAI 字段，兼容服务器要么认、要么忽略
      ...(思考 ? {} : { reasoning_effort: "none" }),
    },
  };
}

export async function 说({ 系统 = "", 消息 = [], 温度 = 0.7, 最大 = 2048, 思考 = false }) {
  const 求 = 构造请求({ 系统, 消息, 温度, 最大, 思考 });
  const res = await fetch(求.url, {
    method: "POST", headers: 求.headers, body: JSON.stringify(求.body),
    signal: AbortSignal.timeout(Number(process.env.DEEPSEEK_TIMEOUT_MS ?? 60000)),
  });
  if (!res.ok) throw new Error("HTTP " + res.status + " " + (await res.text()).slice(0, 200));
  const j = await res.json();
  const m = j.choices?.[0]?.message ?? {};
  const text = m.content ?? "";
  if (!String(text).trim()) {
    const why = m.reasoning_content ? "只有 reasoning_content（思考吃掉了输出预算）" : (j.choices?.[0]?.finish_reason ?? "无 finish_reason");
    throw new Error("空 content（" + why + "）");
  }
  return {
    text,
    usage: j.usage ? { input_tokens: j.usage.prompt_tokens ?? 0, output_tokens: j.usage.completion_tokens ?? 0 } : null,
  };
}

export async function 探() {
  if (!有钥匙()) return { ok: false, why: "没有 OPENAI_API_KEY（插头未接电）" };
  const c = 配置();
  try {
    const r = await fetch(c.base.replace(/\/$/, "") + "/v1/models", { headers: { authorization: "Bearer " + c.钥匙 } });
    if (!r.ok) return { ok: false, why: "HTTP " + r.status };
    const j = await r.json();
    return { ok: true, 模型数: j.data?.length ?? 0, 模型: (j.data ?? []).map((m) => m.id).slice(0, 8) };
  } catch (e) { return { ok: false, why: String(e?.message ?? e) }; }
}

export async function 嵌入() { return null; }
