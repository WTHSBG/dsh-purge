# dsh-purge (jailbreak / cleaning)

English | [中文](README.zh-CN.md)

A prompt-injection / host-patch plugin for the official
[DeepSeek Harness](https://www.deepseek.com/harness/) installed on your own machine.

- **Jailbreak**: rewrites the system prompt every turn and leads with an injected prompt.
- **Cleaning**: applies a patch list to the local `@deepseek-ai/*` packages (approval, sandbox,
  hooks, rendered copy); everything can be restored or uninstalled.
- This fork has no drill console, red-team evaluation or penetration-testing features.

> Fork of [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge), maintained at
> [WTHSBG/dsh-purge](https://github.com/WTHSBG/dsh-purge). Apache-2.0; the upstream original may not
> be resold and forks must attribute (see [FORK-NOTICE.md](FORK-NOTICE.md)).

## Supported hosts

- DSH **0.2.1-rc.2** (0.2.0 still works); the official Web app and desktop are **installed and
  applied separately**.
- Patches whose source text does not match show as skipped and never edit files blindly.

## Install

```sh
# into the profile you are running (desktop: replace web with desktop)
dsh plugin --profile web add https://codeload.github.com/WTHSBG/dsh-purge/tar.gz/refs/heads/dev
```

pnpm only (run inside the profile directory, not in the repo root):

```sh
cd "$DSH_HOME/profiles/web"
pnpm add https://codeload.github.com/WTHSBG/dsh-purge/tar.gz/refs/heads/dev
```

If pnpm blocks install scripts (`ERR_PNPM_IGNORED_BUILDS`) or you used `--ignore-scripts`, run:

```sh
node node_modules/dsh-purge/scripts/ensure-profile-bundle.mjs
```

1. Fully quit and reopen the host (desktop: quit from the tray too).
2. Click **dsh-purge** beside the session title → **Clean** → **Apply**; it restarts once on success.
3. Check with `/purge status` in chat: it prints `DSH_HOME` and the patch list.

Do not use the plugin market (it reports `already queued: dsh-purge`); the npm registry does not
carry this package name.

## Usage

```sh
dsh-purge --status      # overview
dsh-purge --apply       # apply all patches
dsh-purge --revert      # restore
dsh-purge --uninstall   # uninstall
dsh-purge --edit        # edit prompt-inject.md

/purge status | apply | revert | uninstall | edit | help
/rules list | use <id> | create <id> | delete <id> | reset
/rewind
```

- **Prompt**: edit `prompt-inject.md` in the Clean page; it is the injected text used every turn.
- **Rule sets**: several `AGENTS.md` / `CLAUDE.md` sets; enabling one writes workspace rules.
- **Rewind**: "Rewind once / Rewind last turn" beside the composer only rolls back the current turn;
  the sent message returns to the input box, edit and resend.

## How it works

- L1 injected prompt → L2 system-prompt rewrite every turn → L3 host file patches (first write is
  backed up to `*.dshpurge.bak`, repeated applies are idempotent) → L4 local network gate.
- Runtime files live under `$DSH_HOME`: `prompt-inject.md`, `rules/`, `dsh-purge/`; if `DSH_HOME` is
  unset, `.dsh` beside the launcher wins over `~/.dsh`.
- **Local network gate**: attack-class tasks aimed at public hosts and game-cheat tasks are blocked;
  tool arguments mentioning a non-local / non-RFC1918 host are refused; loopback and private targets
  pass after DNS resolution (suffixes such as `.lab` are not trusted).
- Engineering notes live in [docs/fork/](docs/fork/).

## Restore / uninstall / update

```sh
dsh-purge --revert
dsh-purge --uninstall
```

Update: re-run the install command above, or use "Check for updates / Switch version" in the panel
(it tracks this fork's `dev` branch; this fork has no beta channel).

## Checks

```sh
node --check lib/index.js && node --check lib/core.js && node --check client.js
npm run audit:patches   # read-only scan of the local host: does each patch match?
```

## License and compliance

- Apache-2.0; redistributions must keep [LICENSE](LICENSE) and [NOTICE](NOTICE).
- For local machines, offline fixtures or environments with written authorization only; no
  unauthorized attacks, game cheats or illegal content. You are responsible for your use.
- This project has no affiliation with DeepSeek.
