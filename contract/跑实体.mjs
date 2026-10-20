// 改前必读：/root/全忆-V20/设计.md
// 实体第一层：同一个人的别的叫法，找得到
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mount } from "../读我.mjs";
import { 解析实体, 合并实体, 读实体, 展开实体 } from "../实体.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

记("解析模型吐的实体", 解析实体('[{"类型":"人","名":"默风","别名":["小鱼","老默"]}]')[0].别名.length === 2, "");
记("不是 JSON 就给空", 解析实体("随便说说").length === 0, "");

const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "实体-"));
const 卡 = path.join(临时, "卡");
fs.writeFileSync(path.join(临时, "源.jsonl"), [
  { seq: 1, t: "2026-10-01T10:00:00+08:00", who: "user", kind: "text", text: "默风说要做个桌宠" },
  { seq: 2, t: "2026-10-02T10:00:00+08:00", who: "user", kind: "text", text: "小鱼说先跑通再说" },
].map((x) => JSON.stringify(x)).join("\n") + "\n");
execFileSync(process.execPath, [path.join(根, "造卡.mjs"), path.join(临时, "源.jsonl"), 卡], { stdio: "pipe" });

const h0 = mount(卡);
记("没实体时只命中自己那句", h0.recall("小鱼", 3).length === 1, "");
h0.close();

合并实体(卡, [{ 类型: "人", 名: "默风", 别名: ["小鱼"] }]);
合并实体(卡, [{ 类型: "人", 名: "小鱼", 别名: ["老默"] }]);
const 实 = 读实体(卡);
记("别名并成一个人", 实.length === 1 && 实[0].别名.includes("老默"), JSON.stringify(实));
记("展开：查小鱼带上默风", 展开实体(卡, "小鱼问的").includes("默风"), "");

const h = mount(卡);
记("有实体后也命中默风那句", h.recall("小鱼", 3).some((x) => x.seq === 1), JSON.stringify(h.recall("小鱼", 3).map((x) => x.seq)));
h.close();

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
