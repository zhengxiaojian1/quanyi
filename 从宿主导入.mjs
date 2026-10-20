// 改前必读：/root/全忆-V20/设计.md
// 把宿主会话（任意格式，交给 读取器.mjs）整份导成卡带
// 用法：node 从宿主导入.mjs <会话id或文件路径> <卡带> [--家 ~/.dsh]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { 读任意 } from "./读取器.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));

export function 找日志(号, 家 = process.env.DSH_HOME ?? path.join(process.env.HOME ?? "/root", ".dsh")) {
  if (号 && fs.existsSync(号) && fs.statSync(号).isFile()) return 号;
  const 根 = path.join(家, "sessions");
  if (!fs.existsSync(根)) return null;
  const 找 = (d) => {
    let 列;
    try { 列 = fs.readdirSync(d, { withFileTypes: true }); } catch { return null; }
    for (const e of 列) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (号 && (e.name === 号 || e.name.endsWith(号))) {
          const f = path.join(p, "session.v4.jsonl.zstd");
          if (fs.existsSync(f)) return f;
        }
        const r = 找(p);
        if (r) return r;
      }
    }
    return null;
  };
  return 找(根);
}

export function 读会话(路) {
  const r = 读任意(路);
  return { 帧: r.帧, 坏帧: r.坏帧, 格式: r.格式 };
}

if (process.argv[1] && path.basename(process.argv[1]) === "从宿主导入.mjs") {
  const 参 = process.argv.slice(2);
  const 家参 = 参.indexOf("--家") >= 0 ? 参[参.indexOf("--家") + 1] : undefined;
  const [号, 卡带] = 参.filter((x, i) => x !== "--家" && 参[i - 1] !== "--家");
  if (!号 || !卡带) { console.error("用法: node 从宿主导入.mjs <会话id或文件路径> <卡带>"); process.exit(2); }
  const 路 = 找日志(号, 家参);
  if (!路) { console.error("没找到会话日志：" + 号); process.exit(2); }
  const { 帧, 坏帧, 格式 } = 读会话(路);
  if (帧.length < 2) { console.error("这个会话里没有可导的对话（" + 帧.length + " 条）"); process.exit(2); }
  fs.mkdirSync(卡带, { recursive: true });
  fs.writeFileSync(path.join(卡带, "导入.jsonl"), 帧.map((x) => JSON.stringify(x)).join("\n") + "\n");
  console.log("从 " + 格式 + " 导出 " + 帧.length + " 条（坏帧 " + 坏帧 + "）→ " + 卡带);
  execFileSync(process.execPath, [path.join(此处, "导入卡带.mjs"), 卡带], { stdio: "inherit" });
}
