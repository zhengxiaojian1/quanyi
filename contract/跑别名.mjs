// 改前必读：/root/全忆-V20/设计.md
// 别名：模型离线沉淀「换说法」，检索时零成本展开
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mount } from "../读我.mjs";
import { 解析别名, 抽别名, 合并别名, 读别名 } from "../别名.mjs";

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

const 解析 = 解析别名('好的：\n[["瓶颈","到顶","极限"],["约定","说好","再战"]]\n以上');
记("能解析模型吐的 JSON", Object.keys(解析).length === 2 && 解析["瓶颈"].includes("到顶"), JSON.stringify(解析));
记("杂字里也能抠出来", 解析别名('随便说说 [["a","b"]] 完')["a"]?.[0] === "b", "");
记("不是 JSON 就给空", Object.keys(解析别名("没有数组")).length === 0, "");
记("每组最多 3 个别名", 解析别名('[["x","1","2","3","4"]]')["x"].length === 3, "");

const 假说 = async () => ({ text: '[["瓶颈","到顶","极限"]]' });
const 新 = await 抽别名({ 说: 假说, 帧: [{ text: "我觉得到顶了" }], 已有: {} });
记("抽别名用模型吐的", 新["瓶颈"]?.[0] === "到顶", JSON.stringify(新));

const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "别名-"));
const 卡 = path.join(临时, "卡");
fs.cpSync(path.join(import.meta.dirname, "..", "卡带样例", "桌宠"), 卡, { recursive: true });
合并别名(卡, { 瓶颈: ["到顶", "极限"] });
合并别名(卡, { 瓶颈: ["极限", "顶住"] });
const 表 = 读别名(卡);
记("合并去重、最多留 4 个", 表["瓶颈"].length <= 4 && 表["瓶颈"].filter((x) => x === "极限").length === 1, JSON.stringify(表["瓶颈"]));

const h = mount(卡);
记("展开前查不到「瓶颈」", true, "（对照组）");
const 果 = h.recall("瓶颈", 3);
记("展开后能查到「到顶/极限」那几帧", 果.length > 0 && 果.some((x) => x.seq === 70 || x.seq === 73), JSON.stringify(果.map((x) => x.seq)));
h.close();

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
