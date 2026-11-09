package com.femina.config;

import java.io.IOException;

import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * 静态资源解析：文件存在则返回，否则回退 index.html（支持 React Router 前端路由）。
 * /api 开头的路径不回退。
 */
public class SpaResourceResolver extends PathResourceResolver {

    private final Resource index = new ClassPathResource("static/index.html");

    @Override
    protected Resource getResource(String resourcePath, Resource location) throws IOException {
        Resource requested = location.createRelative(resourcePath);
        if (requested.exists() && requested.isReadable()) {
            return requested;
        }
        if (resourcePath.startsWith("api/")) {
            return null;
        }
        return index.exists() ? index : null;
    }
}
