// 改前必读：/root/全忆-V20/设计.md
// 请求侧整形：宿主不做压缩也能用——把太老的对话换成「她记得」那一块
// 只用它替换请求里的消息，不动宿主的会话日志
export function 估token(s) {
  // 粗估：中文约 1.5 字/token，代码约 4 字符/token ⇒ 平均按 2 字符/token。
  // 只求预算不看精确值；绝不对大段文本跑正则（那是 1 秒级的开销）。
  const 文 = typeof s === "string" ? s : String(s?.content ?? "");
  return Math.ceil(文.length / 2);
}

const 摘要标记 = ["<compacted-summary>", "</compacted-summary>", "automatically generated checkpoint"];

export function 是宿主摘要(m) {
  const 文 = typeof m?.content === "string" ? m.content : (Array.isArray(m?.content) ? m.content.map((x) => x?.text ?? "").join(" ") : "");
  return 摘要标记.some((k) => 文.includes(k));
}

export function 整形({ messages = [], 预算 = 60000, 留最近 = 12, 回忆块 = "" } = {}) {
  // 快路：条数不多、总长度不大、也没有宿主摘要 → 直接返回
  const 有摘要 = messages.some((m) => 是宿主摘要(m));
  if (!有摘要 && messages.length <= 留最近 + 2 && messages.reduce((a, m) => a + (typeof m?.content === "string" ? m.content.length : 0), 0) < 预算 * 2) {
    return { messages, 压缩: false, 省下: 0, 丢了: 0, 滤掉宿主摘要: 0 };
  }
  const 去掉 = messages.filter((m) => !是宿主摘要(m));
  const 滤掉 = messages.length - 去掉.length;
  const 总 = 去掉.reduce((a, m) => a + 估token(m?.content), 0);
  if (滤掉 === 0 && (总 <= 预算 || 去掉.length <= 留最近 + 1)) {
    return { messages, 压缩: false, 省下: 0, 丢了: 0, 滤掉宿主摘要: 0 };
  }
  const 尾 = 去掉.slice(-留最近);
  const 头 = 去掉.slice(0, 去掉.length - 留最近);
  const 块文 = typeof 回忆块 === "function" ? 回忆块(头.length) : 回忆块;
  const 块 = {
    role: "user",
    content: "（她记得）\n" + (块文 || "更早的对话她已经想不起细节了；账还在卡带里，问起可以逐字取回。"),
  };
  const 新 = [块, ...尾];
  const 新总 = 新.reduce((a, m) => a + 估token(m?.content), 0);
  return { messages: 新, 压缩: true, 省下: Math.max(0, 总 - 新总), 丢了: 头.length, 滤掉宿主摘要: 滤掉 };
}

if (process.argv[1] && process.argv[1].split("/").pop() === "整形.mjs") {
  const 条文 = Number(process.argv[2] ?? 40);
  const 列 = [];
  for (let i = 1; i <= 条文; i++) 列.push({ role: i % 2 ? "user" : "assistant", content: "第" + i + "条：" + "话".repeat(200) });
  const r = 整形({ messages: 列, 预算: 2000, 留最近: 8, 回忆块: "我们在做桌宠，卡在 2D 的极限。" });
  console.log(JSON.stringify({ 压缩: r.压缩, 原条数: 列.length, 新条数: r.messages.length, 丢了: r.丢了, 省下token: r.省下 }, null, 2));
  console.log("第一块：", r.messages[0].content.slice(0, 40));
}
