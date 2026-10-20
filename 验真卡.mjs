// 改前必读：/root/全忆-V20/设计.md
// 验真卡：拿一张真卡带跑全套体检，出读数（不在样本上骗自己）
// 用法：node 验真卡.mjs <卡带>
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mount } from "./读我.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 卡 = process.argv[2];
if (!卡) { console.error("用法: node 验真卡.mjs <卡带>"); process.exit(2); }

const 行 = [];
const 记 = (k, v) => { 行.push([k, String(v)]); };

// 1 自检
try { execFileSync(process.execPath, [path.join(此处, "自检.mjs"), 卡], { stdio: "pipe" }); 记("自检", "7 项全过"); }
catch { 记("自检", "有问题"); }

// 2 挂载 + 预算
const t0 = Date.now();
const h = mount(卡);
记("挂载", (Date.now() - t0) + "ms");
记("帧数", h.manifest.帧数);
const 问 = ["我们之前卡在哪", "上次那个报错", "清单放在哪", "为什么不用这个方案"];
const t1 = Date.now();
let 总条 = 0;
for (const q of 问) 总条 += h.recall(q, 5).length;
记("4 次检索", (Date.now() - t1) + "ms · 命中 " + 总条 + " 条");
const t2 = Date.now();
const b = h.brief({ 问: 问[0] });
记("brief", b.token估 + " token · " + (Date.now() - t2) + "ms");

// 3 原文
const 首 = h.frame(1), 末 = h.frame(h.manifest.帧数);
记("首末帧校验", 首.ok && 末.ok && 首.校验 && 末.校验 ? "对得上" : "不对");

// 4 导出
const 出 = path.join("/tmp", "验真卡-" + Date.now() + ".md");
const 导 = h.导出(出);
记("导出", 导 ? JSON.stringify(导).slice(0, 40) : "跳过");
if (fs.existsSync(出)) fs.rmSync(出);

// 5 重建（在副本上）
const 副 = fs.mkdtempSync("/tmp/真卡副本-");
fs.cpSync(卡, 副, { recursive: true });
const 前 = JSON.parse(fs.readFileSync(path.join(副, "manifest.json"), "utf8"));
fs.rmSync(path.join(副, "index"), { recursive: true, force: true });
execFileSync(process.execPath, [path.join(此处, "重建索引.mjs"), 副], { stdio: "pipe" });
const 后 = JSON.parse(fs.readFileSync(path.join(副, "manifest.json"), "utf8"));
记("重建索引", 前.帧数 === 后.帧数 && 前.末 === 后.末 ? "帧数/末帧一致" : "不一致");
fs.rmSync(副, { recursive: true, force: true });

// 6 上锁（副本）
const 副2 = fs.mkdtempSync("/tmp/真卡锁-");
fs.cpSync(卡, 副2, { recursive: true });
try {
  execFileSync(process.execPath, [path.join(此处, "上锁.mjs"), 副2], { stdio: "pipe", env: { ...process.env, QUANYI_KEY: "验真卡" } });
  process.env.QUANYI_KEY = "验真卡";
  const 锁后 = mount(副2);
  const 无钥报错 = (() => { const 旧 = process.env.QUANYI_KEY; delete process.env.QUANYI_KEY; try { mount(副2); return false; } catch { return true; } finally { process.env.QUANYI_KEY = 旧; } })();
  记("上锁", 锁后.manifest.加密 && 无钥报错 ? "已加密 · 没钥匙挂不上 · 有钥匙能挂" : "不对");
  锁后.close();
} catch (e) { 记("上锁", "失败：" + e.message); }
fs.rmSync(副2, { recursive: true, force: true });

h.close();
const 宽 = Math.max(...行.map((r) => [...r[0]].length));
console.log("卡带：" + 卡);
for (const [k, v] of 行) console.log("  " + k.padEnd(宽 + 2) + v);
