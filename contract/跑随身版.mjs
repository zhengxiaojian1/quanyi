// 改前必读：/root/全忆-V20/设计.md
// 随身版：起得来、聊得动、写进对话账；没钥匙要照实报
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "随身-"));
const 卡带 = path.join(临时, "卡");
fs.cpSync(path.join(根, "卡带样例", "桌宠"), 卡带, { recursive: true });
const 工具 = path.join(卡带, "工具");
fs.mkdirSync(工具, { recursive: true });
for (const f of ["读我.mjs", "driver.mjs", "倒排.mjs"]) fs.copyFileSync(path.join(根, f), path.join(工具, f));
fs.cpSync(path.join(根, "adapters"), path.join(工具, "adapters"), { recursive: true });
fs.cpSync(path.join(根, "随身版"), path.join(工具, "随身版"), { recursive: true, filter: (s) => !s.includes("/node/") });

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

const 起 = (env) => new Promise((res, rej) => {
  const 子 = spawn(process.execPath, [path.join(工具, "随身版", "服务.mjs")], { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let 出 = "";
  子.stdout.on("data", (b) => { 出 += b; if (出.includes("她在这")) res({ 子, 出 }); });
  子.stderr.on("data", (b) => { 出 += b; });
  子.on("exit", (c) => rej(new Error("服务退出了 " + c + "：" + 出)));
  setTimeout(() => rej(new Error("起不来：" + 出)), 8000);
});

const { 子 } = await 起({ QUANYI_PORT: "8791", QUANYI_FAKE: "1" });
const r = await fetch("http://127.0.0.1:8791/" + encodeURIComponent("聊"), {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ 问: "我们之前卡在哪" }),
}).then((x) => x.json());
记("能聊（假插头）", r.text === "（测试）我记得那件事。", JSON.stringify(r));
const 页 = await fetch("http://127.0.0.1:8791/").then((x) => x.text());
记("首页能打开", 页.includes("说话") && 页.includes("/聊"), "");
子.kill();
await new Promise((r2) => setTimeout(r2, 300));

const 账 = fs.readFileSync(path.join(卡带, "对话.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
记("聊天写进了对话账", 账.some((x) => x.who === "user" && x.text.includes("卡在哪")), 账.length + " 条");

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
