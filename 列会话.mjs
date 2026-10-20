// 改前必读：/root/全忆-V20/设计.md
// 列会话：列出这台机器上的会话（不跑全解，只看文件大小和最后修改）
// 用法：node 列会话.mjs [--家 ~/.dsh] [--最近 20]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const 参 = process.argv.slice(2);
const 取 = (k, d) => { const i = 参.indexOf(k); return i >= 0 ? 参[i + 1] : d; };
const 家 = 取("--家", process.env.DSH_HOME ?? path.join(os.homedir(), ".dsh"));
const 几条 = Number(取("--最近", "20"));

const 根 = path.join(家, "sessions");
if (!fs.existsSync(根)) { console.error("没有 sessions 目录：" + 根); process.exit(2); }

const 列 = [];
const 走 = (d) => {
  let 们;
  try { 们 = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of 们) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) 走(p);
    else if (e.name === "session.v4.jsonl.zstd") {
      const st = fs.statSync(p);
      列.push({ id: path.basename(d), 路: p, 大小: st.size, 时: st.mtime });
    }
  }
};
走(根);
列.sort((a, b) => b.时 - a.时);
console.log("共 " + 列.length + " 个会话（按最近使用排）\n");
console.log("会话 id".padEnd(46) + "最后修改".padEnd(18) + "大小");
for (const x of 列.slice(0, 几条)) {
  const t = new Date(x.时).toISOString().slice(5, 16).replace("T", " ");
  console.log(x.id.padEnd(46) + t.padEnd(18) + (x.大小 / 1024).toFixed(0) + " KB");
}
console.log("\n导入某一个：node 并进卡带.mjs <卡带> <会话id>");
