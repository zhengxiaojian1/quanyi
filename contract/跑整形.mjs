// 改前必读：/root/全忆-V20/设计.md
// 请求侧整形：宿主没压缩也能把上下文收住，且不丢最近的话
import { 整形, 估token } from "../整形.mjs";

let 过 = 0, 败 = 0;
const 记 = (名, ok, 注) => { ok ? 过++ : 败++; console.log((ok ? "✓ " : "✗ ") + 名 + (注 ? "  " + 注 : "")); };

const 长 = [];
for (let i = 1; i <= 60; i++) 长.push({ role: i % 2 ? "user" : "assistant", content: "第" + i + "条 " + "话".repeat(300) });

const r = 整形({ messages: 长, 预算: 4000, 留最近: 10, 回忆块: "我们在做桌宠，卡在 2D 的极限。" });
记("超预算就整形", r.压缩 === true && r.messages.length === 11, "新条数 " + r.messages.length);
记("第一块是「她记得」", r.messages[0].content.startsWith("（她记得）") && r.messages[0].content.includes("桌宠"), "");
记("最近 10 条原样保留", r.messages.slice(1).map((m) => m.content).join("|") === 长.slice(-10).map((m) => m.content).join("|"), "");
记("确实省了 token", r.省下 > 0 && 估token(r.messages.map((m) => m.content).join("")) < 估token(长.map((m) => m.content).join("")), "省 " + r.省下);
记("丢了 50 条", r.丢了 === 50, String(r.丢了));

// 宿主摘要必须被丢掉，不能污染
const 带摘要 = [
  { role: "user", content: "This is an automatically generated checkpoint condensing an earlier span of the conversation.\n\n<compacted-summary>用户问了一堆东西</compacted-summary>" },
  { role: "user", content: "接着聊" },
  { role: "assistant", content: "好" },
];
const r3 = 整形({ messages: 带摘要, 预算: 100000, 留最近: 2, 回忆块: "她记得的事" });
记("宿主摘要被丢掉", r3.滤掉宿主摘要 === 1 && !r3.messages.some((m) => String(m.content).includes("compacted-summary")), "");
记("丢掉后换成她的块", r3.messages[0].content.startsWith("（她记得）"), "");
记("即使没超预算也会处理宿主摘要", r3.压缩 === true, "");

const 短 = 长.slice(-5);
const r2 = 整形({ messages: 短, 预算: 4000, 留最近: 10 });
记("没超预算就不动", r2.压缩 === false && r2.messages.length === 5, "");
记("太短也不动", 整形({ messages: 长.slice(-3), 预算: 1, 留最近: 3 }).压缩 === false, "");

console.log("\n" + 过 + " ✓ · " + 败 + " ✗");
process.exit(败 ? 1 : 0);
