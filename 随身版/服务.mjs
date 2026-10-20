// 改前必读：/root/全忆-V20/设计.md
// 随身版：插上手机/卡带，双击就有一个能记得你的聊天窗口（不需要装宿主）
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const 此处 = path.dirname(fileURLToPath(import.meta.url));
const 工具 = path.resolve(此处, "..");
const 卡带 = path.resolve(工具, "..");

const { mount } = await import(path.join(工具, "读我.mjs"));
const h = mount(卡带);

const 名 = process.env.QUANYI_ADAPTER === "openai" ? "openai.mjs" : "deepseek.mjs";
const 插头 = process.env.QUANYI_FAKE
  ? { 有钥匙: () => true, 说: async () => ({ text: "（测试）我记得那件事。" }) }
  : await import(path.join(工具, "adapters", 名));
// 钥匙.txt 找几个地方（用户放哪都能用）
const 钥匙候选 = [
  path.join(卡带, "钥匙.txt"),
  path.join(工具, "钥匙.txt"),
  path.join(此处, "钥匙.txt"),
];
if (!process.env.DEEPSEEK_KEY_FILE) {
  for (const p of 钥匙候选) if (fs.existsSync(p)) { process.env.DEEPSEEK_KEY_FILE = p; break; }
}

const 页 = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>她</title>
<style>
body{font-family:system-ui;margin:0;background:#faf8f5;color:#222}
#log{max-width:720px;margin:0 auto;padding:16px 16px 120px}
.m{margin:10px 0;padding:10px 14px;border-radius:14px;white-space:pre-wrap;line-height:1.6}
.me{background:#dfe9ff;margin-left:20%}
.her{background:#fff;border:1px solid #eee;margin-right:20%}
#bar{position:fixed;bottom:0;left:0;right:0;background:#faf8f5;border-top:1px solid #eee;padding:10px}
#bar div{max-width:720px;margin:0 auto;display:flex;gap:8px}
textarea{flex:1;height:52px;border:1px solid #ddd;border-radius:12px;padding:8px;font:inherit;resize:none}
button{width:72px;border:0;border-radius:12px;background:#222;color:#fff;font:inherit}
</style>
<div id="log"></div><div id="bar"><div><textarea id="q" placeholder="说话…"></textarea><button id="go">说</button></div></div>
<script>
const log=document.getElementById('log'),q=document.getElementById('q'),go=document.getElementById('go');
const 史=[];
function 加(谁,文){const d=document.createElement('div');d.className='m '+(谁==='user'?'me':'her');d.textContent=文;log.appendChild(d);log.scrollTop=1e9;}
go.onclick=async()=>{const 文=q.value.trim();if(!文)return;q.value='';加('user',文);
  const r=await fetch('/聊',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({问:文,历史:史})}).then(x=>x.json()).catch(e=>({text:'连不上：'+e.message}));
  加('her',r.text||r.error||'（没说话）');史.push({role:'user',content:文},{role:'assistant',content:r.text||''});};
q.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey))go.click()});
</script>`;

const 服 = http.createServer(async (req, res) => {
  let 路 = req.url;
  try { 路 = decodeURIComponent(req.url); } catch { /* 保留原样 */ }
  if (req.method === "GET" && (路 === "/" || 路.startsWith("/?"))) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(页);
  }
  if (req.method === "POST" && 路 === "/聊") {
    let 体 = "";
    for await (const 块 of req) 体 += 块;
    let 参 = {};
    try { 参 = JSON.parse(体); } catch { /* 空体 */ }
    const 问 = String(参.问 ?? "").slice(0, 2000);
    const 史 = Array.isArray(参.历史) ? 参.历史.slice(-20) : [];
    try {
      if (!插头.有钥匙()) throw new Error("卡带里没有 钥匙.txt，也没有 DEEPSEEK_API_KEY");
      const b = h.brief({ 问 });
      const 系统 = [h.self ?? "", "\\n\\n（下面是你记得的事，别装作不知道）\\n", b.text].join("");
      const r = await 插头.说({ 系统, 消息: [...史, { role: "user", content: 问 }], 温度: 0.7, 最大: 800, 思考: false });
      h.记对话({ who: "user", text: 问 }); h.记对话({ who: "her", text: r.text ?? "" });
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ text: r.text, token估: b.token估 }));
    } catch (e) {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: String(e?.message ?? e) }));
    }
  }
  res.writeHead(404); res.end("没有");
});

const 端口 = Number(process.env.QUANYI_PORT ?? 8787);
服.listen(端口, "127.0.0.1", () => {
  console.log("她在这： http://127.0.0.1:" + 端口);
  console.log("卡带：" + 卡带);
  console.log("有钥匙：" + (插头.有钥匙() ? "是" : "否（放一个 钥匙.txt 到卡带根目录）"));
});
