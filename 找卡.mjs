// 改前必读：/root/全忆-V20/设计.md
// 找卡带：在常见挂载点里找带 manifest.json 且格式对得上的目录（给 U 盘场景用）
import fs from "node:fs";
import path from "node:path";

export const 默认根 = ["/sdcard", "/media", "/mnt", "/run/media", "/Volumes", "/storage"];

// 手机当 U 盘（MTP）时，Linux 挂在 gvfs 下：/run/user/1000/gvfs/mtp:host=…
function gvfs根() {
  const 出 = [];
  const uids = fs.existsSync("/run/user") ? fs.readdirSync("/run/user") : [];
  for (const u of uids) {
    for (const g of ["/run/user/" + u + "/gvfs", "/var/run/user/" + u + "/gvfs"]) {
      if (!fs.existsSync(g)) continue;
      for (const e of fs.readdirSync(g)) 出.push(path.join(g, e));
    }
  }
  return 出;
}

export function 找卡带({ 根 = 默认根, 深 = 4 } = {}) {
  const 结果 = [];
  const 走 = (d, 层) => {
    if (层 > 深) return;
    let 列;
    try { 列 = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of 列) {
      if (!e.isDirectory()) continue;
      const p = path.join(d, e.name);
      if (e.name.startsWith(".")) continue;
      const mf = path.join(p, "manifest.json");
      if (fs.existsSync(mf)) {
        try {
          const m = JSON.parse(fs.readFileSync(mf, "utf8"));
          if (m.格式 === "全忆卡带") { 结果.push(p); continue; }
        } catch { /* 不是卡带，继续往下找 */ }
      }
      走(p, 层 + 1);
    }
  };
  for (const r of [...根, ...gvfs根()]) if (fs.existsSync(r)) 走(r, 1);
  return [...new Set(结果)];
}

if (process.argv[1] && path.basename(process.argv[1]) === "找卡.mjs") {
  const 根 = process.argv[2] ? [process.argv[2]] : 默认根;
  const 列 = 找卡带({ 根 });
  if (!列.length) { console.log("没找到卡带"); process.exit(1); }
  for (const p of 列) console.log(p);
}
