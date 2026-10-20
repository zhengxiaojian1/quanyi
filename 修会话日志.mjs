// 改前必读：/root/全忆-V20/设计.md
// 修会话日志：坏行丢掉、缺 source 的 user/message 修成宿主形状
// 大帧走流式（内存只跟一行有关），小帧直接处理
// 用法：
//   node 修会话日志.mjs <文件或目录...>            # 干跑
//   node 修会话日志.mjs <文件或目录...> --修       # 真修（先备份）
//   --流   强制流式（默认单帧 > 16MB 自动流式）
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createZstdDecompress, zstdCompressSync, zstdDecompressSync } from "node:zlib";

export async function 扫修(目标, 选项 = {}) {
  const 真修 = 选项.真修 === true;
  const 文件们 = 目标.flatMap((p) => 找文件(p, []));
  if (!文件们.length) return { 文件们: 0, 汇总: [], 总修: 0, 问题: 0 };
  let 总修 = 0, 问题 = 0;
  const 汇总 = [];
  for (const f of 文件们) {
    const r = await 修一个(f, 真修, 选项.强制流 === true);
    总修 += r.修;
    if (r.修 || r.坏) { 问题++; 汇总.push({ ...r, 路: f }); }
  }
  return { 文件们: 文件们.length, 汇总, 总修, 问题 };
}

if (process.argv[1] && path.basename(process.argv[1]) === "修会话日志.mjs") {
  const 参 = process.argv.slice(2);
  const 真修 = 参.includes("--修");
  const 目标 = 参.filter((x) => !x.startsWith("--"));
  if (!目标.length) { console.error("用法: node 修会话日志.mjs <文件或目录...> [--修] [--流]"); process.exit(2); }
  const 结果 = await 扫修(目标, { 真修, 强制流: 参.includes("--流") });
  for (const r of 结果.汇总) console.log((真修 ? "已修 " : "待修 ") + r.修 + " 条 · 坏行 " + r.坏 + " · 帧 " + r.帧 + (r.流 ? "（流式 " + r.流 + "）" : "") + " · " + r.路);
  console.log("\n扫了 " + 结果.文件们 + " 个会话；有问题 " + 结果.问题 + " 个；共" + (真修 ? "修" : "需修") + " " + 结果.总修 + " 条");
  if (!真修 && 结果.总修 > 0) console.log("确认无误后加 --修 再跑一次（会先备份）");
}

const 魔 = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
const 流阈 = 16 * 1024 * 1024;

function 找文件(p, out = []) {
  let st;
  try { st = fs.statSync(p); } catch { return out; }
  if (st.isDirectory()) for (const e of fs.readdirSync(p, { withFileTypes: true })) 找文件(path.join(p, e.name), out);
  else if (p.endsWith("session.v4.jsonl.zstd")) out.push(p);
  return out;
}

function 修行(l, 计) {
  if (!l) return l;
  let o;
  try { o = JSON.parse(l); } catch { 计.坏++; return null; }
  if (o.type !== "user/message") return l;
  const s = o.data?.source;
  const 合法 = s && typeof s === "object" && typeof s.kind === "string" && s.kind.length > 0 && s.kind !== "plugin";
  if (合法) return l;
  const 旧 = o.data ?? {};
  const 纯文 = typeof 旧.content === "string" ? 旧.content
    : Array.isArray(旧.content) ? 旧.content.map((c) => c?.text ?? "").join("") : "";
  o.data = {
    id: typeof 旧.id === "string" ? 旧.id : randomUUID(),
    role: "user",
    content: [{ type: "text", text: 纯文 }],
    source: { kind: "user", form: "notice", summary: "修复：补 source" },
  };
  计.修++;
  return JSON.stringify(o);
}

function 帧位(fd, 大小) {
  const 块 = 4 * 1024 * 1024;
  const 冲 = Buffer.alloc(块 + 3);
  const 位 = [];
  let 读 = 0;
  while (读 < 大小) {
    const n = fs.readSync(fd, 冲, 0, Math.min(块 + 3, 大小 - 读), 读);
    if (n <= 0) break;
    for (let i = 0; i + 3 < n; i++) {
      if (冲[i] === 0x28 && 冲[i + 1] === 0xb5 && 冲[i + 2] === 0x2f && 冲[i + 3] === 0xfd) {
        const abs = 读 + i;
        if (位[位.length - 1] !== abs) 位.push(abs);
      }
    }
    if (n < 块 + 3) break;
    读 += n - 3;
  }
  return 位;
}

async function 修帧流(路, 起, 止, 写, 计) {
  const 解 = createZstdDecompress();
  fs.createReadStream(路, { start: 起, end: 止 - 1 }).pipe(解);
  let 余 = "", 批 = "";
  const 落 = (行) => {
    const 新 = 修行(行, 计);
    if (新 === null) return;
    批 += 新 + "\n";
    if (批.length >= 8 << 20) { 写.write(zstdCompressSync(Buffer.from(批))); 批 = ""; }
  };
  try {
    for await (const 块 of 解) {
      余 += 块.toString("utf8");
      const 行们 = 余.split("\n");
      余 = 行们.pop();
      for (const l of 行们) 落(l);
    }
  } catch { 计.坏++; }
  if (余) 落(余);
  if (批) 写.write(zstdCompressSync(Buffer.from(批)));
}

async function 修一个(路, 真修, 强制流 = false) {
  const fd = fs.openSync(路, "r");
  const 大小 = fs.fstatSync(fd).size;
  const 位 = 帧位(fd, 大小);
  const 计 = { 修: 0, 坏: 0, 帧: 位.length, 流: 0 };
  const 临时 = 路 + ".修.tmp";
  const 写 = 真修 ? fs.createWriteStream(临时) : null;

  for (let k = 0; k < 位.length; k++) {
    const 起 = 位[k], 止 = 位[k + 1] ?? 大小, 长 = 止 - 起;
    if (写 && (强制流 || 长 > 流阈)) {
      计.流++;
      await 修帧流(路, 起, 止, 写, 计);
      continue;
    }
    const 冲 = Buffer.alloc(长);
    fs.readSync(fd, 冲, 0, 长, 起);
    let 文 = "";
    try { 文 = zstdDecompressSync(冲).toString("utf8"); } catch { 计.坏++; continue; }
    const 行们 = 文.split("\n");
    const 出 = [];
    for (const l of 行们) {
      const 新 = 修行(l, 计);
      if (新 !== null) 出.push(新);
    }
    if (写) 写.write(zstdCompressSync(Buffer.from(出.join("\n"))));
  }
  fs.closeSync(fd);
  if (!写) return 计;
  await new Promise((res) => 写.end(res));
  fs.copyFileSync(路, 路 + ".bak-修日志-" + Date.now());
  fs.renameSync(临时, 路);
  return 计;
}

