#!/bin/sh
# 改前必读：/root/全忆-V20/设计.md
# 一条命令跑完：装卡 → 呼吸 → 递料 → 取原文 → 导出 → 全部测试
set -e
cd "$(dirname "$0")"
CART=/tmp/演示-卡带
rm -rf "$CART"
echo "── 1 装卡 ──"
node 造卡.mjs 样例/生活-桌宠7天.jsonl "$CART" --self 卡带样例/self.md
echo "── 2 呼吸 ──"
node 呼吸.mjs "$CART" | head -5
echo "── 3 这一轮递上去的料 ──"
node 读我.mjs "$CART" brief --问 "桌宠卡住的地方"
echo "── 4 取回原话 ──"
node 读我.mjs "$CART" frame 73 | head -6
echo "── 5 导出 ──"
node 读我.mjs "$CART" 导出 --md /tmp/演示-导出.md
echo "── 6 测试 ──"
for f in contract/跑*.mjs; do
  printf "%-14s " "$(basename "$f" .mjs)"
  node "$f" | tail -1
done
printf "%-14s " "插件"
node 插件/test/自测.mjs | tail -1
