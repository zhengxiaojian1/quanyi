// 改前必读：/root/全忆-V20/设计.md
// 插头 dry-run：不联网，只验请求形状与三个坑
import { 构造请求, 探, 有钥匙 } from "../adapters/deepseek.mjs";

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

const 关 = 构造请求({ 系统: "你是她", 消息: [{ role: "user", content: "在吗" }], 思考: false });
记("坑① 关思考时 reasoning_effort 必须同时 off", 关.body.thinking?.type === "disabled" && 关.body.reasoning_effort === "off", "");
const 开 = 构造请求({ 思考: true });
记("开思考时不带 reasoning_effort", 开.body.thinking?.type === "enabled" && 开.body.reasoning_effort === undefined, "");
记("model 用方言名", typeof 关.body.model === "string" && 关.body.model.length > 0, 关.body.model);
记("端点拼成 /v1/messages", 关.url.endsWith("/v1/messages"), 关.url);
记("headers 带 x-api-key / anthropic-version", "x-api-key" in 关.headers && "anthropic-version" in 关.headers, "");
记("system 走顶层字段，不进 messages", 关.body.system === "你是她" && !JSON.stringify(关.body.messages).includes("你是她"), "");

const 探结果 = 有钥匙() ? { ok: true } : await 探();
记("没有 key 时如实说未接电", 探结果.ok === true || (/未接电|DEEPSEEK_API_KEY/.test(探结果.why ?? "")), 探结果.ok ? "已接电" : 探结果.why);

console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
