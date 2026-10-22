# 持续集成模板

`check.yml.example` 继承并适配 AIHOT 的检查流程，包括干净安装、类型检查、网页构建、网页测试、隔离 PostgreSQL 后端测试及 Docker 冒烟检查。

首次开源没有启用 GitHub Actions：发布使用的既有 GitHub OAuth 授权没有 `workflow` scope，未为此扩大账号授权。模板不在 `.github/workflows/`，不会自动执行。不要把本机已通过的检查描述成 GitHub CI 已通过。

仓库维护者确认模板和所用 Actions SHA 后，可在具有相应权限的环境将此文件复制到 `.github/workflows/check.yml` 并提交。本模板的 sources 数量按 `industry/sources.json` 动态核对，不沿用上游示例的 18 个来源。所有模型及采集调用应在 CI 保持关闭，仅使用临时测试密钥和隔离数据库。

安全报告入口已单独启用，不依赖 Actions。
