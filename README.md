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
├── docker-compose.yml  app 服务；跑 ghcr.io 上的 CI 镜像，数据库连接全部由环境变量决定
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

`docker-compose.yml` 跑的是 GitHub Actions 构建好的镜像 `ghcr.io/scrdx/femina`
（公开可拉、无需登录，amd64 + arm64 双架构，Intel 和 ARM 机型的 NAS 都能跑），
**部署机上不需要源码、不需要编译**。只要把 `docker-compose.yml` 和一份照
`.env.example` 写好的 `.env` 放到 NAS 上某个目录里就行。

> 宿主机端口默认 **8090**（`.env` 里的 `FEMINA_PORT`）：QNAP QTS 的 Web 管理界面
> 默认就占用 8080，群晖等也常有别的套件占着，所以避开了。容器内部仍固定监听 8080，
> 改的只是宿主机映射这一侧。部署前先 `netstat -tln | grep 8090` 确认没被占。

数据库按你的情况二选一（`docker-compose.db.yml` 是可选的覆盖文件）：

### 模式 A：自带 MySQL（新装默认）

compose 会额外起一个专属 `mysql:8.0` 容器，数据存在命名卷 `db_data` 中，
升级镜像不会丢失档案数据。

1. 在同目录创建 `.env`（参照 `.env.example`）：

   ```ini
   MYSQL_ROOT_PASSWORD=your_db_password
   FEMINA_JWT_SECRET=<openssl rand -hex 32 的输出>
   MEDIA_DIR=/volume1/photos      # 你的照片/视频目录，只读挂载进容器 /media
   FEMINA_PORT=8090
   ```

2. 启动（两个文件一起带上）：

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.db.yml up -d
   ```

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
   # host 三选一：host.docker.internal（宿主机，已内置支持，也是默认值）；
   # 172.17.0.1（docker0 网桥，同样指宿主机，前者不生效时兜底）；
   # 或同一 docker network 内的其它容器名
   FEMINA_DB_HOST=host.docker.internal
   FEMINA_DB_PORT=3306
   FEMINA_DB_NAME=femina
   FEMINA_DB_USER=femina
   FEMINA_DB_PASSWORD=your_password
   FEMINA_JWT_SECRET=<openssl rand -hex 32 的输出>
   MEDIA_DIR=/volume1/photos
   ```

**变体：MySQL 跑在另一个容器里、且没映射宿主端口**

这时上面三种 host 都用不了（宿主机上根本没监听），必须让两个容器加入同一个
docker network 走内置 DNS。网络若还不存在先建一个，再让 MySQL 容器加入
（`docker network create nas-db`、`docker network connect nas-db <mysql容器名>`；
如果 MySQL 属于另一个 compose 项目，在那个项目的 compose 文件里声明这个
external 网络更稳妥，`docker network connect` 在容器重建后会失效）：

```bash
# 查出 MySQL 容器名，即 FEMINA_DB_HOST 要填的值
docker network inspect nas-db --format '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}'
# 确认网络名（compose 建的网络常带项目前缀，如 mystack_nas-db）
docker network ls | grep nas-db
```

`.env` 里 `FEMINA_DB_HOST=<mysql容器名>`，然后给 `docker-compose.yml` 补两处
`networks`（其余不动）：

```yaml
services:
  app:
    # ...原有内容保持不变...
    networks:            # ← 新增：显式声明后就不再自动加入 default，所以两个都列上
      - default
      - nas-db

networks:                # ← 新增：文件末尾
  default:
  nas-db:
    external: true       # 网络已存在，compose 不创建也不删除它
```

`external: true` 不能省：没有它 compose 会自建一个叫 `<项目名>_nas-db` 的新网络，
和 MySQL 所在的那个不是同一个，照样解析不到。

连不上时用一个临时容器隔离排查（纯网络/账号问题，与应用无关）：

```bash
docker run --rm --network nas-db mysql:8.0 \
  mysql -h <mysql容器名> -ufemina -pyour_password -e "SHOW DATABASES;"
```

| 报错 | 原因 |
| --- | --- |
| `Unknown MySQL server host` | 两容器不在同一网络；或 MySQL 在 `nas-db` 上的别名不是容器名（`docker inspect <mysql容器名> --format '{{json .NetworkSettings.Networks}}'` 看 aliases） |
| `Can't connect` / 超时 | MySQL 配了 `bind-address=127.0.0.1`，去掉它 |
| `Access denied` | 账号建成了 `'femina'@'localhost'`，须为 `@'%'`——连接来自另一个容器的 IP |

3. 启动：

   ```bash
   docker compose up -d
   ```

要求：MySQL 5.7+ / 8.x，字符集 utf8mb4。Femina 只使用自己的 `femina` 库
（表前缀无冲突：sys_user / person / person_account / tag / person_tag / media），
不会触碰同实例里的其它数据库。

> QNAP App Center 装的通常是 **MariaDB** 而非 MySQL，先 `SELECT VERSION();` 确认。
> Femina 用 MySQL Connector/J，对 MariaDB 多数场景能正常工作，但不在官方支持范围内；
> 真连不上就改用模式 A 起一个独立 MySQL 容器。

### 首次使用

浏览器访问 `http://<NAS地址>:8090`，首次设置管理员后登录。
添加人物时，在「媒体目录」处点「浏览」，进入容器内的 `/media`（即你挂载的目录）选择子目录即可。

命令行自检：

```bash
curl -s http://localhost:8090/api/auth/status
# 期望 {"code":0,...,"data":{"initialized":false}}
docker compose logs -f app          # 看到 Started FeminaApplication 即启动成功
```

### 升级与备份

```bash
docker compose pull && docker compose up -d && docker image prune -f
```

档案数据都在 MySQL 里，升级不会丢。想锁定某次构建便于回滚，在 `.env` 里设
`FEMINA_IMAGE_TAG=sha-xxxxxxxx`（CI 每次构建都会打这个 tag）。

备份只需要导出数据库——媒体文件本来就在 NAS 上，且是 `:ro` 只读挂载，系统改不动：

```bash
mysqldump -h <DB_HOST> -u femina -p --default-character-set=utf8mb4 femina > femina-backup.sql
```

## 配置项（application.yml / 环境变量）

| 配置 | 环境变量 | 说明 |
|---|---|---|
| `spring.datasource.url/username/password` | `FEMINA_DB_HOST/PORT/NAME/USER/PASSWORD` | 数据库连接 |
| `femina.media-root` | `FEMINA_MEDIA_ROOT` | 文件浏览器默认起点目录（可为空） |
| `femina.thumb-dir` | `FEMINA_THUMB_DIR` | 缩略图目录（可为空）。配置后扫描/启动时后台为照片生成最长边 1600px 的 JPEG 副本，图片墙/海报墙/查看器适配态展示缩略图、放大超过其分辨率自动切回原图；留空则全部直接伺服原图。只写该目录，绝不写入媒体目录 |
| `femina.jwt.secret` | `FEMINA_JWT_SECRET` | JWT 签名密钥，生产环境务必修改 |
| `femina.jwt.expire-hours` | `FEMINA_JWT_EXPIRE_HOURS` | 登录有效期（小时），默认 72 |
| `server.port` | `FEMINA_PORT` | 应用监听端口，默认 8080。Docker 部署时容器内固定 8080，`FEMINA_PORT` 只决定宿主机映射端口（compose 默认 8090） |

## 测试辅助脚本（可选）

- `scripts/gen_testdata.py`：在 `testdata/people/` 下生成演示用渐变图与目录结构
- `scripts/seed.py`：通过 API 创建若干演示人物（先跑上一个脚本）
- `scripts/smoke_test.py`：后端 API 全流程冒烟测试（需后端已启动）

`testdata/` 为生成产物（约 16MB 图片），仅本地调试用，已加入 `.gitignore`。
