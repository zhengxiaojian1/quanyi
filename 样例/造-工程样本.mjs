// 改前必读：/root/全忆-V20/设计.md
// 工程样本生成器：确定性伪随机，工具帧为主（分片/内存/检索压力测试）
// 用法：node 造-工程样本.mjs [帧数] [输出文件]

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const 本目录 = dirname(fileURLToPath(import.meta.url));
const 帧数 = Number(process.argv[2] ?? 5000);
const 输出 = process.argv[3] ?? join(本目录, "工程-5000帧.jsonl");

function 伪随机(种子) {
  let a = 种子 >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = 伪随机(20260929);
const 取 = (arr) => arr[Math.floor(rnd() * arr.length)];
const 整数 = (a, b) => a + Math.floor(rnd() * (b - a + 1));

const 目录 = ["src/components", "src/lib", "src/hooks", "public/assets", "scripts", "docs"];
const 文件 = ["Pet.tsx", "useIdle.ts", "rig.ts", "build.mjs", "notes.md", "live2d.ts", "vrm.ts", "main.ts"];
const 报错 = [
  "error TS2322: Type 'string' is not assignable to type 'number'.",
  "error TS2307: Cannot find module './assets/pet-idle.png'.",
  "error during build: Could not resolve \"./assets/pet.png\" from \"src/components/Pet.tsx\"",
  "Error: ENOENT: no such file or directory, open 'public/assets/model.vrm'",
  "RangeError: Invalid typed array length",
  "WARN  chunk size exceeds 500 kB after minification.",
];

function 工具帧() {
  const 类型 = 取(["bash", "bash", "bash", "read", "edit", "grep"]);
  const 路径 = 取(目录) + "/" + 取(文件);
  if (类型 === "bash") {
    const 命令 = 取([
      "npm run build", "npm test -- --run", "ls -la public/assets",
      "node scripts/build.mjs", "grep -n idle " + 路径, "du -sh public lost+found",
    ]);
    let 体 = "$ " + 命令 + "\n";
    const 行数 = 整数(6, 40);
    for (let i = 0; i < 行数; i++) {
      体 += rnd() < 0.25 ? 取(报错) + "\n" : "  " + 取(文件) + ":" + 整数(1, 400) + ":" + 整数(1, 90) + "  ok\n";
    }
    return { tool: "bash", text: 体 };
  }
  if (类型 === "read") {
    const 行 = 整数(20, 120);
    let 体 = 路径 + "  (" + 行 + " lines)\n";
    for (let i = 1; i <= 行; i++) 体 += String(i).padStart(4) + "  " + 取(["const", "let", "return", "if (", "  ", "// ", "export"]) + " " + 取(文件) + "_" + 整数(1, 999) + "\n";
    return { tool: "read", text: 体 };
  }
  if (类型 === "edit") {
    return { tool: "edit", text: 路径 + ":" + 整数(10, 300) + "\n- " + 取(文件) + " 旧值 " + 整数(1, 9999) + "\n+ " + 取(文件) + " 新值 " + 整数(1, 9999) };
  }
  const 条 = [];
  for (let i = 0; i < 整数(3, 15); i++) 条.push("src/" + 取(文件) + ":" + 整数(1, 400) + ": " + 取(["idle", "breath", "lookAt", "blink"]) + "(" + 整数(1, 900) + ")");
  return { tool: "grep", text: "$ grep -rn idle src/\n" + 条.join("\n") };
}

const 人话 = ["再跑一遍", "这个值改回 8192", "为什么还是穿模", "先别管画质", "我试试", "算了，明天再说", "你看这个对不对", "好像好一点了"];
const 她话 = ["先看错误，不要改代码", "把日志贴我", "这一步不用纠结，先过去", "你现在的顺序反了", "跑通了再说", "这个可以先放着"];

let seq = 0;
let 时 = new Date("2026-09-25T10:00:00+08:00").getTime();
const 行 = [];
for (let i = 0; i < 帧数; i++) {
  seq += 1;
  时 += 整数(5, 90) * 1000;
  const t = new Date(时).toISOString().replace(".000Z", "+08:00");
  const 谁 = rnd();
  if (谁 < 0.78) {
    const f = 工具帧();
    行.push(JSON.stringify({ seq, t, who: "tool", kind: "tool", tool: f.tool, text: f.text }));
  } else if (谁 < 0.9) {
    行.push(JSON.stringify({ seq, t, who: "user", kind: "text", text: 取(人话) }));
  } else {
    行.push(JSON.stringify({ seq, t, who: "her", kind: "text", text: 取(她话) }));
  }
}
writeFileSync(输出, 行.join("\n") + "\n", "utf8");
const 字节 = Buffer.byteLength(行.join("\n"));
console.log("写出 " + 帧数 + " 帧 → " + 输出);
console.log("约 " + (字节 / 1024 / 1024).toFixed(2) + " MB，平均 " + Math.round(字节 / 帧数) + " B/帧");
