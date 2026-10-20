// 改前必读：/root/全忆-V20/设计.md
// 换设备 / 换模型：她要照实知道一次，然后接着往下，不表演
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mount } from "../读我.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "接续-"));
const 卡带 = path.join(临时, "卡带");
fs.cpSync(path.join(根, "卡带样例", "桌宠"), 卡带, { recursive: true });

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

const mf = path.join(卡带, "manifest.json");
function 写上次(o) {
  const m = JSON.parse(fs.readFileSync(mf, "utf8"));
  if (o) m.last_seen = o; else delete m.last_seen;
  fs.writeFileSync(mf, JSON.stringify(m, null, 2));
}

process.env.QUANYI_HOST = "新电脑";
process.env.DEEPSEEK_MODEL = "deepseek-flash";

写上次(null);
let h = mount(卡带);
记("第一次挂载没有「接续」一行", !h.brief({}).text.includes("接续："), "");
h.close();

写上次({ t: "2026-09-29T05:00:00.000Z", host: "旧手机", model: "deepseek-v4-pro" });
h = mount(卡带);
const b = h.brief({});
记("换设备会照实说", b.text.includes("换了设备（旧手机 → 新电脑）"), "");
记("换模型会照实说", b.text.includes("换了模型（deepseek-v4-pro → deepseek-flash）"), "");
const r = h.记接续();
记("记接续写进账里", fs.readFileSync(path.join(卡带, "facts", "接续.jsonl"), "utf8").includes("新电脑"), "");
记("记接续更新 manifest", JSON.parse(fs.readFileSync(mf, "utf8")).last_seen?.host === "新电脑", "");
记("记接续返回本次身份", r.host === "新电脑" && r.model === "deepseek-flash", "");
h.close();

h = mount(卡带);
记("记过之后不再重复提示", !h.brief({}).text.includes("接续："), "");
h.close();

process.env.QUANYI_HOST = "又一台";
h = mount(卡带);
记("再换设备会再提示一次", h.brief({}).text.includes("换了设备（新电脑 → 又一台）"), "");
记("换过几次也有数（第 2 次搬家）", h.brief({}).text.includes("第 2 次搬家"), "");
h.记接续();
h.close();

process.env.QUANYI_HOST = "第三台";
h = mount(卡带);
记("第三次搬家会数到 3", h.brief({}).text.includes("第 3 次搬家"), "");
h.close();

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
