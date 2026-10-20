// 改前必读：/root/全忆-V20/设计.md
// 纯函数：从一天的帧里写出日记的规则版、抽承诺、抽判断、校验指针
// 不碰磁盘、不碰宿主，方便单测

// 到期解析：明天/后天/N天后/下周/下个月/月底/X月X号。认不出返回 null。
export function 解析到期(原文, 基准) {
  const t = String(原文 ?? "");
  const 基 = new Date(基准);
  if (Number.isNaN(基.getTime())) return null;
  const 加天 = (n) => { const d = new Date(基); d.setDate(d.getDate() + n); return d; };
  if (/明天/.test(t)) return 加天(1).toISOString();
  if (/后天/.test(t)) return 加天(2).toISOString();
  const 天数 = (() => {
    const m = t.match(/([0-9一二两三四五六七八九十]{1,3})\s*天后/);
    if (!m) return null;
    const 字 = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    const v = m[1];
    if (/^\d+$/.test(v)) return Number(v);
    if (v === "十") return 10;
    if (v.length === 2 && v[0] === "十") return 10 + (字[v[1]] ?? 0);
    if (v.length === 2 && v[1] === "十") return (字[v[0]] ?? 0) * 10;
    return 字[v] ?? null;
  })();
  if (天数) return 加天(天数).toISOString();
  if (/下周/.test(t)) return 加天(7).toISOString();
  const 周 = t.match(/([0-9一二两三四五六七八九十]{1,2})\s*周后/);
  if (周) {
    const 字 = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
    const v = /^\d+$/.test(周[1]) ? Number(周[1]) : 字[周[1]];
    if (v) return 加天(v * 7).toISOString();
  }
  if (/下个月|下月/.test(t)) { const d = new Date(基); d.setMonth(d.getMonth() + 1); return d.toISOString(); }
  const 月日 = t.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/);
  if (月日) {
    const d = new Date(基);
    d.setMonth(Number(月日[1]) - 1, Number(月日[2]));
    d.setHours(9, 0, 0, 0);
    if (d.getTime() < 基.getTime()) d.setFullYear(d.getFullYear() + 1);
    return d.toISOString();
  }
  if (/月底/.test(t)) {
    const d = new Date(基.getFullYear(), 基.getMonth() + 1, 0, 9, 0, 0);
    return d.toISOString();
  }
  return null;
}

export function 抽承诺(帧) {
  const out = [];
  for (const f of 帧) {
    if (f.who !== "user") continue;
    const t = String(f.text ?? "");
    const 像承诺 = /等.{1,20}(再|就|到时候)|约定|说好|下次.{1,10}(再|就)|提醒我|别忘了|到时候/.test(t);
    if (像承诺 && t.length >= 4 && t.length <= 120) {
      const 到期 = 解析到期(t, f.t);
      const 句 = t.match(/等(.{2,12}?)(?:再|就|到时候)/);
      const 条件 = 句 ? [句[1].replace(/^[，,。；;、\s]+/, "").replace(/^我|^你/g, "")] : [];
      out.push({ 内容: t, 触发: { 条件 }, 态: "未兑现", src: [f.seq], t: f.t, ...(到期 ? { 到期 } : {}) });
    }
  }
  return out;
}

export function 抽判断(帧) {
  const out = [];
  for (const f of 帧) {
    if (f.who !== "her") continue;
    const t = String(f.text ?? "");
    const 是建议 = /要不|不如|建议|试试|该不该|应该/.test(t);
    if (是建议 || /我觉得|我知道|我想|我看|我记着|我猜/.test(t)) {
      out.push({ 内容: 短句(t, 200), 置信: 0.5, 依据: [f.seq], 反例: [], 期限: 加天(f.t, 30), 态: "待验证", 类型: 是建议 ? "建议" : "判断", 天: f.t.slice(0, 10) });
    }
  }
  return out;
}

function 关键词(t) {
  const 停词 = new Set(["我们", "你们", "他们", "这个", "那个", "现在", "以后", "然后", "就是", "可以", "什么", "怎么", "自己"]);
  const 停字 = new Set("的我你他她它是了在有".split(""));
  const 句 = String(t).split(/[，。！？!?、；;]/).find((x) => x.includes("等")) ?? String(t);
  const 段 = (句.match(/等(.{0,16})/) ?? [])[1] ?? 句;
  const 净 = 段.replace(/[^\p{Script=Han}A-Za-z0-9]/gu, "");
  const out = [];
  for (let i = 0; i < 净.length - 1; i++) {
    const g = 净.slice(i, i + 2);
    if (停词.has(g) || 停字.has(g[0]) || 停字.has(g[1])) continue;
    if (!out.includes(g)) out.push(g);
  }
  return out.slice(0, 3);
}

export function 选指针(帧, 承诺) {
  const 他 = 帧.filter((f) => f.who === "user" && String(f.text ?? "").length >= 4);
  const 她 = 帧.filter((f) => f.who === "her" && String(f.text ?? "").length >= 4);
  const 集 = [];
  const 加 = (s) => { if (s && !集.includes(s)) 集.push(s); };
  加(他[0]?.seq); 加(金句(帧)?.seq); 加([...她].sort((a, b) => String(b.text).length - String(a.text).length)[0]?.seq); 加(他[他.length - 1]?.seq);
  for (const c of 承诺) 加(c.src[0]);
  return 集.slice(0, 5);
}

export function 规则写手(天, 帧, 承诺) {
  // 跳过系统注入（[runtime-context]、[skill-catalog]、<compacted-summary> 这类）
  const 是人话 = (f) => !/^[\[<]/.test(String(f.text ?? "").trim());
  const 他 = 帧.filter((f) => f.who === "user" && String(f.text ?? "").length >= 2 && 是人话(f));
  const 她 = 帧.filter((f) => f.who === "her" && String(f.text ?? "").length >= 2);
  const 有他 = 他.length > 0;
  // 没有他的帧（比如只有她自己的工作日志）⇒ 用她自己的短句
  const 主 = 有他 ? 他 : 她;
  const 首 = 主[0];
  const 尾 = [...主].reverse().find((f) => String(f.text).length >= 4 && f !== 首) ?? 主[主.length - 1];
  const 金 = 金句(帧);
  const 长 = 金 ?? [...主].filter((f) => String(f.text).length >= 8 && f !== 首 && f !== 尾)
    .sort((a, b) => String(a.text).length - String(b.text).length)[0];
  const 不顺 = 主.filter((f) => /不甘心|算了|不行|烦|累|停|放弃|失败|错/.test(String(f.text))).pop();
  const 行 = ["# " + 天 + " " + 周几(天), ""];
  if (有他 && 首) 行.push("今天他说「" + 短句(首.text) + "」。");
  else if (首) 行.push("今天记下的是：「" + 短句(首.text) + "」。");
  if (长) 行.push((有他 ? "我跟他说：「" : "我自己写下：「") + 短句(长.text) + "」。");
  if (不顺 && 不顺 !== 首 && 不顺 !== 尾) 行.push("中间有点不顺：「" + 短句(不顺.text) + "」。");
  if (尾 && 尾 !== 首) 行.push((有他 ? "最后他说：「" : "最后记下的是：「") + 短句(尾.text) + "」。");
  if (承诺[0]) 行.push("", "📌 约定：" + 短句(承诺[0].内容, 80));
  const 针 = 选指针(帧, 承诺);
  if (针.length) 行.push("", "↩ " + 针.join(", "));
  return 行.join("\n") + "\n";
}

export function 模型提示({ 天, 帧, 称呼 = {} }) {
  const 名字 = 称呼.名字 || 称呼.对方 || "";
  const 代词 = 称呼.代词 || "他";
  const 外号 = Array.isArray(称呼.外号) ? 称呼.外号 : [];
  const 怎么叫 = [
    名字 ? "「" + 名字 + "」" : "",
    "「" + 代词 + "」",
    外号.length ? "外号「" + 外号.join("、") + "」" : "",
  ].filter(Boolean).join(" / ");
  const 料 = 帧.filter((f) => f.who !== "tool").slice(0, 80)
    .map((f) => "[" + f.seq + "] " + (f.who === "user" ? "他" : "我") + "：" + String(f.text ?? "").slice(0, 200))
    .join("\n");
  return `写今天（${天}）的日记。第一人称，200-400 字，像说话，不总结陈词。
硬规则：
1) 只写素材里出现过的事。素材外的天气、地点、动作、别人的话，一律不写。不确定就不写。
2) 至少包含一句原话，用「」标出。
3) 叙述里指称对方用 ${怎么叫}，不要写「用户」「对方」「该用户」。
   这是日记，不是对话——不需要每句都叫名字，多数句子直接说事。
4) 结尾用「↩ 序号,序号」标出原文出处，序号只能从素材方括号里挑。
素材：\n${料}`;
}

export function 校验(文, 帧) {
  const m = String(文).match(/↩\s*([\d,\s]+)/);
  if (!m) return false;
  const 号 = m[1].split(/[,\s]+/).filter(Boolean).map(Number);
  const 有 = new Set(帧.map((f) => f.seq));
  return 号.length > 0 && 号.every((n) => 有.has(n));
}

export function 金句(帧) {
  for (let i = 1; i < 帧.length; i++) {
    const 前 = 帧[i - 1], 本 = 帧[i];
    if (本.who === "user" && 前.who === "her" && /^(对|是|没错|就是这句)/.test(String(本.text).trim())) return 前;
  }
  return null;
}

export function 净句(t) { return String(t).replace(/[。！？!?，,、；;：:]+$/u, ""); }

export function 短句(t, n = 60) {
  const 净 = 净句(t).replace(/\s+/g, " ");
  return 净.length > n ? 净.slice(0, n) + "…" : 净;
}

function 周几(天) { return "日一二三四五六"[new Date(天 + "T12:00:00").getDay()]; }
function 加天(t, n) { const d = new Date(t); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
