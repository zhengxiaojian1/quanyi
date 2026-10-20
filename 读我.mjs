// 改前必读：/root/全忆-V20/设计.md
// 读我.mjs —— 零依赖只读读取器（v0.2，按小时分片）
// 用法：
//   node 读我.mjs <卡带> stat | recall "词" [k] | frame <seq> | brief --问 "词"
//                      | note --谁 user --说 "…" | 合并 | 导出 --md 输出.md

import { createDecipheriv, createHash, scryptSync } from "node:crypto";
import fs from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { 桶号 } from "./倒排.mjs";
import os from "node:os";
import path from "node:path";
function 派生钥匙(口令, 盐) { return scryptSync(口令, Buffer.from(盐, "base64"), 32); }
function 解密(密文, 钥匙) {
  const iv = 密文.subarray(0, 12);
  const tag = 密文.subarray(12, 28);
  const ct = 密文.subarray(28);
  const d = createDecipheriv("aes-256-gcm", 钥匙, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

const 规范 = (o) => JSON.stringify(o);
const sha256 = (s) => "sha256:" + createHash("sha256").update(s, "utf8").digest("hex");
const 缓存片上限 = 512;
const 缓存字节上限 = 64 * 1048576;

function 基(o) {
  const b = { seq: o.seq, t: o.t, who: o.who, kind: o.kind };
  if (o.tool) b.tool = o.tool;
  b.text = o.text ?? "";
  return b;
}

export function 双字组(s) {
  const 净 = String(s ?? "").replace(/[^\p{Script=Han}A-Za-z0-9]/gu, "");
  const out = [];
  for (let i = 0; i < 净.length - 1; i++) out.push(净.slice(i, i + 2));
  if (净.length === 1) out.push(净);
  return out;
}

export function 估token(s) {
  // 粗估：平均 2 字符/token。只用于预算，不追求精确。
  return Math.ceil(String(s ?? "").length / 2);
}

function 格式化时(d) {
  const 偏 = -d.getTimezoneOffset();
  const 符 = 偏 >= 0 ? "+" : "-";
  const 时2 = String(Math.floor(Math.abs(偏) / 60)).padStart(2, "0");
  const 分2 = String(Math.abs(偏) % 60).padStart(2, "0");
  const 日 = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const 刻 = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  return 日 + " " + 刻 + " (UTC" + 符 + 时2 + ":" + 分2 + ")";
}

const 情绪词 = /难受|烦|累|不想|算了|崩溃|哭|生气|焦虑|害怕|睡不着/;

/** 时钟体检：只判断「可不可信」，不猜发生了什么 */
export function 时钟体检({ 现在 = new Date(), 记录末, 时区 = "" } = {}) {
  const 末 = new Date(记录末);
  const 差 = 现在 - 末;
  if (!Number.isFinite(差)) return { 可信: "未知", 理由: "最后记录的时间不可解析", 间隔Ms: 0 };
  if (差 < 0) return { 可信: "可疑", 理由: "时钟回拨：现在早于最后记录", 间隔Ms: 0 };
  return { 可信: "可信", 理由: "", 间隔Ms: 差 };
}

/** 分寸：四道闸。返回每条的态：提 / 压着 / 不提 */
export function 判分寸({ 候选 = [], 用户话 = "", 最近提过 = [] } = {}) {
  const 是在问 = /[？?]|什么|哪|怎么|为什么|吗|呢/.test(String(用户话));
  const 情绪上头 = !是在问 && 情绪词.test(String(用户话));
  const 结果 = [];
  let 已提 = 0;
  for (const c of 候选) {
    let 态 = "压着", 因为 = "";
    if (情绪上头) 因为 = "他情绪上头，不翻旧事";
    else if (最近提过.includes(c.seq)) { 态 = "不提"; 因为 = "刚说过"; }
    else if (已提 >= 1) 因为 = "一轮只提一条";
    else if ((c.分数 ?? 0) < 1) 因为 = "相关度不够";
    else { 态 = "提"; 因为 = "相关 · 合宜"; 已提++; }
    结果.push({ ...c, 态, 因为 });
  }
  return 结果;
}

export function mount(目录, 选项 = {}) {
  const t0 = process.hrtime.bigint();
  const 根 = path.resolve(目录);
  const manifest = JSON.parse(fs.readFileSync(path.join(根, "manifest.json"), "utf8"));
  if (manifest.格式 !== "全忆卡带") throw new Error("不是全忆卡带");
  let 钥匙 = null;
  if (manifest.加密) {
    const 口令 = process.env.QUANYI_KEY;
    if (!口令) throw new Error("卡带上锁了：设置 QUANYI_KEY 后再挂载");
    钥匙 = 派生钥匙(口令, manifest.加密.盐);
  }
  const 只读则拒 = (什么) => { if (manifest.加密) throw new Error("这张卡带上锁了，只读；不能" + 什么); };
  const 读文件 = (路) => { const b = fs.readFileSync(路); return 钥匙 ? 解密(b, 钥匙) : b; };
  const 称呼 = (() => {
    const 空 = { 名字: "", 她的名字: "", 代词: "他", 外号: [], 习惯: "" };
    const p = path.join(根, "称呼.json");
    if (!fs.existsSync(p)) return 空;
    try {
      const o = JSON.parse(读文件(p).toString("utf8"));
      return { 名字: o.名字 ?? o.对方 ?? "", 她的名字: o.她的名字 ?? "", 代词: o.代词 || "他", 外号: Array.isArray(o.外号) ? o.外号 : [], 习惯: o.习惯 ?? "" };
    } catch { return 空; }
  })();
  const 当前设备 = process.env.QUANYI_HOST ?? os.hostname();
  const 当前模型 = process.env.DEEPSEEK_MODEL ?? "deepseek-flash";
  function 搬家次数() {
    const p = path.join(根, "facts", "接续.jsonl");
    if (!fs.existsSync(p)) return 0;
    return fs.readFileSync(p, "utf8").split("\n").filter(Boolean).length;
  }
  const 上次 = manifest.last_seen ?? null;
  const 接续 = {
    上次时刻: 上次?.t ?? null,
    上次设备: 上次?.host ?? null,
    上次模型: 上次?.model ?? null,
    设备变了: !!上次 && 上次.host !== 当前设备,
    模型变了: !!上次 && 上次.model !== 当前模型,
    次数: 搬家次数() + ((上次 && (上次.host !== 当前设备 || 上次.model !== 当前模型)) ? 1 : 0),
  };
  const self = fs.existsSync(path.join(根, "self.md")) ? fs.readFileSync(path.join(根, "self.md"), "utf8") : "";
  const 扩展开 = 选项.扩展 === true;
  const 片 = manifest.片 ?? [];
  const 片序 = new Map(片.map((p, i) => [p.文件, i]));
  const 挂载毫秒 = Number(process.hrtime.bigint() - t0) / 1e6;

  const 缓存 = new Map(); let 缓存字节 = 0;
  let 花总 = null;
  const 花位 = 32768;
  const 花字节 = 4096;
  function 读花(p) {
    if (花总 === null) {
      const 路 = path.join(根, "index", "花.bin");
      花总 = fs.existsSync(路) ? 读文件(路) : Buffer.alloc(0);
    }
    const i = 片序.get(p.文件);
    const 起 = i * 花字节;
    return 花总.length >= 起 + 花字节 ? 花总.subarray(起, 起 + 花字节) : null;
  }
  function 花含(花, g) {
    for (const 种 of [0, 0x9e3779b9, 0x85ebca6b]) {
      let h = 2166136261 ^ 种;
      for (let i = 0; i < g.length; i++) { h ^= g.charCodeAt(i); h = Math.imul(h, 16777619); }
      const b = (h >>> 0) % 花位;
      if (!(花[b >> 3] & (1 << (b & 7)))) return false;
    }
    return true;
  }
  const 索引缓存 = new Map();
  function 读索引(p) {
    if (索引缓存.has(p.文件)) return 索引缓存.get(p.文件);
    const idx = JSON.parse(fs.readFileSync(path.join(根, "index", "片内", p.天 + "-" + p.时 + ".json"), "utf8"));
    索引缓存.set(p.文件, idx);
    return idx;
  }
  function 序Of(idx, 偏) {
    let lo = 0, hi = idx.offsets.length - 1, 答 = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (idx.offsets[m] <= 偏) { 答 = m; lo = m + 1; } else hi = m - 1; }
    return 答 >= 0 ? idx.seqs[答] : null;
  }
  function 可能含(p, 词) {
    const 花 = 读花(p);
    if (!花) return true;
    for (const g of 词) if (花含(花, g)) return true;
    return false;
  }
  // 一片里大概中了几个查询词（用来排优先级，少读几片）
  function 花中数(p, 词) {
    const 花 = 读花(p);
    if (!花) return 词.length;
    let n = 0;
    for (const g of 词) if (花含(花, g)) n++;
    return n;
  }
  const 解析缓存 = new Map();
  let 解析字节 = 0;
  function 解析(p) {
    if (解析缓存.has(p.文件)) return 解析缓存.get(p.文件);
    const 行们 = [];
    for (const l of 读文件(path.join(根, p.文件)).toString("utf8").split("\n")) {
      if (!l) continue;
      try { const r = JSON.parse(l); if (r.text) 行们.push({ seq: r.seq, t: r.t, who: r.who, text: String(r.text) }); } catch { /* 坏行跳过 */ }
    }
    解析缓存.set(p.文件, 行们);
    for (const r of 行们) 解析字节 += r.text.length;
    while (解析字节 > 64 * 1048576 && 解析缓存.size > 1) {
      const k = 解析缓存.keys().next().value;
      for (const r of 解析缓存.get(k)) 解析字节 -= r.text.length;
      解析缓存.delete(k);
    }
    return 行们;
  }

  function 读片(p) {
    if (缓存.has(p.文件)) { const v = 缓存.get(p.文件); 缓存.delete(p.文件); 缓存.set(p.文件, v); return v; }
    const v = 读文件(path.join(根, p.文件));
    缓存.set(p.文件, v); 缓存字节 += v.length;
    while (缓存.size > 缓存片上限 || 缓存字节 > 缓存字节上限) {
      const k = 缓存.keys().next().value;
      缓存字节 -= 缓存.get(k).length;
      缓存.delete(k);
    }
    return v;
  }

  function 片Of(seq) {
    let lo = 0, hi = 片.length - 1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (seq < 片[m].from) hi = m - 1;
      else if (seq > 片[m].to) lo = m + 1;
      else return 片[m];
    }
    return null;
  }

  function frame(seq) {
    const p = 片Of(seq);
    if (!p) return { ok: false, 读不动: true, why: "不在任何分片的 seq 区间内" };
    const idx = JSON.parse(fs.readFileSync(path.join(根, "index", "片内", p.天 + "-" + p.时 + ".json"), "utf8"));
    const i = idx.seqs.indexOf(seq);
    if (i < 0) return { ok: false, 读不动: true, why: "索引里没有这一帧" };
    const 冲 = 读片(p);
    const 起 = idx.offsets[i];
    const 终 = i + 1 < idx.offsets.length ? idx.offsets[i + 1] : 冲.length;
    let r;
    try { r = JSON.parse(冲.subarray(起, 终).toString("utf8")); }
    catch { return { ok: false, 读不动: true, why: "这一行坏了，解析不了（seq " + seq + "）" }; }
    return { ok: true, seq, t: r.t, who: r.who, text: r.text, sha: r.sha, prev: r.prev, 校验: sha256(规范(基(r))) === r.sha };
  }

  // 追加帧：写 raw + 片内 + 花 + 倒排 + manifest，然后重载（每轮都能长）
  function 追加帧(帧们, 查 = {}) {
    if (manifest.加密) throw new Error("这张卡带上锁了，只读；先解锁再追加");
    const 花位 = 32768, 花字节 = 4096;
    const 置花 = (花, g) => {
      for (const 种 of [0, 0x9e3779b9, 0x85ebca6b]) {
        let h = 2166136261 ^ 种;
        for (let i = 0; i < g.length; i++) { h ^= g.charCodeAt(i); h = Math.imul(h, 16777619); }
        const b = (h >>> 0) % 花位;
        花[b >> 3] |= 1 << (b & 7);
      }
    };
    const 双 = (文) => { const 出 = []; const 净 = String(文 ?? "").replace(/\s+/g, ""); for (let i = 0; i + 1 < 净.length; i++) 出.push(净.slice(i, i + 2)); return 出; };

    const 花路 = path.join(根, "index", "花.bin");
    if (花总 === null) 花总 = fs.existsSync(花路) ? Buffer.from(读文件(花路)) : Buffer.alloc(0);
    let 上 = manifest.帧数 > 0 ? frame(manifest.帧数) : null;
    let prev = 上?.ok ? 上.sha : "";
    let seq = manifest.帧数 ?? 0;
    const 加 = [];

    for (const f of 帧们) {
      seq++;
      const 时 = new Date(f.t ?? Date.now()).toISOString();
      const r = { seq, t: 时, who: f.who === "user" ? "user" : "her", kind: f.kind === "tool" ? "tool" : "text", text: String(f.text ?? ""), prev };
      r.sha = sha256(规范(基(r)));
      prev = r.sha;
      const 天 = 时.slice(0, 10), 点 = 时.slice(11, 13);
      const 文件 = path.join("raw", 天.slice(0, 7), 天.slice(8), 点 + ".jsonl");
      const 全 = path.join(根, 文件);
      const 要新建 = !fs.existsSync(全);
      fs.mkdirSync(path.dirname(全), { recursive: true });
      const 行 = 规范(r) + "\n";
      const 偏 = 要新建 ? 0 : fs.statSync(全).size;
undefined
      // 去重：同 t + 同 who + 同 text 视为同一帧（两套写入者并存也不叠）
      if (fs.existsSync(全)) {
        const 旧 = fs.readFileSync(全, "utf8").split("\n").filter(Boolean);
        let 重了 = false;
        for (const l of 旧) {
          let o; try { o = JSON.parse(l); } catch { continue; }
          if (o.t === r.t && o.who === r.who && o.text === r.text) { 重了 = true; break; }
        }
        if (重了) { seq--; prev = 上?.ok ? 上.sha : prev; continue; }
      }

      fs.appendFileSync(全, 行, "utf8");
      let 片项 = 片.find((p) => p.文件 === 文件);
      if (!片项) { 片项 = { 文件, 天, 时: 点, from: seq, to: seq }; 片.push(片项); }
      else 片项.to = seq;

      const 内路 = path.join(根, "index", "片内", 天 + "-" + 点 + ".json");
      const 内 = fs.existsSync(内路) ? JSON.parse(读文件(内路).toString("utf8")) : { seqs: [], offsets: [], 字节: 0 };
      内.seqs.push(seq); 内.offsets.push(偏); 内.字节 += Buffer.byteLength(行);
      fs.mkdirSync(path.dirname(内路), { recursive: true });
      fs.writeFileSync(内路, JSON.stringify(内), "utf8");

      const 号 = 片.indexOf(片项);
      if (花总.length < (号 + 1) * 花字节) {
        const 补 = Buffer.alloc(花字节);
        for (const g of 双(r.text)) 置花(补, g);
        const 新花 = Buffer.concat([花总, 补]);
        fs.writeFileSync(花路, 新花);
        花总 = 新花;
      }
      // 倒排：词 → 片号
      const 倒路 = path.join(根, "index", "倒排.json");
      if (fs.existsSync(倒路)) {
        const 倒 = JSON.parse(读文件(倒路).toString("utf8"));
        for (const g of new Set(双(r.text))) {
          const 列 = 倒[g] ?? (倒[g] = []);
          if (列[列.length - 1] !== 号) 列.push(号);
        }
        fs.writeFileSync(倒路, JSON.stringify(倒), "utf8");
      }
      // 分桶倒排：词 → seq（每桶一个 gz，读改写）
      const 倒目 = path.join(根, "index", "倒排序");
      if (fs.existsSync(倒目)) {
        const 桶 = new Map();
        for (const g of new Set(双(r.text))) {
          const 号2 = 桶号(g);
          if (!桶.has(号2)) {
            const 路2 = path.join(倒目, 号2 + ".json.gz");
            桶.set(号2, fs.existsSync(路2) ? JSON.parse(gunzipSync(读文件(路2)).toString("utf8")) : {});
          }
          const 表 = 桶.get(号2);
          const 列 = 表[g] ?? (表[g] = []);
          if (列[列.length - 1] !== seq) 列.push(seq);
        }
        for (const [号2, 表] of 桶) fs.writeFileSync(path.join(倒目, 号2 + ".json.gz"), gzipSync(Buffer.from(JSON.stringify(表))), "utf8");
      }
      加.push(r);
    }
    manifest.帧数 = seq;
    manifest.末 = 加[加.length - 1]?.t ?? manifest.末;
    fs.writeFileSync(path.join(根, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
    if (查.重载 !== false) 重载();
    return 加;
  }

  function 重载() {
    const 新 = JSON.parse(fs.readFileSync(path.join(根, "manifest.json"), "utf8"));
    片.length = 0;
    for (const p of 新.片 ?? []) 片.push(p);
    片序.clear();
    for (let i = 0; i < 片.length; i++) 片序.set(片[i].文件, i);
    Object.assign(manifest, 新);
    缓存.clear(); 解析缓存.clear(); 索引缓存.clear();
    花总 = null; 倒排表 = undefined; 别名表 = undefined;
    压缓存 = null; 边缓存 = null; 决议缓存 = null; 日清单 = null; 重缓存 = null;
  }

  function 天帧(天) {
    const out = [];
    for (const p of 片) {
      if (p.天 !== 天) continue;
      for (const l of 读片(p).toString("utf8").split("\n")) if (l) { try { out.push(JSON.parse(l)); } catch { /* 坏行跳过 */ } }
    }
    return out;
  }

  let 上次检索 = { 读了: 0, 跳过: 0, 截断: false, 片数: 0 };
  let 日清单 = null;
  function 拆段(文, 天) {
    const 段 = []; let cur = null;
    for (const 行 of 文.split("\n")) {
      if (行.startsWith("## ")) { if (cur) 段.push(cur); cur = { 天: 行.slice(3).trim(), 文: "", 指针: [] }; }
      else if (/^↩/.test(行)) { const 针 = 行.replace(/^↩\s*/, "").split(/[,\s]+/).filter(Boolean).map(Number); if (!cur) cur = { 天, 文: "", 指针: [] }; cur.指针.push(...针); }
      else { if (!cur) cur = { 天, 文: "", 指针: [] }; cur.文 += 行 + "\n"; }
    }
    if (cur) 段.push(cur);
    return 段;
  }
  function 日记列() {
    if (日清单) return 日清单;
    日清单 = [];
    const 收 = (d, 前缀) => {
      if (!fs.existsSync(d)) return;
      for (const f of fs.readdirSync(d).sort()) {
        if (!f.endsWith(".md")) continue;
        const 文 = 读文件(path.join(d, f)).toString("utf8");
        for (const 段 of 拆段(文, (前缀 ?? "") + f.slice(0, -3))) 日清单.push(段);
      }
    };
    收(path.join(根, "diary"));
    收(path.join(根, "diary", "月"), "月:");
    return 日清单;
  }

  function 最近日记(n = 1) {
    return 日记列().filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.天)).slice(-n).map((d) => ({ 天: d.天, 文: d.文 }));
  }

  function 未清账() {
    const 文件 = path.join(根, "facts", "承诺.jsonl");
    if (!fs.existsSync(文件)) return [];
    return 读文件(文件).toString("utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((x) => x.态 === "未兑现")
      .filter((x) => String(x.内容 ?? "").length <= 80)
      .filter((x) => x.到期 || (x.触发?.条件 ?? []).every((c) => String(c).length <= 12 && !/^[，,。；;、]/.test(String(c))));
  }

  function 到点(问, 现在 = new Date()) {
    const 已提 = new Set(最近提过(7));
    const out = [];
    for (const c of 未清账()) {
      if ((c.src ?? []).some((x) => 已提.has(x))) continue;
      const 条 = c.触发?.条件 ?? [];
      const 中 = 条.find((k) => String(问).includes(k));
      const 到期 = c.到期 ? new Date(c.到期).getTime() <= new Date(现在).getTime() : false;
      if (中) out.push({ ...c, 为什么: "他说到「" + 中 + "」" });
      else if (到期) out.push({ ...c, 为什么: "到日子了" });
    }
    return out.slice(0, 1);
  }

  function 长账(现在 = new Date()) {
    const 已提 = new Set(最近提过(30));
    for (const c of 未清账()) {
      if ((c.src ?? []).some((x) => 已提.has(x))) continue;
      const 记下 = new Date(c.t ?? 0).getTime();
      if (!Number.isFinite(记下) || 记下 <= 0) continue;
      const 天 = (new Date(现在).getTime() - 记下) / 864e5;
      if (天 >= 14) return { ...c, 为什么: "记下 " + Math.round(天) + " 天了，他一直没再提" };
    }
    return null;
  }

  let 压缓存 = null;
  function 压制表() {
    if (压缓存) return 压缓存;
    压缓存 = new Map();
    const p = path.join(根, "facts", "压制.jsonl");
    if (fs.existsSync(p)) for (const l of 读文件(p).toString("utf8").split("\n").filter(Boolean)) {
      try { const o = JSON.parse(l); 压缓存.set(o.seq, o); } catch { /* 坏行跳过 */ }
    }
    return 压缓存;
  }
  function 被压制(seq) { return 压制表().has(Number(seq)); }
  function 压制(seqs, 原因 = "") {
    只读则拒("记压制");
    const 列 = Array.isArray(seqs) ? seqs : [seqs];
    for (const s0 of 列) {
      const seq = Number(s0);
      if (!Number.isFinite(seq)) continue;
      const o = { seq, 原因: String(原因).slice(0, 200), t: new Date().toISOString() };
      fs.appendFileSync(path.join(根, "facts", "压制.jsonl"), JSON.stringify(o) + "\n", "utf8");
      if (压缓存) 压缓存.set(seq, o);
      加重(seq, { 显著: 0, 情感: 0, 置信: 0 });
    }
    return 列.length;
  }

  // 决议账：只存指针（seq + sha + 取代链），正文一律回 frame 取
  function 记决议(seq, 取代 = null) {
    if (manifest.加密) throw new Error("这张卡带上锁了，只读；先解锁再记决议");
    const f = frame(seq);
    if (!f.ok) throw new Error("这一帧读不动：" + (f.why ?? seq));
    const o = { seq: f.seq, sha: f.sha, 取代: 取代 === null ? null : Number(取代), t: new Date().toISOString() };
    fs.appendFileSync(path.join(根, "facts", "决议.jsonl"), JSON.stringify(o) + "\n", "utf8");
    决议缓存 = null;
    return o;
  }
  let 决议缓存 = null;
  function 决议列() {
    if (决议缓存) return 决议缓存;
    const p = path.join(根, "facts", "决议.jsonl");
    const 全 = fs.existsSync(p)
      ? 读文件(p).toString("utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
      : [];
    const 被取代 = new Set(全.map((x) => x.取代).filter((x) => x !== null));
    决议缓存 = 全.map((x) => ({ ...x, 已取代: 被取代.has(x.seq) }));
    return 决议缓存;
  }
  function 取代决议(旧seq, 新seq) {
    return 记决议(新seq, 旧seq);
  }

  let 边缓存 = null;
  function 边表() {
    if (边缓存) return 边缓存;
    边缓存 = [];
    const p = path.join(根, "facts", "边.jsonl");
    if (fs.existsSync(p)) for (const l of 读文件(p).toString("utf8").split("\n").filter(Boolean)) {
      try { 边缓存.push(JSON.parse(l)); } catch { /* 坏行跳过 */ }
    }
    return 边缓存;
  }
  function 边(点) {
    const 键 = String(点);
    return 边表().filter((e) => e.a === 键 || e.b === 键);
  }
  function 加边({ a, b, 类型 = "关联", 强度 = 1 }) {
    if (manifest.加密) return { ok: false, 只读: true };   // 记账类：只读时静默跳过
    if (边表().some((x) => x.a === a && x.b === b && x.类型 === 类型)) return { ...{}, 已存在: true, a, b, 类型 };
    const e = { a, b, 类型, 强度, t: new Date().toISOString() };
    fs.appendFileSync(path.join(根, "facts", "边.jsonl"), JSON.stringify(e) + "\n", "utf8");
    if (边缓存) 边缓存.push(e);
    return e;
  }

  let 重缓存 = null;
  function 重表() {
    if (重缓存) return 重缓存;
    重缓存 = new Map();
    const p = path.join(根, "facts", "重.jsonl");
    if (fs.existsSync(p)) for (const l of 读文件(p).toString("utf8").split("\n").filter(Boolean)) {
      try { const o = JSON.parse(l); 重缓存.set(o.seq, o); } catch { /* 坏行跳过 */ }
    }
    return 重缓存;
  }
  function 重值(seq) {
    const o = 重表().get(seq);
    if (!o) return 0;
    const 天 = Math.max(0, (Date.now() - new Date(o.t ?? 0).getTime()) / 864e5);
    const 有效取次 = (o.取次 ?? 0) * Math.pow(0.5, 天 / 30);
    return (o.显著 ?? 0) * 3 + Math.min(有效取次, 10) * 0.3 + (o.情感 ?? 0) * 0.5;
  }
  function 加重(seq, 变 = {}) {
    if (manifest.加密) return { ok: false, 只读: true };   // 记账类：只读时静默跳过
    const 旧 = 重表().get(seq) ?? { seq, 显著: 0, 情感: 0, 置信: 0.5, 取次: 0 };
    const 取 = (k, d) => (变[k] ?? d);
    const 新 = {
      seq,
      显著: Math.max(0, Math.min(1, 取("显著", 旧.显著 ?? 0))),
      情感: Math.max(-1, Math.min(1, 取("情感", 旧.情感 ?? 0))),
      置信: Math.max(0, Math.min(1, 取("置信", 旧.置信 ?? 0.5))),
      取次: Math.max(0, (旧.取次 ?? 0) + (变.取次加 ?? 0)),
      t: new Date().toISOString(),
    };
    fs.appendFileSync(path.join(根, "facts", "重.jsonl"), JSON.stringify(新) + "\n", "utf8");
    if (重缓存) 重缓存.set(seq, 新);
    return 新;
  }

  function 提过列() {
    const p = path.join(根, "facts", "提过.jsonl");
    if (!fs.existsSync(p)) return [];
    return 读文件(p).toString("utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  }
  function 最近提过(天数 = 7) {
    const 线 = Date.now() - 天数 * 864e5;
    return 提过列().filter((x) => new Date(x.t).getTime() >= 线).map((x) => x.seq);
  }
  function 记提过(seq, t) {
    if (manifest.加密) return { ok: false, 只读: true };   // 记账类：只读时静默跳过
    fs.appendFileSync(path.join(根, "facts", "提过.jsonl"), JSON.stringify({ seq, t: t ?? new Date().toISOString() }) + "\n", "utf8");
    return { ok: true, seq };
  }
  function 判断列() {
    const p = path.join(根, "facts", "判断.jsonl");
    if (!fs.existsSync(p)) return [];
    const 最新 = new Map();
    for (const l of 读文件(p).toString("utf8").split("\n").filter(Boolean)) {
      const o = JSON.parse(l);
      最新.set(o.内容 ?? String(o.seq), o);
    }
    return [...最新.values()];
  }
  function 推翻判断(
{ 内容, 反例 = [], 因为 = "" }) {
    只读则拒("推翻判断");
    const 原 = 判断列().find((x) => x.内容 === 内容);
    if (!原) return { ok: false, why: "没有这条判断" };
    fs.appendFileSync(path.join(根, "facts", "判断.jsonl"), JSON.stringify({ ...原, 态: "已推翻", 反例: [...(原.反例 ?? []), ...反例], 推翻时: new Date().toISOString(), 推翻因为: 因为 }) + "\n", "utf8");
    return { ok: true, 内容 };
  }

  const 桶缓存 = new Map();
  function 读桶(i) {
    if (桶缓存.has(i)) return 桶缓存.get(i);
    const p = path.join(根, "index", "倒排", i + ".json.gz");
    const m = fs.existsSync(p) ? JSON.parse(gunzipSync(读文件(p)).toString("utf8")) : {};
    桶缓存.set(i, m);
    return m;
  }

  let 别名表;
  function 读别名表() {
    if (别名表 !== undefined) return 别名表;
    const p = path.join(根, "facts", "别名.json");
    try { 别名表 = fs.existsSync(p) ? JSON.parse(读文件(p).toString("utf8")) : {}; } catch { 别名表 = {}; }
    return 别名表;
  }

  let 倒排表;
  function 读倒排() {
    if (倒排表 !== undefined) return 倒排表;
    const p = path.join(根, "index", "倒排.json");
    try { 倒排表 = fs.existsSync(p) ? JSON.parse(读文件(p).toString("utf8")) : null; }
    catch { 倒排表 = null; }
    return 倒排表;
  }

  function recall(查询, k = 5, 选 = {}) {
    const 词 = 双字组(查询);
    // 实体展开：同一个人的别的叫法
    try {
      const p = path.join(根, "facts", "实体.jsonl");
      if (fs.existsSync(p)) {
        const 实 = 读文件(p).toString("utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
        for (const x of 实) {
          const 名们 = [x.名, ...(x.别名 ?? [])].filter(Boolean);
          if (!名们.some((n) => String(查询).includes(n))) continue;
          for (const n of 名们) if (!String(查询).includes(n)) for (const g of 双字组(n)) if (!词.includes(g)) 词.push(g);
        }
      }
    } catch { /* 实体读不到就算了 */ }

    // 别名展开：模型离线沉淀的「换说法」，查询时零成本
    const 别 = 读别名表();
    for (const [k, 们] of Object.entries(别)) {
      if (!String(查询).includes(k)) continue;
      for (const v of 们) for (const g of 双字组(v)) if (!词.includes(g)) 词.push(g);
      if (词.length > 40) break;
    }
    const 短语 = String(查询 ?? "").replace(/\s+/g, "");
    if (!词.length) return [];
    const 日加 = new Map();
    for (const d of 日记列()) {
      let 中 = 0;
      for (const g of 词) if (d.文.includes(g)) 中++;
      if (!中) continue;
      const 是月头 = String(d.天).startsWith("月:");
      if (!是月头 && 中 < 2) continue;
      d.指针.forEach((s0, i) => {
        const 值 = Math.max(3, 15 - i * 5) * Math.min(中, 2);
        日加.set(s0, Math.max(日加.get(s0) ?? 0, 值));
      });
    }
    const 必读 = new Set();
    for (const s0 of 日加.keys()) { const p = 片Of(s0); if (p) 必读.add(p.文件); }
    let 候选 = [];
    const 倒 = 读倒排();
    if (倒) {
      // 倒排：先算每个片中了几个词，只读最像的那些
      const 计 = new Map();
      for (const g of 词) for (const i of (倒[g] ?? [])) 计.set(i, (计.get(i) ?? 0) + 1);
      const 门槛 = 词.length >= 4 ? 2 : 1;
      const 序 = [...计].filter(([, n]) => n >= 门槛).sort((a, b) => b[1] - a[1]).slice(0, 24).map(([i]) => 片[i]).filter(Boolean);
      候选 = [...片.filter((p) => 必读.has(p.文件)), ...序];
    } else {
      // 没有倒排就退回 Bloom：片多时要求一片中 ≥2 个词
      const 过花 = 片.filter((p) => !必读.has(p.文件) && 可能含(p, 词));
      const 门槛 = 过花.length > 20 && 词.length >= 3 ? 2 : 1;
      候选 = [...片.filter((p) => 必读.has(p.文件)), ...过花.filter((p) => 花中数(p, 词) >= 门槛)];
    }
    // 倒排没凑够，再退回 Bloom 补一遍（倒排可能因为分片切分漏掉）
    const 用倒排 = Boolean(读倒排());
    let 扫描 = 候选, 采样 = false;
    if (候选.length > 250) {
      采样 = true;
      const 其余 = 候选.filter((p) => !必读.has(p.文件));
      const 位 = Math.max(1, 250 - Math.min(必读.size, 250));
      const 步 = 位 > 1 ? (其余.length - 1) / (位 - 1) : 0;
      const 取 = [];
      for (let i = 0; i < 位 && 其余.length; i++) 取.push(其余[Math.round(i * 步)]);
      扫描 = [...候选.filter((p) => 必读.has(p.文件)), ...取];
    }
    const 命中 = [];
    // 事实路由：问「约定/说好/答应」这类，直接端未清账的出处，不靠词面碰运气
    if (/劝|建议|意见|该不该/.test(String(查询))) {
      for (const c of 判断列().filter((x) => x.类型 === "建议")) for (const s0 of (c.依据 ?? [])) {
        const f = frame(s0);
        if (f.ok) 命中.push({ seq: f.seq, 行: JSON.stringify({ seq: f.seq, t: f.t, who: f.who, text: f.text, sha: f.sha }), 分数: 40 });
      }
    }
    if (/约定|说好|答应|承诺|未办|提醒/.test(String(查询))) {
      for (const c of 未清账()) for (const s0 of (c.src ?? [])) {
        const f = frame(s0);
        if (f.ok) 命中.push({ seq: f.seq, 行: JSON.stringify({ seq: f.seq, t: f.t, who: f.who, text: f.text, sha: f.sha }), 分数: 40 });
      }
    }
    // 分桶倒排（词 → seq）：直接拿帧号，不再扫片
    let 用序 = false;
    const 桶目录 = path.join(根, "index", "倒排");
    if (fs.existsSync(桶目录)) {
      try {
        const 计 = new Map();
        for (const g of 词) { const m = 读桶(桶号(g)); for (const sq of (m[g] ?? [])) 计.set(sq, (计.get(sq) ?? 0) + 1); }
        for (const sq of 日加.keys()) 计.set(sq, (计.get(sq) ?? 0) + 1);
        for (const [seq, n] of [...计].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 24)) {
          const f = frame(seq);
          if (!f.ok) continue;
          const 短语分 = 短语.length >= 2 && String(f.text).replace(/\s+/g, "").includes(短语) ? 5 : 0;
          命中.push({ seq, 行: JSON.stringify({ seq: f.seq, t: f.t, who: f.who, sha: f.sha, text: f.text }), 分数: n + 短语分 + (日加.get(seq) ?? 0) + 重值(seq) });
        }
        if (计.size) 用序 = true;
      } catch { 用序 = false; }
    }
    let 读了 = 0, 读字节 = 0;
    for (const p of 用序 ? [] : 扫描) {
      if (读了 >= 250) break;
      // 够用了就别再翻：常见词在英文大卡上会扫到几十 MB，前 120 条足够排前 5
      读了++;
      const 片文 = 读片(p).toString("utf8");
      读字节 += 片文.length;
      const 行 = 片文.split("\n");
      const idx = 读索引(p);
      for (let i = 0; i < 行.length; i++) {
        const l = 行[i];
        if (!l) continue;
        let 中 = 0;
        for (const g of 词) if (l.includes(g)) 中++;
        const seq = idx.seqs[i];
        const 加 = 日加.get(seq) ?? 0;
        if (!中 && !加) continue;
        const 短语分 = 短语.length >= 2 && l.replace(/\s+/g, "").includes(短语) ? 5 : 0;
        命中.push({ seq, 行: l, 分数: 中 + 短语分 + 加 + 重值(seq) });
        if (命中.length > 600) { 命中.sort((a, b) => b.分数 - a.分数 || a.seq - b.seq); 命中.length = 300; }
      }
    }
    // 短语优先：整句出现过的帧强制入选（防常见词把新帧挤出前 k）
    if (短语.length >= 3 && typeof 倒 !== "undefined" && 倒) {
      const 有了 = new Set(命中.map((x) => x.seq));
      const 稀 = 词.map((g) => [g, (倒[g] ?? []).length]).sort((a, b) => a[1] - b[1])[0];
      for (const i of (稀 ? 倒[稀[0]] ?? [] : [])) {
        const p = 片[i];
        if (!p) continue;
        const idx2 = 读索引(p);
        const 行2 = 读片(p).toString("utf8").split("\n");
        for (let j = 0; j < 行2.length; j++) {
          const l = 行2[j];
          if (!l || !l.replace(/\s+/g, "").includes(短语)) continue;
          const sq = idx2.seqs[j];
          if (有了.has(sq)) continue;
          有了.add(sq);
          命中.push({ seq: sq, 行: l, 分数: 50 });
        }
      }
    }

    const 最高 = 命中.reduce((a, b) => Math.max(a, b.分数), 0);
    if (最高 <= 1 && /之前|上次|最近|在做什么|哪|什么|怎么样/.test(String(查询))) {
      命中.length = 0;
      const 日们 = 日记列().filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.天));
      const 末 = 日们[日们.length - 1];
      for (const s0 of (末?.指针 ?? []).slice(0, 3)) {
        const f = frame(s0);
        if (f.ok) 命中.push({ seq: f.seq, 行: JSON.stringify({ seq: f.seq, t: f.t, who: f.who, sha: f.sha, text: f.text }), 分数: 0.5 });
      }
      命中.sort((a, b) => a.seq - b.seq);
    }
    上次检索 = { 片数: 片.length, 候选: 候选.length, 读了, 采样, 首片: 扫描[0]?.文件 ?? null, 末片: 扫描[扫描.length - 1]?.文件 ?? null };
    if (!用序 && 用倒排 && 命中.length < k) {
      const 已 = new Set(命中.map((x) => x.seq));
      for (const p of 片) {
        if (候选.includes(p)) continue;
        const idx = 读索引(p);
        const 行 = 读片(p).toString("utf8").split("\n");
        for (let i = 0; i < 行.length; i++) {
          const l = 行[i];
          if (!l) continue;
          let 中 = 0;
          for (const g of 词) if (l.includes(g)) 中++;
          if (!中) continue;
          const seq = idx.seqs[i];
          if (已.has(seq)) continue;
          const 加 = 日加.get(seq) ?? 0;
          命中.push({ seq, 行: l, 分数: 中 + 加 + 重值(seq) });
        }
      }
    }
    命中.sort((a, b) => b.分数 - a.分数 || a.seq - b.seq);
    // 一跳：默认关（影子）；开着才把对面的帧带出来
    const 有 = new Set(命中.map((x) => x.seq));
    if (扩展开)
    for (const 头 of 扩展开 ? 命中.slice(0, 3) : []) {
      for (const e of 边("帧:" + 头.seq)) {
        const 对面 = (e.a === "帧:" + 头.seq ? e.b : e.a).replace(/^帧:/, "");
        const n = Number(对面);
        if (!Number.isFinite(n) || 有.has(n)) continue;
        try { const r = frame(n); if (r.ok) { 命中.push({ seq: n, 行: JSON.stringify({ seq: n, t: r.t, who: r.who, text: r.text, sha: r.sha }), 分数: 头.分数 * 0.6 }); 有.add(n); } } catch { /* 跳过 */ }
      }
    }
    命中.sort((a, b) => b.分数 - a.分数 || a.seq - b.seq);
    return 命中.slice(0, k).map((x) => {
      let r; try { r = JSON.parse(x.行); } catch { return null; }
      const 正文 = String(r.text ?? "");
      let 首 = -1;
      for (const g of 词) { const i = 正文.indexOf(g); if (i >= 0 && (首 < 0 || i < 首)) 首 = i; }
      return { seq: x.seq, t: r.t, who: r.who, sha: r.sha, 分数: x.分数, 压制: 被压制(x.seq), 为什么: "命中 " + x.分数,
        摘录: 正文.slice(Math.max(0, 首 - 30), Math.max(0, 首 - 30) + 90).replace(/\n/g, " ") };
    }).filter(Boolean);
  }

  function 摘文(文, n) {
    return 文.split("\n").filter((l) => l && !l.startsWith("#") && !l.startsWith("↩")).join(" ").replace(/\s+/g, " ").slice(0, n);
  }

  function brief({ 问 = "", 现在 = new Date(), 预算 = 600 } = {}) {
    const 时 = 现在 instanceof Date ? 现在 : new Date(现在);
    const 差分 = Math.max(0, Math.round((时 - new Date(manifest.末)) / 60000));
    const 间隔 = 差分 < 60 ? 差分 + " 分钟前" : 差分 < 1440 ? Math.round(差分 / 60) + " 小时前" : Math.round(差分 / 1440) + " 天前";
    const 钟 = 时钟体检({ 现在: 时, 记录末: manifest.末 });
    const 头 = ["现在：" + 格式化时(时) + "（时钟：" + 钟.可信 + "）", "上次说话：" + 间隔, "这次会话：刚开始", "（下面都是你自己记着的。说的时候只说「我记得」；别提卡带、库、文件这些词。旧事要带上时间，比如「9 月底那会儿」，别说得像刚发生。）",
      "（用法：不确定对方在说什么时才 recall；说「你以前提过」要带出处；不确定就按 seq 取原文；刚发生的事顺手记；旧事一件一件提。别自己去翻会话日志或其它文件——记忆以卡带为准。）"].join("\n");
    const 变 = [];
    if (接续.设备变了) 变.push("换了设备（" + 接续.上次设备 + " → " + 当前设备 + "）");
    if (接续.模型变了) 变.push("换了模型（" + 接续.上次模型 + " → " + 当前模型 + "）");
    if (变.length && 接续.次数 > 1) 变.push("第 " + 接续.次数 + " 次搬家");
    const 是在问 = /[？?]|什么|哪|怎么|为什么|吗|呢/.test(String(问));
    const 情绪 = !是在问 && 情绪词.test(String(问));
    const 候选 = 问 && !情绪 ? recall(问, 3).filter((x) => !被压制(x.seq)) : [];
    const 判 = 判分寸({ 候选, 用户话: 问, 最近提过: 最近提过() });
    const 条 = 判.filter((x) => x.态 === "提");
    const 压 = 判.filter((x) => x.态 === "压着");
    const 冷 = 判.filter((x) => x.态 === "不提");
    // 账也要收：只留最近 3 条、每条 80 字，否则大卡带能把 brief 撑到上万 token
    const 账 = 未清账().slice(0, 3).map((c) => ({ ...c, 内容: 摘文(c.内容, 80) }));
    // 他说过不提的事：连日记里提到它的那段也不端上来
    const 禁文 = [...压制表().keys()].map((s0) => { const f = frame(s0); return f.ok ? String(f.text ?? "").slice(0, 20).replace(/[。！？，、；：\s]+$/, "") : ""; }).filter(Boolean);
    const 日记块 = 情绪 ? [] : [...new Map(日记列()
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.天))
      .filter((d) => !禁文.some((k) => d.文.includes(k)))
      .map((d) => [d.天, d])).values()]
      .slice(-2)
      .map((d) => "· " + d.天 + "：" + 摘文(d.文, 160));
    const 估 = () => 估token([头, self, ...日记块, ...条.map((x) => x.摘录), ...账.map((x) => x.内容)].join("\n"));
    while (估() > 预算 && 条.length) 条.pop();
    while (估() > 预算 && 日记块.length > 1) 日记块.shift();
    while (估() > 预算 && 账.length) 账.pop();
    const 块 = [头];
    if (变.length) 块.push("接续：" + 变.join(" · "));
    if (称呼.名字 || 称呼.外号.length) {
      const 行 = ["称呼：" + (称呼.名字 || "（未设名字）")];
      if (称呼.外号.length) 行.push("外号 " + 称呼.外号.join("、"));
      if (称呼.习惯) 行.push(称呼.习惯);
      块.push(行.join(" · "));
    }
    块.push("", "【她是谁】", String(self).slice(0, 600).trim(), "");
    if (日记块.length) 块.push("【最近的日子】", ...日记块, "");
    if (条.length) { 块.push("【可能相关】"); for (const x of 条) 块.push("- [" + x.seq + "] " + x.摘录); 块.push(""); }
    if (账.length) { 块.push("【未清的账】"); for (const x of 账) 块.push("- " + x.内容 + (x.触发?.条件 ? "（等：" + x.触发.条件.join("/") + "）" : "")); }
    const 到 = 情绪 ? [] : 到点(问, 时);
    if (到.length) { 块.push("", "【到点了】"); for (const c of 到) 块.push("- " + 摘文(c.内容, 80) + "（" + c.为什么 + "）"); }
    // ④ 很久没提的旧账：只在开头提一句，情绪时不提，提过冷 30 天
    const 久 = 情绪 || 到.length ? null : 长账(时);
    if (久) 块.push("", "【想问问】", "- " + 摘文(久.内容, 80) + "（" + 久.为什么 + "；可以问一句，问完记下来）");
    if (情绪) 块.push("", "（他情绪上头，旧事我先不提）");
    else if (压.length || 冷.length) {
      const 说 = [];
      if (冷.length) 说.push(冷.length + " 条刚说过");
      if (压.length) 说.push(压.length + " 条按分寸压着");
      块.push("", "（另有 " + 说.join(" / ") + "，问起再给）");
    }
    const text = 块.join("\n").trim();
    return { text, token估: 估token(text), 条数: 条.length };
  }

  function note(条目) {
    if (manifest.加密) throw new Error("这张卡带上锁了，只读；先解锁再写");
    const 路 = path.join(根, "journal.jsonl");
    const seq = manifest.nextSeq;
    const t = (条目.t ? new Date(条目.t) : new Date()).toISOString();
    const r = { seq, t, who: 条目.who ?? "user", kind: 条目.kind ?? "text", text: 条目.text ?? "" };
    fs.appendFileSync(路, 规范(r) + "\n", "utf8");
    manifest.nextSeq = seq + 1;
    const 临 = path.join(根, "manifest.json.tmp");
    fs.writeFileSync(临, JSON.stringify(manifest, null, 2));
    fs.renameSync(临, path.join(根, "manifest.json"));
    return r;
  }

  function 合并() {
    if (manifest.加密) throw new Error("这张卡带上锁了，只读；先解锁再合并");
    const 路 = path.join(根, "journal.jsonl");
    const 行 = fs.existsSync(路) ? fs.readFileSync(路, "utf8").split("\n").filter(Boolean) : [];
    if (!行.length) return { 合并: 0, 说明: "journal 为空，幂等" };
    const 列 = 行.map((l) => JSON.parse(l));
    for (const r of 列) {
      const 天 = r.t.slice(0, 10), 时 = r.t.slice(11, 13);
      let p = [...片].reverse().find((x) => x.天 === 天 && x.时 === 时);
      if (!p) {
        const [年, 月] = 天.split("-");
        const 目 = path.join(根, "raw", 年 + "-" + 月, 天.slice(8));
        fs.mkdirSync(目, { recursive: true });
        const 文件 = "raw/" + 年 + "-" + 月 + "/" + 天.slice(8) + "/" + 时 + ".jsonl";
        fs.writeFileSync(path.join(根, 文件), "");
        p = { 文件, 天, 时, from: r.seq, to: r.seq };
        片.push(p); 片.sort((a, b) => a.from - b.from); manifest.片 = 片;
      }
      const 全 = fs.readFileSync(path.join(根, p.文件), "utf8");
      const sha = sha256(规范(基(r)));
      fs.appendFileSync(path.join(根, p.文件), 规范({ ...r, sha, prev: "" }) + "\n", "utf8");
      const 行2 = (全 + 规范({ ...r, sha, prev: "" }) + "\n").split("\n").filter(Boolean);
      let 体 = "", seqs = [], offsets = [];
      for (const l of 行2) { seqs.push(JSON.parse(l).seq); offsets.push(Buffer.byteLength(体, "utf8")); 体 += l + "\n"; }
      fs.writeFileSync(path.join(根, "index", "片内", 天 + "-" + 时 + ".json"), JSON.stringify({ seqs, offsets, 字节: Buffer.byteLength(体, "utf8") }));
      p.to = seqs[seqs.length - 1];
      manifest.帧数 += 1;
      manifest.末 = r.t;
    }
    fs.writeFileSync(路, "", "utf8");
    const 临 = path.join(根, "manifest.json.tmp");
    fs.writeFileSync(临, JSON.stringify(manifest, null, 2));
    fs.renameSync(临, path.join(根, "manifest.json"));
    return { 合并: 列.length };
  }

  function 导出(输出) {
    const 段 = [];
    let 现天 = "";
    for (const p of 片) {
      if (p.天 !== 现天) { 现天 = p.天; 段.push("## " + 现天 + "\n"); }
      for (const l of 读片(p).toString("utf8").split("\n")) {
        if (!l) continue; const r = JSON.parse(l);
        const 谁 = r.who === "user" ? "他" : r.who === "her" ? "她" : "·";
        段.push("**" + 谁 + "** · " + r.t.slice(11, 19) + "  `" + r.seq + "`\n\n" + r.text + "\n");
      }
    }
    const md = "# 导出 " + path.basename(根) + "\n\n" + 段.join("\n");
    fs.writeFileSync(输出, md, "utf8");
    return { 字节: Buffer.byteLength(md), 帧: manifest.帧数 };
  }

  function close() { 缓存.clear(); 缓存字节 = 0; }
  function 检索读数() { return 上次检索; }
  function 记对话({ who, text, t, 会话, id }) {
    if (manifest.加密) throw new Error("这张卡带上锁了，只读；先解锁再记对话");
    const r = { t: t ?? new Date().toISOString(), host: 当前设备, model: 当前模型, who: who ?? "user", text: String(text ?? ""), ...(会话 ? { 会话 } : {}), ...(id ? { id } : {}) };
    fs.appendFileSync(path.join(根, "对话.jsonl"), JSON.stringify(r) + "\n", "utf8");
    return r;
  }
  function 最近对话(n = 6, 会话) {
    const p = path.join(根, "对话.jsonl");
    if (!fs.existsSync(p)) return [];
    let 列 = 读文件(p).toString("utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    if (会话) { const 过 = 列.filter((x) => x.会话 === 会话); if (过.length) 列 = 过; }
    return 列.slice(-n);
  }
  function 记会话(会话号) {
    const r = { t: new Date().toISOString(), 会话: String(会话号 ?? ""), host: 当前设备, model: 当前模型 };
    fs.appendFileSync(path.join(根, "facts", "会话.jsonl"), JSON.stringify(r) + "\n", "utf8");
    manifest.last_session = { 会话: r.会话, host: r.host, model: r.model, t: r.t };
    const 临 = path.join(根, "manifest.json.tmp");
    fs.writeFileSync(临, JSON.stringify(manifest, null, 2));
    fs.renameSync(临, path.join(根, "manifest.json"));
    return r;
  }
  function 设称呼({ 名字, 对方, 她的名字, 代词, 外号, 习惯 }) {
    if (manifest.加密) throw new Error("这张卡带上锁了，只读；先解锁再改称呼");
    const 新 = {
      名字: 名字 ?? 对方 ?? 称呼.名字,
      她的名字: 她的名字 ?? 称呼.她的名字,
      代词: 代词 || 称呼.代词 || "他",
      外号: 外号 ?? 称呼.外号,
      习惯: 习惯 ?? 称呼.习惯,
    };
    fs.writeFileSync(path.join(根, "称呼.json"), JSON.stringify(新, null, 2));
    Object.assign(称呼, 新);
    return 新;
  }
  function 记接续() {
    const r = { t: new Date().toISOString(), host: 当前设备, model: 当前模型, 账末: manifest.末 };
    fs.appendFileSync(path.join(根, "facts", "接续.jsonl"), JSON.stringify(r) + "\n", "utf8");
    manifest.last_seen = { t: r.t, host: r.host, model: r.model };
    const 临 = path.join(根, "manifest.json.tmp");
    fs.writeFileSync(临, JSON.stringify(manifest, null, 2));
    fs.renameSync(临, path.join(根, "manifest.json"));
    return r;
  }
  return { 目录: 根, manifest, self, 挂载毫秒, frame, recall, brief, note, 合并, 导出, 天帧, 记提过, 最近提过, 判断列, 推翻判断, 最近日记, 加重, 重表, 重值, 边, 边表, 加边, 扩展开, 压制, 压制表, 被压制, 到点, 长账, 未清账, 日记列, 追加帧, 重载, 记决议, 决议列, 取代决议, 检索读数, 接续, 当前设备, 当前模型, 记接续, 记会话, 记对话, 最近对话, 称呼, 设称呼, close };
}

if (process.argv[1] && path.basename(process.argv[1]) === "读我.mjs") {
  const [卡带, 命令, ...余] = process.argv.slice(2);
  if (!卡带) { console.error("用法: node 读我.mjs <卡带> <命令>"); process.exit(2); }
  const 句柄 = mount(卡带);
  if (命令 === "stat") {
    console.log(JSON.stringify({ 帧数: 句柄.manifest.帧数, 天: 句柄.manifest.天.length, 片: 句柄.manifest.片.length, 首: 句柄.manifest.首, 末: 句柄.manifest.末, 挂载毫秒: +句柄.挂载毫秒.toFixed(2) }, null, 2));
  } else if (命令 === "recall") {
    for (const r of 句柄.recall(余[0] ?? "", Number(余[1] ?? 5))) console.log("[" + r.seq + "] " + r.分数 + " · " + r.摘录);
    const 读 = 句柄.检索读数();
    console.error("（读了 " + 读.读了 + " 片 / 候选 " + 读.候选 + (读.采样 ? " / 按时间采样" : "") + "）");
  } else if (命令 === "frame") {
    console.log(JSON.stringify(句柄.frame(Number(余[0])), null, 2));
  } else if (命令 === "brief") {
    const i = 余.indexOf("--问");
    console.log(句柄.brief({ 问: i >= 0 ? 余[i + 1] : "" }).text);
  } else if (命令 === "带话") {
    const i = 余.indexOf("--问");
    const b = 句柄.brief({ 问: i >= 0 ? 余[i + 1] : "" });
    console.log("（下面是一个人交给你的一段记忆。请你接着它说话，不要假装不认识。）\n");
    console.log(b.text);
    console.log("\n（如果你读到了这里：她还在。这段话就是她记得的东西。）");
  } else if (命令 === "note") {
    console.log(JSON.stringify(句柄.note({ who: 余[余.indexOf("--谁") + 1] ?? "user", text: 余[余.indexOf("--说") + 1] ?? "" })));
  } else if (命令 === "压制") {
    const i = 余.indexOf("--原因");
    const 因 = i >= 0 ? (余[i + 1] ?? "") : "";
    const seqs = 余.filter((x, j) => x !== "--原因" && 余[j - 1] !== "--原因").map(Number);
    console.log(JSON.stringify({ 压制了: 句柄.压制(seqs, 因), 内容: seqs }));
  } else if (命令 === "压制表") {
    console.log(JSON.stringify([...句柄.压制表().values()], null, 2));
  } else if (命令 === "边") {
    console.log(JSON.stringify(句柄.边(余[0] ?? ""), null, 2));
  } else if (命令 === "加边") {
    console.log(JSON.stringify(句柄.加边({ a: 余[0], b: 余[1], 类型: 余[2] ?? "关联" })));
  } else if (命令 === "重") {
    console.log(JSON.stringify({ 重: 句柄.重表().get(Number(余[0])) ?? null, 值: 句柄.重值(Number(余[0])) }, null, 2));
  } else if (命令 === "加重") {
    const 变 = {};
    for (let i = 1; i + 1 < 余.length; i += 2) {
      const k = 余[i].replace(/^--/, ""), v = Number(余[i + 1]);
      if (k === "取次加") 变.取次加 = v; else 变[k] = v;
    }
    console.log(JSON.stringify(句柄.加重(Number(余[0]), 变)));
  } else if (命令 === "记会话") {
    console.log(JSON.stringify(句柄.记会话(余[0] ?? "")));
  } else if (命令 === "称呼") {
    console.log(JSON.stringify(句柄.称呼, null, 2));
  } else if (命令 === "设称呼") {
    const 取 = (名) => 余.indexOf("--" + 名) >= 0 ? 余[余.indexOf("--" + 名) + 1] : undefined;
    const 外号 = 取("外号");
    console.log(JSON.stringify(句柄.设称呼({
      名字: 取("名字"), 对方: 取("对方"), 她的名字: 取("她的名字"), 代词: 取("代词"),
      外号: 外号 === undefined ? undefined : 外号.split(/[，,、]/).filter(Boolean),
      习惯: 取("习惯"),
    })));
  } else if (命令 === "接续") {
    console.log(JSON.stringify({ 当前设备: 句柄.当前设备, 当前模型: 句柄.当前模型, ...句柄.接续 }, null, 2));
  } else if (命令 === "记接续") {
    console.log(JSON.stringify(句柄.记接续()));
  } else if (命令 === "记提过") {
    console.log(JSON.stringify(句柄.记提过(Number(余[0]))));
  } else if (命令 === "推翻") {
    console.log(JSON.stringify(句柄.推翻判断({ 内容: 余[0] ?? "", 反例: 余[1] ? [Number(余[1])] : [], 因为: 余[2] ?? "" })));
  } else if (命令 === "判断") {
    console.log(JSON.stringify(句柄.判断列(), null, 2));
  } else if (命令 === "合并") {
    console.log(JSON.stringify(句柄.合并()));
  } else if (命令 === "导出") {
    const i = 余.indexOf("--md");
    console.log(JSON.stringify(句柄.导出(i >= 0 ? 余[i + 1] : "导出.md")));
  } else { console.error("未知命令: " + 命令); process.exit(2); }
  句柄.close();
}
