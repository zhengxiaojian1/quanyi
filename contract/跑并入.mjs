// 改前必读：/root/全忆-V20/设计.md
// 并入：把一段会话并进已有卡带，老 seq 不变、日记不丢、可去重
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mount } from "../读我.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "并入-"));
const 卡带 = path.join(临时, "卡");
fs.cpSync(path.join(根, "卡带样例", "桌宠"), 卡带, { recursive: true });
const 源 = path.join(临时, "源.jsonl");
fs.writeFileSync(源, [
  { seq: 1, t: "2026-10-18T10:00:00+08:00", who: "user", kind: "text", text: "网吧里说的第一句" },
  { seq: 2, t: "2026-10-18T10:01:00+08:00", who: "her", kind: "text", text: "嗯，我记下了" },
].map((x) => JSON.stringify(x)).join("\n") + "\n");

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };
const 跑 = (参) => execFileSync(process.execPath, [path.join(根, "并进卡带.mjs"), ...参], { stdio: "pipe" }).toString();

const 干 = 跑([卡带, 源, "--干跑"]);
let h = mount(卡带);
记("干跑不动", h.manifest.帧数 === 88 && 干.includes("干跑"), "帧 " + h.manifest.帧数);
const 旧73 = h.frame(73);
h.close();

跑([卡带, 源]);
h = mount(卡带);
记("并进来两帧", h.manifest.帧数 === 90, "帧 " + h.manifest.帧数);
记("老帧一个字节没变", h.frame(73).sha === 旧73.sha, "");
记("新的能取到", h.frame(89).ok && h.frame(89).text.includes("网吧"), "");
记("日记还在", fs.existsSync(path.join(卡带, "diary", "2026-09-29.md")), "");
记("新的能检索", h.recall("网吧", 3).some((x) => x.seq === 89), "");
h.close();

const 再 = 跑([卡带, 源]);
h = mount(卡带);
记("同样的来源并第二次不重复", h.manifest.帧数 === 90 && 再.includes("没有新东西"), "帧 " + h.manifest.帧数);
h.close();

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
