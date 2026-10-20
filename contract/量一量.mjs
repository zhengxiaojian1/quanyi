// 改前必读：/root/全忆-V20/设计.md
// 量五个数：挂载 / 冷检索 / 温检索 / 取帧 / 常驻
import { mount } from "../读我.mjs";
import path from "node:path";

const 卡带 = path.resolve(process.argv[2] ?? "卡带样例/桌宠");
const 句柄 = mount(卡带);
const 问 = ["2D 的极限", "npm run build", "穿模", "idle", "桌宠"];

const 计 = (f, n) => { const a = process.hrtime.bigint(); for (let i = 0; i < n; i++) f(i); return Number(process.hrtime.bigint() - a) / 1e6 / n; };

const 冷 = 计((i) => 句柄.recall(问[i % 问.length], 5), 5);
const 温 = 计((i) => 句柄.recall(问[i % 问.length], 5), 10);
const 帧均 = 计((i) => 句柄.frame(1 + ((i * 97) % 句柄.manifest.帧数)), 50);
const m = process.memoryUsage();

console.log(JSON.stringify({
  卡带: path.basename(卡带),
  帧: 句柄.manifest.帧数,
  片: 句柄.manifest.片.length,
  挂载ms: +句柄.挂载毫秒.toFixed(2),
  冷检索ms: +冷.toFixed(1),
  温检索ms: +温.toFixed(1),
  取帧ms: +帧均.toFixed(3),
  RSS_MB: +(m.rss / 1048576).toFixed(1),
  堆_MB: +(m.heapUsed / 1048576).toFixed(1),
}, null, 2));
