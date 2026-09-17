# Mini WPS Comate

基于 **Electron + React/Vite**、以 [@earendil-works/pi-coding-agent](https://github.com/earendil-works/pi) 为 Agent 底座的本地 AI 客户端。

- 包名 / 项目名：`mini-wps-comate`
- 用户数据目录：`%USERPROFILE%\.mini-wps-comate\`
- OAuth 回调（固定，占用即报错、不换端口）：`http://127.0.0.1:18365/callback`

## 功能对照（P0）

| # | 能力 | 状态 |
|---|------|------|
| 3.1 | WPS 账号登录 / 退出 / 登录态展示 | ✅ |
| 3.2 | 大模型列表与 Key 配置（落盘 config） | ✅ |
| 3.3 | 流式对话 + 发送排队 | ✅ |
| 3.4 | 会话新建 / 切换 / 删除 / 置顶 / 重命名 + 持久化 | ✅ |
| 3.5 | 本地项目目录 + Agent 读写（白名单外拦截） | ✅ |

## 启动

```bash
# 1. 配置开放平台凭证（作业文档中的应用 ID / 密钥）
copy .env.example .env
# 编辑 .env，填入 WPS_APP_SECRET（勿提交 .env）

# 2. 安装依赖
npm install

# 3. 开发模式（作业要求入口）
npm run dev
```

可选：`npm run build` 仅构建渲染进程静态资源。

## 仓库目录

```
mini-wps-comate/
  electron/           # 主进程：OAuth、IPC、pi Agent、会话与项目
  src/                # 渲染进程：React UI
  demo-project/       # 批次 5/联调示例本地项目
  screenshots/        # 作业截图 01–07（由你拍摄放入）
  chatlog/            # 各批次开发摘要
  bundled-skills/     # Skills 占位（本作业未实现）
  .env.example        # 凭证模板
```

## 用户数据目录

与代码分离，统一落在：

```
%USERPROFILE%\.mini-wps-comate\
  config\
    auth.json         # 登录态
    models.json       # 供应商与 API Key
    settings.json     # 默认模型等
    project.json      # 本地项目根 + 白名单
  sessions\           # 会话 jsonl + index.json
  pi-agent\           # pi 运行时 models/auth
  skills\             # 预留
  logs\               # 预留
```

## 端到端验收（提交前请自测）

按顺序走通即可覆盖 P0：

1. **登录**：`npm run dev` → 未登录页 → 扫码登录 → 左下角显示昵称/头像；可退出后再登。
2. **模型**：设置页配置 DeepSeek（或其它）API Key，保存默认模型；确认写入 `config\models.json` / `settings.json`。
3. **对话**：工作台发消息，助手**流式**输出；生成中再发一条应出现排队。
4. **会话**：侧栏新建 / 切换 / 置顶 / 改名 / 删除；重启后列表与历史仍在（可对照 `sessions\`）。
5. **本地项目**：选择 `demo-project`（或任意目录）→ 让 Agent 列目录并改小文件 → 再请求白名单外路径（如 `C:\Windows\...`）应被拦截。

## 截图

见 [`screenshots/README.md`](screenshots/README.md)。**请你自行拍摄** 01–07 放入该目录（Skills 的 08–10 非研发可不交）。

建议对应关系：

| 截图 | 操作提示 |
|------|----------|
| 01 | 启动后未登录 |
| 02 | 浏览器扫码/授权页 |
| 03 | 登录后主界面（可拼脱敏 token / 用户信息） |
| 04 | 设置页模型列表 + Key |
| 05 | 流式对话中 |
| 06 | 多会话 + 可拼 `sessions` 文件夹 |
| 07 | 选中本地项目 + 工具调用；可拼目录内容 |
| 08 | 其他功能-双色双语模式+白名单 |

## 开发记录

见 [`chatlog/`](chatlog/)（`batch-01.md` … `batch-06.md`）。

## 批次进度

- 批次 1：工程骨架 + 登录 ✅
- 批次 2：大模型配置 ✅
- 批次 3：流式对话 ✅
- 批次 4：会话管理 ✅
- 批次 5：本地项目 + 白名单 ✅
- 批次 6：交付收口 ✅

## 说明与边界

- OAuth 回调端口 **固定 18365**；被占用时明确报错，不会静默换端口。
- API Key 明文落盘即可过作业门槛（勿写入日志）；加密非硬门槛。
- 本地项目工具仅开放 `read` / `ls` / `edit` / `write`；**未启用 bash**（避免逃逸白名单）。
- Skills、会话搜索/导入导出/归档、主题双语等为 P1 / 加分，本仓库当前未实现。
