-- Femina schema. Executed on application startup (idempotent).
-- NOTE: This system NEVER modifies or deletes user media files; DB records only.

CREATE TABLE IF NOT EXISTS sys_user (
    id            BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(64)  NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    display_name  VARCHAR(64)           DEFAULT NULL COMMENT '显示名称，为空时回退用户名',
    avatar        MEDIUMTEXT            DEFAULT NULL COMMENT '头像，base64 data URL',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS person (
    id               CHAR(36)     NOT NULL PRIMARY KEY,
    name             VARCHAR(64)           DEFAULT NULL COMMENT '姓名可能未知，可空',
    nickname         VARCHAR(64)           DEFAULT NULL,
    birth_date       DATE                  DEFAULT NULL,
    birth_year       INT                   DEFAULT NULL,
    birth_year_only  TINYINT      NOT NULL DEFAULT 0,
    hometown         VARCHAR(128)          DEFAULT NULL,
    education        VARCHAR(64)           DEFAULT NULL,
    height_cm        INT                   DEFAULT NULL,
    weight_kg        DECIMAL(5, 1)         DEFAULT NULL,
    media_dir        VARCHAR(512)          DEFAULT NULL,
    cover_path       VARCHAR(512)          DEFAULT NULL,
    cover_data       MEDIUMTEXT            DEFAULT NULL COMMENT '裁剪后的封面，base64 data URL；不改动用户原文件',
    remarks          TEXT                  DEFAULT NULL,
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_person_name (name),
    KEY idx_person_nickname (nickname)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS person_account (
    id        BIGINT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
    person_id CHAR(36)    NOT NULL,
    type      VARCHAR(32) NOT NULL,
    value     VARCHAR(255) NOT NULL,
    sort_no   INT         NOT NULL DEFAULT 0,
    KEY idx_account_person (person_id),
    KEY idx_account_value (value)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tag (
    id         BIGINT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(64) NOT NULL UNIQUE,
    created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS person_tag (
    person_id CHAR(36) NOT NULL,
    tag_id    BIGINT   NOT NULL,
    PRIMARY KEY (person_id, tag_id),
    KEY idx_pt_tag (tag_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media (
    id         BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
    person_id  CHAR(36)      NOT NULL,
    type       VARCHAR(8)    NOT NULL COMMENT 'PHOTO or VIDEO',
    rel_path   VARCHAR(1024) NOT NULL COMMENT 'relative path under person.media_dir',
    file_name  VARCHAR(255)  NOT NULL,
    ext        VARCHAR(16)            DEFAULT NULL,
    file_size  BIGINT                 DEFAULT 0,
    width      INT                            DEFAULT NULL COMMENT '图片宽 px（扫描/回填写入）',
    height     INT                            DEFAULT NULL COMMENT '图片高 px',
    modified_at DATETIME                      DEFAULT NULL COMMENT '文件修改时间',
    file_created_at DATETIME                  DEFAULT NULL COMMENT '文件创建时间（文件系统）',
    created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录登记时间',
    UNIQUE KEY uk_media_person_path (person_id, rel_path(255)),
    KEY idx_media_person (person_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 见面记录：日期可空（见面时间非必填）
CREATE TABLE IF NOT EXISTS meet_record (
    id         BIGINT   NOT NULL AUTO_INCREMENT PRIMARY KEY,
    person_id  CHAR(36) NOT NULL,
    meet_date  DATE              DEFAULT NULL COMMENT '见面日期，可空',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录登记时间',
    KEY idx_meet_person (person_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
