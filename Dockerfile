# ============================================================
# Femina 多阶段构建
#   阶段1: Node 构建 React 前端
#   阶段2: Maven(Java 8) 构建 Spring Boot 后端（前端产物打入 jar）
#   阶段3: JRE 8 运行
# ============================================================

# ---- 阶段 1: 前端 ----
FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- 阶段 2: 后端 ----
FROM maven:3.9-eclipse-temurin-8 AS backend-build
WORKDIR /build
# 先拷贝 pom 预下载依赖，利用 Docker 层缓存
COPY backend/pom.xml ./pom.xml
RUN mvn -q dependency:go-offline -B || true
COPY backend/src ./src
# 前端构建产物放入 Spring Boot 静态资源目录
COPY --from=frontend-build /build/dist ./src/main/resources/static
RUN mvn -q clean package -DskipTests -B

# ---- 阶段 3: 运行时 ----
FROM eclipse-temurin:8-jre-jammy
WORKDIR /app
COPY --from=backend-build /build/target/femina-backend-1.0.0.jar app.jar

# 时区（出生日期等按本地时区处理）
ENV TZ=Asia/Shanghai

EXPOSE 8080
# 数据库等配置通过环境变量注入，见 docker-compose.yml
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
