# phonejian（手机之间）

> 面向手机零售与全 3C 赛道的行业资讯聚合与研判工作台。基于 [KKKKhazix/AIHOT](https://github.com/KKKKhazix/AIHOT)（MIT）改造，上游基线 commit `8d5a39bb47c917616798a3fdd71688a80f6c9b6c`，主要维护者 GitHub 账号 `slfnyyds-stack`。
>
> 本项目处于早期首次开源阶段，代码可供自建运行，但请勿视其为成熟稳定或已被广泛使用的成品。`phonejian.cn` 目前并不是已公开提供的线上服务。

English summary: phonejian is an open-source news aggregation and analysis workspace for the smartphone retail and broader 3C industry. It is a vertical adaptation of KKKKhazix/AIHOT (MIT) at upstream baseline `8d5a39b`, adding industry-specific sources and taxonomy, dual scoring, event source cross-reference, permission-gated article bodies, and provenance-preserving AI interpretation. This is an early first open-source release; the v2 human-review pipeline remains experimental.

## 核心能力

- 行业化信源与分类：围绕手机零售、渠道、供应链与全 3C 方向组织采集源与内容归类。
- 双次独立评分：按行业精选标准分别评分，再结合信源分级门槛决定是否入选；不是热度与行业影响力两种分数。
- 事件来源对照：并列呈现报道及出处，方便回查；不自动得出共同事实或差异结论，也不等于事实核验。
- 阅读体验：明暗响应式排版，适配桌面与手机。
- 受许可约束的正文：只在适用许可与审核条件满足时展示正文，否则保留摘要和原文入口；运营数据不随代码分发。
- 保留出处的 AI 解读：解读内容标注引用来源，可回溯到对应原文证据。

## 状态与边界（使用前请先读）

- v2 人工终审流程仍处于实验阶段；系统**不提供**全自动事实核验能力。
- 自动事件归组可能有误；多来源参与和 AI 综述不能替代人工核实。
- 日报等调度能力取决于部署配置，不承诺开箱即用的定时运行。
- 部分实验性测试依赖私有新闻样本，可能未随首发公开，因此本仓库并非全量验收状态。
- npm 工作区保留 `private: true` 以避免误发布 npm，这不代表闭源。

## 快速开始

环境要求：Node.js >= 24.11、PostgreSQL 17、Docker Compose。

```bash
git clone https://github.com/slfnyyds-stack/phonejian
cd phonejian
cp .env.example .env
```

编辑 `.env` 并填入：

- 管理员密码：不少于 12 位；
- `SESSION_SECRET`：随机生成；
- `IMG_PROXY_SIGN_SECRET`：随机生成；
- `POSTGRES_PASSWORD`：随机生成；
- 模型 API key：按需填写。

不要把真实密钥写进命令行参数，也不要提交进仓库。

```bash
docker compose up -d --build
```

访问 `http://localhost:3000`，后台入口为 `/admin`。

> 本模板默认 `COLLECT_ENABLED=false`、`MODEL_CALLS_ENABLED=false`，首次启动后数据库中没有文章属于正常现象。请在充分了解调用成本后再手动打开开关，并启动 worker。

模型侧：示例配置兼容 `https://api.minimaxi.com/v1`，模型 `MiniMax-M3.1-Flash`，adaptive thinking，`reasoning_effort: low`（该模型不支持关闭思考）。解读实验要求使用该模型；常规采集与编辑可使用其他 OpenAI 兼容 provider。

## 开发与验证

```bash
npm ci
npm run typecheck
npm run build -w @aihot/web
node --test 'tests/*-phone.test.ts'
```

全量 `npm test` 需要另行准备 `_test/_ci` 数据库，切勿指向生产库。首发已在独立公开源码副本中完成干净安装、全项目类型检查、网页构建、210 项手机站测试及 31 项网页测试；不代表全量后端集成或 Docker 部署已验收。详见 [首发验收与范围](docs/open-source-release.md)。

Windows 如把项目放在 junction/软链接目录，构建器可能混用逻辑路径与真实路径；请从真实物理路径运行构建。GitHub Actions 首发未启用，保留了 [CI 模板](docs/ci/README.md)。

## 许可与来源

- MIT 许可覆盖软件本身，不涵盖新闻全文、第三方字体与商标。
- 请保留 `LICENSE` 与 `NOTICE`；上游 `README.upstream.md` 及部分文档仍沿用 AIHOT / MyHOT 命名，与本项目的差异属于衍生改造。
- 公开副本不含 `.env`、运营数据、第三方新闻正文、私有部署记录与个人机器脚本。

## 参与与安全

- Issues 与 PR 请提交到本仓库：https://github.com/slfnyyds-stack/phonejian
- 安全问题请使用 private reporting：https://github.com/slfnyyds-stack/phonejian/security/advisories/new
- 请勿公开提交密钥、令牌或运营数据。维护者目前不承诺响应时限（SLA）。
