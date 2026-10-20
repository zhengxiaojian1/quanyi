// 改前必读：/root/全忆-V20/设计.md
// 把卡带里的 导入.jsonl 就地建成卡带，并顺手呼吸一次
// 用法：node 导入卡带.mjs <卡带>
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 卡带 = process.argv[2];
if (!卡带) { console.error("用法: node 导入卡带.mjs <卡带>"); process.exit(2); }
const 源 = path.join(卡带, "导入.jsonl");
if (!fs.existsSync(源)) { console.error("没有 导入.jsonl：先让插件把上下文切下来"); process.exit(2); }
const 行数 = fs.readFileSync(源, "utf8").split("\n").filter(Boolean).length;
if (行数 < 2) { console.error("导入.jsonl 太短（" + 行数 + " 条）"); process.exit(2); }

execFileSync(process.execPath, [path.join(此处, "造卡.mjs"), 源, 卡带], { stdio: "inherit" });
execFileSync(process.execPath, [path.join(此处, "呼吸.mjs"), 卡带], { stdio: "inherit" });
fs.renameSync(源, path.join(卡带, "导入.已用.jsonl"));
console.log("导入完成：" + 行数 + " 条");
