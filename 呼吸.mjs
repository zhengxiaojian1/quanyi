import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { 开, 大事, 收 } from "./黑匣子.mjs";
import path from "node:path";
import { mount } from "./读我.mjs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import * as 深 from "./adapters/deepseek.mjs";
import * as 开放 from "./adapters/openai.mjs";
import { 抽承诺, 抽判断, 选指针, 规则写手, 校验, 金句, 净句, 模型提示 } from "./日记写手.mjs";
import { 抽别名, 合并别名 } from "./别名.mjs";
import { 抽实体, 合并实体 } from "./实体.mjs";

const 插头 = process.env.QUANYI_ADAPTER === "openai" ? 开放 : 深;
const [卡带, ...余] = process.argv.slice(2);

if (!卡带) { console.error("用法: node 呼吸.mjs <卡带> [--天 YYYY-MM-DD] [--模型]"); process.exit(2); }
const 指定天 = 余.indexOf("--天") >= 0 ? 余[余.indexOf("--天") + 1] : null;
const 用模型 = 余.includes("--模型");

const 句柄 = mount(卡带);
const 称呼 = 句柄.称呼;
const 天列 = 指定天 ? [指定天] : 句柄.manifest.天;
const 计划 = {};
const 日摘 = new Map();
let 写了几篇 = 0, 承诺数 = 0, 判断数 = 0, 别名数 = 0, 实体数 = 0;
let 用量 = { 入: 0, 出: 0, 次: 0 };

for (const 天 of 天列) {
  const 帧 = 句柄.天帧(天);
  if (!帧.length) continue;
  const 承诺 = 抽承诺(帧);
  const 判断 = 抽判断(帧);

  const 他 = 帧.filter((f) => f.who === "user" && String(f.text ?? "").length >= 2);
  const 金 = 金句(帧);
  日摘.set(天, { 首Seq: 他[0]?.seq, 首文: 净句(他[0]?.text ?? ""), 金Seq: 金?.seq, 金文: 净句(金?.text ?? "") });

  let 文 = 规则写手(天, 帧, 承诺);
  if (用模型 && 插头.有钥匙()) {
    try { 文 = await 模型写手(天, 帧); } catch (e) { console.error("模型写手失败，退回规则写手：" + e.message); }
  }
  if (!校验(文, 帧)) 文 = 规则写手(天, 帧, 承诺);
  const 首行 = String(文).split("\n")[0] ?? "";
  if (/^\s*\d{4}\s*年/.test(首行) && 首行.length < 24) 文 = String(文).split("\n").slice(1).join("\n").replace(/^\s*\n+/, "");
  if (!文.startsWith("#")) 文 = "# " + 天 + "\n\n" + 文.trim() + "\n";
  fs.writeFileSync(path.join(句柄.目录, "diary", 天 + ".md"), 文, "utf8");
  写了几篇++;

  // 别名：让模型把「换说法」沉淀成词表（一天一次，零检索成本）
  if (用模型 && 插头.有钥匙()) {
    try {
      const 新 = await 抽别名({ 说: 插头.说, 帧, 已有: {} });
      if (Object.keys(新).length) { 合并别名(句柄.目录, 新); 别名数 += Object.keys(新).length; }
    } catch (e) { console.error("别名抽取失败（不影响别的）：" + e.message); }
  }

  // 实体（第一层）：同一个人的别的叫法
  if (用模型 && 插头.有钥匙()) {
    try {
      const 新 = await 抽实体({ 说: 插头.说, 帧 });
      if (新.length) { 合并实体(句柄.目录, 新); 实体数 += 新.length; }
    } catch (e) { console.error("抽实体失败（不影响别的）：" + e.message); }
  }

  if (承诺.length) {
    追加("承诺", 承诺.map((x) => ({ ...x, 天 })));
    承诺数 += 承诺.length;
    for (const c of 承诺) 句柄.加边({ a: "承诺:" + encodeURIComponent(c.内容.slice(0, 40)), b: "帧:" + c.src[0], 类型: "约定" });
  }
  const 名们 = [句柄.称呼?.名字, ...(句柄.称呼?.外号 ?? [])].filter(Boolean);
  for (const f of 帧) for (const 名 of 名们) if (String(f.text ?? "").includes(名)) 句柄.加边({ a: "人:" + 名, b: "帧:" + f.seq, 类型: "提到" });
  if (判断.length) { 追加("判断", 判断.map((x) => ({ ...x, 天 }))); 判断数 += 判断.length; }

  // 白捡的边：同一天被她选进日记的几帧，两两相连（影子：只落账，不影响检索）
  const 针 = 选指针(帧, 承诺).filter((s) => !句柄.被压制(s));
  for (let i = 0; i < 针.length; i++) for (let j = i + 1; j < 针.length; j++) {
    句柄.加边({ a: "帧:" + 针[i], b: "帧:" + 针[j], 类型: "同篇" });
  }

  const 工具 = 帧.filter((f) => f.kind === "tool");
  计划[天] = {
    工具帧: 工具.length,
    可删: 工具.filter((f) => !选指针(帧, 承诺).includes(f.seq)).length,
    字节估: 工具.reduce((a, f) => a + Buffer.byteLength(f.text ?? "", "utf8"), 0),
  };
}

写月记(天列);
fs.writeFileSync(path.join(句柄.目录, "压缩计划.json"), JSON.stringify(计划, null, 2));
追加行("呼吸", { 时: new Date().toISOString(), 天: 天列.length, 日记: 写了几篇, 承诺: 承诺数, 判断: 判断数 });
开(卡带, "呼吸");
大事(卡带, "呼吸", { 日记: 写了几篇, 承诺: 承诺数, 判断: 判断数 });
收(卡带);
console.log(JSON.stringify({ 日记: 写了几篇, 承诺: 承诺数, 判断: 判断数, 别名: 别名数, 实体: 实体数, 模型用量: 用量, 计划 }, null, 2));

function 写月记(天列) {
  const 月集 = new Map();
  for (const 天 of 天列) {
    const 月 = 天.slice(0, 7);
    if (!月集.has(月)) 月集.set(月, []);
    月集.get(月).push(天);
  }
  const 目录 = path.join(句柄.目录, "diary", "月");
  fs.mkdirSync(目录, { recursive: true });
  for (const [月, 天们] of 月集) {
    const 排 = [...天们].sort();
    const 首 = 日摘.get(排[0]) ?? {};
    const 尾 = 日摘.get(排[排.length - 1]) ?? {};
    const 段 = ["# " + 月, ""];
    if (排.length >= 2 && 首.首文) {
      段.push("这个月从「" + 首.首文 + "」开始" + (尾.金文 ? "，停在「" + 尾.金文 + "」" : "") + "。");
      if (尾.金Seq) 段.push("↩ " + [尾.金Seq, 首.首Seq].filter(Boolean).join(", "));
      段.push("");
    }
    for (const 天 of 排) {
      const p = path.join(句柄.目录, "diary", 天 + ".md");
      if (!fs.existsSync(p)) continue;
      const 文 = fs.readFileSync(p, "utf8");
      const m = 文.match(/↩\s*([\d,\s]+)/);
      const 针 = m ? m[1].split(/[,\s]+/).filter(Boolean).join(", ") : "";
      段.push("## " + 天, "", 文.replace(/^#.*\n/, "").replace(/↩.*$/m, "").trim(), "", 针 ? "↩ " + 针 : "", "");
    }
    fs.writeFileSync(path.join(目录, 月 + ".md"), 段.join("\n"), "utf8");
  }
}

function 追加(类, 列) {
  const 路 = path.join(句柄.目录, "facts", 类 + ".jsonl");
  const 已有 = fs.existsSync(路) ? fs.readFileSync(路, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const 键 = new Set(已有.map((x) => x.内容));
  const 新 = 列.filter((x) => !键.has(x.内容));
  if (新.length) fs.appendFileSync(路, 新.map((x) => JSON.stringify(x)).join("\n") + "\n", "utf8");
}
function 追加行(类, o) {
  fs.appendFileSync(path.join(句柄.目录, "facts", 类 + ".jsonl"), JSON.stringify(o) + "\n", "utf8");
}

async function 模型写手(天, 帧) {
  const r = await 插头.说({
    系统: 句柄.self,
    消息: [{ role: "user", content: 模型提示({ 天, 帧, 称呼 }) }],
    温度: 0.8, 最大: 1200, 思考: false,
  });
  用量.入 += r.usage?.input_tokens ?? 0;
  用量.出 += r.usage?.output_tokens ?? 0;
  用量.次 += 1;
  return r.text;
}
