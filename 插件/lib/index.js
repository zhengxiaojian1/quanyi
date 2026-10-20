// 改前必读：/root/全忆-V20/设计.md
// 宿主插件（只读记忆、可写名字）：每轮第一步把卡带的 brief 追加进请求
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { 整形 } from "../../整形.mjs";
import { 读配方, 选配方, 跑配方, 算子表 } from "../../配方.mjs";
import { 重排 } from "../../重排.mjs";
import { 开, 大事, 收 } from "../../黑匣子.mjs";
import { 读态, 记提, 记接, 该排 } from "../../主动.mjs";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const name = "memory-v20";

// 宿主的用户消息形状（照 dsh-llm 的 createUserMessage）：
// { id, role, content:[{type:"text",text}], source:{kind, form, summary} }，并深冻。
// 少了 id/source，客户端会在 observeSubmissionMessage 里读 .kind 崩掉。
// 宿主 v4 的硬要求：id/role/content 块/source.kind（非空、非 "plugin"）。
// 不合规的消息一旦被宿主写进会话日志，那个会话就再也打不开——宁可不注入。
export function 校验消息(m) {
  return Boolean(
    m && typeof m.id === "string" && m.id.length > 0 &&
    m.role === "user" &&
    Array.isArray(m.content) && m.content.length > 0 &&
    m.content.every((c) => c && c.type === "text" && typeof c.text === "string") &&
    m.source && typeof m.source.kind === "string" && m.source.kind.length > 0 && m.source.kind !== "plugin"
  );
}

function 记忆消息(文) {
  const 块 = Object.freeze([Object.freeze({ type: "text", text: String(文 ?? "") })]);
  return Object.freeze({
    id: randomUUID(),
    role: "user",
    content: 块,
    source: Object.freeze({ kind: "memory-v20", form: "notice", summary: "全忆 V20：每轮递料" }),
  });
}

const 取最后一句 = (messages) => {
  for (let i = (messages?.length ?? 0) - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user") {
      const c = m.content;
      if (typeof c === "string") return c;
      if (Array.isArray(c)) return c.map((x) => x?.text ?? "").join(" ");
      return "";
    }
  }
  return "";
};

export async function apply(ctx, config = {}) {
  const 自身 = path.dirname(fileURLToPath(import.meta.url));      // …/plugin/lib
  const 推家 = path.resolve(自身, "..", "..");                       // …/全忆-V20
  const 家 = config.家 ?? process.env.QUANYI_HOME ?? (fsSync.existsSync(path.join(推家, "driver.mjs")) ? 推家 : "/root/全忆-V20");
  const { 造驱动 } = await import(path.join(家, "driver.mjs"));

  // 卡带默认：先看「家」本身、再看「家的上一层」（U 盘布局：卡带/工具/插件）、最后样例
  const 有卡 = (d) => { try { return fsSync.existsSync(path.join(d, "manifest.json")); } catch { return false; } };
  const 默认卡带 = 有卡(家) ? 家 : (有卡(path.resolve(家, "..")) ? path.resolve(家, "..") : path.join(家, "卡带样例", "桌宠"));
  let 卡带 = config.卡带 ?? process.env.QUANYI_CARD ?? 默认卡带;
  if (!fsSync.existsSync(path.join(卡带, "manifest.json"))) {
    const { 找卡带 } = await import(path.join(家, "找卡.mjs"));
    const 列 = 找卡带({ 根: config.根 });
    if (列.length === 0) { ctx.logger?.warn?.("[memory-v20] 没找到卡带（可设 QUANYI_CARD）；插件不启用"); return; }
    if (列.length > 1) ctx.logger?.warn?.("[memory-v20] 找到 " + 列.length + " 张卡带，先用第一张；要固定请设 QUANYI_CARD：" + 列.join(" | "));
    卡带 = 列[0];
    ctx.logger?.info?.("[memory-v20] 自动找到卡带：" + 卡带);
  }

  let 驱;
  try { 驱 = 造驱动({ 卡带, 预算: config.预算 ?? 600 }); }
  catch (e) { ctx.logger?.warn?.("[memory-v20] 卡带打不开：" + String(e?.message ?? e) + "；插件不启用"); return; }

  // 轻自检：首帧/末帧能逐字取回，才认为卡带是好的
  try {
    const 首 = 驱.句柄.frame(1);
    const 末 = 驱.句柄.frame(驱.句柄.manifest.帧数 ?? 0);
    if (首?.ok && 末?.ok) ctx.logger?.info?.("[memory-v20] 自检通过：首末帧都能逐字取回");
    else ctx.logger?.warn?.("[memory-v20] 自检异常：首/末帧取不回，卡带可能坏了（跑 node 自检.mjs 看详情）");
  } catch (e) { ctx.logger?.warn?.("[memory-v20] 自检失败：" + String(e?.message ?? e)); }

  let 配方们 = [];
  try { 配方们 = 读配方(卡带); if (配方们.length) ctx.logger?.info?.("[memory-v20] 配方：" + 配方们.map((r) => r.名).join(" / ")); }
  catch { 配方们 = []; }

  // 主动：档位自己升自己降（档 0 = 一周探一次；档 1+ = 一天一次）
  const 主动检查 = "（全忆·主动检查）";
  let 已排 = false;
  const 排主动 = (sessionId) => {
    if (已排 || !sessionId) return;
    if (config.主动 === false) return;
    const 态 = 读态(卡带);
    const 该 = config.主动 === true ? { 排: true, 频率: "daily", 间隔秒: 0 } : 该排(态);
    if (!该.排) return;
    let 服 = null;
    try { 服 = ctx.get?.("schedule") ?? null; } catch { 服 = null; }
    if (!服?.create) return;
    const 时 = String(config.主动时刻 ?? "21:00:00");
    try {
      服.create(sessionId, {
        title: "全忆·主动检查",
        prompt: 主动检查,
        ...(该.频率 === "daily"
          ? { daily: { time: 时, time_zone: String(config.时区 ?? "Asia/Shanghai") } }
          : { every_seconds: 该.间隔秒 }),
      });
      已排 = true;
      ctx.logger?.info?.("[memory-v20] 主动检查已排：" + (该.频率 === "daily" ? "每天 " + 时 : "每 7 天一次（还在观察期）") + " · 档 " + 态.档);
    } catch (e) { ctx.logger?.warn?.("[memory-v20] 排主动检查失败：" + String(e?.message ?? e)); }
  };

  const 建议 = 驱.建议会话();
  ctx.logger?.info?.("[memory-v20] 挂上卡带：" + 卡带 + "；会话：" + 建议.动作 + "（" + 建议.因为 + "）");

  // 宿主接口自检：不猜、不硬撞，缺了哪根就报哪根
  const 接口 = { preStep: false, tools: false, title: false, logger: Boolean(ctx.logger) };
  接口.preStep = typeof ctx.on === "function";
  let 工具服务 = null;
  try { 工具服务 = ctx.get?.("tools") ?? null; } catch { 工具服务 = null; }
  if (!工具服务) { try { 工具服务 = ctx.tools ?? null; } catch { 工具服务 = null; } }
  接口.tools = Boolean(工具服务?.register);
  let 标题服务 = null;
  try { 标题服务 = ctx.get?.("sessionTitle") ?? null; } catch { 标题服务 = null; }
  接口.title = Boolean(标题服务?.rename);
  ctx.logger?.info?.("[memory-v20] 宿主接口：pre-step " + (接口.preStep ? "✓" : "✗") + " · tools " + (接口.tools ? "✓" : "✗（工具不注册，只递料）") + " · sessionTitle " + (接口.title ? "✓" : "✗（不起名、不钉标签）"));
  if (!接口.preStep) { ctx.logger?.warn?.("[memory-v20] 这个宿主没有 agent/pre-step，插件不启用"); return; }

  开(卡带, "插件");
  ctx.effect?.(() => () => 收(卡带));

  let 本会话记过 = false;
  let 翻账记录 = [];
  let 连败 = 0;
  let 上次她 = "", 上次他 = "", 会话号 = null;

  const 取标题服务 = () => 标题服务;

  const 记本轮 = (messages) => {
    let 她 = "", 他 = "";
    for (const m of messages ?? []) {
      const 文 = typeof m?.content === "string" ? m.content : (Array.isArray(m?.content) ? m.content.map((x) => x?.text ?? "").join(" ") : "");
      if (!文) continue;
      if (m.role === "assistant") 她 = 文;
      else if (m.role === "user") 他 = 文;
    }
    try {
      if (她 && 她 !== 上次她) { 驱.记对话("her", 她, 会话号); 上次她 = 她; }
      if (他 && 他 !== 上次他) { 驱.记对话("user", 他, 会话号); 上次他 = 他; }
    } catch (e) { ctx.logger?.warn?.("[memory-v20] 记对话失败（上锁的卡带是只读的）：" + String(e?.message ?? e)); }
  };

  // 工具面：五个。撞名就换前缀（v19 也叫 recall）；注册失败只 warn、不抛，
  // 所以一个工具失败不拖累其余（不是“各自独立 try”，是 注册一个() 内部吞错）
  // 宿主的 ctx.tools 是「必须 inject 才能摸」的服务；不 inject 就直接抛。
  // 用 ctx.get("tools") 取可选的，再退回 ctx.tools（假 ctx / 老宿主）。
  if (接口.tools) {
    const 转参 = (规格 = {}) => {
      const properties = {}, required = [];
      for (const [k, v] of Object.entries(规格)) {
        const { required: 必, description, ...rest } = v ?? {};
        properties[k] = { ...rest, ...(description ? { description } : {}) };
        if (必) required.push(k);
      }
      return { type: "object", properties, ...(required.length ? { required } : {}) };
    };
    let 定义 = (x) => ({ ...x, parameters: 转参(x.parameters) });
    try {
      const m = await import("@deepseek-ai/dsh-tools");
      if (typeof m.defineTool === "function") 定义 = m.defineTool;
    } catch { /* 没有就自己转 */ }
    const 注册一个 = (候选, 造) => {
      for (const 名 of 候选) {
        try {
          const 注销 = 工具服务.register(定义(造(名)));
          return { 名, 注销 };
        } catch (e) {
          const 撞名 = /already registered|重复|重名/.test(String(e?.message ?? e));
          ctx.logger?.warn?.("[memory-v20] 工具名「" + 名 + "」" + (撞名 ? "被占了，换下一个" : "注册失败：" + String(e?.message ?? e)));
        }
      }
      return null;
    };
    try {
      const 找 = 注册一个(["recall", "memory_recall"], (名) => ({
        name: 名,
        description: "翻记忆：按词在卡带里找说过的话，返回带 seq 的摘录。当他说起过去的事、你拿不准细节、或要引用原话时先用它，别凭印象。找不到就说没有，不许编。",
        parameters: {
          q: { type: "string", required: true, description: "要找的词或短句" },
          k: { type: "number", description: "最多几条，默认 5" },
        },
        output: {
          schema: { type: "object", additionalProperties: true, properties: {} },
          render: (_a, v) => [{ type: "text", text: String(typeof v === "string" ? v : JSON.stringify(v)).slice(0, 200) }],
        },
        execute(args) {
          // 限流：一分钟最多 5 次，防止她一个劲地翻、把手机翻卡
          const 现在 = Date.now();
          翻账记录 = 翻账记录.filter((t) => 现在 - t < 60000);
          if (翻账记录.length >= 5) {
            return { 命中: [], 提示: "这一分钟已经翻了 5 次了。先凭你记得的说；真不够再翻。", 限流: true };
          }
          翻账记录.push(现在);
          const 条 = 驱.调工具("recall", { q: args.q, k: args.k });
          // 只有工具被真调用才记取次：她真翻过的帧才有痕
          try { for (const x of 条.slice(0, 2)) 驱.句柄.加重(Number(x.seq), { 取次加: 1 }); } catch { /* 忽略 */ }
          return { 命中: 条.map((x) => ({ seq: x.seq, 分数: x.分数, 摘录: x.摘录, 压制: x.压制 === true })) };
        },
      }));
      const 取 = 注册一个(["frame", "memory_frame"], (名) => ({
        name: 名,
        description: "取原文：按 seq 取回逐字原文，附 sha256。recall 给了 seq 之后、要引用或核对时用它；校验失败会照实说。",
        parameters: { seq: { type: "number", required: true, description: "帧号" } },
        output: {
          schema: { type: "object", additionalProperties: true, properties: {} },
          render: (_a, v) => [{ type: "text", text: String(typeof v === "string" ? v : JSON.stringify(v)).slice(0, 200) }],
        },
        execute(args) {
          const f = 驱.调工具("frame", { seq: args.seq });
          // 只有「工具被真调用」才记取次：内部读帧（测试/自检）不该给帧加权
          try { if (f.ok) 驱.句柄.加重(Number(f.seq), { 取次加: 1 }); } catch { /* 忽略 */ }
          if (!f.ok) return { ok: false, 读不动: true, why: f.why };
          return { ok: true, seq: f.seq, t: f.t, who: f.who, 原文: f.text, sha256: f.sha, 校验: f.校验 };
        },
      }));
      const 忘 = 注册一个(["forget", "memory_forget"], (名) => ({
        name: 名,
        description: "把某几帧压到最底下：默认不再检索、不再主动提。原文仍在，用户要求时可取回。",
        parameters: {
          seqs: { type: "string", required: true, description: "帧号，多个用逗号分隔" },
          原因: { type: "string", description: "为什么压（用户原话更好）" },
        },
        output: {
          schema: { type: "object", additionalProperties: true, properties: {} },
          render: (_a, v) => [{ type: "text", text: String(typeof v === "string" ? v : JSON.stringify(v)).slice(0, 200) }],
        },
        execute(args) {
          const 列 = String(args.seqs).split(/[,，\s]+/).map(Number).filter(Number.isFinite);
          return { 压制了: 驱.压制(列, args.原因 ?? "") };
        },
      }));
      const 组 = 注册一个(["compose", "memory_compose"], (名) => ({
        name: 名,
        description: "给自己加一个能力：用现有算子组合。算子有：" + Object.keys(算子表).join(" / ") + "。写到卡带 配方/<名>.json，下一轮就生效。",
        parameters: {
          名: { type: "string", required: true, description: "能力名，比如「变了没」" },
          触发: { type: "string", required: true, description: "触发词，逗号分隔，比如「以前,变」" },
          算子: { type: "string", required: true, description: "算子名，必须是上面列出的" },
        },
        output: {
          schema: { type: "object", additionalProperties: true, properties: {} },
          render: (_a, v) => [{ type: "text", text: String(typeof v === "string" ? v : JSON.stringify(v)).slice(0, 200) }],
        },
        execute(args) {
          const 算子 = String(args.算子 ?? "").trim();
          if (!算子表[算子]) return { ok: false, why: "没有这个算子：" + 算子 + "（有：" + Object.keys(算子表).join(" / ") + "）" };
          const 触发 = String(args.触发 ?? "").split(/[,，\s]+/).filter(Boolean);
          if (!触发.length) return { ok: false, why: "触发词不能空" };
          const 目录 = path.join(卡带, "配方");
          fsSync.mkdirSync(目录, { recursive: true });
          const 路 = path.join(目录, String(args.名 ?? "").trim() + ".json");
          fsSync.writeFileSync(路, JSON.stringify({ 名: args.名, 触发, 算子, 档: "开口" }, null, 2) + "\n", "utf8");
          配方们 = 读配方(卡带);
          return { ok: true, 已保存: 路, 现在有: 配方们.map((r) => r.名) };
        },
      }));
      const 建 = 注册一个(["new_card", "memory_new_card"], (名) => ({
        name: 名,
        description: "生成一张新卡带。从：\"空\"（从今天开始）/ 一个会话 id / 一个文件路径。默认建在当前卡带旁边。",
        parameters: {
          名: { type: "string", required: true, description: "新卡带的名字" },
          从: { type: "string", description: "空 / 会话id / 文件路径，默认空" },
        },
        output: {
          schema: { type: "object", additionalProperties: true, properties: {} },
          render: (_a, v) => [{ type: "text", text: String(typeof v === "string" ? v : JSON.stringify(v)).slice(0, 200) }],
        },
        execute(args) {
          const 新名 = String(args.名 ?? "").trim();
          if (!新名 || /[\/\\]/.test(新名)) return { ok: false, why: "名字不能空，也不能带斜杠" };
          const 从 = String(args.从 ?? "空").trim();
          const 参 = [path.join(家, "新卡带.mjs"), 新名, "--到", path.dirname(卡带)];
          if (!从 || 从 === "空") 参.push("--空");
          else if (fsSync.existsSync(从)) 参.push("--从文件", 从);
          else 参.push("--从会话", 从);
          try {
            const 出 = execFileSync(process.execPath, 参, { timeout: 120000, encoding: "utf8" });
            const 新路 = path.join(path.dirname(卡带), 新名);
            const m = JSON.parse(fsSync.readFileSync(path.join(新路, "manifest.json"), "utf8"));
            return { ok: true, 新卡带: 新路, 帧数: m.帧数, 提示: "要切过去：改 plugin/cordis.patch.yml 的 卡带 这一行，然后重启。" };
          } catch (e) {
            return { ok: false, why: String(e?.message ?? e).slice(0, 200) };
          }
        },
      }));
      const 名们 = [找?.名, 取?.名, 忘?.名, 组?.名, 建?.名].filter(Boolean);
      if (名们.length) {
        ctx.effect?.(() => () => { for (const x of [找, 取, 忘, 组, 建]) if (x?.注销) x.注销(); });
        ctx.logger?.info?.("[memory-v20] 工具已注册：" + 名们.join(" / "));
        大事(卡带, "工具注册", { 个数: 名们.length });
      } else {
        ctx.logger?.warn?.("[memory-v20] 两个工具都没注册上（可能名字全被占）");
      }
    } catch (e) {
      ctx.logger?.warn?.("[memory-v20] 工具注册失败：" + String(e?.message ?? e));
    }
  }

  // 她说的话：pre-step 只看得到本轮进来的 user；她的回答在 turn 结束时取
  const 记过 = new Set();
  ctx.on("agent/turn-stopping", async ({ agent }) => {
    try {
      const 事 = agent?.session?.snapshotEvents?.() ?? [];
      for (let i = 事.length - 1; i >= 0; i--) {
        if (事[i]?.type !== "assistant/message") continue;
        const m = 事[i].data?.message;
        const 文 = (m?.content ?? []).filter((c) => c?.type === "text").map((c) => c.text).join("").trim();
        if (!文 || (m?.id && 记过.has(m.id))) return;
        if (m?.id) 记过.add(m.id);
        驱.记对话("her", 文, 会话号, m?.id);
        // 她的话刚落盘：马上起一次自长，别等下一轮（自长自带锁与去重）
        try {
          const 子 = spawn(process.execPath, [path.join(家, "自长.mjs"), 卡带, ...(会话号 ? ["--会话", 会话号] : [])], { detached: true, stdio: "ignore" });
          子.unref?.();
        } catch { /* 起不来就等下一轮 */ }
        return;
      }
    } catch (e) { ctx.logger?.warn?.("[memory-v20] 记她的回答失败：" + String(e?.message ?? e)); }
  });

  ctx.on("agent/pre-step", async ({ agent, messages, step, signal }, next) => {
    const decision = await next();
    if (signal?.aborted || decision?.kind === "reject") return decision;
    if (!Array.isArray(decision?.messages)) return decision;
    // 不是第一步：只整形、不注入（长回合里每一步都可能把上下文撑大）
    if (step !== 1) {
      try {
        const 整 = 整形({ messages: decision.messages, 预算: config.窗口预算 ?? 60000, 留最近: config.留最近 ?? 12 });
        if (整.压缩) return { ...decision, messages: 整.messages };
      } catch { /* 整形失败不影响这一轮 */ }
      return decision;
    }

    if (连败 >= 3) return decision;
    try {
      // 先算接回包：它要对比「上次是哪台机器」，记会话会把 last_session 改成本机
      const 接 = 本会话记过 ? "" : 驱.接回包({ 最多: 20, 会话: agent?.session?.id });
      let 提示 = "";

      if (!本会话记过) {
        本会话记过 = true;
        // 空卡带 + 已经聊了很久 ⇒ 把现有对话切下来，留给导入工具建卡
        try {
          if ((驱.句柄.manifest.帧数 ?? 0) === 0 && agent?.session?.id) {
            // 先试宿主日志：那才是完整历史
            const { 找日志 } = await import(path.join(家, "从宿主导入.mjs"));
            const 路 = 找日志(agent.session.id);
            if (路) {
              ctx.logger?.info?.("[memory-v20] 空卡带：找到宿主会话日志，正在后台整份导入");
              if (config.自动导入 !== false) {
                const 子 = spawn(process.execPath, [path.join(家, "从宿主导入.mjs"), 路, 驱.句柄.目录], { detached: true, stdio: "ignore" });
                子.unref();
              }
              throw { 已处理: true };
            }
          }
          if ((驱.句柄.manifest.帧数 ?? 0) === 0 && (messages?.length ?? 0) >= 4) {
            const 行 = [];
            let 序 = 0;
            for (const m of messages) {
              const 文 = typeof m?.content === "string" ? m.content : (Array.isArray(m?.content) ? m.content.map((x) => x?.text ?? "").join(" ") : "");
              if (!文 || (m.role !== "user" && m.role !== "assistant")) continue;
              序++;
              行.push(JSON.stringify({ seq: 序, t: new Date().toISOString(), who: m.role === "user" ? "user" : "her", kind: "text", text: 文 }));
            }
            if (行.length) {
              fsSync.writeFileSync(path.join(驱.句柄.目录, "导入.jsonl"), 行.join("\n") + "\n", "utf8");
              ctx.logger?.info?.("[memory-v20] 空卡带：已把现有 " + 行.length + " 条对话切到 导入.jsonl");
              if (config.自动导入 !== false) {
                const 子 = spawn(process.execPath, [path.join(家, "导入卡带.mjs"), 驱.句柄.目录], { detached: true, stdio: "ignore" });
                子.unref();
                ctx.logger?.info?.("[memory-v20] 正在后台建卡，完成后下次接入就有历史了");
              }
            }
          }
        } catch (e) {
          if (!e?.已处理) ctx.logger?.warn?.("[memory-v20] 切片失败：" + String(e?.message ?? e));
        }
        const 号 = agent?.session?.id;
        会话号 = 号 ?? null;
        排主动(号);
        if (号) 驱.记会话(号);

        // 名字：用户改过标签就采用；有名字就钉住；新会话没名字就问一句
        const 服 = 取标题服务();
        let 标 = null;
        try { 标 = 服?.get?.(agent.session) ?? null; } catch { 标 = null; }
        const 用户改过 = 标?.source?.kind === "user" && 标?.title;
        if (用户改过 && 标.title !== 驱.句柄.称呼.她的名字) {
          驱.句柄.设称呼({ 她的名字: 标.title });
          ctx.logger?.info?.("[memory-v20] 采用你起的名字：" + 标.title);
        } else if (驱.句柄.称呼.她的名字) {
          try { 服?.rename?.(agent.session, 驱.句柄.称呼.她的名字); }
          catch (e) { ctx.logger?.warn?.("[memory-v20] 钉标签失败：" + String(e?.message ?? e)); }
        } else if ((messages?.length ?? 0) <= 2) {
          提示 = "（新会话：你还没有名字。可以问一句她想怎么叫你；她说了就记下来。）";
        }
      }

      记本轮(messages);
      const 打点 = Date.now();
      const 话 = 取最后一句(messages) || 取最后一句(decision.messages);
      const 是检查 = String(话).includes(主动检查);
      // 每轮：后台自长（宿主日志 → 帧），20 秒最多一次；不阻塞这一轮
      try {
        const 现在 = Date.now();
        if (现在 - (globalThis.__v20自长 ?? 0) > 20000) {
          globalThis.__v20自长 = 现在;
          const 子 = spawn(process.execPath, [path.join(家, "自长.mjs"), 卡带, ...(会话号 ? ["--会话", 会话号] : [])], { detached: true, stdio: "ignore" });
          子.unref?.();
        }
      } catch (e) { ctx.logger?.warn?.("[memory-v20] 自长起不来：" + String(e?.message ?? e)); }
      try { 驱.重载(); } catch { /* 重载失败不影响 */ }
      let b = 驱.取料(是检查 ? "" : 话);
      if (b.条数 === 0 && config.改写 !== false) {
        try {
          const 名 = process.env.QUANYI_ADAPTER === "openai" ? "openai.mjs" : "deepseek.mjs";
          const 插头 = await import(path.join(家, "adapters", 名));
          if (插头.有钥匙()) {
            const { 改写 } = await import(path.join(家, "改写.mjs"));
            const 日 = 驱.句柄.最近日记?.(1)?.[0];
            const 词 = await 改写({ 查询: 话, 说: 插头.说, 上下文: 日 ? String(日.文).slice(0, 400) : "" });
            if (词.length) {
              b = 驱.取料(话 + " " + 词.join(" "));
              ctx.logger?.info?.("[memory-v20] 词法没命中，改写后重试：" + 词.join(" / ") + "（" + b.条数 + " 条）");
            }
          }
        } catch (e) { ctx.logger?.warn?.("[memory-v20] 改写失败：" + String(e?.message ?? e)); }
      }
      驱.收尾(b.条数 ? b.text.match(/\[(\d+)\]/g)?.map((x) => Number(x.slice(1, -1))) ?? [] : []);

      if (!是检查) { try { 记接(卡带); } catch { /* 忽略 */ } }
      const 头们 = [接, 提示].filter(Boolean);
      if (是检查) {
        try { 记提(卡带); } catch { /* 记不上不影响这一轮 */ }
        const 到 = 驱.句柄.到点("", new Date()) ?? [];
        const 久 = 驱.句柄.长账(new Date());
        if (到.length) 头们.push("（主动检查：有到点的事）\n- " + String(到[0].内容).slice(0, 80) + "\n（可以提一句，别提第二件。）");
        else if (久) 头们.push("（主动检查：有一件久了）\n- " + String(久.内容).slice(0, 80) + "\n（可以问一句。）");
        else 头们.push("（主动检查：没有该提的事。回一个「。」就行，别打扰他。）");
      }
      // 在线重排（窄版）：他明说找不到，才多问模型一次
      try {
        if (/找不到|没印象|不对|再想想|再搜|记不得/.test(话) && b.条数 >= 3 && config.重排 !== false) {
          const 名 = process.env.QUANYI_ADAPTER === "openai" ? "openai.mjs" : "deepseek.mjs";
          const 插头 = await import(path.join(家, "adapters", 名));
          if (插头.有钥匙()) {
            const 候选 = 驱.调工具("recall", { q: 话, k: 8 });
            const 序 = await 重排({ 问: 话, 候选, 说: 插头.说 });
            const 挑 = 序.map((i) => 候选[i]).filter(Boolean);
            if (挑.length) 头们.push("（他说找不到，我又翻了一遍）\n" + 挑.map((x) => "  [" + x.seq + "] " + String(x.摘录).slice(0, 70)).join("\n"));
          }
        }
      } catch { /* 重排失败就原样递 */ }
      // 配方：卡带带了什么能力，就按触发词跑什么
      try {
        for (const r of 选配方(配方们, 话).slice(0, 2)) {
          const x = 跑配方(驱.句柄, r, 话);
          if (!x.ok || !x.条.length) continue;
          const 文 = x.条.slice(0, 3).map((t) => (t.seq ? "  [" + t.seq + "] " : "  ") + (t.备注 ? t.备注 + (t.摘录 ? "：" : "") : "") + String(t.摘录 ?? "").slice(0, 60)).join("\n");
          头们.push("（" + r.名 + "）\n" + 文.slice(0, 400));
        }
      } catch { /* 配方失败不影响递料 */ }
      const 头 = 头们.join("\n\n");
      // 请求侧整形：宿主有没有压缩都不怕，太老的换成「她记得」
      const 整 = 整形({
        messages: decision.messages,
        预算: config.窗口预算 ?? 60000,
        留最近: config.留最近 ?? 12,
        回忆块: (丢了) => {
          const 要几篇 = Math.min(3, Math.max(1, Math.ceil(丢了 / 8)));
          const 日们 = 驱.句柄.最近日记?.(要几篇) ?? [];
          if (!日们.length) return b.text.split("\n").slice(0, 6).join("\n");
          return 日们.map((d) => String(d.文).split("\n").filter((l) => l && !l.startsWith("#") && !l.startsWith("↩")).join("\n").trim()).join("\n\n").slice(0, 600);
        },
      });
      const 基底 = 整.压缩 ? 整.messages : decision.messages;
      const 注入 = 记忆消息((头 ? 头 + "\n\n" : "") + "（记忆）\n" + b.text);
      if (!校验消息(注入)) {
        连败++;
        ctx.logger?.warn?.("[memory-v20] 注入消息形状不对，这一轮不注入（连败 " + 连败 + "）");
        return 整.压缩 ? { ...decision, messages: 基底 } : decision;
      }
      连败 = 0;
      ctx.logger?.info?.("[memory-v20] 这一轮递料 " + (Date.now() - 打点) + "ms（" + b.条数 + " 条 · 整形" + (整.压缩 ? "换了 " + 整.丢了 + " 条" : "未触发") + "）");
      if (整.压缩) ctx.logger?.info?.("[memory-v20] 上下文整形：换掉 " + 整.丢了 + " 条，省约 " + 整.省下 + " token");
      return { ...decision, messages: [...基底, 注入] };
    } catch (e) {
      连败++;
      ctx.logger?.warn?.("[memory-v20] 递料失败：" + String(e?.message ?? e) + "（连败 " + 连败 + "，不影响这一轮）");
      if (连败 >= 3) ctx.logger?.warn?.("[memory-v20] 连续 3 次失败，本会话不再尝试注入（重启或换会话可恢复）");
      return decision;
    }
  }, { prepend: true });
}
