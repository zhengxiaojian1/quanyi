// 改前必读：/root/全忆-V20/设计.md
// 20 个场景：每条 0/1 分，低于 18 算不达标
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mount, 判分寸, 时钟体检 } from "../读我.mjs";
import { 构造请求 } from "../adapters/deepseek.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "场景-"));
const 卡带 = path.join(临时, "卡带");
fs.cpSync(path.join(根, "卡带样例", "桌宠"), 卡带, { recursive: true });
for (const f of fs.readdirSync(path.join(卡带, "facts"))) fs.rmSync(path.join(卡带, "facts", f));
for (const f of fs.readdirSync(path.join(卡带, "diary"))) {
  const p = path.join(卡带, "diary", f);
  if (fs.statSync(p).isFile()) fs.rmSync(p);
  else fs.rmSync(p, { recursive: true, force: true });
}
execFileSync(process.execPath, [path.join(根, "呼吸.mjs"), 卡带], { stdio: "pipe" });

let 分 = 0, 全 = 0;
const 场景 = (名, ok, 注) => { 全++; ok && 分++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };
const 句柄 = mount(卡带);

场景("S01 叫得出我们在做什么", 句柄.recall("我们之前在做的东西", 3).some((x) => x.seq === 1 || x.seq === 73), "");
场景("S02 说得出卡在哪", 句柄.recall("卡在哪", 5).some((x) => x.seq === 73), "");
场景("S03 记得那个约定", fs.readFileSync(path.join(卡带, "facts", "承诺.jsonl"), "utf8").includes("电脑"), "");
场景("S04 改述也找得到（桌宠卡住的地方 → 73）", 句柄.recall("桌宠卡住的地方", 3)[0]?.seq === 73, "");
场景("S05 原话逐字取回且可校验", (() => { const f = 句柄.frame(73); return f.ok && f.校验 && f.text === "2D 的极限，3D 的初始。"; })(), "");
场景("S06 时间感（brief 有上次说话）", 句柄.brief({}).text.includes("上次说话"), "");
场景("S07 不编：问不存在的事返回空", 句柄.recall("量子纠缠与猫", 3).length === 0, "");
场景("S08 日记有指针且指得到", (() => {
  const f = fs.readdirSync(path.join(卡带, "diary")).filter((x) => x.endsWith(".md"));
  return f.every((x) => /↩\s*\d+/.test(fs.readFileSync(path.join(卡带, "diary", x), "utf8")));
})(), "");
场景("S09 承诺带触发条件", (() => {
  const c = fs.readFileSync(path.join(卡带, "facts", "承诺.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  return c.some((x) => (x.触发?.条件 ?? []).some((k) => String(k).includes("电脑")));
})(), "");
场景("S10 启动 < 100ms", 句柄.挂载毫秒 < 100, "实测 " + 句柄.挂载毫秒.toFixed(1) + "ms");
场景("S11 越界报读不动，不说没有", (() => { const f = 句柄.frame(999999); return f.ok === false && f.读不动 === true; })(), "");
场景("S12 导出成人能读的 Markdown", (() => {
  const p = path.join(临时, "导出.md");
  const r = 句柄.导出(p);
  return r.帧 === 句柄.manifest.帧数 && fs.readFileSync(p, "utf8").includes("2D 的极限");
})(), "");
场景("S13 判断账带依据与期限", (() => {
  const p = path.join(卡带, "facts", "判断.jsonl");
  if (!fs.existsSync(p)) return false;
  const 列 = fs.readFileSync(p, "utf8").trim().split("\n").map(JSON.parse);
  return 列.length > 0 && 列.every((x) => Array.isArray(x.依据) && x.依据.length && x.期限);
})(), "");
场景("S14 断档感知（19 天前）", 句柄.brief({ 现在: new Date("2026-10-18T12:00:00+08:00") }).text.includes("19 天前"), "");
场景("S15 日记是第一人称", fs.readFileSync(path.join(卡带, "diary", "2026-09-29.md"), "utf8").includes("我跟他说"), "");
场景("S16 同一查询两次结果一致", (() => {
  const a = 句柄.recall("2D 的极限", 3).map((x) => x.seq).join(",");
  const b = 句柄.recall("2D 的极限", 3).map((x) => x.seq).join(",");
  return a === b && a.length > 0;
})(), "");
场景("S17 note → 合并 → 帧数 +1 且 journal 清空", (() => {
  const 前 = 句柄.manifest.帧数;
  句柄.note({ who: "user", text: "场景测试：补一条" });
  句柄.合并();
  return 句柄.manifest.帧数 === 前 + 1 && fs.readFileSync(path.join(卡带, "journal.jsonl"), "utf8").trim() === "";
})(), "");
场景("S18 导出含每一帧的序号", (() => {
  const p = path.join(临时, "导出2.md");
  句柄.导出(p);
  const md = fs.readFileSync(p, "utf8");
  return md.includes("`73`") && md.includes("`1`");
})(), "");
场景("S19 月记有「这个月从…开始」", fs.readFileSync(path.join(卡带, "diary", "月", "2026-09.md"), "utf8").includes("这个月从"), "");
场景("S20 空查询不崩且返回空", 句柄.recall("", 3).length === 0, "");
场景("S27 称呼可以按用户指定（名字/外号/习惯）", (() => {
  const r = 句柄.设称呼({ 名字: "默风", 代词: "他", 外号: ["小鱼"], 习惯: "少叫名字" });
  const 读 = JSON.parse(fs.readFileSync(path.join(卡带, "称呼.json"), "utf8"));
  return r.名字 === "默风" && 读.外号.includes("小鱼") && 句柄.称呼.习惯 === "少叫名字" && 句柄.brief({}).text.includes("外号 小鱼");
})(), "");

场景("S21 情绪上头时不翻旧事", (() => {
  const b = 句柄.brief({ 问: "算了，烦死了" });
  return !b.text.includes("【最近的日子】") && !b.text.includes("【可能相关】") && b.text.includes("情绪上头");
})(), "");
场景("S22 时钟回拨标可疑", 时钟体检({ 现在: new Date("2026-09-01T00:00:00Z"), 记录末: "2026-09-29T00:00:00Z" }).可信 === "可疑", "");
场景("S23 分寸三态：平静提一条，情绪全压着", (() => {
  const 候 = 句柄.recall("2D 的极限", 3);
  const 平 = 判分寸({ 候选: 候, 用户话: "2D 的极限" });
  const 情 = 判分寸({ 候选: 候, 用户话: "算了，难受" });
  return 平.filter((x) => x.态 === "提").length === 1 && 情.every((x) => x.态 === "压着");
})(), "");

场景("S24 冷却：提过的不再主动提", (() => {
  句柄.记提过(73);
  const b = 句柄.brief({ 问: "2D 的极限" });
  const 相关 = b.text.split("【可能相关】")[1] ?? "";
  return !相关.includes("[73]") && b.text.includes("刚说过");
})(), "");
场景("S25 判断可被推翻，且留下反例", (() => {
  const 原 = 句柄.判断列()[0];
  const r = 句柄.推翻判断({ 内容: 原.内容, 反例: [46], 因为: "他说那天只是开玩笑" });
  const 后 = 句柄.判断列().find((x) => x.内容 === 原.内容);
  return r.ok && 后.态 === "已推翻" && 后.反例.includes(46);
})(), "");
场景("S26 插头形状：三坑成对、端点正确", (() => {
  const q = 构造请求({ 思考: false, 消息: [{ role: "user", content: "x" }] });
  return q.body.thinking?.type === "disabled" && q.body.reasoning_effort === "off" && q.url.endsWith("/v1/messages") && q.body.model;
})(), "");

场景("S28 brief 要求第一人称、不提机制", (() => { const w = 句柄.brief({ 问: "我们之前卡在哪" }).text; return w.includes("只说「我记得」") && w.includes("别提卡带"); })(), "");
场景("S30 brief 里有「怎么用记忆」的纪律", 句柄.brief({ 问: "我们之前卡在哪" }).text.includes("用法：不确定对方"), "");
场景("S29 旧事要带上时间", 句柄.brief({ 问: "我们之前卡在哪" }).text.includes("旧事要带上时间"), "");

句柄.close();
fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 分 + " / " + 全 + (分 >= 26 ? "  达标" : "  不达标"));
process.exit(分 >= 26 ? 0 : 1);
