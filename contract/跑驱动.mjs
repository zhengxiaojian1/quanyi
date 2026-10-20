// 改前必读：/root/全忆-V20/设计.md
// 驱动：每轮递料、预算不超、情绪时收住、工具能用、冷却记账
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { 造驱动 } from "../driver.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "驱动-"));
const 卡带 = path.join(临时, "卡带");
fs.cpSync(path.join(根, "卡带样例", "桌宠"), 卡带, { recursive: true });

const 驱 = 造驱动({ 卡带 });
let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

const 话 = ["我们之前在做什么", "那个卡住的地方是哪", "把 73 的原文给我", "算了，烦死了", "2D 的极限"];
const 料 = 话.map((x) => 驱.取料(x));
记("五轮都递了料", 料.every((b) => b.text.length > 0), "");
记("每轮都不超预算", 料.every((b) => b.token估 <= 600), 料.map((b) => b.token估).join(" / "));
记("时间感每轮都在", 料.every((b) => b.text.includes("上次说话")), "");
记("称呼每轮都在", 料.every((b) => b.text.includes("称呼：默风")), "");
记("情绪上头那轮收住了", !料[3].text.includes("【可能相关】") && !料[3].text.includes("【最近的日子】"), "");
记("平静那轮给了相关料", 料[4].text.includes("【可能相关】"), "");
// 接回包按会话分开：别把另一条会话的话接回来
{
  const 驱2 = 造驱动({ 卡带 });
  驱2.记对话("user", "甲会话的话", "s-A");
  驱2.记对话("her", "甲的回应", "s-A");
  驱2.记对话("user", "乙会话的话", "s-B");
  const 甲 = 驱2.句柄.最近对话(10, "s-A").map((x) => x.text).join(" ");
  const 乙 = 驱2.句柄.最近对话(10, "s-B").map((x) => x.text).join(" ");
  记("接回包按会话分开（甲）", 甲.includes("甲会话的话") && !甲.includes("乙会话的话"), "");
  记("接回包按会话分开（乙）", 乙.includes("乙会话的话") && !乙.includes("甲会话的话"), "");
  驱2.关();
}

const 检索 = 驱.调工具("recall", { q: "2D 的极限", k: 2 });
记("工具 recall 能取到 73", 检索[0]?.seq === 73, JSON.stringify(检索.map((x) => x.seq)));
const 帧 = 驱.调工具("frame", { seq: 73 });
记("工具 frame 能逐字校验", 帧.ok && 帧.校验 && 帧.text.includes("2D 的极限"), "");
let 错 = null;
try { 驱.调工具("删库", {}); } catch (e) { 错 = String(e.message); }
记("没这个工具会报错，不静默", /没有这个工具/.test(错 ?? ""), "");

驱.收尾([73]);
记("用过的进冷却账", 驱.句柄.最近提过().includes(73), "");
记("读数记得住", 驱.读数.轮 === 5 && 驱.读数.工具 === 2 && 驱.读数.记提过 === 1, JSON.stringify(驱.读数));

驱.关();
fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
