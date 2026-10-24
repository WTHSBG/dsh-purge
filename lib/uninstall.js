import fs from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";
import * as core from "./core.js";
import * as hostctl from "./host.js";
import * as rules from "./rules.js";
import * as updater from "./update.js";
import { clearOwnedSelectedDefault, removeStaleAgentPresetDir } from "./preset-default.js";

/** 当前包名（2026-10-25 由 dsh-purge 改名）。 */
const PKG_NAME = "dsh-stan";
/** 改名前的包名。卸载/清理新旧都要扫，否则升级后残留旧 bundle 条目。 */
const PKG_NAMES = [PKG_NAME, "dsh-purge"];


export function wasApplied(state) {
  if (!state) return false;
  if (state.has_backup) return true;
  if (Number(state.patches_applied) > 0) return true;
  return [state.shim_cmd, state.shim_ps1, state.shim_bin].includes("patched");
}

export function shouldDeletePluginTree(dir, dshHome = core.findDshHome()) {
  if (!dir) return false;
  let real;
  try {
    real = fs.realpathSync(dir);
  } catch {
    real = path.resolve(dir);
  }
  const n = real.replace(/[/\\]+/g, "/").toLowerCase();
  if (PKG_NAMES.some((name) => n.includes(`/node_modules/${name}`))) return true;
  let home;
  try {
    home = fs.realpathSync(dshHome);
  } catch {
    home = path.resolve(dshHome);
  }
  const homeN = home.replace(/[/\\]+/g, "/").toLowerCase();
  return n.startsWith(`${homeN}/profiles/`);
}

/** "dsh-stan" / "dsh-stan@1.2.3" / "dsh-purge" / "dsh-purge@x" 都算本插件。 */
function matchesPkgName(value) {
  if (typeof value !== "string") return false;
  return PKG_NAMES.some((name) => value === name || value.startsWith(`${name}@`));
}

function isPurgeBundleItem(item) {
  if (typeof item === "string") return matchesPkgName(item);
  const id = item && (item.id || item.name);
  return typeof id === "string" && PKG_NAMES.includes(id);
}

function stripBundleList(list) {
  if (!Array.isArray(list)) return { list, changed: false };
  const next = list.filter((item) => !isPurgeBundleItem(item));
  return { list: next, changed: next.length !== list.length };
}

export function stripPluginFromPackage(pkg) {
  if (!pkg || typeof pkg !== "object") return false;
  let changed = false;
  for (const key of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    if (!pkg[key]) continue;
    for (const name of PKG_NAMES) {
      if (!Object.prototype.hasOwnProperty.call(pkg[key], name)) continue;
      delete pkg[key][name];
      changed = true;
    }
  }
  for (const key of ["bundles", "plugins"]) {
    const top = stripBundleList(pkg[key]);
    if (top.changed) {
      pkg[key] = top.list;
      changed = true;
    }
    const nested = pkg.dsh && pkg.dsh.profile ? pkg.dsh.profile[key] : null;
    const nest = stripBundleList(nested);
    if (nest.changed) {
      pkg.dsh.profile[key] = nest.list;
      changed = true;
    }
  }
  return changed;
}

function readJson(fp) {
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(fp, value) {
  fs.writeFileSync(fp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function pkgMentionsPurge(pkg) {
  if (!pkg) return false;
  for (const name of PKG_NAMES) {
    if (pkg.dependencies?.[name] || pkg.devDependencies?.[name]) return true;
  }
  for (const key of ["bundles", "plugins"]) {
    if (Array.isArray(pkg[key]) && pkg[key].some(isPurgeBundleItem)) return true;
    const nested = pkg.dsh && pkg.dsh.profile ? pkg.dsh.profile[key] : null;
    if (Array.isArray(nested) && nested.some(isPurgeBundleItem)) return true;
  }
  return false;
}

export function listInstalledProfiles(dshHome = core.findDshHome()) {
  const root = path.join(dshHome, "profiles");
  if (!fs.existsSync(root)) return [];
  let names = [];
  try {
    names = fs.readdirSync(root);
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    const dir = path.join(root, name);
    const pkgPath = path.join(dir, "package.json");
    const pkg = readJson(pkgPath);
    // 旧版装的是 dsh-purge，迁移前目录还在，两个都探。
    const nmHit = PKG_NAMES.map((n) => path.join(dir, "node_modules", n)).find((p) => fs.existsSync(p)) || "";
    if (!pkgMentionsPurge(pkg) && !nmHit) continue;
    const spec = PKG_NAMES.map((n) => pkg?.dependencies?.[n] || pkg?.devDependencies?.[n]).find(Boolean) || "";
    out.push({ name, dir, spec: String(spec || ""), pkgPath, hasModule: Boolean(nmHit) });
  }
  return out;
}

async function unlinkIfExists(fp) {
  try {
    await fsp.unlink(fp);
    return true;
  } catch (e) {
    if (e && e.code === "ENOENT") return false;
    throw e;
  }
}

async function rmIfExists(fp) {
  try {
    await fsp.rm(fp, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

async function removeOverride(dshHome) {
  const fp = core.findOverrideFile(dshHome);
  const ok = await unlinkIfExists(fp);
  return { path: fp, removed: ok };
}

async function resetRules(dshHome) {
  const reset = await rules.resetToOriginal(dshHome);
  const dir = rules.rulesDir(dshHome);
  const removedDir = await rmIfExists(dir);
  return { ...reset, rules_dir: dir, rules_dir_removed: removedDir };
}

/** 把一个 node_modules/<pkg> 目录及其 realpath 记进清理清单。 */
function collectPluginTree(nm, dshHome, remember) {
  if (!fs.existsSync(nm)) return;
  let real;
  try {
    real = fs.realpathSync(nm);
  } catch {
    real = path.resolve(nm);
  }
  if (shouldDeletePluginTree(real, dshHome)) remember(real);
  if (path.resolve(nm).toLowerCase() !== real.toLowerCase()) remember(nm);
}

function collectCleanupDirs(profiles, dshHome) {
  const seen = new Set();
  const cleanup = [];
  const remember = (dir) => {
    if (!dir) return;
    let real;
    try {
      real = fs.realpathSync(dir);
    } catch {
      real = path.resolve(dir);
    }
    const key = real.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    cleanup.push(real);
  };

  for (const p of profiles) {
    // 新旧包名装的目录都要清，否则改名后旧目录成孤儿。
    for (const name of PKG_NAMES) {
      collectPluginTree(path.join(p.dir, "node_modules", name), dshHome, remember);
    }
  }

  const dataDir = path.join(dshHome, "dsh-purge");
  remember(dataDir);

  const root = updater.pluginRoot();
  if (shouldDeletePluginTree(root, dshHome)) remember(root);

  return cleanup;
}

function unregisterProfiles(profiles) {
  const stripped = [];
  const errors = [];
  for (const p of profiles) {
    try {
      const pkg = readJson(p.pkgPath) || {};
      if (stripPluginFromPackage(pkg)) {
        writeJson(p.pkgPath, pkg);
        stripped.push(p.name);
      }
    } catch (e) {
      errors.push({ profile: p.name, error: String(e && e.message ? e.message : e) });
    }
  }
  return { stripped, errors };
}

export async function uninstallPurge() {
  const state = await core.gatherState();
  const applied = wasApplied(state);
  const dshHome = state.dsh_home || core.findDshHome();
  const report = {
    ok: true,
    applied,
    reverted: false,
    needRestart: true,
    patches: null,
    shim: null,
    flash: null,
    override: null,
    rules: null,
    profiles: [],
    cleanup: [],
    errors: [],
  };

  try {
    if (state.ai_base) {
      report.patches = await core.revertAll(state.ai_base);
      if (applied) report.reverted = true;
    }
  } catch (e) {
    report.errors.push(`revert patches: ${e.message || e}`);
  }
  if (applied && (report.patches?.errors?.length || report.errors.some((e) => /^revert patches:/.test(e)))) {
    report.ok = false;
    report.needRestart = false;
    report.cleanup = [];
    return report;
  }

  try {
    report.shim = await core.revertAllShims();
    if (state.shim_cmd === "patched" || state.shim_ps1 === "patched" || state.shim_bin === "patched") {
      report.reverted = true;
    }
  } catch (e) {
    report.errors.push(`revert shims: ${e.message || e}`);
  }

  try {
    report.flash = core.revertCmdFlash(state.ai_base, dshHome);
  } catch (e) {
    report.errors.push(`revert flash: ${e.message || e}`);
  }

  try {
    report.override = await removeOverride(dshHome);
  } catch (e) {
    report.errors.push(`remove override: ${e.message || e}`);
  }

  try {
    report.rules = await resetRules(dshHome);
  } catch (e) {
    report.errors.push(`reset rules: ${e.message || e}`);
  }

  try {
    // 旧版演练台预设的遗留清理（升级兼容；演练台已移除）。
    const preset = clearOwnedSelectedDefault({ dshHome });
    report.presetDefault = { live: preset.live, files: preset.files };
    report.stalePresetDir = removeStaleAgentPresetDir(dshHome, "redteam");
  } catch (e) {
    report.errors.push(`clear selectedDefault: ${e.message || e}`);
  }

  const profiles = listInstalledProfiles(dshHome);
  report.profiles = profiles.map((p) => p.name);
  const unreg = unregisterProfiles(profiles);
  report.stripped = unreg.stripped;
  report.errors.push(...unreg.errors.map((x) => `${x.profile}: ${x.error}`));
  if (unreg.errors.length) {
    report.ok = false;
    report.needRestart = false;
    report.cleanup = [];
    return report;
  }

  report.cleanup = collectCleanupDirs(profiles, dshHome);
  return report;
}

export function scheduleCleanupRestart(opts = {}) {
  hostctl.scheduleCleanupRestart(opts);
}
