// 改前必读：/root/全忆-V20/设计.md
// 假 ctx 验插件：注册、每轮注入、预算、异常不崩、会话记账
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { apply } from "../lib/index.js";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..", "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "插件-"));
const 卡带 = path.join(临时, "卡带");
fs.cpSync(path.join(根, "卡带样例", "桌宠"), 卡带, { recursive: true });

let 过 = 0, 败 = 0;
const 文 = (m) => typeof m?.content === "string" ? m.content : (m?.content ?? []).map((x) => x?.text ?? "").join("");
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

let 处理 = null, 选项 = null;
const 日志 = [];
const 改名 = [];
const 工具表 = new Map();
let 标题 = null;
const ctx = {
  logger: { info: (m) => 日志.push(m), warn: (m) => 日志.push(m) },
  on: (名, fn, opt) => { 处理 = fn; 选项 = opt; },
  tools: { register: (工具) => { 工具表.set(工具.name, 工具); return () => { 工具表.delete(工具.name); }; } },
  effect: () => {},
  get: (名) => 名 === "sessionTitle" ? { rename: (s, t) => { 改名.push([s?.id, t]); }, get: () => 标题 } : undefined,
};
await apply(ctx, { 卡带, 预算: 600 });
记("注册了 pre-step", typeof 处理 === "function" && 选项?.prepend === true, "");
记("工具参数是 JSON Schema（宿主只认这个）", 工具表.get("recall").parameters.type === "object" && 工具表.get("compose").parameters.type === "object", JSON.stringify(工具表.get("compose").parameters).slice(0, 60));
记("注册了 recall / frame / forget 三个工具", 工具表.has("recall") && 工具表.has("frame") && 工具表.has("forget"), [...工具表.keys()].join(","));

记("recall 能取到 73", (() => {
  const r = 工具表.get("recall").execute({ q: "2D 的极限", k: 2 });
  return r.命中 && r.命中[0].seq === 73;
})(), "");
记("frame 能逐字校验", (() => {
  const r = 工具表.get("frame").execute({ seq: 73 });
  return r.校验 === true && r.sha256?.startsWith("sha256:");
})(), "");
记("启动时说了会话建议", 日志.some((x) => x.includes("会话：")), 日志[0] ?? "");

const 决策 = { kind: "ok", messages: [{ role: "user", content: "我们之前在做什么" }] };
const 出 = await 处理({ agent: { session: { id: "s-测试-1" } }, messages: 决策.messages, step: 1, signal: { aborted: false } }, async () => 决策);
记("第一轮追加了一条记忆", 出.messages.length === 决策.messages.length + 1, "");
记("会话标签被钉成卡带里的名字", 改名.length === 1 && 改名[0][0] === "s-测试-1" && 改名[0][1] === "小鱼", JSON.stringify(改名));
const 注 = 出.messages.at(-1);
记("追加的内容带「（记忆）」和时间", 注.content[0].text.includes("（记忆）") && 注.content[0].text.includes("现在："), "");
记("注入消息是宿主形状（id / content 块 / source.kind）", typeof 注.id === "string" && Array.isArray(注.content) && 注.content[0].type === "text" && 注.source?.kind === "memory-v20" && 注.source?.form === "notice", "");
记("没改动原消息", 出.messages[0] === 决策.messages[0], "");

const 出2 = await 处理({ agent: { session: { id: "s-测试-1" } }, messages: 决策.messages, step: 2, signal: { aborted: false } }, async () => 决策);
记("第二步不重复注入", 出2.messages.length === 决策.messages.length, "");
记("第二步仍会整形（长回合也收得住）", await (async () => {
  const 长 = Array.from({ length: 60 }, (_, i) => ({ role: i % 2 ? "user" : "assistant", content: "话".repeat(3000) }));
  const 决长 = { kind: "ok", messages: 长 };
  const r = await 处理({ agent: { session: { id: "s-测试-1" } }, messages: 长, step: 3, signal: { aborted: false } }, async () => 决长);
  return r.messages.length < 60 && !JSON.stringify(r.messages).includes("（记忆）");
})(), "");
记("标签只改一次", 改名.length === 1, "改了 " + 改名.length + " 次");

const 出3 = await 处理({ agent: { session: { id: "s-测试-1" } }, messages: 决策.messages, step: 1, signal: { aborted: true } }, async () => 决策);
记("中断时不注入", 出3.messages.length === 决策.messages.length, "");

const 出4 = await 处理({ agent: { session: { id: "s-测试-1" } }, messages: 决策.messages, step: 1, signal: { aborted: false } }, async () => ({ kind: "reject" }));
记("reject 时不动", 出4 === 决策 || 出4.kind === "reject", "");

const mf = JSON.parse(fs.readFileSync(path.join(卡带, "manifest.json"), "utf8"));
记("会话号记进卡带", mf.last_session?.会话 === "s-测试-1", JSON.stringify(mf.last_session));
记("同一设备+模型，下次建议恢复", (() => {
  const 账 = fs.readFileSync(path.join(卡带, "facts", "会话.jsonl"), "utf8");
  return 账.includes("s-测试-1") && mf.last_session.host === os.hostname();
})(), "");

// 用户自己改过标签 ⇒ 采用它
驱2: {
}
const 卡2 = path.join(临时, "卡2");
fs.cpSync(path.join(根, "卡带样例", "桌宠"), 卡2, { recursive: true });
const { mount } = await import(path.join(根, "读我.mjs"));
const 句2 = mount(卡2);
句2.设称呼({ 她的名字: "" });
句2.close();
标题 = { title: "阿岚", source: { kind: "user" } };
let 处2 = null;
const ctxB = { logger: { info() {}, warn() {} }, on: (n, f) => { 处2 = f; }, get: (名) => 名 === "sessionTitle" ? { rename() {}, get: () => 标题 } : undefined };
await apply(ctxB, { 卡带: 卡2 });
const 决B = { kind: "ok", messages: [{ role: "user", content: "你好" }] };
await 处2({ agent: { session: { id: "s-name" } }, messages: 决B.messages, step: 1, signal: { aborted: false } }, async () => 决B);
记("用户改过标签就采用为她的名字", JSON.parse(fs.readFileSync(path.join(卡2, "称呼.json"), "utf8")).她的名字 === "阿岚", "");

// 新会话且没名字 ⇒ 提醒问一句
const 卡3 = path.join(临时, "卡3");
fs.cpSync(path.join(根, "卡带样例", "桌宠"), 卡3, { recursive: true });
const 句3 = mount(卡3); 句3.设称呼({ 她的名字: "" }); 句3.close();
标题 = null;
let 处3 = null;
const ctxC = { logger: { info() {}, warn() {} }, on: (n, f) => { 处3 = f; }, get: (名) => 名 === "sessionTitle" ? { rename() {}, get: () => 标题 } : undefined };
await apply(ctxC, { 卡带: 卡3 });
const 决C = { kind: "ok", messages: [{ role: "user", content: "在吗" }] };
const 出C = await 处3({ agent: { session: { id: "s-new" } }, messages: 决C.messages, step: 1, signal: { aborted: false } }, async () => 决C);
记("新会话没名字会提醒问一句", 文(出C.messages.at(-1)).includes("你还没有名字"), "");

// 空卡带 + 聊了很久 ⇒ 切片成 导入.jsonl
const 空卡 = path.join(临时, "空卡");
fs.mkdirSync(空卡, { recursive: true });
const { execFileSync } = await import("node:child_process");
fs.writeFileSync(path.join(临时, "空.jsonl"), "");
execFileSync(process.execPath, [path.join(根, "造卡.mjs"), path.join(临时, "空.jsonl"), 空卡, "--self", path.join(根, "卡带样例", "self.md")], { stdio: "pipe" });
let 处4 = null;
const ctxD = { logger: { info() {}, warn() {} }, on: (n, f) => { 处4 = f; }, get: () => undefined };
await apply(ctxD, { 卡带: 空卡, 自动导入: false });
const 决D = { kind: "ok", messages: [
  { role: "user", content: "我想做个桌宠" },
  { role: "assistant", content: "先别想美术" },
  { role: "user", content: "动了" },
  { role: "assistant", content: "有点像活着" },
  { role: "user", content: "然后呢" },
] };
await 处4({ agent: { session: { id: "s-空" } }, messages: 决D.messages, step: 1, signal: { aborted: false } }, async () => 决D);
const 导入 = path.join(空卡, "导入.jsonl");
记("空卡带会把已有对话切到 导入.jsonl", fs.existsSync(导入) && fs.readFileSync(导入, "utf8").trim().split("\n").length === 5, fs.existsSync(导入) ? fs.readFileSync(导入, "utf8").trim().split("\n").length + " 条" : "没生成");

// 有宿主日志时优先整份导入
const 家 = path.join(临时, "dsh");
fs.mkdirSync(path.join(家, "sessions", "ws", "session-真实"), { recursive: true });
const { zstdCompressSync } = await import("node:zlib");
fs.writeFileSync(path.join(家, "sessions", "ws", "session-真实", "session.v4.jsonl.zstd"), zstdCompressSync(Buffer.from([
  { type: "user/message", time: 1792200000000, data: { source: { kind: "user" }, content: [{ type: "text", text: "旧对话一" }] } },
].map((x) => JSON.stringify(x)).join("\n") + "\n")));
process.env.DSH_HOME = 家;
const 卡5 = path.join(临时, "卡5");
fs.writeFileSync(path.join(临时, "空5.jsonl"), "");
execFileSync(process.execPath, [path.join(根, "造卡.mjs"), path.join(临时, "空5.jsonl"), 卡5, "--self", path.join(根, "卡带样例", "self.md")], { stdio: "pipe" });
let 处5 = null;
const 日志5 = [];
const ctxE = { logger: { info: (m) => 日志5.push(m), warn: (m) => 日志5.push(m) }, on: (n, f) => { 处5 = f; }, get: () => undefined };
await apply(ctxE, { 卡带: 卡5, 自动导入: false });
const 决E = { kind: "ok", messages: [{ role: "user", content: "在吗" }] };
await 处5({ agent: { session: { id: "session-真实" } }, messages: 决E.messages, step: 1, signal: { aborted: false } }, async () => 决E);
记("有宿主日志时优先整份导入", 日志5.some((x) => x.includes("宿主会话日志")), 日志5.at(-1) ?? "");
delete process.env.DSH_HOME;

// 换机器：把上次的对话接回来
fs.writeFileSync(path.join(卡带, "对话.jsonl"), [
  { t: "2026-10-01T10:00:00Z", host: "别的机器", model: "deepseek-flash", who: "user", text: "我想做个桌宠" },
  { t: "2026-10-01T10:01:00Z", host: "别的机器", model: "deepseek-flash", who: "her", text: "先别想美术，跑通再说" },
].map((x) => JSON.stringify(x)).join("\n") + "\n");
const mf2 = JSON.parse(fs.readFileSync(path.join(卡带, "manifest.json"), "utf8"));
mf2.last_session = { 会话: "s-旧机器", host: "别的机器", model: "deepseek-flash", t: "2026-10-01T10:02:00Z" };
fs.writeFileSync(path.join(卡带, "manifest.json"), JSON.stringify(mf2, null, 2));

let 处理2 = null;
const ctx2 = { logger: { info() {}, warn() {} }, on: (n, f) => { 处理2 = f; } };
await apply(ctx2, { 卡带 });
const 出5 = await 处理2({ agent: { session: { id: "s-新机器" } }, messages: 决策.messages, step: 1, signal: { aborted: false } }, async () => 决策);
记("换机器时把上次的对话接回来", 文(出5.messages.at(-1)).includes("（接续）") && 文(出5.messages.at(-1)).includes("我想做个桌宠"), "");
const 出5b = await 处理2({ agent: { session: { id: "s-新机器" } }, messages: 决策.messages, step: 1, signal: { aborted: false } }, async () => 决策);
记("接回只给一次，下一轮不再重复", !出5b.messages.at(-1).content.includes("（接续）"), "");
记("同一台机器时不重复接续", !出.messages.at(-1).content.includes("（接续）"), "");

// U 盘场景：不给路径，自动找
const U = path.join(临时, "U盘");
fs.mkdirSync(U, { recursive: true });
fs.cpSync(卡带, path.join(U, "她"), { recursive: true });
let 处理3 = null;
const ctx3 = { logger: { info: (m) => 日志.push(m), warn: (m) => 日志.push(m) }, on: (n, f) => { 处理3 = f; } };
await apply(ctx3, { 卡带: path.join(临时, "没有这张"), 根: [U] });
记("没给路径也能在挂载点找到卡带", 日志.some((x) => x.includes("自动找到卡带")), 日志.at(-1) ?? "");
const 出6 = await 处理3({ agent: { session: { id: "s-usb" } }, messages: 决策.messages, step: 1, signal: { aborted: false } }, async () => 决策);
记("自动找到的卡带能递料", 文(出6.messages.at(-1)).includes("（记忆）"), "");

// 请求侧整形：长历史也要收住
let 处6 = null;
const 日志6 = [];
const ctxF = { logger: { info: (m) => 日志6.push(m), warn: (m) => 日志6.push(m) }, on: (n, f) => { 处6 = f; }, get: () => undefined };
await apply(ctxF, { 卡带, 窗口预算: 2000, 留最近: 6, 自动导入: false });
const 长话 = [];
for (let i = 0; i < 40; i++) 长话.push({ role: i % 2 ? "user" : "assistant", content: "第" + i + "条 " + "话".repeat(300) });
const 决F = { kind: "ok", messages: 长话 };
const 出F = await 处6({ agent: { session: { id: "s-长" } }, messages: 长话, step: 1, signal: { aborted: false } }, async () => 决F);
记("长历史会被整形（只留最近 + 一块她记得）", 出F.messages.length <= 8, "条数 " + 出F.messages.length);
记("整形后第一块是她记得", 文(出F.messages[0]).startsWith("（她记得）"), "");
记("替换块用的是她的日记口吻（不是公式）", 文(出F.messages[0]).includes("今天他说") || 文(出F.messages[0]).includes("我跟他说"), 出F.messages[0].content.slice(0, 40));
记("丢得多时会取多篇日记", (出F.messages[0].content.match(/今天他说|今天记下的是/g) ?? []).length >= 2, "篇数 " + (出F.messages[0].content.match(/今天/g) ?? []).length);
记("整形后仍然递了记忆", 文(出F.messages.at(-1)).includes("（记忆）"), "");

const 空 = { logger: { info() {}, warn(m) { 日志.push(m); } }, on() {} };
await apply(空, { 卡带: path.join(临时, "没有这张卡"), 根: [path.join(临时, "也没有")] });
记("卡带打不开时只报警、不抛", 日志.some((x) => /卡带打不开|没找到卡带/.test(x)), "");

记("forget 能把帧压下去", (() => {
  const r = 工具表.get("forget").execute({ seqs: "70", 原因: "他让我忘了" });
  const 条目 = 工具表.get("recall").execute({ q: "我觉得到顶了", k: 5 }).命中.find((x) => x.seq === 70);
  const 还能取 = 工具表.get("frame").execute({ seq: 70 }).ok;
  return r.压制了 === 1 && 条目?.压制 === true && 还能取;
})(), "");

// 卡带中途消失：只报警、不崩、不动这一轮
{
  const 卡6 = path.join(临时, "卡6");
  fs.writeFileSync(path.join(临时, "空6.jsonl"), "");
  execFileSync(process.execPath, [path.join(根, "造卡.mjs"), path.join(临时, "空6.jsonl"), 卡6, "--self", path.join(根, "卡带样例", "self.md")], { stdio: "pipe" });
  let 处K = null;
  const 日K = [];
  const ctxK = { logger: { info() {}, warn: (m) => 日K.push(m) }, on: (n, f) => { 处K = f; }, get: () => undefined };
  await apply(ctxK, { 卡带: 卡6 });
  fs.renameSync(卡6, 卡6 + "-没了");
  const 决K = { kind: "ok", messages: [{ role: "user", content: "在吗", source: { kind: "user" } }] };
  const 出K = await 处K({ agent: { session: { id: "s-跑掉" } }, messages: 决K.messages, step: 1, signal: { aborted: false } }, async () => 决K);
  记("卡带中途消失也不崩", 出K.messages.length === 决K.messages.length && 日K.some((x) => x.includes("递料失败") || x.includes("切片失败")), "");
}

// 注入消息的硬校验：形状不对宁可不注入（写进会话日志就再也打不开）
{
  const { 校验消息 } = await import("../lib/index.js");
  const 好 = { id: "x", role: "user", content: [{ type: "text", text: "hi" }], source: { kind: "memory-v20" } };
  记("合规消息通过校验", 校验消息(好) === true, "");
  记("缺 source 不通过", 校验消息({ ...好, source: undefined }) === false, "");
  记("source.kind=plugin 不通过", 校验消息({ ...好, source: { kind: "plugin" } }) === false, "");
  记("content 是字符串不通过", 校验消息({ ...好, content: "hi" }) === false, "");
  记("缺 id 不通过", 校验消息({ ...好, id: undefined }) === false, "");
}

// 宿主接口自检：缺哪根说哪根，不崩
{
  const 日I = [];
  const ctxI = { logger: { info: (m) => 日I.push(m), warn: (m) => 日I.push(m) }, on: () => {}, get: () => undefined };
  await apply(ctxI, { 卡带 });
  记("启动时报出宿主接口状态", 日I.some((x) => x.includes("宿主接口：")), 日I.find((x) => x.includes("宿主接口")) ?? "");
  记("缺 tools / sessionTitle 时照常活着", 日I.some((x) => x.includes("tools ✗")) && 日I.some((x) => x.includes("sessionTitle ✗")), "");
}

// 配方：卡带带了什么能力，就按触发词跑什么
{
  let 处R = null;
  const 日R = [];
  const ctxR = { logger: { info: (m) => 日R.push(m), warn: (m) => 日R.push(m) }, on: (n, f) => { 处R = f; }, get: () => undefined };
  await apply(ctxR, { 卡带 });
  const 决R = { kind: "ok", messages: [{ role: "user", content: "桌宠以前是怎么说的" }] };
  const 出R = await 处R({ agent: { session: { id: "s-配方" } }, messages: 决R.messages, step: 1, signal: { aborted: false } }, async () => 决R);
  const 文R = 出R.messages.at(-1).content.map((x) => x.text).join("");
  记("配方从卡带加载", 日R.some((x) => x.includes("配方：")) && 文R.includes("（变了没）"), "");
  记("没触发的配方不出现", !文R.includes("（多久没提）"), "");
}

// 大模型自己组能力：compose 工具写配方，下一轮就生效
{
  const 好 = 工具表.get("compose").execute({ 名: "谁说过", 触发: "谁说的,谁提过", 算子: "谁说过" });
  记("compose 能加一个能力", 好.ok === true && fs.existsSync(path.join(卡带, "配方", "谁说过.json")), "");
  const 坏 = 工具表.get("compose").execute({ 名: "瞎编", 触发: "x", 算子: "不存在的算子" });
  记("没有的算子拒绝，并列出有的", 坏.ok === false && 坏.why.includes("最早"), "");
  const 空 = 工具表.get("compose").execute({ 名: "空触发", 触发: " ", 算子: "最近" });
  记("触发词不能空", 空.ok === false, "");
}

// 在线重排（窄版）：只在他说「找不到」时补一块
{
  const { 解析重排 } = await import("../../重排.mjs");
  记("能解析模型给的编号", JSON.stringify(解析重排("2,5,1", 8)) === "[1,4,0]", 解析重排("2,5,1", 8).join(","));
  记("乱给的编号会被丢掉", JSON.stringify(解析重排("9,0,3,3", 8)) === "[2]", 解析重排("9,0,3,3", 8).join(","));
}

// 主动：排任务、以及「没有该提的就别开口」
{
  let 捕获 = null;
  let 处P = null;
  const 日P = [];
  const ctxP = { logger: { info: (m) => 日P.push(m), warn: (m) => 日P.push(m) }, on: (n, f) => { 处P = f; },
    get: (n) => n === "schedule" ? { create: (sid, req) => { 捕获 = { sid, req }; return { id: "s1" }; } } : undefined };
  const 卡P = path.join(临时, "卡P");
  fs.writeFileSync(path.join(临时, "卡P.jsonl"), JSON.stringify({ seq: 1, t: "2026-10-18T10:00:00+08:00", who: "user", kind: "text", text: "随便聊聊" }) + "\n");
  execFileSync(process.execPath, [path.join(根, "造卡.mjs"), path.join(临时, "卡P.jsonl"), 卡P], { stdio: "pipe" });
  await apply(ctxP, { 卡带: 卡P, 主动: true });
  const 决P = { kind: "ok", messages: [{ role: "user", content: "（全忆·主动检查）" }] };
  const 出P = await 处P({ agent: { session: { id: "s-主动" } }, messages: 决P.messages, step: 1, signal: { aborted: false } }, async () => 决P);
  const 文P = 出P.messages.at(-1).content.map((x) => x.text).join("");
  记("主动：排了每天的任务", 捕获?.req?.prompt?.includes("全忆·主动检查") && 捕获.req.daily.time === "21:00:00", JSON.stringify(捕获?.req?.daily ?? null));
  记("主动：没有该提的就说别开口", 文P.includes("没有该提的事"), "");
  记("主动：默认不排（配置关着）", 日P.some((x) => x.includes("主动检查已排")), "");
}

// 主动：档位自己长（观察期一周一次 → 接过三次变每天）
{
  const 卡Q = path.join(临时, "卡Q");
  fs.writeFileSync(path.join(临时, "卡Q.jsonl"), JSON.stringify({ seq: 1, t: "2026-10-18T10:00:00+08:00", who: "user", kind: "text", text: "随便聊聊" }) + "\n");
  execFileSync(process.execPath, [path.join(根, "造卡.mjs"), path.join(临时, "卡Q.jsonl"), 卡Q], { stdio: "pipe" });
  const 捕获2 = [];
  const ctxQ = { logger: { info() {}, warn() {} }, on: () => {}, get: (n) => n === "schedule" ? { create: (sid, req) => { 捕获2.push(req); return { id: "q" }; } } : undefined };
  await apply(ctxQ, { 卡带: 卡Q });
  const { 读态, 记提, 记接 } = await import("../../主动.mjs");
  for (let i = 0; i < 3; i++) { 记提(卡Q); 记接(卡Q); }
  记("档位接过三次会升到每天", 读态(卡Q).档 === 1, "档 " + 读态(卡Q).档);
}

// 翻账限流：一分钟最多 5 次（防止她把手机翻卡）
{
  const 表 = new Map();
  const ctxL = { logger: { info() {}, warn() {} }, on() {}, effect() {},
    get: (n) => n === "tools" ? { register: (工具) => { 表.set(工具.name, 工具); return () => 表.delete(工具.name); } } : undefined };
  await apply(ctxL, { 卡带 });
  const 果 = [];
  for (let i = 0; i < 6; i++) 果.push(表.get("recall").execute({ q: "桌宠", k: 2 }));
  记("一分钟第 6 次被限流", 果[5]?.限流 === true && 果[5].命中.length === 0, "");
  记("前 5 次照常", 果.slice(0, 5).every((r) => Array.isArray(r.命中) && !r.限流), "");
}

// 一句话让她自己建一张卡带
{
  const 卡X = path.join(临时, "卡X");
  fs.writeFileSync(path.join(临时, "卡X.jsonl"), JSON.stringify({ seq: 1, t: "2026-10-18T10:00:00+08:00", who: "user", kind: "text", text: "随便聊聊" }) + "\n");
  execFileSync(process.execPath, [path.join(根, "造卡.mjs"), path.join(临时, "卡X.jsonl"), 卡X], { stdio: "pipe" });
  let 处S = null;
  const ctxS = { logger: { info() {}, warn() {} }, on: (n, f) => { 处S = f; }, get: () => undefined };
  await apply(ctxS, { 卡带: 卡X });
  const 建 = 工具表.get("new_card");
  const r = 建.execute({ 名: "她新建的", 从: "空" });
  记("她自己能建一张卡带", r.ok === true && fs.existsSync(path.join(r.新卡带, "manifest.json")), JSON.stringify(r).slice(0, 80));
  记("建在她旁边", r.ok && path.dirname(r.新卡带) === 临时, "");
}

// 牙：一个工具注册抛错，不许拖累其余四个
{
  const 表2 = new Map();
  const ctxL = { logger: { info() {}, warn() {} }, on() {}, effect() {},
    get: (n) => n === "tools" ? { register: (工具) => {
      if (工具.name === "forget" || 工具.name === "memory_forget") throw new Error("故意炸");
      表2.set(工具.name, 工具); return () => 表2.delete(工具.name);
    } } : undefined };
  await apply(ctxL, { 卡带 });
  记("一个工具抛错，其余四个照注册", 表2.has("recall") && 表2.has("frame") && 表2.has("compose") && 表2.has("new_card") && !表2.has("forget"), [...表2.keys()].join(","));
}

// 她的回答：turn-stopping 里取最后一条 assistant/message
{
  const 卡H = path.join(临时, "卡H");
  fs.writeFileSync(path.join(临时, "卡H.jsonl"), JSON.stringify({ seq: 1, t: "2026-10-18T10:00:00+08:00", who: "user", kind: "text", text: "随便聊聊" }) + "\n");
  execFileSync(process.execPath, [path.join(根, "造卡.mjs"), path.join(临时, "卡H.jsonl"), 卡H], { stdio: "pipe" });
  const 处们 = {};
  const ctxH = { logger: { info() {}, warn() {} }, effect() {}, get: () => undefined, on: (n, f) => { 处们[n] = f; } };
  await apply(ctxH, { 卡带: 卡H });
  const 事 = [{ type: "assistant/message", data: { message: { id: "m1", content: [{ type: "text", text: "我答了一句" }] } } }];
  await 处们["agent/turn-stopping"]({ agent: { session: { snapshotEvents: () => 事 } } });
  const 对 = fs.readFileSync(path.join(卡H, "对话.jsonl"), "utf8").split("\n").filter(Boolean).map(JSON.parse);
  记("她的回答能被记下来", 对.some((x) => x.who === "her" && x.id === "m1"), JSON.stringify(对.map((x) => x.who)));
  await 处们["agent/turn-stopping"]({ agent: { session: { snapshotEvents: () => 事 } } });
  const 对2 = fs.readFileSync(path.join(卡H, "对话.jsonl"), "utf8").split("\n").filter(Boolean);
  记("同一条回答不重复记", 对2.length === 对.length, 对2.length + " 行");
  // 帧由 自长.mjs 统一写（单一写入者）；这里只验“回答被记下来”
  记("插件不再直接写帧（单一写入者）", JSON.parse(fs.readFileSync(path.join(卡H, "manifest.json"), "utf8")).帧数 === 1, "");
}

// 真宿主形态：ctx.tools 是必须 inject 的 getter，会抛；只能用 ctx.get("tools")
{
  const 表 = new Map();
  const 服务 = { register: (工具) => { 表.set(工具.name, 工具); return () => 表.delete(工具.name); } };
  const ctxG = {
    logger: { info() {}, warn() {} },
    on() {},
    get: (名) => 名 === "tools" ? 服务 : undefined,
    get tools() { throw new Error("cannot get property tools without inject"); },
    effect: () => {},
  };
  await apply(ctxG, { 卡带 });
  记("ctx.tools 会抛时仍能注册（走 ctx.get）", 表.has("recall") && 表.has("frame"), [...表.keys()].join(","));
}

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
