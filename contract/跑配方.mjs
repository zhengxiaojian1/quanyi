// 改前必读：/root/全忆-V20/设计.md
// 配方机：能力 = 原语 + 固定算子；配方是数据，不是代码
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mount } from "../读我.mjs";
import { 跑配方, 算子表 } from "../配方.mjs";

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "配方-"));
fs.cpSync(path.join(import.meta.dirname, "..", "卡带样例", "桌宠"), path.join(临时, "卡"), { recursive: true });
const h = mount(path.join(临时, "卡"));

记("有九个算子", Object.keys(算子表).length >= 9, Object.keys(算子表).join(","));

const 变 = 跑配方(h, { 名: "变了没", 算子: "变了没" }, "桌宠");
记("变了没：给出最早和最近，且不是同一帧", 变.ok && 变.条.length === 2 && 变.条[0].seq !== 变.条[1].seq, JSON.stringify(变.条.map((x) => x.seq)));

const 久 = 跑配方(h, { 名: "多久没提", 算子: "多久没提" }, "桌宠");
记("多久没提：带天数", 久.ok && 久.条[0]?.备注.includes("天前"), 久.条[0]?.备注 ?? "");

const 谁 = 跑配方(h, { 名: "谁说过", 算子: "谁说过" }, "桌宠");
记("谁说过：数得出人次", 谁.ok && /他 \d+ 次/.test(谁.条[0]?.备注 ?? ""), 谁.条[0]?.备注 ?? "");

const 计 = 跑配方(h, { 名: "计数", 算子: "计数" }, "桌宠");
记("计数：说得出几次、谁说的", /提过 \d+ 次（他 \d+ · 她 \d+）/.test(计.条[0]?.备注 ?? ""), 计.条[0]?.备注 ?? "");

const 时 = 跑配方(h, { 名: "时间线", 算子: "时间线" }, "桌宠");
记("时间线：按天展开", 时.条.length >= 2 && /\d{4}-\d{2}-\d{2}：\d+ 次/.test(时.条[0].备注), "");

const 比 = 跑配方(h, { 名: "两件事比", 算子: "两件事比", 参数: { 问2: "约定" } }, "桌宠");
记("两件事比：给出先后", 比.条.length === 2 && 比.条[0].备注.includes("先"), 比.条[0]?.备注 ?? "");
记("两件事比：缺第二件事就空", 跑配方(h, { 名: "两件事比", 算子: "两件事比" }, "桌宠").条.length === 0, "");

const 滤 = 跑配方(h, { 名: "只她", 算子: "最近", 过滤: "只她说的" }, "桌宠");
记("过滤：只她说的", 滤.ok && 滤.条.length > 0 && 滤.条.every((x) => x.seq !== 1), JSON.stringify(滤.条.map((x) => x.seq)));
记("取：只留一条", 跑配方(h, { 名: "取一", 算子: "最近", 取: 1 }, "桌宠").条.length === 1, "");

const 坏 = 跑配方(h, { 名: "x", 算子: "不存在" }, "桌宠");
记("没有的算子照实说", 坏.ok === false && 坏.why.includes("没有这个算子"), "");

const 空 = 跑配方(h, { 名: "最近", 算子: "最近" }, "量子纠缠与猫");
记("查不到就空，不编", 空.ok && 空.条.length === 0, "");
h.close();

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
