# dsh-stan（破甲 / 清洗）

中文 | [English](README.md)

装在本机官方 [DeepSeek Harness](https://www.deepseek.com/harness/) 上的提示词注入 / 宿主补丁插件。

- **破甲**：每轮把注入提示词和身份 / policy 改写塞进 system prompt。
- **清洗**：按补丁列表改写本机 `@deepseek-ai/*`（审批、沙箱、hooks、文案），支持还原和卸载。
- 本 fork 不含演练台、红队评估、渗透测试相关功能。

> Fork 自 [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge)，维护在
> [WTHSBG/dsh-stan](https://github.com/WTHSBG/dsh-stan)。Apache-2.0；原版不得转卖，
> 二开必须署名（见 [FORK-NOTICE.md](FORK-NOTICE.md)）。

## 适配

- DSH **0.2.1-rc.2**（0.2.0 仍可用）；官方 Web 和官方桌面端**分开安装、分开应用**。
- 对不上的补丁显示跳过，不会乱改文件。

## 安装

```sh
# 装进正在用的 profile（桌面端把 web 换成 desktop）
dsh plugin --profile web add https://codeload.github.com/WTHSBG/dsh-stan/tar.gz/refs/heads/dev
```

只有 pnpm 时（进 profile 目录，不要在仓库根执行）：

```sh
cd "$DSH_HOME/profiles/web"
pnpm add https://codeload.github.com/WTHSBG/dsh-stan/tar.gz/refs/heads/dev
```

pnpm 拦安装脚本（`ERR_PNPM_IGNORED_BUILDS`）或用了 `--ignore-scripts`，补跑：

```sh
node node_modules/dsh-stan/scripts/ensure-profile-bundle.mjs
```

1. 完全退出并重开宿主（桌面端托盘也要退）。
2. 会话标题旁点 **dsh-stan** →「清洗」→ **应用**，成功后自动重启一次。
3. 验证：聊天里 `/purge status` 能打出 `DSH_HOME` 和补丁列表。

不要走插件市场（会报 `already queued: dsh-stan`）；npm 仓库没有这个包名。

## 使用

```sh
dsh-stan --status      # 概览
dsh-stan --apply       # 应用全部补丁
dsh-stan --revert      # 还原
dsh-stan --uninstall   # 卸载
dsh-stan --edit        # 编辑 prompt-inject.md

/purge status | apply | revert | uninstall | edit | help
/rules list | use <id> | create <id> | delete <id> | reset
/rewind
```

- **提示词**：清洗页编辑 `prompt-inject.md`，作为每轮注入正文。
- **规则集**：多套 `AGENTS.md` / `CLAUDE.md`，启用后写入工作区规则。
- **回退**：输入框旁「回退一次 / 回退上一轮」只撤当前这一轮，已发送的那句回到输入框，改完重新发送。

## 原理与文件

- L1 注入提示词 → L2 每轮改写 system prompt → L3 打补丁改宿主文件（首次写入前备份 `*.dshpurge.bak`，重复应用幂等）。
- 运行时文件在 `$DSH_HOME`：`prompt-inject.md`、`rules/`、`dsh-purge/`；`DSH_HOME` 未设时按启动器旁 `.dsh` → `~/.dsh`。
- 插件不再做任何网络 / 域名 / IP 层面的拦截：目标判定交回模型与宿主自身的策略层，插件只负责提示词与实际执行的补丁。
- 机制笔记见 [docs/fork/](docs/fork/)。

## 还原 / 卸载 / 更新

```sh
dsh-stan --revert
dsh-stan --uninstall
```

更新：重新执行上面的安装命令，或面板里「检查更新 / 切换版本」（跟随本 fork 的 `dev` 分支；本 fork 没有 beta 通道）。

## 自检

```sh
node --check lib/index.js && node --check lib/core.js && node --check client.js
npm run audit:patches   # 只读扫描本机宿主，报告每条补丁能否命中
```

## 许可证与合规

- Apache-2.0；再分发保留 [LICENSE](LICENSE) 和 [NOTICE](NOTICE)。
- 仅限本机、离线靶标或已书面授权的环境；不得用于未授权攻击、游戏外挂或违法内容，后果自负。
- 本项目与 DeepSeek 官方无关。
