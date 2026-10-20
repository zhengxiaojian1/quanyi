// 改前必读：/root/全忆-V20/设计.md
// 删掉 index/ 重建，结果要与原来逐字节一致
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mount } from "../读我.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "重建-"));
const 卡带 = path.join(临时, "卡带");
fs.cpSync(path.join(根, "卡带样例", "桌宠"), 卡带, { recursive: true });

function 树哈希(目录) {
  const h = createHash("sha256");
  const 走 = (d) => {
    for (const f of fs.readdirSync(d).sort()) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) 走(p);
      else h.update(path.relative(目录, p)).update(fs.readFileSync(p));
    }
  };
  走(目录);
  return h.digest("hex");
}

const 前 = 树哈希(path.join(卡带, "index"));
fs.rmSync(path.join(卡带, "index"), { recursive: true, force: true });
execFileSync(process.execPath, [path.join(根, "重建索引.mjs"), 卡带], { stdio: "pipe" });
const 后 = 树哈希(path.join(卡带, "index"));

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };
记("重建后的花与片内与原来逐字节一致", 前 === 后, 前.slice(0, 10) + " → " + 后.slice(0, 10));

const h = mount(卡带);
记("重建后能检索", h.recall("2D 的极限", 2)[0]?.seq === 73, "");
记("重建后能取帧", (() => { const f = h.frame(73); return f.ok && f.校验; })(), "");
记("重建后能读日记", h.brief({ 问: "2D 的极限" }).text.includes("【最近的日子】"), "");
h.close();

// 上锁的卡带也能重建，且重建后仍是密文
const 锁卡 = path.join(临时, "锁卡");
fs.cpSync(path.join(根, "卡带样例", "桌宠"), 锁卡, { recursive: true });
execFileSync(process.execPath, [path.join(根, "上锁.mjs"), 锁卡], { env: { ...process.env, QUANYI_KEY: "k" }, stdio: "pipe" });
fs.rmSync(path.join(锁卡, "index"), { recursive: true, force: true });
execFileSync(process.execPath, [path.join(根, "重建索引.mjs"), 锁卡], { env: { ...process.env, QUANYI_KEY: "k" }, stdio: "pipe" });
const 花长 = fs.statSync(path.join(锁卡, "index", "花.bin")).size;
记("上锁卡带重建后花仍加密（长度不是 4096 的整数倍）", 花长 % 4096 !== 0, 花长 + " 字节");
process.env.QUANYI_KEY = "k";
const 锁句柄 = mount(锁卡);
记("上锁卡带重建后仍可用", 锁句柄.recall("2D 的极限", 2)[0]?.seq === 73, "");
锁句柄.close();

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
