#!/bin/sh
# 改前必读：/root/全忆-V20/设计.md
# 把整套工具链装进卡带：U 盘插到任何机器，卡带自己就能装插件
set -e
cd "$(dirname "$0")"
CART=${1:?用法: ./带上U盘.sh <卡带目录>}
TOOL="$CART/工具"
rm -rf "$TOOL"
mkdir -p "$TOOL"
cp *.mjs "$TOOL"/
cp -a adapters contract "$TOOL"/
cp -a 插件 随身版 "$TOOL"/
cp README.md 设计.md 待办.md 验收清单.md 对比.md "$TOOL"/ 2>/dev/null || true
echo "已装进卡带：$TOOL"
du -sh "$TOOL" | cut -f1
echo "到新机器上：node \"$TOOL/装进宿主.mjs\""
