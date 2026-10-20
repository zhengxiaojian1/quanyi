// 改前必读：/root/全忆-V20/设计.md
// 快照：重建/合并之前先留一份，出事能回滚
// 用法：
//   node 快照.mjs <卡带>               拍一张（留最近 3 份）
//   node 快照.mjs <卡带> --列表
//   node 快照.mjs <卡带> --回滚 <名字>  回到那一张
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const 保留 = 3;

function 快照根(卡) { return path.join(卡, ".快照"); }

export function 拍(卡, 标 = "") {
  const 根 = 快照根(卡);
  fs.mkdirSync(根, { recursive: true });
  const 名 = (标 || new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19));
  const 到 = path.join(根, 名);
  if (fs.existsSync(到)) return 到;
  // 不能往自己的子目录里拷：先拷到临时目录，再挪进来
  const 临 = path.join(os.tmpdir(), "快照-" + Date.now() + "-" + process.pid);
  fs.cpSync(卡, 临, { recursive: true, filter: (p) => !p.includes("/.快照") });
  fs.renameSync(临, 到);
  // 只留最近 N 份
  const 有 = fs.readdirSync(根).filter((x) => !x.startsWith(".")).sort();
  for (const 旧 of 有.slice(0, Math.max(0, 有.length - 保留))) fs.rmSync(path.join(根, 旧), { recursive: true, force: true });
  return 到;
}

export function 列(卡) {
  const 根 = 快照根(卡);
  if (!fs.existsSync(根)) return [];
  return fs.readdirSync(根).filter((x) => !x.startsWith(".")).sort().reverse();
}

export function 回滚(卡, 名) {
  const 根 = 快照根(卡);
  const 源 = path.join(根, 名);
  if (!fs.existsSync(源)) throw new Error("没有这张快照：" + 名);
  拍(卡, "回滚前-" + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19));   // 先保当前
  for (const e of fs.readdirSync(卡)) {
    if (e === ".快照") continue;
    fs.rmSync(path.join(卡, e), { recursive: true, force: true });
  }
  for (const e of fs.readdirSync(源)) fs.cpSync(path.join(源, e), path.join(卡, e), { recursive: true });
  return 源;
}

if (process.argv[1] && path.basename(process.argv[1]) === "快照.mjs") {
  const [卡, ...余] = process.argv.slice(2);
  if (!卡) { console.error("用法: node 快照.mjs <卡带> [--列表] [--回滚 <名字>]"); process.exit(2); }
  if (余.includes("--列表")) { const 们 = 列(卡); console.log(们.length ? 们.join("\n") : "还没有快照"); process.exit(0); }
  if (余.includes("--回滚")) { const 名 = 余[余.indexOf("--回滚") + 1]; try { 回滚(卡, 名); console.log("已回滚到：" + 名); } catch (e) { console.error(e.message); process.exit(1); } process.exit(0); }
  console.log("已拍：" + 拍(卡));
}
