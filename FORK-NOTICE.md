# Fork notice / 分支声明

本仓库是 [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge) 的 fork，维护地址：
<https://github.com/WTHSBG/dsh-purge>

## 来源与版本

| 项 | 值 |
|---|---|
| Upstream | `YuJunZhiXue/dsh-purge` |
| Fork 基线 commit | `671011a7c1a941d119739cd665a887663578c1e9` |
| 基线版本 | v1.1.78（`dshTarget: 0.2.1-rc.2`） |
| 基线日期 | 2026-10-24 |
| 许可证 | Apache-2.0，`LICENSE` 与 `NOTICE` 原样保留 |

## 上游作者的约束（摘要）

- **原版不得转卖**：不得付费转售、不得换皮上架、不得在群里兜售。
- **Fork 必须署名并写明来源仓库**：即本节内容，以及 README 顶部的 fork 横幅。
- 借用名称、思路、代码或提示词，同样需要署名。
- 署名缺失或据为己有会被追究。

本 fork 不转卖原版，且保留全部上游版权与署名信息。

## 本地 remote 约定

```
origin    git@github.com:WTHSBG/dsh-purge.git        # 本 fork
upstream  git@github.com:YuJunZhiXue/dsh-purge.git   # 原始仓库
```

工作分支：`dev`（`master` 保持与 upstream 同步，仅用于拉取上游更新）。

同步上游：

```bash
git fetch upstream
git checkout master && git merge --ff-only upstream/master
git checkout dev && git rebase master
```

## 使用范围

本 fork 仅用于本地研究、代码审计、以及在该代码基座上的合法工程开发。
不要用它攻击未授权目标，也不要用于绕过模型服务条款产出违规内容。
