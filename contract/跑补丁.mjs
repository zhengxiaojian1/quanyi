// 改前必读：/root/全忆-V20/设计.md
// 补丁形态：必须是 insert + name；只写 - id: 的补丁在宿主里会被静默跳过
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 文 = fs.readFileSync(path.join(此处, "..", "插件", "cordis.patch.yml"), "utf8");

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

记("补丁用 insert 形态", /^-\s*insert:/m.test(文), "");
记("insert 里有 id 和 name", /id:\s*memory-v20/.test(文) && /name:\s*'dsh-memory-v20'/.test(文), "");
记("没有裸的 - id: 顶层补丁", !/^-\s*id:/m.test(文), "");
记("config 里没有写死 /root/全忆-V20", !文.includes("/root/全忆-V20"), "");

console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
