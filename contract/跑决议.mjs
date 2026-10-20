// 改前必读：/root/全忆-V20/设计.md
// 决议账（最小版）：只存指针；取代链；正文一律回 frame
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mount } from "../读我.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "决议-"));
const 卡 = path.join(临时, "卡");
fs.cpSync(path.join(此处, "..", "卡带样例", "桌宠"), 卡, { recursive: true });
let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

const h = mount(卡);
const a = h.记决议(73);
记("写入只存指针（seq + sha）", a.seq === 73 && String(a.sha).startsWith("sha256:"), "");
记("取得到", h.决议列().some((x) => x.seq === 73), "");

h.取代决议(73, 70);
const 列 = h.决议列();
记("取代后：旧条仍在且标被取代", 列.find((x) => x.seq === 73)?.已取代 === true, "");
记("取代后：新条未被标", 列.find((x) => x.seq === 70)?.已取代 === false, "");
记("正文仍逐字取得到", h.frame(73).ok && h.frame(73).校验 === true, "");
记("没存正文（文件里不含原话）", !fs.readFileSync(path.join(卡, "facts", "决议.jsonl"), "utf8").includes("2D 的极限"), "");
h.close();

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
