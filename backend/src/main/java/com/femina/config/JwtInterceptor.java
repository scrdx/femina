package com.femina.config;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.femina.common.R;
import com.femina.util.JwtUtil;

/**
 * 校验 Authorization: Bearer &lt;token&gt;，通过后将用户名放入 request attribute。
 */
@Component
public class JwtInterceptor implements HandlerInterceptor {

    public static final String ATTR_USERNAME = "authUsername";

    private final JwtUtil jwtUtil;
    private final ObjectMapper objectMapper;

    public JwtInterceptor(JwtUtil jwtUtil, ObjectMapper objectMapper) {
        this.jwtUtil = jwtUtil;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        // 预检请求直接放行
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String header = request.getHeader("Authorization");
        String token = null;
        if (StringUtils.startsWithIgnoreCase(header, "Bearer ")) {
            token = header.substring(7);
        }
        // 媒体文件通过 <img>/<video> 标签加载时无法带 header，允许 query 参数
        if (token == null) {
            token = request.getParameter("token");
        }
        String username = jwtUtil.verify(token);
        if (username == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write(objectMapper.writeValueAsString(R.fail(401, "未登录或登录已过期")));
            return false;
        }
        request.setAttribute(ATTR_USERNAME, username);
        return true;
    }
}
