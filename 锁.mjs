// 改前必读：/root/全忆-V20/设计.md
// 卡带上锁：AES-256-GCM，口令从环境变量 QUANYI_KEY 取，盐存在 manifest 里
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

export function 派生钥匙(口令, 盐) {
  return scryptSync(口令, Buffer.from(盐, "base64"), 32);
}

export function 加密(明文, 钥匙) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", 钥匙, iv);
  const ct = Buffer.concat([c.update(明文), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]);
}

export function 解密(密文, 钥匙) {
  const iv = 密文.subarray(0, 12);
  const tag = 密文.subarray(12, 28);
  const ct = 密文.subarray(28);
  const d = createDecipheriv("aes-256-gcm", 钥匙, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

export function 新盐() { return randomBytes(16).toString("base64"); }
