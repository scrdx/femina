package com.femina.util;

import java.util.Date;

import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

import com.femina.config.AppProperties;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;

@Component
public class JwtUtil {

    private final AppProperties props;

    public JwtUtil(AppProperties props) {
        this.props = props;
    }

    public String generate(String username) {
        long millis = props.getJwt().getExpireHours() * 3600_000L;
        Date now = new Date();
        return Jwts.builder()
                .setSubject(username)
                .setIssuedAt(now)
                .setExpiration(new Date(now.getTime() + millis))
                .signWith(SignatureAlgorithm.HS256, props.getJwt().getSecret())
                .compact();
    }

    /**
     * 校验 token 并返回用户名；无效或过期返回 null。
     */
    public String verify(String token) {
        if (StringUtils.isBlank(token)) {
            return null;
        }
        try {
            Claims claims = Jwts.parser()
                    .setSigningKey(props.getJwt().getSecret())
                    .parseClaimsJws(token)
                    .getBody();
            return claims.getSubject();
        } catch (Exception e) {
            return null;
        }
    }

    public long getExpireHours() {
        return props.getJwt().getExpireHours();
    }
}
