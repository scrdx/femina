package com.femina.util;

import java.nio.file.Path;

import com.femina.common.ApiException;

/**
 * 文件路径安全工具。
 * 系统对用户媒体文件只读；此工具确保解析出的路径不会逃逸出允许的根目录（防目录穿越）。
 */
public final class FilePathUtil {

    private FilePathUtil() {
    }

    /**
     * 将相对路径解析到 base 之内，逃逸（如 ../../etc）时抛出 400。
     */
    public static Path resolveInside(Path base, String rel) {
        Path normalizedBase = base.toAbsolutePath().normalize();
        Path resolved = normalizedBase.resolve(rel == null ? "" : rel).normalize();
        if (!resolved.startsWith(normalizedBase)) {
            throw ApiException.badRequest("非法路径");
        }
        return resolved;
    }
}
