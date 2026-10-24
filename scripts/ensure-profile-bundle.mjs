#!/usr/bin/env node
/**
 * 装进 DSH profile 时补两笔（#154）：
 *   1. dsh.profile.bundles
 *   2. 用户层 cordis.patch.yml 的本体 insert
 * pnpm add / dsh plugin add 都不会自己写 insert；市场会写，已有则跳过。
 * 在插件仓库里跑 pnpm install 则整段跳过。
 *
 * 2026-10-25 项目由 dsh-purge 改名 dsh-stan：写新 id，顺手把旧 id 的残留清掉。
 * 不清旧 id 会出两个问题——bundles 列表里同一个插件出现两次、旧 insert 条目
 * 指向已不存在的包导致宿主起不来。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const NAME = "dsh-stan";
/** 改名前的包名，只用于清理残留。 */
const LEGACY_NAMES = ["dsh-purge"];

const INSERT_BLOCK = [
  "- insert:",
  `    - id: ${NAME}`,
  `      name: ${NAME}`,
  "",
].join("\n");

function readJson(fp) {
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch {
    return null;
  }
}

function isProfilePkg(pkg) {
  if (!pkg || typeof pkg !== "object") return false;
  if (typeof pkg.name === "string" && pkg.name.startsWith("dsh-profile-")) return true;
  return Array.isArray(pkg.dsh?.profile?.bundles);
}

function findProfileDir() {
  const seeds = [process.env.INIT_CWD, process.env.npm_config_local_prefix, process.cwd()].filter(Boolean);
  for (const seed of seeds) {
    let dir = path.resolve(seed);
    for (let i = 0; i < 8; i += 1) {
      if (isProfilePkg(readJson(path.join(dir, "package.json")))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return "";
}

export function profileHasPurgeBodyInsert(text, id = NAME) {
  const lines = String(text || "").split(/\r?\n/);
  let insertIndent = -1;
  const want = new RegExp(`^-\\s*id:\\s*${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
  for (const line of lines) {
    if (/^-\s*insert:\s*$/.test(line) || /^\s+-\s*insert:\s*$/.test(line)) {
      insertIndent = (line.match(/^[ \t]*/) || [""])[0].length;
      continue;
    }
    if (insertIndent < 0) continue;
    const indent = (line.match(/^[ \t]*/) || [""])[0].length;
    const trimmed = line.trim();
    if (trimmed && indent <= insertIndent && /^-\s/.test(trimmed)) {
      insertIndent = -1;
      if (/^-\s*insert:\s*$/.test(trimmed)) {
        insertIndent = indent;
      }
      continue;
    }
    if (want.test(trimmed)) return true;
  }
  return false;
}

/**
 * 删掉旧包名的 `- insert:` 块（整块，含 id/name 两行及其后续同级键）。
 * 只删「本插件自己那一条」，其它插件块原样保留。
 */
export function stripLegacyInserts(text) {
  const src = String(text || "");
  if (!src) return { text: src, removed: 0 };
  const lines = src.split(/\r?\n/);
  const out = [];
  let removed = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const isInsert = /^([ \t]*)-[ \t]*insert:[ \t]*$/.test(line);
    if (!isInsert) {
      out.push(line);
      i += 1;
      continue;
    }
    // 收集这一块：从 insert: 起，到下一个同级或更浅的 `- ` 项为止。
    const baseIndent = (line.match(/^[ \t]*/) || [""])[0].length;
    const block = [line];
    let j = i + 1;
    while (j < lines.length) {
      const l = lines[j];
      const indent = (l.match(/^[ \t]*/) || [""])[0].length;
      const trimmed = l.trim();
      if (trimmed && indent <= baseIndent && /^-/.test(trimmed)) break;
      block.push(l);
      j += 1;
    }
    const isLegacy = LEGACY_NAMES.some((legacy) => {
      // 块内的写法是 `- id: dsh-purge`，前导短横必须一起匹配。
      const re = new RegExp(`^(?:-\\s*)?id:\\s*${legacy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
      return block.some((b) => re.test(b.trim()));
    });
    if (isLegacy) {
      removed += 1;
      // 顺带吃掉块尾的空白行，避免留下连续空行
      while (j < lines.length && !lines[j].trim()) j += 1;
    } else {
      out.push(...block);
    }
    i = j;
  }
  return { text: out.join("\n"), removed };
}

function ensureProfileInsert(profileDir) {
  const fp = path.join(profileDir, "cordis.patch.yml");
  let text = "";
  try { text = fs.readFileSync(fp, "utf8"); } catch { text = ""; }

  // 先清旧包名的 insert 块，否则同一插件在 patch 里入队两次。
  const cleaned = stripLegacyInserts(text);
  if (cleaned.removed > 0) {
    text = cleaned.text;
    fs.writeFileSync(fp, text, "utf8");
    process.stdout.write(`${NAME}: removed ${cleaned.removed} legacy insert block(s) in ${fp}\n`);
  }

  if (profileHasPurgeBodyInsert(text, NAME)) {
    process.stdout.write(`${NAME}: insert already in ${fp}\n`);
    return false;
  }
  // 新 profile 的 patch 文件模板是「注释 + 独立一行 `[]`」的空文档。
  // 直接追加 `- insert:` 会变成「流式空序列后再接块序列」，YAML 解析报
  // "end of the stream or a document separator is expected"，宿主起不来。
  // 先去掉独立的 `[]` 行（保留注释），再追加 insert 块。
  if (/^[ \t]*\[\][ \t]*$/m.test(text)) {
    text = text.replace(/^[ \t]*\[\][ \t]*\r?\n?/m, "");
  }
  const prefix = text && !text.endsWith("\n") ? "\n" : "";
  fs.writeFileSync(fp, `${text}${prefix}${text ? "\n" : ""}${INSERT_BLOCK}`, "utf8");
  process.stdout.write(`${NAME}: wrote body insert (${fp})\n`);
  return true;
}

/** 把 bundles / plugins 里的旧包名替换成新包名，只留一条。 */
export function migrateBundleList(list) {
  if (!Array.isArray(list)) return { list, changed: false };
  const kept = [];
  let sawLegacy = false;
  let sawNew = false;
  let deduped = false;
  for (const item of list) {
    const value = typeof item === "string" ? item : item && (item.id || item.name);
    if (LEGACY_NAMES.includes(value)) { sawLegacy = true; continue; }
    if (value === NAME) {
      if (sawNew) { deduped = true; continue; }
      sawNew = true;
    }
    kept.push(item);
  }
  const needsAppend = sawLegacy && !sawNew;
  return { list: needsAppend ? [...kept, NAME] : kept, changed: sawLegacy || deduped };
}

function main() {
  const profileDir = findProfileDir();
  if (!profileDir) return;

  const fp = path.join(profileDir, "package.json");
  const pkg = readJson(fp);
  if (!pkg) {
    process.stderr.write(`${NAME}: cannot read ${fp}\n`);
    process.exit(1);
  }
  pkg.dsh = pkg.dsh && typeof pkg.dsh === "object" ? pkg.dsh : {};
  pkg.dsh.profile = pkg.dsh.profile && typeof pkg.dsh.profile === "object" ? pkg.dsh.profile : {};

  let changed = false;
  for (const key of ["bundles", "plugins"]) {
    const cur = pkg.dsh.profile[key];
    if (!Array.isArray(cur)) continue;
    const next = migrateBundleList(cur);
    if (next.changed) {
      pkg.dsh.profile[key] = next.list;
      changed = true;
    }
  }

  const bundles = Array.isArray(pkg.dsh.profile.bundles) ? pkg.dsh.profile.bundles : [];
  if (!bundles.includes(NAME)) {
    pkg.dsh.profile.bundles = [...bundles, NAME];
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(fp, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
    process.stdout.write(`${NAME}: updated bundles (${profileDir})\n`);
  } else {
    process.stdout.write(`${NAME}: already in bundles (${profileDir})\n`);
  }

  try {
    ensureProfileInsert(profileDir);
  } catch (e) {
    process.stderr.write(`${NAME}: insert failed: ${e && e.message ? e.message : e}\n`);
    process.exit(1);
  }
}

/**
 * 入口判定必须比 realpath。node_modules/dsh-stan 是符号链接（pnpm link / workspace link /
 * 本地 `pnpm add <path>` 都会这样），此时 argv[1] 保持软链路径，而 import.meta.url 已被
 * Node 解析成真实路径，直接比较永远不相等 —— postinstall 会静默什么都不做。
 */
function isEntrypoint() {
  const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
  if (!invoked) return false;
  const self = fileURLToPath(import.meta.url);
  if (invoked === self) return true;
  try {
    return fs.realpathSync(invoked) === fs.realpathSync(self);
  } catch {
    return false;
  }
}

if (isEntrypoint()) main();
