// 改前必读：/root/全忆-V20/设计.md
// 契约 c1–c5：任何插头/宿主实现都必须过
// 用法：node contract/跑契约.mjs [卡带目录]

import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mount } from "../读我.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 源卡带 = path.resolve(process.argv[2] ?? path.join(此处, "..", "卡带样例", "桌宠"));
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "契约-"));
const 卡带 = path.join(临时, "卡带");
fs.cpSync(源卡带, 卡带, { recursive: true });

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

function 树哈希(根) {
  const 文件 = [];
  const 走 = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(d, e.name); e.isDirectory() ? 走(p) : 文件.push(p);
  } };
  走(根);
  const h = createHash("sha256");
  for (const f of 文件) h.update(path.relative(根, f)).update(fs.readFileSync(f));
  return h.digest("hex");
}

const 句柄 = mount(卡带);

// c1
{
  const 条 = 句柄.recall("2D 的极限", 3);
  记("c1 mount < 100ms 且 recall 有结果", 句柄.挂载毫秒 < 100 && 条.length >= 1,
    "挂载 " + 句柄.挂载毫秒.toFixed(2) + "ms · 命中 " + 条.length);
}

// c2
{
  const 条 = 句柄.recall("桌宠", 5);
  let ok = 条.length > 0;
  for (const x of 条) {
    const f = 句柄.frame(x.seq);
    if (!f.ok || f.sha !== x.sha || f.校验 !== true) ok = false;
  }
  记("c2 recall 带 seq，frame 的 sha 对得上", ok, "查了 " + 条.length + " 条");
}

// c3
{
  const b = 句柄.brief({ 问: "桌宠卡住的地方" });
  记("c3 brief 不超预算", b.token估 <= 600, "估 " + b.token估 + " token（限 600）");
}

// c4
{
  const 前 = 树哈希(path.join(卡带, "raw"));
  const 前日记 = fs.existsSync(path.join(卡带, "journal.jsonl")) ? fs.statSync(path.join(卡带, "journal.jsonl")).size : 0;
  句柄.note({ who: "user", text: "契约测试：这一条只该进 journal" });
  const 后 = 树哈希(path.join(卡带, "raw"));
  const 后日记 = fs.statSync(path.join(卡带, "journal.jsonl")).size;
  记("c4 note 只写 journal，raw 的 sha 不变", 前 === 后 && 后日记 > 前日记, "raw " + 前.slice(0, 8) + " → " + 后.slice(0, 8));
}

// c5
{
  const 一 = 句柄.合并();
  const 甲 = 树哈希(path.join(卡带, "raw"));
  const 二 = 句柄.合并();
  const 乙 = 树哈希(path.join(卡带, "raw"));
  记("c5 合并幂等", 乙 === 甲 && 二.合并 === 0, "第一次 " + 一.合并 + " 条 · 第二次 " + 二.合并 + " 条");
}

// 附加：三态（读不动 ≠ 没有）
{
  const f = 句柄.frame(999999);
  记("附加 越界帧报「读不动」而不是「没有」", f.ok === false && f.读不动 === true, f.why ?? "");
}

// 附加：合并后原帧仍可校验
{
  const f = 句柄.frame(73);
  记("附加 合并后 seq 73 仍逐字可校验", f.ok === true && f.校验 === true && f.text.includes("2D 的极限"));
}

句柄.close();
fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
