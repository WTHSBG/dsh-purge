<p align="center">
  <img src="docs/banner.svg" alt="dsh-purge" width="720">
</p>

> **Fork 声明** — 本仓库是 [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge) 的 fork，
> 维护地址 [WTHSBG/dsh-purge](https://github.com/WTHSBG/dsh-purge)，仅用于本地研究与工程开发。
> 详见 [FORK-NOTICE.md](FORK-NOTICE.md)。上游署名要求保留，原版不得转卖。

<h1 align="center">⚔️ dsh-purge · 破甲 / 清洗</h1>

<p align="center"><strong>Version 1.1.78</strong> · 适配 DSH 0.2.1-rc.2 · 官方 Web / 桌面端</p>

<p align="center">
  <a href="README.md">English</a> | 中文 · <a href="FORK-NOTICE.md">Fork 声明</a> · <a href="LICENSE">Apache-2.0</a>
</p>

**本 fork 只保留破甲 / 清洗**：本机提示词注入、宿主补丁、规则集、还原与卸载。
**演练台、红队评估、资产库、评分、报告、自有服务器白名单等渗透测试相关功能已于 2026-10-25 移除。**

## 这是什么

**dsh-purge** 是装在本机官方 [DeepSeek Harness](https://www.deepseek.com/harness/) 上的提示词注入 / 补丁清洗插件。它在你自己的安装里做两件事：

- **破甲**：把「注入提示词 + 官方身份/policy 改写」写进每一轮 system prompt；
- **清洗**：按补丁列表改写本机 `@deepseek-ai/*` 里的审批门、沙箱、hooks 与渲染文案，并支持还原。

| 你会用到 | 它做什么 |
|---|---|
| **dsh-purge 按钮** | 会话标题旁（或页面角上）打开右侧栏，只有一个「清洗」页 |
| **清洗** | 分组查看补丁；应用 / 还原 / 卸载 |
| **提示词** | 编辑 `prompt-inject.md`，作为每轮会话的注入正文 |
| **规则集** | 多套 `AGENTS.md` / `CLAUDE.md`，启用后写入工作区规则 |
| **宿主策略** | 默认文案、权限策略、工具上限等补丁项 |
| **启动时** | 自动检查是否已应用；npm 升级覆盖 `node_modules` 后不用手改文件 |

> **本 fork 不包含**：演练台 / 红队评估 / 渗透测试编排、资产库、评分、报告、目标授权门、自有服务器白名单、技能库与知识库。

## 适配范围

| DSH 版本 | 用哪个 dsh-purge 版本 |
|---|---|
| **0.2.1-rc.2**（官方 Web / 桌面端） | 本 fork（1.1.78） |
| 0.2.0-rc.2 | 1.1.40+，本页这档也能装 |
| 0.1.7 及更早 | 不要在 0.1.x 上装；上游历史包见 Releases |

对不上的补丁会显示 `待应用` / `跳过`，不会乱改文件。

## 安装

> 本 fork 的代码在 `dev` 分支；上游 `master` 仍是含演练台的旧版本，不要混装。
> 官方 Web 和官方桌面 EXE **分开装、分开应用**，只装你正在用的那一个。

### 1. 装进 profile

有 `dsh`：

```sh
# Web
dsh plugin --profile web add https://codeload.github.com/WTHSBG/dsh-purge/tar.gz/refs/heads/dev

# 桌面端把 web 换成 desktop
dsh plugin --profile desktop add https://codeload.github.com/WTHSBG/dsh-purge/tar.gz/refs/heads/dev
```

只有 pnpm（进正在用的 profile 目录，不要在仓库根执行）：

```sh
cd "$DSH_HOME/profiles/web"      # 桌面改 profiles/desktop
pnpm add https://codeload.github.com/WTHSBG/dsh-purge/tar.gz/refs/heads/dev
```

当前目录已是本仓库时，把地址换成 `.`。

`postinstall` 会做两件事：把 `dsh-purge` 加进 profile 的 `dsh.profile.bundles`，并在用户层 `cordis.patch.yml` 补上本体 `insert`（没有这一行宿主不加载插件）。pnpm 11 拦安装脚本（`ERR_PNPM_IGNORED_BUILDS`）或用了 `--ignore-scripts` 时，补跑：

```sh
node node_modules/dsh-purge/scripts/ensure-profile-bundle.mjs
```

**不要走插件市场**：市场一键装会报 `already queued: dsh-purge`。npm 仓库也没有这个包名。

### 2. 完全退出再打开宿主

Web：停掉 `dsh web` 再开。桌面：托盘也要退出，再开 exe。

### 3. 点「应用」

会话标题旁的 **dsh-purge** → 清洗 → **「应用」**。成功后会自动重启一次，让改过的包文件生效。

Web 的按钮只动 Web，桌面的只动桌面，不要在一个里面点另一个的应用。

### 怎样算装上了

- 会话标题旁有 **dsh-purge**，清洗页能点「应用」；
- 聊天里 `/purge status` 能打出 `DSH_HOME` 和补丁列表，路径是正在用的那一份；
- 没装的可选包显示跳过，不挡住完成。

没有按钮时，在对应 profile 跑 `dsh --dump-config`，看有没有本体行 `id: dsh-purge`；没有就补跑 `ensure-profile-bundle.mjs`，再完全退出重开。

<details>
<summary><strong>手动安装（命令行装不上时）</strong></summary>

1. 找到真正在用的 `$DSH_HOME`：`DSH_HOME` 环境变量 → 启动器旁 `.dsh` → `~/.dsh`（Windows `%USERPROFILE%\.dsh`）→ `%APPDATA%\DeepSeek Harness\dsh-home`。
2. 把本仓库放到 `$DSH_HOME/plugins/dsh-purge`（目录名与 `package.json` 的 `name` 都必须是 `dsh-purge`）：
   ```sh
   git clone https://github.com/WTHSBG/dsh-purge.git "$DSH_HOME/plugins/dsh-purge"
   ```
3. 只改对应 profile 的 `package.json`：`dependencies` 加 `"dsh-purge": "file:../../plugins/dsh-purge"`，`dsh.profile.bundles` 末尾加 `"dsh-purge"`。
4. 在该 profile 目录执行 `pnpm install`（或 `npm install`）。
5. 完全退出重开宿主，再点「应用」。

</details>

## 界面预览

会话标题旁的 **dsh-purge** 打开右侧栏，只有一个 **清洗** 页；白 / 墨可切换。补丁按组展开，进度只计真正已应用的项；规则集在上方列表启用或删除。

**清洗**

![清洗](docs/preview/dock-clean.png)

**补丁**

![补丁](docs/preview/settings.png)

**规则集**

![规则集](docs/preview/rules.png)

## 使用

```sh
# CLI
dsh-purge --status      # 概览
dsh-purge --apply       # 应用全部补丁
dsh-purge --revert      # 还原
dsh-purge --uninstall   # 卸载
dsh-purge --edit        # 编辑 prompt-inject.md

# 聊天
/purge status | apply | revert | uninstall | edit | help
/rules list | use <id> | create <id> | delete <id> | reset | help
/rewind

# 模型工具
purge_status   purge_apply   purge_revert
```

- **回退**：输入框旁的「回退一次 / 回退上一轮」只撤当前对话里这一轮，已发送的那句回到输入框，改完重新发送即可；聊天里 `/rewind` 同样可用。
- **响应速度**：需要更快返回工具结果时，在 `$DSH_HOME/profiles/web/cordis.patch.yml` 加：

  ```yaml
  - id: bash-sandbox
    config:
      timeoutMs: 10000
  ```

  未完成的命令会转后台任务，用 `job_output` 读结果、`job_kill` 停止。

## 工作原理

| 层 | 作用 | 主要文件 |
|---|---|---|
| L1 提示词 | 替换人格 + 压制拒答 | `lib/asset-table.js`（加密槽）、`$DSH_HOME/prompt-inject.md` |
| L2 装配期改写 | 每轮重写 system prompt：删官方身份、改写 policy、置顶注入 | `lib/identity.js` |
| L3 文件补丁 | 改本机 `@deepseek-ai/*`，短路审批 / 沙箱 / hooks / 工具描述 | `lib/core.js` |
| L4 本地网络门禁 | 判定目标 IP，拦公网可达性 | `lib/net-scope.js` |

- 补丁逐字匹配目标文件，首次写入前备份为 `<文件>.dshpurge.bak`；备份存在时重复应用是幂等的。
- 每轮注入：`prompt-inject.md`（或加密默认）→ ChatML 规整 → persona/身份改写 → capability 协议段 → 置顶注入 → cwd 变量处理。
- DSH 升级后原文对不上会显示跳过，这次应用仍算完成，不会乱改。

## 本地网络门禁

本 fork 已移除演练台，但保留了 `lib/net-scope.js` 这道安全门禁（它不是渗透功能）：

- 公网目标上的攻击类任务 → 拦截并写入拒绝消息；
- 游戏外挂类任务 → 拦截；
- 工具参数里出现非本机 / 非 RFC1918 主机 → 工具调用拒绝；
- 本机回环与私网靶场照常放行；域名先解析再判 IP，不认 `.lab` / `.htb` 后缀，也不认对话里的口头授权。

## 还原与卸载

- 每个被改文件在应用前备份为 `<文件>.dshpurge.bak`；「还原」用备份覆盖并删除备份。
- 没有备份时，只去掉 shim 里由本插件写入的行；`prompt-inject.md` 是用户文件，还原时保留。
- 「卸载」会先还原（若已应用），再删除注入文件、规则库与插件本身。

```sh
dsh-purge --revert
dsh-purge --uninstall
```

## 更新

重新执行安装命令即可（本 fork 跟随 `dev` 分支）：

```sh
dsh plugin --profile web add https://codeload.github.com/WTHSBG/dsh-purge/tar.gz/refs/heads/dev
```

> ⚠️ 面板里的「检查更新 / 切换到正式版」目前仍指向上游仓库（`YuJunZhiXue/dsh-purge` master），
> 会拉回含演练台的旧版本，本 fork 用户不要使用；更新请用上面的命令或 `git pull`。

## 路径探测

- **Web**：`DSH_HOME` / `DSH_BASE` → 启动器旁 `.dsh` → `npm prefix -g` / `npm root -g` → 嵌套 `@deepseek-ai/dsh/node_modules/@deepseek-ai` → `~/.dsh`。
- **桌面端**：只改当前正在运行的官方桌面安装，应用成功后自动重启一次。
- 找不到目标时提示设置 `DSH_BASE`，不改任何文件。

运行时文件在 `$DSH_HOME`：`prompt-inject.md`、`rules/`。Web 和桌面端各用自己那一份主目录。

## 目录结构

```
bin/        命令行
lib/        补丁引擎、注入链、宿主面逻辑、本地网络门禁
client.js   右侧栏（清洗页）
docs/       预览图、机制笔记（docs/fork/）
scripts/    postinstall、补丁审计、提示词封装
```

## 本地校验

```sh
node --check lib/index.js
node --check lib/core.js
node --check lib/identity.js
node --check lib/net-scope.js
node --check client.js

npm run audit:patches   # 只读扫描本机宿主，报告每条补丁能否命中
```

## 常见问题

- **某条补丁 `skipped` / `pending`**：DSH 版本对不上原文。应用仍算完成，其余补丁照常生效；等补丁跟上对应版本。
- **点应用后没变化**：确认点的是正在用的那个宿主；应用成功后要等自动重启完成。只换 preset 不重应用，旧进程里的补丁不会更新。
- **按钮不出现**：多半是改到了另一份 `.dsh`。按「路径探测」核对，或补跑 `ensure-profile-bundle.mjs`。
- **市场报 `already queued`**：不要点市场，按安装第 1 步用 `dsh plugin add` / pnpm 装；命令也说已存在就 `remove` 后重装。
- **两个 `.dsh` 并存**：认你实际启动的那个宿主对应的那份，另一份不要动。

## 说明

- 改的是本机 `@deepseek-ai/*` 包里的渲染文案、默认策略和执行逻辑，以及 `$DSH_HOME` 下的覆盖文件与规则集；不改 DSH 源码仓库。
- 不改非 `@deepseek-ai` 的第三方插件源仓库；启动时的 CMD 无感会尽力修补已装的 doctor / market / 梁神 / mnemon，属运行时补丁。
- 应用前有备份，重复应用幂等；DSH 升级后对不上的补丁显示跳过，不会乱改。
- 本 fork 的机制笔记与功能收敛记录见 [docs/fork/](docs/fork/)。

## Fork 声明与署名

本仓库是 [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge) 的 fork，维护地址 [WTHSBG/dsh-purge](https://github.com/WTHSBG/dsh-purge)。

- **原版不允许倒卖**：不得收费转卖、换皮上架、当货挂群。
- **二开必须署名**：借用名称、思路、代码或提示词，必须写明来源仓库，并保留 [FORK-NOTICE.md](FORK-NOTICE.md)。
- 许可证为 [Apache-2.0](LICENSE)，再分发须保留 [NOTICE](NOTICE)。

## 合规与法律声明

1. **本仓库不含违法内容**：代码、文档、补丁和默认提示词不是木马、后门、未授权渗透工具、勒索软件或针对公网的攻击载荷。
2. **只作用于本机官方 Harness**：补丁与注入只在本机 `@deepseek-ai` 包、本机 profile / `$DSH_HOME` 内完成。
3. **不对外网目标联网攻击**：应用、还原、卸载只动本机文件；「检测更新」最多访问本插件自己的仓库。
4. **合法受控范围**：仅限你有权管理的本机 Harness、离线本地靶标、已书面授权的演练靶场与合规实验室；严禁对未授权目标、公网在线系统或生产业务运行。
5. **只允许本机/内网范围**：涉及网络的任务只放行回环与 RFC1918；公网 IP、解析到公网的域名、解析失败、hosts 指到公网一律拦；密钥、网段、通配符、口头说明都不能增加例外；禁止制作游戏外挂。
6. **严禁违法与违禁用途**：使用者必须遵守《中华人民共和国刑法》《网络安全法》《数据安全法》《个人信息保护法》等现行法律法规，以及所用大模型的服务条款与滥用政策；严禁未授权渗透、攻击、勒索、撞库、破坏、窃取数据，严禁生成违法违禁内容。
7. **责任由使用者承担**：本项目按 Apache-2.0「按现状」提供；因下载、部署、运行、修改、传播产生的全部后果由使用者独立承担。
8. **与 DeepSeek 无关**：本项目为独立开源项目，与 DeepSeek 官方及其关联主体无隶属、合作或背书关系。

**免责声明：** 本项目为非营利开源项目，仅供学习与研究。任何将本项目用于违法犯罪的行为均与开发者无关，由行为人依法独立承担全部责任。

---

感谢 [LINUX DO](https://linux.do) 社区。
