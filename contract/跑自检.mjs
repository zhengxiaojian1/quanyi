// 改前必读：/root/全忆-V20/设计.md
// 自检：好卡带全过；raw 多一行 / 少一行都要当场报
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "自检-"));
let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

const 跑 = (卡) => {
  try { return { ok: true, 出: execFileSync(process.execPath, [path.join(根, "自检.mjs"), 卡], { stdio: "pipe" }).toString() }; }
  catch (e) { return { ok: false, 出: String(e.stdout ?? "") + String(e.stderr ?? "") }; }
};

const 好 = path.join(临时, "好");
fs.cpSync(path.join(根, "卡带样例", "桌宠"), 好, { recursive: true });
const r1 = 跑(好);
记("好卡带全过", r1.ok && r1.出.includes("全部通过"), r1.出.trim().split("\n").pop());

const 多 = path.join(临时, "多");
fs.cpSync(好, 多, { recursive: true });
const 片 = fs.readdirSync(path.join(多, "raw"), { recursive: true }).filter((x) => x.endsWith(".jsonl"));
fs.appendFileSync(path.join(多, "raw", 片[0]), JSON.stringify({ seq: 9999, t: "x", who: "user", kind: "text", text: "多出来的" }) + "\n");
const r2 = 跑(多);
记("raw 多一行会被抓", !r2.ok && r2.出.includes("帧数与 raw 行数对得上"), "");

const 少 = path.join(临时, "少");
fs.cpSync(好, 少, { recursive: true });
const m = JSON.parse(fs.readFileSync(path.join(少, "manifest.json"), "utf8"));
m.帧数 = (m.帧数 ?? 0) + 5;
fs.writeFileSync(path.join(少, "manifest.json"), JSON.stringify(m));
const r3 = 跑(少);
记("manifest 帧数不对会被抓", !r3.ok && r3.出.includes("帧数与 raw 行数对得上"), "");

const 没 = path.join(临时, "没");
const r4 = 跑(没);
记("没有 manifest 会被抓", !r4.ok, "");

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
