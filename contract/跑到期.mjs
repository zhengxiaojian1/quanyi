// 改前必读：/root/全忆-V20/设计.md
// ⑤ 日期到期：说得出什么时候的，到日子要能自己提
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mount } from "../读我.mjs";
import { 解析到期 } from "../日记写手.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

const 基 = "2026-10-15T10:00:00+08:00";
const 日 = (t) => (解析到期(t, 基) ?? "").slice(0, 10);
记("明天", 日("明天提醒我") === "2026-10-16", 日("明天提醒我"));
记("三天后（中文数字）", 日("三天后问他") === "2026-10-18", 日("三天后问他"));
记("月底", 日("月底交") === "2026-10-31", 日("月底交"));
记("X月X号", 日("11月3号提醒我") === "2026-11-03", 日("11月3号提醒我"));
记("下个月", 日("下个月再说") !== "", 日("下个月再说"));
记("认不出就不猜", 解析到期("没有时间的话", 基) === null, "");

// 端到端：过期的到期 → 到点；未来的 → 不到点
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "到期-"));
const 造 = (名, t) => {
  const 源 = path.join(临时, 名 + ".jsonl");
  const 卡 = path.join(临时, 名);
  fs.writeFileSync(源, [
    { seq: 1, t, who: "user", kind: "text", text: "月底提醒我把清单交上去" },
    { seq: 2, t, who: "her", kind: "text", text: "好，月底我提你。" },
  ].map((x) => JSON.stringify(x)).join("\n") + "\n");
  execFileSync(process.execPath, [path.join(根, "造卡.mjs"), 源, 卡], { stdio: "pipe" });
  execFileSync(process.execPath, [path.join(根, "呼吸.mjs"), 卡], { stdio: "pipe" });
  return 卡;
};
const 旧 = mount(造("旧", "2026-09-20T10:00:00+08:00"));
记("过了日子会说「到日子了」", 旧.brief({ 问: "今天在做什么" }).text.includes("【到点了】"), "");
旧.close();
const 新 = mount(造("新", "2026-10-16T10:00:00+08:00"));
记("还没到日子不提", !新.brief({ 问: "今天在做什么" }).text.includes("【到点了】"), "");
新.close();

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
