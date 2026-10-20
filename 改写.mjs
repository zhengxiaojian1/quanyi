// 改前必读：/root/全忆-V20/设计.md
// 语义改写：词法没命中时，让模型把问题换成几个检索词再试一次
export async function 改写({ 查询, 说, 上下文 = "", 最多 = 3, 最多字 = 130 }) {
  const q = String(查询 ?? "").trim();
  if (!q || q.length > 最多字) return [];
  const r = await 说({
    系统: "你在帮人回忆。把问题改写成三个「原文里可能出现的具体词」：人名、物件、动作、数字。不要抽象词（原因/解决/问题/事情/我们/什么），不要代词。只输出三个词，空格分隔。",
    消息: [{ role: "user", content: (上下文 ? "最近的日记：" + 上下文 + "\n\n" : "") + "问题：" + q }],
    温度: 0, 最大: 40, 思考: false,
  });
  return String(r?.text ?? "")
    .split(/[\s,，、;；\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 最多);
}
