// 改前必读：/root/全忆-V20/设计.md
// ④ 久账：记下 14 天没再提的约定，可以在开头问一句；提过冷 30 天；情绪时不提
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mount } from "../读我.mjs";

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "久账-"));
fs.cpSync(path.join(import.meta.dirname, "..", "卡带样例", "桌宠"), path.join(临时, "卡"), { recursive: true });
const 卡 = path.join(临时, "卡");
const 路 = path.join(卡, "facts", "承诺.jsonl");
const 行 = fs.readFileSync(路, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
行[0].t = new Date(Date.now() - 20 * 864e5).toISOString();
fs.writeFileSync(路, 行.map((x) => JSON.stringify(x)).join("\n") + "\n");

const h = mount(卡);
记("20 天没提，会想问问", h.brief({ 问: "今天在做什么" }).text.includes("【想问问】"), "");
记("情绪时不问", !h.brief({ 问: "烦死了" }).text.includes("【想问问】"), "");

const 源 = 行[0].src?.[0];
h.记提过(源);
记("提过冷 30 天", !h.brief({ 问: "今天在做什么" }).text.includes("【想问问】"), "src " + 源);
h.close();

// 10 天：还不够久
const 卡2 = path.join(临时, "卡2");
fs.cpSync(path.join(临时, "卡"), 卡2, { recursive: true });
const 路2 = path.join(卡2, "facts", "承诺.jsonl");
const 行2 = fs.readFileSync(路2, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
行2[0].t = new Date(Date.now() - 10 * 864e5).toISOString();
fs.writeFileSync(路2, 行2.map((x) => JSON.stringify(x)).join("\n") + "\n");
fs.rmSync(path.join(卡2, "facts", "提过.jsonl"), { force: true });
const h2 = mount(卡2);
记("10 天还不够久", !h2.brief({ 问: "今天在做什么" }).text.includes("【想问问】"), "");
h2.close();

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
