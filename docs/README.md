# 全忆 V20

> 给大模型一副身体，和一本账。卡带装过去，会话装此刻，模型负责判断和说话。

零依赖，只用 Node ≥ 18。不联网也能跑。

## 五分钟上手

```bash
cd /root/全忆-V20
./演示.sh
```

它会：装卡 → 呼吸（写日记/抽承诺/出压缩计划）→ 生成这一轮的料 → 取回原话 → 导出 → 跑三套测试。

## 四个文件

| 文件 | 干什么 |
|---|---|
| `造卡.mjs` | JSONL → 卡带（流式，按小时分片，布隆 + 偏移索引 + 哈希链） |
| `日记写手.mjs` | 纯函数：规则版日记、抽承诺、抽判断、指针校验 |
| `driver.mjs` | 只读驱动：把卡带接进一个 agent 循环（每轮递料 + 两个工具） |
| `找卡.mjs` | 在 /sdcard /media /mnt /Volumes 里自动找卡带（U 盘场景） |
| `导入卡带.mjs` | 把卡带里的 `导入.jsonl` 一步建成卡带（造卡 + 呼吸） |
| `从宿主导入.mjs` | 直接读宿主会话日志（多帧 zstd）整份导进卡带 |
| `读取器.mjs` | 通用会话读取器：DSH / Markdown / JSON / JSONL / ChatGPT 导出 |
| `整形.mjs` | 请求侧压缩：超预算时把太老的换成「她记得」，不依赖宿主压缩 |
| `改写.mjs` | 词法没命中时，让模型把问题改成三个检索词 |
| 压制（`读我.mjs 压制`） | 他说过不想提的事：brief 里绝不再出现，原文仍可取 |
| `上锁.mjs` | 给卡带上锁（AES-256-GCM，口令走 QUANYI_KEY） |
| `多卡.mjs` | 同时挂几张卡带，按域检索（一盘是一段人生） |
| `称呼.json` | 用户指定的称呼：名字 / 代词 / 外号 / 习惯；进 brief 和日记提示词 |
| `重建索引.mjs` | 删了 index/ 也能从 raw 一片一片重建 |
| `呼吸.mjs` | 每天沉淀一次：日记、月记、承诺、判断、压缩计划 |
| `读我.mjs` | 挂载卡带：recall / frame / brief / note / 合并 / 导出 |
| `adapters/deepseek.mjs` | 插头 A：Anthropic 兼容（DeepSeek `/anthropic`） |
| `adapters/openai.mjs` | 插头 B：OpenAI 兼容 `/v1/chat/completions`（Qwen / Moonshot / GLM / vLLM / Ollama 都走这个） |

## 常用命令

```bash
node 造卡.mjs 样例/生活-桌宠7天.jsonl 卡带样例/桌宠 --self 卡带样例/self.md
node 呼吸.mjs 卡带样例/桌宠
node 读我.mjs 卡带样例/桌宠 brief --问 "桌宠卡住的地方"
node 读我.mjs 卡带样例/桌宠 frame 73
node 读我.mjs 卡带样例/桌宠 导出 --md /tmp/她.md
node 读我.mjs 卡带样例/桌宠 称呼                 # 看现在怎么称呼
node 读我.mjs 卡带样例/桌宠 设称呼 --名字 阿岚 --代词 她 --外号 "小岚,阿岚岚" --习惯 "少叫名字，直接说事"
node 读我.mjs 卡带样例/桌宠 记提过 73          # 冷却账
node 读我.mjs 卡带样例/桌宠 判断               # 判断列（最新态）
node 读我.mjs 卡带样例/桌宠 推翻 "我记着。" 46  # 推翻一条，留反例
```

## 接进会话（驱动）

```bash
node driver.mjs 卡带样例/桌宠          # 假循环，看每轮递上去什么
```

## 装进宿主

```bash
# 见 插件/README.md；只读，每轮递料
cd ~/.dsh/profiles/<测试 profile>
pnpm add link:/root/全忆-V20/插件
```

## 交付

```bash
./打包.sh        # 打出干净交付包（44–68 KB），带 清单.sha256
```

拿到包的人先读 `验收清单.md`：十分钟，每步都有「应该看到什么」。

## 测试

```bash
node contract/跑契约.mjs    # c1–c5，任何插头必过
node contract/跑日记.mjs    # 日记有指针、断档、改述桥
node contract/跑场景.mjs    # 26 个场景
node contract/跑插头.mjs    # 插头形状（不联网）
node contract/跑采样.mjs    # 截断时按时间采样
node contract/跑插头-回环.mjs # 假服务器把插头跑通（发出去 + 收回来）
node contract/跑写手规则.mjs  # 日记写手的纯函数
node contract/跑上锁.mjs      # 卡带加密（没钥匙打不开）
node contract/跑多卡.mjs      # 多盘同时挂，按域检索
node contract/跑重建.mjs      # 删掉 index/ 也能从 raw 重建
node contract/跑接续.mjs      # 换设备 / 换模型时照实说一次
node contract/跑插头-openai.mjs # 通用插头（OpenAI 兼容）回环
node contract/跑驱动.mjs     # 驱动：递料 / 预算 / 工具 / 冷却
node contract/跑找卡.mjs     # U 盘里自动找到卡带
node contract/跑导入.mjs     # 导入.jsonl → 卡带 + 日记
node contract/跑宿主导入.mjs # 宿主日志整份导进卡带
node contract/跑读取器.mjs   # 一个入口吃五种格式
node contract/跑整形.mjs     # 宿主没压缩也能收住上下文
node contract/跑重.mjs       # 重：显著/情感/取次/衰减
node contract/跑边.mjs       # 边：人/约定/帧与帧，检索一跳
node contract/跑路由.mjs     # 事实路由：问约定就直接端出处
node contract/跑改写.mjs     # 语义改写（假说函数，不联网）
node contract/量一量.mjs 卡带样例/工程
```

## 先读哪份

1. `设计.md` —— 唯一规格，改代码前必读
2. `REPORT.md` —— 当前进度、实测数字、已知问题
3. `卡带/schema.md` —— 卡带格式
4. `改动账.md` —— 改了什么、为什么

## 纪律

一处一改 · 先读设计 · 记入改动账 · 先写牙再写肉 · 跳 ≠ 绿 · 读不动 ≠ 没有
