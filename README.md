# Femina · 人物档案管理系统

以电影海报墙的形式管理人物档案（基本信息 + 照片 + 视频）。   
Web 技术栈：Spring Boot 2.7 (Java 8) + MyBatis + MySQL 后端；  
React 18 + Vite + TypeScript 前端，UI 采用 [Kokonut UI](https://kokonutui.com)（shadcn/ui registry：   
Tailwind CSS v4 + Motion 动效组件，见 `frontend/src/components/kokonutui/`）+ shadcn/ui 基础组件，   
主题 token 定制为暖纸 + 陶土色板（`frontend/src/index.css`）。

---

## 功能

- **首次使用设置管理员**：第一次打开系统时设置用户名/密码，之后作为唯一管理员账号登录
- **海报墙主页**：竖版 2:3 海报卡片流；关键字搜索（姓名 / 昵称 / 账号 / 标签）；
  标签云点选搜索；按昵称 / 添加日期 / 修改日期 / 媒体数量排序；分页加载
- **人物档案**：UUID、姓名、昵称、出生日期或仅出生年份、户籍地、学历、身高、体重、
  多账号表格（手机号 / Telegram / 抖音 / 快手 / 小红书 / 微博 …）、自定义标签（输入时可点选已有标签）
- **媒体管理**：添加人物时指定媒体目录，系统自动递归扫描目录中的图片与视频（只读）；
  详情页可「重新扫描」增量同步；封面可在该目录内用文件浏览器挑选，
  并支持裁剪（2:3 取景、可缩放平移，结果存数据库，原图文件不受影响）
- **浏览体验**：点击照片放大（Lightbox，方向键切换 / Esc 关闭）；点击视频弹窗播放（支持进度拖动）；
  详情页「文件」视图可浏览人物目录（多级目录、含非媒体文件，只读）
- **账户**：右上角头像菜单 → 主题（浅色 / 深色 / 跟随系统）/
  设置（用户信息：显示名称与头像；密码：需验证原密码）/ 长按退出登录

## 目录结构

```
femina/
├── backend/            Spring Boot 后端（Java 8 + MyBatis）
│   └── src/main/
│       ├── java/com/femina/     controller / service / mapper / model / config / util
│       └── resources/
│           ├── application.yml  数据库地址/密码、媒体根目录等配置
│           ├── schema.sql       启动时自动建表（幂等）
│           ├── mapper/*.xml     MyBatis SQL
│           └── static/          前端构建产物（构建时拷入）
├── frontend/           React 18 + Vite + TS 前端
├── scripts/            可选的测试辅助脚本（造数据 / 冒烟测试）
├── Dockerfile          三阶段构建：node → maven → JRE8
├── docker-compose.yml  app 服务；数据库连接全部由环境变量决定
├── docker-compose.db.yml
│                       可选覆盖文件：附带专属 MySQL 8 实例（模式 A）
└── .env.example        部署环境变量模板（两种数据库模式）
```

`scripts/` 生成的演示数据目录 `testdata/` 与运行日志不入库（见 `.gitignore`）。

## 本地开发

### 后端

1. 准备 MySQL，创建数据库：`CREATE DATABASE femina DEFAULT CHARSET utf8mb4;`
2. 修改 `backend/src/main/resources/application.yml` 中的数据库地址/密码
   （默认 `localhost:3306`、用户 `root`，也可用环境变量 `FEMINA_DB_HOST` / `FEMINA_DB_PASSWORD` 等覆盖）
3. 启动（首次启动会自动建表）：

   ```bash
   cd backend
   mvn spring-boot:run        # 需要 JDK 8
   ```

### 前端

```bash
cd frontend
npm install
npm run dev                  # http://localhost:5173，/api 已代理到 8080
```

### 一体化运行（类生产）

```bash
cd frontend && npm run build
cp -r dist/* ../backend/src/main/resources/static/
cd ../backend && mvn spring-boot:run
# 打开 http://localhost:8080
```

首次打开会进入「设置管理员」页面，设置后即可登录使用。

## NAS / Docker 部署

compose 拆为两个文件：`docker-compose.yml`（只有 app，数据库连接全走环境变量）
和 `docker-compose.db.yml`（附带一个专属 MySQL 8 实例）。按你的数据库情况二选一：

### 模式 A：自带 MySQL（新装默认）

1. 修改媒体目录挂载（`docker-compose.yml` 中 `app.volumes`）指向你存放照片/视频的位置：

   ```yaml
   volumes:
     - /volume1/photos:/media:ro     # 改成你的实际路径；:ro 表示只读挂载
   ```

2. （可选）在同目录创建 `.env` 覆盖默认值（可参照 `.env.example`）：

   ```ini
   MYSQL_ROOT_PASSWORD=your_db_password
   FEMINA_JWT_SECRET=change-me-to-a-long-random-string
   MEDIA_DIR=/volume1/photos
   FEMINA_PORT=8080
   ```

3. 启动（两个文件一起带上）：

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.db.yml up -d --build
   ```

数据库数据保存在命名卷 `db_data` 中；升级镜像不会丢失档案数据。

### 模式 B：使用 NAS 上已有的 MySQL（多系统共库）

不带 `docker-compose.db.yml`，app 会连接 `.env` 里指定的外部实例：

1. 在已有 MySQL 里建库（只需一次；**表结构由应用启动时自动创建**，无需导入 SQL）：

   ```sql
   CREATE DATABASE femina DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
   -- 建议建独立账号而非共用 root：
   CREATE USER 'femina'@'%' IDENTIFIED BY 'your_password';
   GRANT ALL PRIVILEGES ON femina.* TO 'femina'@'%';
   ```

2. `.env` 配置连接信息：

   ```ini
   # 三选一：局域网/宿主机 IP；或 host.docker.internal（指 NAS 宿主机，已内置支持）；
   # 或同一 docker network 内其它容器名
   FEMINA_DB_HOST=host.docker.internal
   FEMINA_DB_PORT=3306
   FEMINA_DB_NAME=femina
   FEMINA_DB_USER=femina
   FEMINA_DB_PASSWORD=your_password
   FEMINA_JWT_SECRET=change-me-to-a-long-random-string
   MEDIA_DIR=/volume1/photos
   ```

   若 MySQL 跑在另一个 compose 项目的容器里：先 `docker network create nas-db`，
   让两边容器加入同一网络（本项目的 `docker-compose.yml` 加 `networks` 段即可），
   `FEMINA_DB_HOST` 填对方容器名。

3. 启动：

   ```bash
   docker compose up -d --build
   ```

要求：MySQL 5.7+ / 8.x，字符集 utf8mb4。Femina 只使用自己的 `femina` 库
（表前缀无冲突：sys_user / person / person_account / tag / person_tag / media），
不会触碰同实例里的其它数据库。

### 首次使用

浏览器访问 `http://<NAS地址>:8080`，首次设置管理员后登录。
添加人物时，在「媒体目录」处点「浏览」，进入容器内的 `/media`（即你挂载的目录）选择子目录即可。

## 配置项（application.yml / 环境变量）

| 配置 | 环境变量 | 说明 |
|---|---|---|
| `spring.datasource.url/username/password` | `FEMINA_DB_HOST/PORT/NAME/USER/PASSWORD` | 数据库连接 |
| `femina.media-root` | `FEMINA_MEDIA_ROOT` | 文件浏览器默认起点目录（可为空） |
| `femina.jwt.secret` | `FEMINA_JWT_SECRET` | JWT 签名密钥，生产环境务必修改 |
| `femina.jwt.expire-hours` | `FEMINA_JWT_EXPIRE_HOURS` | 登录有效期（小时），默认 72 |
| `server.port` | `FEMINA_PORT` | 服务端口，默认 8080 |

## 测试辅助脚本（可选）

- `scripts/gen_testdata.py`：在 `testdata/people/` 下生成演示用渐变图与目录结构
- `scripts/seed.py`：通过 API 创建若干演示人物（先跑上一个脚本）
- `scripts/smoke_test.py`：后端 API 全流程冒烟测试（需后端已启动）

`testdata/` 为生成产物（约 16MB 图片），仅本地调试用，已加入 `.gitignore`。
