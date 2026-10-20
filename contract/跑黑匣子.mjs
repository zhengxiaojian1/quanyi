// 改前必读：/root/全忆-V20/设计.md
// 黑匣子：每进程 ≤3 笔；正常退出尾笔「收」；kill -9 后能报「上一代未收」；≤400 行轮转
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { 开, 大事, 收, 上一代收了吗, 上一代 } from "../黑匣子.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "黑匣子-"));
let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

// 1) 正常一代：开 / 做 / 收
开(临时, "测试");
大事(临时, "干活", { 帧数: 3 });
收(临时);
记("正常退出：尾笔是「收」", 上一代收了吗(临时) === true, "");
const 行 = fs.readFileSync(path.join(临时, "facts", "黑匣子.jsonl"), "utf8").split("\n").filter(Boolean);
记("一代只写三笔", 行.length === 3, 行.length + " 笔");

// 2) kill -9：只有「开」，没有「收」
const 子 = path.join(临时, "子.mjs");
fs.writeFileSync(子, `import { 开 } from ${JSON.stringify(path.join(根, "黑匣子.mjs"))};\n开(process.argv[2], "会被杀");\nsetTimeout(() => {}, 60000);\n`);
const p = spawn(process.execPath, [子, 临时], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
p.kill("SIGKILL");
await new Promise((r) => setTimeout(r, 300));
记("kill -9 后：上一代未收", 上一代收了吗(临时) === false, "");
const 末 = 上一代(临时);
记("能报出上一代的 pid 与时刻", Number.isInteger(末?.pid) && typeof 末?.t === "string" && 末.做什么 === "会被杀", JSON.stringify({ pid: 末?.pid, 做什么: 末?.做什么 }));

// 3) 轮转：写爆 400 行后文件不超
const 档 = path.join(临时, "facts", "黑匣子.jsonl");
for (let i = 0; i < 420; i++) fs.appendFileSync(档, JSON.stringify({ t: new Date().toISOString(), pid: 1, 笔: "做" }) + "\n");
大事(临时, "触发轮转");
const 后 = fs.readFileSync(档, "utf8").split("\n").filter(Boolean).length;
记("超过 400 行会轮转", 后 <= 400, 后 + " 行");

// 4) 判据不能把“当前活着的一代”误报成崩
const 活 = path.join(临时, "活");
fs.mkdirSync(path.join(活, "facts"), { recursive: true });
fs.writeFileSync(path.join(活, "facts", "黑匣子.jsonl"), JSON.stringify({ t: new Date().toISOString(), pid: process.pid, 笔: "开", 做什么: "在跑" }) + "\n");
const 跑 = (d) => { try { return execFileSync(process.execPath, [path.join(根, "黑匣子.mjs"), d], { encoding: "utf8" }); } catch (e) { return String(e.stdout ?? ""); } };
记("活着的那一代：报「本代在跑」，不报崩", 跑(活).includes("本代在跑"), 跑(活).trim().slice(0, 40));
const 死 = path.join(临时, "死");
fs.mkdirSync(path.join(死, "facts"), { recursive: true });
fs.writeFileSync(path.join(死, "facts", "黑匣子.jsonl"), JSON.stringify({ t: new Date().toISOString(), pid: 999999, 笔: "开", 做什么: "崩了" }) + "\n");
记("pid 不在：才报「上一代没收尾」", 跑(死).includes("上一代没收尾"), 跑(死).trim().slice(0, 40));

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
