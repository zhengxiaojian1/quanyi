// 改前必读：/root/全忆-V20/设计.md
// 给一张卡带上锁：raw / diary / facts / index/花.bin 就地加密
// 用法：QUANYI_KEY='口令' node 上锁.mjs <卡带>
import fs from "node:fs";
import path from "node:path";
import { 派生钥匙, 加密, 新盐 } from "./锁.mjs";

const 卡带 = process.argv[2];
if (!卡带) { console.error("用法: QUANYI_KEY='口令' node 上锁.mjs <卡带>"); process.exit(2); }
const 口令 = process.env.QUANYI_KEY;
if (!口令) { console.error("没有 QUANYI_KEY（口令不进卡带）"); process.exit(2); }
const 根 = path.resolve(卡带);
const manifest = JSON.parse(fs.readFileSync(path.join(根, "manifest.json"), "utf8"));
if (manifest.加密) { console.error("这张卡带已经上锁了"); process.exit(1); }

const 盐 = 新盐();
const 钥匙 = 派生钥匙(口令, 盐);
let 数 = 0;
function 走(相对) {
  const 全 = path.join(根, 相对);
  if (!fs.existsSync(全)) return;
  const st = fs.statSync(全);
  if (st.isDirectory()) { for (const f of fs.readdirSync(全)) 走(path.join(相对, f)); return; }
  if (相对.endsWith(".md") || 相对.endsWith(".jsonl") || 相对.endsWith(".tsv") || 相对.endsWith(".bin")) {
    fs.writeFileSync(全, 加密(fs.readFileSync(全), 钥匙));
    数++;
  }
}
for (const d of ["raw", "diary", "facts"]) 走(d);
// 对话账里是原话，一样要锁
走("对话.jsonl");
走(path.join("index", "花.bin"));

manifest.加密 = { 算法: "aes-256-gcm", 盐, 文件数: 数, 锁于: new Date().toISOString() };
fs.writeFileSync(path.join(根, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("上锁完成：" + 数 + " 个文件");
