// 改前必读：/root/全忆-V20/设计.md
// 通用插头（OpenAI 兼容）回环：形状、关思考、choices 解析、空 content、401
import http from "node:http";
import * as 开 from "../adapters/openai.mjs";

let 模式 = "正常";
let 最后 = null;
const 服务 = http.createServer((req, res) => {
  let 体 = "";
  req.on("data", (c) => (体 += c));
  req.on("end", () => {
    if (req.url.endsWith("/models")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ object: "list", data: [{ id: "m-a" }, { id: "m-b" }] }));
      return;
    }
    最后 = { url: req.url, headers: req.headers, body: JSON.parse(体 || "{}") };
    if (模式 === "401") { res.writeHead(401); res.end("no"); return; }
    if (模式 === "空") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "", reasoning_content: "想了很久" }, finish_reason: "length" }] }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "我在。" }, finish_reason: "stop" }], usage: { prompt_tokens: 3, completion_tokens: 2 } }));
  });
});
await new Promise((r) => 服务.listen(0, "127.0.0.1", r));
process.env.OPENAI_BASE = "http://127.0.0.1:" + 服务.address().port;
process.env.OPENAI_API_KEY = "test-key";

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

const r = await 开.说({ 系统: "你是她", 消息: [{ role: "user", content: "在吗" }], 最大: 64 });
记("正常返回解析出文本", r.text === "我在。", r.text);
记("usage 映射成 input/output", r.usage.input_tokens === 3 && r.usage.output_tokens === 2, JSON.stringify(r.usage));
记("system 放进 messages[0]", 最后.body.messages[0].role === "system" && 最后.body.messages[0].content === "你是她", "");
记("关思考时带 reasoning_effort=none", 最后.body.reasoning_effort === "none", "");
记("Authorization 用 Bearer", 最后.headers.authorization === "Bearer test-key", "");
记("路径是 /v1/chat/completions", 最后.url === "/v1/chat/completions", 最后.url);
记("max_tokens 传下去了", 最后.body.max_tokens === 64, String(最后.body.max_tokens));

await 开.说({ 思考: true, 消息: [{ role: "user", content: "x" }] });
记("开思考时不带 reasoning_effort", 最后.body.reasoning_effort === undefined, "");

模式 = "空";
let 错 = null;
try { await 开.说({ 消息: [{ role: "user", content: "x" }] }); } catch (e) { 错 = String(e.message); }
记("空 content 抛错，并说清是思考吃掉了预算", /空 content/.test(错 ?? "") && /reasoning_content/.test(错 ?? ""), 错 ?? "没抛");

模式 = "401";
错 = null;
try { await 开.说({ 消息: [{ role: "user", content: "x" }] }); } catch (e) { 错 = String(e.message); }
记("HTTP 401 抛错", /HTTP 401/.test(错 ?? ""), 错 ?? "没抛");

const 探 = await 开.探();
记("探() 能列出模型", 探.ok === true && 探.模型数 === 2, JSON.stringify(探.模型));

服务.close();
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
