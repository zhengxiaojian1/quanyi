// 改前必读：/root/全忆-V20/设计.md
// 主动档位：靠回应账自己升自己降，不靠人开开关
import fs from "node:fs";
import path from "node:path";

const 空 = { 档: 0, 提: 0, 接: 0, 无应: 0, 上次提: null, 待接: null };

export function 读态(根) {
  const p = path.join(根, "facts", "主动.json");
  if (!fs.existsSync(p)) return { ...空 };
  try { return { ...空, ...JSON.parse(fs.readFileSync(p, "utf8")) }; } catch { return { ...空 }; }
}

export function 写态(根, o) {
  const p = path.join(根, "facts", "主动.json");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(o, null, 2) + "\n", "utf8");
  return o;
}

// 该不该排、排多密：档 0 一周探一次，档 1+ 一天一次
export function 该排(态) {
  if (态.档 >= 1) return { 排: true, 频率: "daily", 间隔秒: 0 };
  return { 排: true, 频率: "every", 间隔秒: 7 * 86400 };
}

export function 记提(根, 现在 = new Date()) {
  let 态 = 读态(根);
  if (态.待接) 态 = 记无应(根);   // 上次那口气还没人接，又提了
  态.提 += 1;
  态.待接 = { t: new Date(现在).toISOString() };
  态.上次提 = 态.待接.t;
  return 写态(根, 态);
}

export function 记接(根, 现在 = new Date()) {
  let 态 = 读态(根);
  if (!态.待接) return 态;
  const 隔 = new Date(现在).getTime() - new Date(态.待接.t).getTime();
  if (隔 > 24 * 3600e3) { 态.待接 = null; return 写态(根, 态); }
  态.接 += 1;
  态.无应 = 0;
  态.待接 = null;
  if (态.接 % 3 === 0 && 态.档 < 2) 态.档 += 1;
  return 写态(根, 态);
}

export function 记无应(根) {
  let 态 = 读态(根);
  if (!态.待接) return 态;
  态.无应 += 1;
  态.待接 = null;
  if (态.无应 >= 3 && 态.档 > 0) { 态.档 -= 1; 态.无应 = 0; }
  return 写态(根, 态);
}
