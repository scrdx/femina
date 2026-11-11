package com.femina.config;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.Statement;

import javax.annotation.PostConstruct;
import javax.sql.DataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.stereotype.Component;

/**
 * 启动时自动执行 schema.sql（全部为 CREATE TABLE IF NOT EXISTS，可重复执行），
 * 并对存量库执行尽力而为的结构迁移（已应用时忽略报错）。
 */
@Component
public class SchemaInitializer {

    private static final Logger log = LoggerFactory.getLogger(SchemaInitializer.class);

    /** 存量库迁移：幂等性无法用纯 SQL 保证，逐条执行、失败即视为已应用 */
    private static final String[] BEST_EFFORT_MIGRATIONS = {
            "ALTER TABLE person MODIFY COLUMN name VARCHAR(64) NULL",
            "ALTER TABLE person ADD COLUMN remarks TEXT NULL",
            "ALTER TABLE sys_user ADD COLUMN display_name VARCHAR(64) NULL",
            "ALTER TABLE sys_user ADD COLUMN avatar MEDIUMTEXT NULL",
            "ALTER TABLE person ADD COLUMN cover_data MEDIUMTEXT NULL",
            // 媒体属性排序所需；逐条独立，中断不会留下半应用状态
            "ALTER TABLE media ADD COLUMN width INT NULL",
            "ALTER TABLE media ADD COLUMN height INT NULL",
            "ALTER TABLE media ADD COLUMN modified_at DATETIME NULL",
            "ALTER TABLE media ADD COLUMN file_created_at DATETIME NULL",
    };

    private final DataSource dataSource;

    public SchemaInitializer(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @PostConstruct
    public void initSchema() throws Exception {
        ClassPathResource resource = new ClassPathResource("schema.sql");
        try (Connection conn = dataSource.getConnection()) {
            ScriptUtils.executeSqlScript(conn, new EncodedResource(resource, StandardCharsets.UTF_8));
            for (String migration : BEST_EFFORT_MIGRATIONS) {
                try (Statement st = conn.createStatement()) {
                    st.execute(migration);
                    log.info("Applied migration: {}", migration);
                } catch (Exception e) {
                    log.debug("Migration skipped (already applied): {}", migration);
                }
            }
            log.info("Database schema initialized");
        }
    }
}
