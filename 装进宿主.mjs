// 改前必读：/root/全忆-V20/设计.md
// 装进宿主：自动找 DSH profile → 建软链 → 加 bundle → 提示重启
// 用法：
//   node 装进宿主.mjs [--profile 名] [--家 ~/.dsh] [--复制]
//   --复制：把工具链拷到本机（手机当 U 盘 / MTP 时用，拔线也不断）
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 参 = process.argv.slice(2);
const 取 = (k) => { const i = 参.indexOf(k); return i >= 0 ? 参[i + 1] : undefined; };
const 家 = 取("--家") ?? process.env.DSH_HOME ?? path.join(os.homedir(), ".dsh");
const 指定 = 取("--profile");
const 复制 = 参.includes("--复制");

if (!fs.existsSync(path.join(此处, "插件"))) { console.error("找不到插件目录：" + path.join(此处, "插件")); process.exit(2); }

let 源 = path.join(此处, "插件");
if (复制) {
  const 落 = path.join(家, "quanyi", "工具");
  fs.rmSync(落, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(落), { recursive: true });
  fs.cpSync(此处, 落, { recursive: true });
  源 = path.join(落, "插件");
  console.log("已把工具链复制到本机：" + 落);
}

const 档目录 = path.join(家, "profiles");
if (!fs.existsSync(档目录)) { console.error("没找到宿主 profile：" + 档目录); process.exit(2); }

const 候选 = [];
for (const 名 of fs.readdirSync(档目录)) {
  const p = path.join(档目录, 名, "package.json");
  if (!fs.existsSync(p)) continue;
  try {
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    if (j?.dsh?.profile?.bundles) 候选.push({ 名, 路: path.join(档目录, 名) });
  } catch { /* 坏 profile 跳过 */ }
}
if (!候选.length) { console.error("profile 里没有 dsh.profile.bundles，装不了"); process.exit(2); }
const 目标 = 指定 ? 候选.find((c) => c.名 === 指定) : 候选[0];
if (!目标) { console.error("没有这个 profile：" + 指定 + "（有：" + 候选.map((c) => c.名).join(" / ") + "）"); process.exit(2); }

const 链 = path.join(目标.路, "node_modules", "dsh-memory-v20");
fs.mkdirSync(path.dirname(链), { recursive: true });
try { fs.rmSync(链, { force: true }); } catch { /* 忽略 */ }
fs.symlinkSync(源, 链, "dir");

const pkg路 = path.join(目标.路, "package.json");
const 备份 = pkg路 + ".bak-装v20-" + Date.now();
fs.copyFileSync(pkg路, 备份);
const j = JSON.parse(fs.readFileSync(pkg路, "utf8"));
if (!j.dsh.profile.bundles.includes("dsh-memory-v20")) j.dsh.profile.bundles.push("dsh-memory-v20");
fs.writeFileSync(pkg路, JSON.stringify(j, null, 2) + "\n");

console.log("✅ 已装进 profile：" + 目标.名);
console.log("   软链：" + 链 + " → " + 源);
console.log("   备份：" + 备份);
console.log(复制 ? "   （已复制到本机：拔掉手机也不影响插件，但卡带会随线一起走）" : "");
console.log("\n重启宿主后看日志：");
console.log("   [memory-v20] 挂上卡带：…");
console.log("   [memory-v20] 工具已注册：recall / frame / forget");
