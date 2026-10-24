#!/usr/bin/env node
/**
 * 补丁审计：只读扫描本机已安装的 DSH，报告每条补丁的命中状态。
 *
 * 用法：
 *   node scripts/audit-patches.mjs            # 表格摘要
 *   node scripts/audit-patches.mjs --detail   # 逐条列出 id / 名称 / 状态
 *   node scripts/audit-patches.mjs --json     # 机器可读
 *
 * 状态含义（来自 lib/core.js#patchStatus）：
 *   pending     = 目标原文还在，Apply 时会命中（说明这条补丁在本机可用）
 *   applied     = 目标已是「期望形态」（多为"恢复官方形态"类补丁，属正常）
 *   skipped     = 目标原文找不到 → 版本漂移，这条能力打不上
 *   unmatched   = strictFiles 补丁未命中文件
 *   missing_file= 补丁声明的宿主文件不存在
 *   na          = 本机不需要（可选包未安装 / 平台不符，如 desktop 专属）
 *
 * ⚠️ 本脚本只读：不会写文件、不会 Apply、不会重启宿主。
 */
import * as core from "../lib/core.js";

const argv = new Set(process.argv.slice(2));
const wantJson = argv.has("--json");
const wantDetail = argv.has("--detail") || wantJson;

const aiBase = core.findAiBase();
if (!aiBase) {
  console.error("[audit] 找不到已安装的 @deepseek-ai 包（可用 DSH_BASE 指定）");
  process.exit(1);
}

const status = await core.patchStatus(aiBase);
const rows = core.ALL_PATCHES.map((p) => ({
  id: p.id,
  name: p.name,
  layer: p.layer,
  desc: p.desc,
  optional: Boolean(p.optional),
  status: status[p.id] ?? "unknown",
}));

if (wantJson) {
  console.log(JSON.stringify({ aiBase, generatedAt: new Date().toISOString(), rows }, null, 2));
  process.exit(0);
}

const counts = {};
for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;

const ORDER = ["pending", "applied", "skipped", "unmatched", "missing_file", "na", "unknown"];
console.log(`[audit] aiBase = ${aiBase}`);
console.log(`[audit] patches = ${rows.length}`);
console.log("");
for (const key of ORDER) {
  if (!counts[key]) continue;
  const ids = rows.filter((r) => r.status === key).map((r) => `#${r.id}`);
  console.log(`${key.padEnd(12)} ${String(counts[key]).padStart(3)}  ${ids.join(" ")}`);
}

if (wantDetail) {
  console.log("");
  console.log("id  status        layer   name / desc");
  for (const row of rows.sort((a, b) => a.id - b.id)) {
    console.log(
      String(row.id).padStart(2),
      row.status.padEnd(13),
      String(row.layer || "-").padEnd(6),
      `${row.name}  ${row.desc}`,
    );
  }
}

// 退出码：有 skipped / missing_file 时非 0，方便 CI 或升级后快速发现漂移。
const broken = rows.filter((r) => r.status === "skipped" || r.status === "missing_file");
process.exitCode = broken.length > 0 ? 2 : 0;
