// 改前必读：/root/全忆-V20/设计.md
// 查看器：首页 / 搜索 / 原文页 三条路能走通
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "查看-"));
fs.cpSync(path.join(根, "卡带样例", "桌宠"), path.join(临时, "卡"), { recursive: true });
const 端口 = 8800 + Math.floor(Math.random() * 90);

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

const 子 = spawn(process.execPath, [path.join(根, "查看器.mjs"), path.join(临时, "卡"), "--端口", String(端口)], { stdio: ["ignore", "pipe", "pipe"] });
await new Promise((res, rej) => {
  let 出 = "";
  子.stdout.on("data", (b) => { 出 += b; if (出.includes("查看器")) res(); });
  setTimeout(() => rej(new Error("查看器起不来：" + 出)), 8000);
});

const 取 = (p) => fetch("http://127.0.0.1:" + 端口 + p).then((r) => r.text());
const 首页 = await 取("/");
记("首页列出帧数", 首页.includes("88 帧"), "");
记("首页列出最近的日记", 首页.includes("最近的日记") && 首页.includes("日记</span>"), "");
const 搜 = await 取("/搜?q=" + encodeURIComponent("2D 的极限"));
记("搜索能搜到 73", 搜.includes("[73]"), "");
const 帧 = await 取("/帧/73");
记("原文页给出原文与校验", 帧.includes("2D 的极限") && 帧.includes("对得上"), "");
const 卡页 = await 取("/卡");
记("有换卡带按钮", 首页.includes("换卡带") && 卡页.includes("卡带（"), "");
const 无 = await 取("/帧/99999");
记("没有的帧照实说", 无.includes("读不动"), "");

子.kill();
fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
