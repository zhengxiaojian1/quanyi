// 改前必读：/root/全忆-V20/设计.md
// U 盘场景：在挂载点里自动找到卡带，不靠用户填路径
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { 找卡带 } from "../找卡.mjs";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 根 = path.join(此处, "..");
const 临时 = fs.mkdtempSync(path.join(os.tmpdir(), "找卡-"));

fs.cpSync(path.join(根, "卡带样例", "桌宠"), path.join(临时, "U盘", "她"), { recursive: true });
fs.mkdirSync(path.join(临时, "别的东西", "照片"), { recursive: true });
fs.writeFileSync(path.join(临时, "别的东西", "manifest.json"), JSON.stringify({ 格式: "不是卡带" }));

const 列 = 找卡带({ 根: [path.join(临时, "别的东西"), path.join(临时, "U盘")] });
let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

记("能找到 U 盘里的卡带", 列.length === 1 && 列[0].endsWith(path.join("U盘", "她")), 列.join(" | "));
记("不会把假 manifest 当卡带", !列.some((p) => p.includes("别的东西")), "");
记("空目录返回空数组", 找卡带({ 根: [path.join(临时, "没有")] }).length === 0, "");

fs.rmSync(临时, { recursive: true, force: true });
console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
