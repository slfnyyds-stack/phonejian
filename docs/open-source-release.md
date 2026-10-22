# 手机之间 · 首次开源预览验收

本仓库为 AIHOT（MIT）的独立衍生快照，基线为 `8d5a39bb47c917616798a3fdd71688a80f6c9b6c`。不是 AIHOT 官方仓库，也不是从零开发的通用框架。

## 已实际执行

在与运营项目隔离的公开源码副本中执行：

- `npm ci --no-audit --no-fund`：成功安装依赖；有上游 whatwg-encoding 废弃提醒。
- `npm run typecheck`：全项目通过。
- `npm run build -w @aihot/web`：客户端与服务端构建通过。
- `node --test 'tests/*-phone.test.ts'`：210 项通过，0 失败。
- `node --test 'apps/web/tests/*.test.ts'`：31 项通过，0 失败；包含构建产物的 SSR 行为测试。
- 待公开文件的密钥格式扫描、已配置秘密值逐项比对及禁止文件检查未发现命中；此检查不等于完整安全审计。

环境：Windows，Node.js 24.14.0。先从 junction 逻辑路径构建时，React Router/Vite 因逻辑路径与真实路径混用而误报服务端模块进入客户端；改从真实物理路径运行后成功，未据此改动业务代码。Git Bash 的 node 包装器还可能报 `stdin is not a tty`，测试使用实际 node.exe 执行。

## 测试可移植性

手机站提示词测试原先通过 `git show HEAD:...` 读取上游模板，导致无 `.git` 的发布快照失败。现在读取 `tests/fixtures/upstream-prompts/` 中固定基线样本；四个 fixture 均从上述 AIHOT 提交原样导出，保留 MIT 许可。原来的占位符等断言没有删除或跳过，修复前真实失败四项，修复后转绿。

## 首发排除项

不分发 `.env`、运营数据库、新闻全文与试稿、截图、私有部署脚本/连接记录、机器特定工具、个人 Agent 指令及构建缓存。

以下三个本地测试不随首发分发：

- `tests/group-phone-trial.test.ts`：依赖本机受限批次脚本。
- `tests/interpretation-v2-core.test.ts`：依赖不公开的新闻样本。
- `tests/interpretation-v2-pipeline.test.ts`：同样依赖私有样本及本机临时路径。

v2 生产候选处理源码与提示词仍保留；上述排除不表示相关实验已获得公开版完整验收。需要后续用明确可分发的样本补齐测试。

## 尚未验证

- 本次没有在公开副本重跑需要隔离数据库的全部后端集成测试，也没有做 Docker 全栈部署、负载或长期稳定性验收。
- 首发未启用 GitHub Actions；保留 `docs/ci/check.yml.example`，不能把本机通过说成 GitHub CI 通过。
- `phonejian.cn` 不作为已公开运营服务的证明；本次开源代码不改变现有私有站点、服务器、备案或采集配置。
- 不保证 AI 输出事实正确、事件归组无误或不存在漏洞；新闻、字体、商标仍遵循各自权利与许可。

`manifest.public.json` 记录本次公开文件的相对路径、SHA256 和来源；不包含自身哈希及生成的依赖/构建目录。
