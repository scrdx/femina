# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Femina 是一个人物档案管理系统（海报墙 + 档案详情 + 照片/视频浏览），单体部署：
Spring Boot 2.7（Java 8）+ MyBatis + MySQL 后端，React 18 + Vite + TS 前端，
前端构建产物由后端从 `classpath:/static/` 直接伺服。

## 铁律：用户媒体文件只读

系统对用户照片/视频**只读**。任何功能（扫描、预览、播放、删除人物、重新扫描）都不得
创建/修改/移动/删除磁盘上的媒体文件——删除人物只删数据库记录，`rescan` 只同步数据库行
与文件系统的差异（新文件 INSERT IGNORE 入库、已消失文件删 DB 行）。写新代码时不得打破
这一约束；Docker 部署时媒体目录以 `:ro` 挂载做操作系统层兜底。

## 常用命令

```bash
# 后端（需 JDK 8；本地 MySQL 建库：CREATE DATABASE femina DEFAULT CHARSET utf8mb4）
# 本机 JAVA_HOME 未设置、PATH 上的 java 是 JRE，必须显式指定 JDK，否则报
# "No compiler is provided in this environment"：
cd backend && JAVA_HOME="C:/Program Files/Java/jdk-1.8" mvn spring-boot:run   # 首次启动自动建表，:8080

# 前端
cd frontend && npm install && npm run dev  # :5173，/api 代理到 :8080
npm run build                              # tsc 类型检查 + vite build（无独立 lint/test）

# 一体化运行（类生产）：前端 build 后
cp -r frontend/dist/* backend/src/main/resources/static/ && cd backend && mvn spring-boot:run

# Docker（NAS 部署见 README）：直接跑 GitHub Actions 构建的 ghcr.io/scrdx/femina
# 镜像（公开、amd64+arm64），compose 里没有 build: 段，部署机上不需要源码。
# 宿主机端口默认 8090（容器内仍 8080）——QNAP QTS 的管理界面占着 8080。
# 不自带 MySQL：.env 必须提供 FEMINA_DB_* 五项指向已有实例，缺失 compose 直接报错。
docker compose up -d

# 测试辅助（无自动化单测；smoke test 需后端已启动在 :8080）
python scripts/gen_testdata.py             # 在 testdata/ 生成演示媒体（testdata/ 已 gitignore）
python scripts/seed.py                     # 经 API 造演示人物
python scripts/smoke_test.py               # 后端 API 全流程冒烟
```

后台常驻服务用 `nohup ... &` 脱离会话（后台任务会被 harness 清理）：日志在仓库根
`backend-dev.log` 与 `frontend/vite-dev.log`（均 gitignore）。`npm run dev` 在非 TTY 后台
会因 stdin 关闭立即退出，改用 `node node_modules/vite/bin/vite.js`。停止 `mvn spring-boot:run`
后 fork 出的 java 子进程可能残留占着 8080——用 `netstat -ano | grep :8080` 找 PID 再 taskkill。

数据库连接、JWT 密钥等全部可用环境变量覆盖：`FEMINA_DB_HOST/PORT/NAME/USER/PASSWORD`、
`FEMINA_JWT_SECRET`、`FEMINA_JWT_EXPIRE_HOURS`、`FEMINA_MEDIA_ROOT`、`FEMINA_PORT`。

## 后端架构（backend/src/main/java/com/femina/）

- 分层：`controller → service → mapper`。Mapper 是 MyBatis 接口 + `resources/mapper/*.xml`
  手写 SQL；`model/` 是实体，请求/响应 DTO 集中在 `model/dto/PersonDtos.java`、`AuthDtos.java`。
- **统一响应体** `common/R.java`：`{code, message, data}`，`code=0` 为成功；业务错误抛
  `ApiException`，由 `GlobalExceptionHandler` 转成 R。前端 axios 拦截器（`frontend/src/api/client.ts`）
  负责解包：成功直接 resolve `data`，`code!=0` 或 HTTP 错误 reject 出 message——所以前端
  api 函数的返回类型是解包后的 data，不是 R。
- **鉴权**：单管理员账号（首次启动 setup 创建）。`JwtInterceptor` 拦截 `/api/**`，放行
  `/api/auth/{status,setup,login}`；`<img>/<video>` 无法带 header，媒体接口额外接受
  `?token=` query 参数。JWT 工具在 `util/JwtUtil.java`，密码用 spring-security-crypto 的 BCrypt。
- **媒体流**：`MediaController` 手写 HTTP Range（206）流式输出，保证视频可拖动；
  路径解析必须走 `util/FilePathUtil.resolveInside`（防目录穿越），文件严格限制在该人物的
  `media_dir` 内。`FsBrowseService` 提供服务器端目录浏览（选媒体目录/挑封面用），同样只读。
- **建表/迁移**：`resources/schema.sql` 全幂等（CREATE TABLE IF NOT EXISTS），启动时由
  `config/SchemaInitializer` 执行。存量库的结构变更没有迁移工具——把幂等性无法用纯 SQL
  保证的 ALTER 追加到 `SchemaInitializer.BEST_EFFORT_MIGRATIONS` 数组（逐条执行、失败视为已应用）。
- 数据模型：`person.id` 是 UUID（CHAR(36)）；账号（手机/Telegram/抖音…）在 `person_account`，
  标签是 `tag` + `person_tag` 多对多（`GET /api/tags` 带使用人数 count）；`media.rel_path`
  存相对于 `person.media_dir` 的路径，`(person_id, rel_path)` 唯一。出生日期兼容"仅年份"
  （`birth_year_only` 标志）。派生数据只进数据库、不落盘：裁剪封面 `person.cover_data`、
  显示名/头像 `sys_user.display_name/avatar`（均 base64 data URL）。
- 列表接口 `GET /api/persons` 支持 `sortBy`（nickname/created/updated/media/firstMeet/lastMeet/rating）
  + `sortDir`；排序列在 `PersonMapper.xml` 用 `<choose>` 白名单映射为固定列名，Service 层再兜底校验。
  `p.pinned DESC` 是无条件前导键：固定的人恒排最前、不参与排序；`rating` 排序时未评分（0）恒垫底。
  人物带 `rating`（1-5，0=未评分）与 `pinned` 两列；卡片右键菜单可快捷打分/固定，走单字段更新
  `PUT /api/persons/{id}/rating`、`PUT /api/persons/{id}/pinned`（不刷新 `updated_at`，不算「修改档案」）。
  `GET /api/persons/{id}/files?path=` 浏览人物目录（多级、含非媒体文件，`resolveInside` 限域）。

## 前端架构（frontend/src/）

- 路由用 **HashRouter**；`App.tsx` 的 `Gate` 组件是唯一入口守卫：未初始化 → `/setup`，
  未登录 → `/login`，已登录 → `/`（海报墙 HomePage）与 `/person/:id`（PersonDetailPage）。
- `api/client.ts`：axios 实例，token 存 localStorage（`femina_token`），拦截器解包 R 响应、
  401 时清 token 跳登录。`api/index.ts` 按域分组（authApi/personApi/fsApi），`mediaUrl()`
  构造带 token 的媒体 URL。`api/types.ts` 与后端 DTO 对应，改后端接口时同步更新。
- UI 组件三层：`components/ui/`（shadcn/ui 基础件）、`components/kokonutui/`（Kokonut UI
  动效组件）、`components/`（业务组件）。路径别名 `@` → `src/`。
- 主题：Tailwind CSS v4，暖纸 + 陶土色板 token 定制在 `index.css`；`main.tsx` 挂 next-themes
  的 `ThemeProvider`（class 策略，`.dark` token 已备好）。整体风格要求简约、有呼吸感，
  避免典型 AI 科幻风（见 需求.txt）。
- **弹窗约定**：所有 Dialog 用 `ui/dialog.tsx` 的 `DialogTitleBar` 做标题栏（Windows 标题栏
  观感：关闭钮贴右上角），配套 `DialogContent` 必须 `p-0 gap-0` + `showCloseButton={false}`，
  内边距由 body 自行控制。
- Radix 嵌套坑（踩过，改时注意）：Dialog 内的浮层（如 TagInput 候选面板）必须用 Radix
  Popover 而非手动 portal 到 body（模态 Dialog 会给 body 加 pointer-events:none）；
  锚点型组合框要 `onFocusOutside`/`onPointerDownOutside` preventDefault（打开面板的 focusin
  会在冒泡阶段被判定为层外焦点；anchor 内点击删 chip 时 target 可能已脱离文档，靠
  `data-tag-chip` + `closest()` 兜底）。kokonut 组件里 React 18 缺 `inert` 类型，用
  `inertProps()` shim 透传。shadcn CLI 在本环境静默失效，装组件可直接拉 registry JSON
  （`https://kokonutui.com/r/<name>.json`）写入，来源等价。

### Kokonut UI 规则（来自 AGENTS.md）

- 要从头写动画/交互组件前，先查 https://kokonutui.com/llms.txt 有没有现成组件；
  任何文档页 URL 加 `.md` 后缀可拿到完整源码。
  （WebFetch 访问该域名会被安全策略拦截，用 `curl` 拉取。）
- 安装只用 shadcn CLI：`npx shadcn@latest add @kokonutui/<name>`，不要手贴代码。
- 装好的组件就是项目代码，直接原地修改，不要再包一层。
