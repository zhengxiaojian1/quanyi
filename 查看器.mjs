// 改前必读：/root/全忆-V20/设计.md
// 卡带查看器：多卡带、可切换；看日记、搜原话、翻账（零依赖）
// 用法：node 查看器.mjs [卡带] [--端口 8788] [--主机 0.0.0.0]
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { mount } from "./读我.mjs";

const [首个, ...余] = process.argv.slice(2);
const 取 = (k, d) => { const i = 余.indexOf(k); return i >= 0 ? 余[i + 1] : d; };
const 端口 = Number(取("--端口", 8788));
const 主机 = 取("--主机", "127.0.0.1");

function 找卡() {
  const 根们 = ["/sdcard/Download/卡带", "/sdcard/卡带", path.dirname(path.resolve("."))];
  const 出 = [];
  const 看 = (p, 层 = 0) => {
    if (层 > 2) return;
    let 列;
    try { 列 = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
    for (const e of 列) {
      if (!e.isDirectory() || e.name.startsWith(".")) continue;
      const q = path.join(p, e.name);
      const mf = path.join(q, "manifest.json");
      if (fs.existsSync(mf)) {
        try { const m = JSON.parse(fs.readFileSync(mf, "utf8")); if (m.格式 === "全忆卡带") 出.push({ 路: q, 名: e.name, 帧: m.帧数, 末: m.末 }); } catch { /* 不是卡带 */ }
        continue;
      }
      看(q, 层 + 1);
    }
  };
  for (const r of 根们) 看(r);
  return [...new Map(出.map((x) => [x.路, x])).values()];
}

const 卡们 = 找卡();
if (!卡们.length && !首个) { console.error("没找到卡带；用法：node 查看器.mjs <卡带>"); process.exit(2); }

let 当前 = 首个 && fs.existsSync(path.join(首个, "manifest.json")) ? path.resolve(首个) : 卡们[0]?.路;
if (!当前) { console.error("卡带打不开：" + 首个); process.exit(2); }
let h = mount(当前);
let 日们 = [], 账 = [], 判 = [], 天们 = [];
function 重载() {
  h = mount(当前);
  天们 = [...new Set((h.manifest.片 ?? []).map((p) => p.天))].sort();
  日们 = [...new Map(h.日记列().filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.天)).map((d) => [d.天, d])).values()];
  账 = h.未清账();
  判 = h.判断列();
}
重载();

const 样式 = `
:root{--bg:#f4f1ea;--card:#fffdf9;--ink:#1f1c18;--dim:#8b8377;--line:#e6dfd2;--acc:#2f6f4f;--hi:#ffe9a8}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 system-ui,-apple-system,"PingFang SC","Noto Sans CJK SC",sans-serif}
header{position:sticky;top:0;z-index:9;background:rgba(244,241,234,.94);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.wrap{max-width:860px;margin:0 auto;padding:0 18px}
.bar{display:flex;align-items:center;gap:14px;padding:11px 0;flex-wrap:wrap}
.bar b{font-size:18px;letter-spacing:.06em}
.bar nav{display:flex;gap:14px;font-size:14px;margin-left:auto}
.bar a{color:var(--dim);text-decoration:none;padding:2px 0}
.bar a.on{color:var(--ink);font-weight:600;border-bottom:2px solid var(--acc)}
main{max-width:860px;margin:0 auto;padding:18px 18px 90px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:2px 0 18px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px}
.stat b{display:block;font-size:22px;font-weight:600}
.stat span{font-size:12px;color:var(--dim)}
form{display:flex;gap:8px;margin:0 0 18px}
input,select{flex:1;padding:12px 14px;border:1px solid var(--line);border-radius:12px;font:inherit;background:var(--card);color:var(--ink)}
button{padding:0 20px;border:0;border-radius:12px;background:var(--acc);color:#fff;font:inherit}
h2{font-size:13px;color:var(--dim);font-weight:600;letter-spacing:.12em;margin:24px 0 8px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin:9px 0}
.card a{color:var(--ink);text-decoration:none}
.meta{font-size:12px;color:var(--dim);font-family:ui-monospace,Menlo,monospace}
.q{font-size:16px}
.hit{background:var(--hi);border-radius:4px;padding:0 2px}
pre{white-space:pre-wrap;word-break:break-word;margin:0;font:15px/1.85 "Songti SC","Noto Serif CJK SC",serif}
.empty{color:var(--dim);padding:18px 0}
.pill{display:inline-block;font-size:12px;color:var(--acc);border:1px solid var(--acc);border-radius:999px;padding:0 8px;margin-right:6px}
.switch{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--dim)}
footer{color:var(--dim);font-size:12px;text-align:center;padding:28px 0}
`;

const 壳 = (标, 体, 当前页 = "") => `<!doctype html><html lang="zh"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${标} · 她</title><style>${样式}</style>
<header><div class="wrap bar"><b>她</b>
<nav><a href="/" class="${当前页 === "首页" ? "on" : ""}">首页</a><a href="/记" class="${当前页 === "日记" ? "on" : ""}">日记</a><a href="/账" class="${当前页 === "账" ? "on" : ""}">账</a><a href="/卡" class="${当前页 === "卡带" ? "on" : ""}">卡带</a></nav></div>
<div class="wrap" style="padding-bottom:10px"><form action="/换" method="get" class="switch">
<select name="卡">${卡们.map((c) => `<option value="${c.路}" ${c.路 === 当前 ? "selected" : ""}>${c.名}（${c.帧} 帧）</option>`).join("")}</select>
<button>换卡带</button></form></div></header>
<main>${体}</main><footer>${path.basename(当前)} · ${天们.length} 天 · ${h.manifest.帧数} 帧</footer></html>`;

const 高亮 = (s, q) => {
  let 出 = String(s).replace(/</g, "&lt;");
  if (!q) return 出;
  for (const 词 of [...new Set(String(q).replace(/\s+/g, "").match(/.{2}/g) ?? [])].slice(0, 8)) 出 = 出.split(词).join('<span class="hit">' + 词 + "</span>");
  return 出;
};

const 发 = (res, s) => { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(s); };

const 服 = http.createServer((req, res) => {
  let 径 = "/", 查 = "";
  try { const u = new URL(decodeURIComponent(req.url), "http://x"); 径 = decodeURIComponent(u.pathname); 查 = u.search; } catch { /* 原样 */ }

  if (径 === "/换") {
    const 要 = new URL(decodeURIComponent(req.url), "http://x").searchParams.get("卡");
    if (要 && fs.existsSync(path.join(要, "manifest.json"))) { try { h.close(); } catch { /* 忽略 */ } 当前 = path.resolve(要); 重载(); }
    res.writeHead(302, { location: "/" }); return res.end();
  }

  if (径 === "/卡") {
    let 体 = `<h2>卡带（${卡们.length}）</h2>`;
    for (const c of 卡们) 体 += `<div class="card"><a href="/换?卡=${encodeURIComponent(c.路)}"><b>${c.名}</b></a><div class="meta">${c.帧} 帧 · 末 ${String(c.末).slice(0, 10)} · ${c.路}</div></div>`;
    return 发(res, 壳("卡带", 体, "卡带"));
  }

  if (径 === "/") {
    const 近 = 日们.slice(-6).reverse();
    let 体 = `<div class="stats"><div class="stat"><b>${h.manifest.帧数}</b><span>帧</span></div><div class="stat"><b>${天们.length}</b><span>天</span></div><div class="stat"><b>${日们.length}</b><span>日记</span></div><div class="stat"><b>${账.length}</b><span>未清的账</span></div></div>
<form action="/搜"><input name="q" placeholder="搜一句你记得的话…"><button>搜</button></form>`;
    体 += `<h2>最近的日记</h2>`;
    for (const d of 近) 体 += `<div class="card"><a href="/读/${d.天}"><b>${d.天}</b></a><div>${String(d.文).split("\n").filter((l) => l && !l.startsWith("#") && !l.startsWith("↩")).slice(0, 2).join(" ").slice(0, 95)}</div></div>`;
    if (!日们.length) 体 += `<div class="empty">还没有日记。跑一次 <code>node 呼吸.mjs 卡带</code> 就有了。</div>`;
    if (账.length) { 体 += `<h2>未清的账</h2>`; for (const c of 账.slice(0, 6)) 体 += `<div class="card">${String(c.内容).slice(0, 120)}<div class="meta">${c.到期 ? "到期 " + String(c.到期).slice(0, 10) : c.触发?.条件 ? "等：" + c.触发.条件.join("/") : ""}</div></div>`; }
    if (判.length) { 体 += `<h2>判断（最近）</h2>`; for (const c of 判.slice(0, 4)) 体 += `<div class="card"><span class="pill">${c.态 ?? "判断"}</span>${String(c.内容).slice(0, 110)}</div>`; }
    return 发(res, 壳("首页", 体, "首页"));
  }

  if (径 === "/搜") {
    const q = new URL(decodeURIComponent(req.url), "http://x").searchParams.get("q") ?? "";
    const 果 = q ? h.recall(q, 10) : [];
    let 体 = `<form action="/搜"><input name="q" value="${q.replace(/"/g, "&quot;")}" placeholder="搜一句你记得的话…"><button>搜</button></form>`;
    if (!q) 体 += `<div class="empty">输入一句你记得的话。她会按词、别名和短语去找。</div>`;
    else if (!果.length) 体 += `<div class="empty">没找到。换几个词，或者加一句上下文。</div>`;
    else { 体 += `<h2>${果.length} 条</h2>`; for (const x of 果) 体 += `<div class="card"><div class="meta">[${x.seq}] ${String(x.t).slice(0, 16)} · ${x.who === "user" ? "他" : "她"}</div><div class="q">${高亮(x.摘录, q)}</div><div><a href="/帧/${x.seq}">看原文 →</a></div></div>`; }
    return 发(res, 壳("搜：" + q, 体));
  }

  if (径.startsWith("/帧/")) {
    const seq = Number(径.slice(3));
    const f = h.frame(seq);
    if (!f.ok) return 发(res, 壳("读不动", `<div class="card">${f.why ?? "没有这一帧"}</div>`));
    const 前 = h.frame(seq - 1), 后 = h.frame(seq + 1);
    const 体 = `<div class="card"><div class="meta">${String(f.t).slice(0, 19)} · ${f.who === "user" ? "他" : "她"} · seq ${f.seq}</div>
<div class="meta">sha256 ${String(f.sha).slice(0, 24)}… · ${f.校验 ? "✅ 对得上" : "❌ 对不上"}</div><pre style="margin-top:10px">${String(f.text).replace(/</g, "&lt;")}</pre></div>
<div class="card meta" style="display:flex;justify-content:space-between">${前.ok ? `<a href="/帧/${seq - 1}">← [${seq - 1}]</a>` : "<span></span>"}${后.ok ? `<a href="/帧/${seq + 1}">[${seq + 1}] →</a>` : "<span></span>"}</div>`;
    return 发(res, 壳("[" + seq + "]", 体));
  }

  if (径 === "/记") {
    let 体 = `<h2>日记（${日们.length} 篇）</h2>`;
    for (const d of [...日们].reverse()) 体 += `<div class="card"><a href="/读/${d.天}"><b>${d.天}</b></a><div>${String(d.文).split("\n").filter((l) => l && !l.startsWith("#")).slice(0, 2).join(" ").slice(0, 105)}</div></div>`;
    return 发(res, 壳("日记", 体, "日记"));
  }

  if (径.startsWith("/读/")) {
    const 天 = 径.slice(3);
    const d = 日们.find((x) => x.天 === 天) ?? h.日记列().find((x) => x.天 === 天);
    if (!d) return 发(res, 壳("没有", `<div class="card">这一天没有日记。</div>`));
    return 发(res, 壳(天, `<div class="card"><pre>${String(d.文).replace(/</g, "&lt;")}</pre></div>`));
  }

  if (径 === "/账") {
    let 体 = `<h2>未清的账（${账.length}）</h2>`;
    for (const c of 账) 体 += `<div class="card">${String(c.内容).slice(0, 170)}<div class="meta">${c.到期 ? "到期 " + String(c.到期).slice(0, 10) : ""} ${c.触发?.条件 ? "等：" + c.触发.条件.join("/") : ""}</div></div>`;
    体 += `<h2>判断（${判.length}）</h2>`;
    for (const c of 判.slice(0, 80)) 体 += `<div class="card"><span class="pill">${c.态 ?? "判断"}</span>${String(c.内容).slice(0, 150)}</div>`;
    return 发(res, 壳("账", 体, "账"));
  }

  res.writeHead(404); res.end("没有");
});

服.listen(端口, 主机, () => {
  console.log("卡带查看器： http://" + 主机 + ":" + 端口);
  for (const c of 卡们) console.log("  卡带：" + c.名 + "（" + c.帧 + " 帧）");
  if (主机 === "0.0.0.0") for (const [名, 列] of Object.entries(os.networkInterfaces())) for (const x of 列 ?? []) {
    if (x.family === "IPv4" && !x.internal) console.log("  http://" + x.address + ":" + 端口 + "   （" + 名 + "）");
  }
});
