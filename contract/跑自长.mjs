// 改前必读：/root/全忆-V20/设计.md
// 自长：把会话里的原话补成帧；可重复跑不叠加；上锁的卡带不长
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mount } from "../读我.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "自长-"));
let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };
const 跑 = (卡, 源) => { try { return execFileSync(process.execPath, [path.join(根, "自长.mjs"), 卡, "--会话", 源], { encoding: "utf8" }); } catch (e) { return String(e.stdout ?? ""); } };

const 卡 = path.join(临时, "卡");
fs.cpSync(path.join(根, "卡带样例", "桌宠"), 卡, { recursive: true });
const 源 = path.join(临时, "源.jsonl");
fs.writeFileSync(源, [
  { t: "2026-10-18T21:40:00+08:00", who: "user", text: "自长的第一句" },
  { t: "2026-10-18T21:40:10+08:00", who: "her", text: "自长的第二句：她的回答" },
  { t: "2026-10-18T21:40:20+08:00", who: "user", text: "<compacted-summary> 这段不该收" },
].map((x) => JSON.stringify(x)).join("\n") + "\n");

const 前 = JSON.parse(fs.readFileSync(path.join(卡, "manifest.json"), "utf8")).帧数;
跑(卡, 源);
const h = mount(卡);
记("收了两条（脚手架被滤掉）", h.manifest.帧数 === 前 + 2, 前 + " → " + h.manifest.帧数);
记("新帧逐字可取", h.frame(h.manifest.帧数).ok && h.frame(h.manifest.帧数).校验 === true, "");
记("她的回答落成了帧（who=her）", h.frame(h.manifest.帧数).who === "her", "");
h.close();
跑(卡, 源);
记("再跑一次不叠加", JSON.parse(fs.readFileSync(path.join(卡, "manifest.json"), "utf8")).帧数 === 前 + 2, "");

// 上锁的卡带只读
const 锁卡 = path.join(临时, "锁卡");
fs.cpSync(卡, 锁卡, { recursive: true });
const m = JSON.parse(fs.readFileSync(path.join(锁卡, "manifest.json"), "utf8"));
m.加密 = { 算法: "aes-256-gcm", 盐: "x", 检查: "y" };
fs.writeFileSync(path.join(锁卡, "manifest.json"), JSON.stringify(m, null, 2));
const 前2 = m.帧数;
跑(锁卡, 源);
记("上锁的卡带不长", JSON.parse(fs.readFileSync(path.join(锁卡, "manifest.json"), "utf8")).帧数 === 前2, "");

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
