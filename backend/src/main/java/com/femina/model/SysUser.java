package com.femina.model;

import java.util.Date;

import lombok.Data;

@Data
public class SysUser {
    private Long id;
    private String username;
    private String passwordHash;
    /** 显示名称，为空时前端回退用户名 */
    private String displayName;
    /** 头像，base64 data URL */
    private String avatar;
    private Date createdAt;
}
