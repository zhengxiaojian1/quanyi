// 改前必读：/root/全忆-V20/设计.md
// 卡带上锁：明文消失、没钥匙打不开、有钥匙一切照旧、上锁后只读
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "上锁-"));
const 卡带 = path.join(临时, "卡带");
fs.cpSync(path.join(根, "卡带样例", "桌宠"), 卡带, { recursive: true });

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

execFileSync(process.execPath, [path.join(根, "上锁.mjs"), 卡带], { env: { ...process.env, QUANYI_KEY: "测试口令" }, stdio: "pipe" });

const 明文 = fs.readFileSync(path.join(卡带, "raw", "2026-09", "29", "00.jsonl"));
记("上锁后 raw 里没有明文", !明文.toString("latin1").includes("2D 的极限"), 明文.length + " 字节");
记("manifest 记了盐和算法", (() => { const m = JSON.parse(fs.readFileSync(path.join(卡带, "manifest.json"), "utf8")); return m.加密?.算法 === "aes-256-gcm" && m.加密?.盐; })(), "");

const 无钥 = await import(path.join(根, "读我.mjs")).then((m) => m.mount(卡带)).then(() => null).catch((e) => String(e.message));
记("没有钥匙打不开", /上锁/.test(无钥 ?? ""), 无钥 ?? "居然打开了");

process.env.QUANYI_KEY = "测试口令";
const { mount } = await import(path.join(根, "读我.mjs"));
const h = mount(卡带);
记("有钥匙能取回原话", (() => { const f = h.frame(73); return f.ok && f.校验 && f.text === "2D 的极限，3D 的初始。"; })(), "");
记("有钥匙能检索", h.recall("2D 的极限", 2)[0]?.seq === 73, "");
记("有钥匙能导出", (() => { const p = path.join(临时, "导出.md"); return h.导出(p).帧 > 0 && fs.readFileSync(p, "utf8").includes("2D 的极限"); })(), "");
let 写错 = null;
try { h.note({ text: "想写" }); } catch (e) { 写错 = String(e.message); }
记("上锁后写入被拒", /只读/.test(写错 ?? ""), 写错 ?? "居然写进去了");

h.close();
fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
