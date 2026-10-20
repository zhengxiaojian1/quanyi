# 全忆 V20

**给 AI 一副身体，和一本账。卡带装过去，会话装此刻，模型负责判断和说话。**

## 下载

- **Windows 完整版（自带 Node，双击即用）**：[quanyi-v20-windows.tar.gz](https://github.com/zhengxiaojian1/quanyi/releases/download/v20/quanyi-v20-windows.tar.gz)
- 网盘备用：[夸克网盘](https://pan.quark.cn/s/e2de1dd64e8f?pwd=nXXv)（提取码 nXXv）
- 源码：本仓库


一句话：**让 AI 记得你说过的原话，并且能带走。**

```
卡带   记忆（原文、日记、账）      可带走 · 可上锁 · 不上云
插件   插头（递料、工具、会话）     装进宿主，不依赖模型
模型   身体                       换模型不换人
```

三条铁律：**原文是唯一真相 · 从不全量加载 · 料由机器递。**

---

## 它是什么

**给 AI 加一副记性。** 卡带装过去，会话装此刻，模型负责说话。

它不依赖模型读文件：读卡带、挑记忆、拼提示，都是本地程序干的；模型只收到一段文本。
**能做到什么、做不到什么、最容易搞错的期待** → [docs/说明书.md](docs/说明书.md)

## 五分钟开始

---

## 快速开始（五分钟）

需要 **Node ≥ 18**，零依赖，不联网也能跑。

```bash
tar xzf 全忆-V20-*.tar.gz
cd 全忆-V20-*

# 一条命令看全套：装卡 → 呼吸 → 递料 → 取原文 → 导出 → 跑测试
./演示.sh
```

## 两种用法

### A. 有 DSH：装插件（能接管会话，装完自动补历史）

```bash
cd ~/.dsh/profiles/<你的 profile>
pnpm add link:<这个目录>/插件
# 在 package.json 的 dsh.profile.bundles 里加 "dsh-memory-v20"
# 卡带路径写进 插件/cordis.patch.yml，或设 QUANYI_CARD
# 重启宿主
```

⚠️ 会重启宿主，**别装在正在跑的那个 profile 上**。

### B. 没有 DSH：随身版（解压双击）

```bash
# 1) 把 API key 粘进 钥匙.txt（一行）
# 2) 启动
随身版/启动.bat          # Windows
node 随身版/服务.mjs      # macOS / Linux
# 3) 打开 http://127.0.0.1:8787
```

没有历史？粘一段对话就能建卡带：

```bash
node 粘贴导入.mjs 对话.txt 对话.jsonl
node 造卡.mjs 对话.jsonl 卡带/我的
```

---

## 上下文与 Token 用量

**每轮注入 ≤ 600 token**，跟会话跑了多久无关。

```
每轮注入   ≤ 600 token   （self 一页 + 相关日记 3 条 + 没清的账）
self.md    ≤ 400 token
每天沉淀   ≤ 1000 token
启动 <100ms · 常驻 <80MB · 单帧 <20ms · 检索 <1s · 三年 ≤ 25GB
```

对比：把历史全塞进去，10 万 token 的会话就是 10 万 token 的账单，越用越贵。
全忆的成本不随记忆变大而上涨。详见 [docs/上下文与用量.md](docs/上下文与用量.md)。

## 主要文件

| 文件 | 干什么 |
|---|---|
| `造卡.mjs` | JSONL → 卡带（流式，按小时分片，布隆 + 偏移索引 + 哈希链） |
| `读我.mjs` | 卡带读接口：brief / 取原文 / 压制 / 上锁 |
| `driver.mjs` | 只读驱动：把卡带接进一个 agent 循环（每轮递料 + 两个工具） |
| `呼吸.mjs` | 写日记、抽承诺、抽判断、出压缩计划 |
| `检索` | 分桶 posting list，中文大卡带 0.15–0.3 秒 |
| `主动.mjs` | 到点 / 到期 / 久账 三种触发 |
| `读取器.mjs` | 通用会话读取器（DSH / Markdown / JSON / JSONL / ChatGPT 导出） |
| `粘贴导入.mjs` | 粘一段对话 → 帧（没导出功能的人用这个） |
| `上锁.mjs` | 卡带加密（AES-256-GCM，口令走 `QUANYI_KEY`） |
| `快照.mjs` `救急.mjs` `自检.mjs` | 备份 / 抢救 / 自测 |

## 文档

- [说明书](docs/说明书.md) ★ 先看这个
- [上手](docs/上手.md) · [版本说明](docs/版本说明.md) · [上下文与用量](docs/上下文与用量.md)
- [设计](docs/设计.md) · [交接](docs/交接.md) · [待办](docs/待办.md) · [改动账](docs/改动账.md)

## 已知问题

见 [docs/说明书.md](docs/说明书.md)。

## 许可

MIT，见 [LICENSE](LICENSE)。

作者：默风
