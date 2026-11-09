package com.femina.common;

import lombok.Getter;

/**
 * 业务异常，code 与前端约定：
 * 400 参数错误 / 401 未登录 / 403 禁止 / 404 不存在 / 409 冲突 / 500 服务端错误
 */
@Getter
public class ApiException extends RuntimeException {

    private final int code;

    public ApiException(int code, String message) {
        super(message);
        this.code = code;
    }

    public static ApiException badRequest(String message) {
        return new ApiException(400, message);
    }

    public static ApiException unauthorized(String message) {
        return new ApiException(401, message);
    }

    public static ApiException notFound(String message) {
        return new ApiException(404, message);
    }

    public static ApiException conflict(String message) {
        return new ApiException(409, message);
    }
}
