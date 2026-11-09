package com.femina.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import lombok.Data;

@Data
@ConfigurationProperties(prefix = "femina")
public class AppProperties {

    /** 媒体文件根目录（默认浏览起点），可为空 */
    private String mediaRoot = "";

    private Jwt jwt = new Jwt();

    @Data
    public static class Jwt {
        private String secret = "femina-default-jwt-secret-change-me";
        private long expireHours = 72;
    }
}
