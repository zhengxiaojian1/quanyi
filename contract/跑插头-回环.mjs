// 改前必读：/root/全忆-V20/设计.md
// 插头回环：本地假服务器，把「发出去」和「收回来」都真跑一遍（不花钱、不联网）
import http from "node:http";
import * as 深 from "../adapters/deepseek.mjs";

let 模式 = "正常";
let 最后请求 = null;

const 服务 = http.createServer((req, res) => {
  let 体 = "";
  req.on("data", (c) => (体 += c));
  req.on("end", () => {
    let j = {};
    try { j = JSON.parse(体 || "{}"); } catch {}
    最后请求 = { url: req.url, headers: req.headers, body: j };
    if (模式 === "401") { res.writeHead(401, { "content-type": "text/plain" }); res.end("unauthorized"); return; }
    if (模式 === "空") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ content: [] })); return; }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ content: [{ type: "text", text: "我在。" }], usage: { input_tokens: 3, output_tokens: 2 } }));
  });
});
await new Promise((r) => 服务.listen(0, "127.0.0.1", r));
process.env.DEEPSEEK_BASE = "http://127.0.0.1:" + 服务.address().port;
process.env.DEEPSEEK_API_KEY = "test-key";

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

const r = await 深.说({ 系统: "你是她", 消息: [{ role: "user", content: "在吗" }], 最大: 64 });
记("正常返回解析出文本", r.text === "我在。", r.text);
记("请求体 model 正确", 最后请求.body.model === (process.env.DEEPSEEK_MODEL ?? "deepseek-flash"), 最后请求.body.model);
记("请求体带 max_tokens", 最后请求.body.max_tokens === 64, String(最后请求.body.max_tokens));
记("坑①：thinking 与 reasoning_effort 成对", 最后请求.body.thinking?.type === "disabled" && 最后请求.body.reasoning_effort === "off", "");
记("请求头带 key 与 anthropic-version", 最后请求.headers["x-api-key"] === "test-key" && !!最后请求.headers["anthropic-version"], "");
记("路径是 /v1/messages", 最后请求.url === "/v1/messages", 最后请求.url);

模式 = "空";
let 空错 = null;
try { await 深.说({ 消息: [{ role: "user", content: "x" }] }); } catch (e) { 空错 = String(e.message); }
记("坑②：200 + 空 content 必须抛错", /空 content/.test(空错 ?? ""), 空错 ?? "没抛");

模式 = "401";
let 错 = null;
try { await 深.说({ 消息: [{ role: "user", content: "x" }] }); } catch (e) { 错 = String(e.message); }
记("HTTP 401 抛错且带状态码", /HTTP 401/.test(错 ?? ""), 错 ?? "没抛");

模式 = "正常";
const 探 = await 深.探();
记("有 key 时 探() 通", 探.ok === true, JSON.stringify(探));

服务.close();
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
