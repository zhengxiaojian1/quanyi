#!/bin/sh
# 改前必读：/root/全忆-V20/设计.md
# 干净交付包：文档 + 所有 mjs + 测试 + 小样例 + 插件 + 清单
set -e
cd "$(dirname "$0")"
TS=$(date +%Y%m%d-%H%M)
NAME="全忆-V20-交付-$TS"
TMP=$(mktemp -d)
DST="$TMP/$NAME"
mkdir -p "$DST"
cp *.md *.sh *.mjs "$DST"/
cp -a adapters contract 插件 随身版 "$DST"/
rm -rf "$DST"/随身版/node
mkdir -p "$DST/卡带" "$DST/样例" "$DST/卡带样例"
cp 卡带/schema.md "$DST/卡带/"
cp 样例/生活-桌宠7天.jsonl 样例/造-工程样本.mjs 样例/说明.md "$DST/样例/"
cp 样例/模型日记示例*.md "$DST/样例/" 2>/dev/null || true
cp 卡带样例/self.md "$DST/卡带样例/"
cp -a 卡带样例/桌宠 "$DST/卡带样例/"
: > "$DST/卡带样例/桌宠/facts/提过.jsonl" 2>/dev/null || true
: > "$DST/卡带样例/桌宠/facts/重.jsonl" 2>/dev/null || true
: > "$DST/卡带样例/桌宠/对话.jsonl" 2>/dev/null || true
: > "$DST/卡带样例/桌宠/facts/承诺.jsonl" 2>/dev/null || true
rm -f "$DST/卡带样例/桌宠/facts/压制.jsonl"
( cd "$DST" && find . -type f ! -name 清单.sha256 | sort | xargs sha256sum > 清单.sha256 )
PKG="/root/$NAME.tar.gz"
tar -czf "$PKG" -C "$TMP" "$NAME"
rm -rf "$TMP"
echo "包：$PKG"
echo "大小：$(du -h "$PKG" | cut -f1)"
echo "sha256：$(sha256sum "$PKG" | cut -d' ' -f1)"
