// 改前必读：/root/全忆-V20/设计.md
// 上锁 = 只读：用户意图的写要报错；记账类的写静默跳过；读照常
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mount } from "../读我.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "只读-"));
const 卡 = path.join(临时, "卡");
fs.cpSync(path.join(根, "卡带样例", "桌宠"), 卡, { recursive: true });
execFileSync(process.execPath, [path.join(根, "上锁.mjs"), 卡], { stdio: "pipe", env: { ...process.env, QUANYI_KEY: "口令" } });

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

process.env.QUANYI_KEY = "口令";
const h = mount(卡);
记("锁上了", !!h.manifest.加密, "");
记("读照常（recall）", h.recall("桌宠", 2).length > 0, "");
记("读照常（brief）", h.brief({ 问: "桌宠" }).text.includes("【她是谁】") || h.brief({ 问: "桌宠" }).text.length > 50, "");

const 拒 = (f) => { try { f(); return false; } catch { return true; } };
记("记对话被拒", 拒(() => h.记对话({ who: "user", text: "x" })), "");
记("压制被拒", 拒(() => h.压制([1], "x")), "");
记("设称呼被拒", 拒(() => h.设称呼({ 名字: "x" })), "");

记("记账类静默跳过（记提过）", h.记提过(1)?.ok === false, "");
记("记账类静默跳过（加重）", h.加重(1, { 显著: 1 })?.ok === false, "");
记("记账类静默跳过（加边）", h.加边({ a: "帧:1", b: "帧:2" })?.ok === false, "");

const 对话 = fs.readFileSync(path.join(卡, "对话.jsonl"));
记("对话账也加密了（不是明文）", !对话.toString("utf8").includes("\"who\""), "");
const 原话 = h.最近对话(3);
记("加密后仍能读回对话", Array.isArray(原话), 原话.length + " 条");
h.close();

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
