package com.femina.model.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

import lombok.Data;

/**
 * 认证相关请求/响应 DTO 集合。
 */
public class AuthDtos {

    @Data
    public static class SetupReq {
        @NotBlank(message = "用户名不能为空")
        @Size(min = 2, max = 32, message = "用户名长度需在2-32之间")
        private String username;

        @NotBlank(message = "密码不能为空")
        @Size(min = 6, max = 64, message = "密码长度需在6-64之间")
        private String password;
    }

    @Data
    public static class LoginReq {
        @NotBlank(message = "用户名不能为空")
        private String username;
        @NotBlank(message = "密码不能为空")
        private String password;
    }

    @Data
    public static class LoginResp {
        private String token;
        private String username;
        private long expireHours;

        public LoginResp(String token, String username, long expireHours) {
            this.token = token;
            this.username = username;
            this.expireHours = expireHours;
        }
    }

    /** 当前登录账号资料 */
    @Data
    public static class ProfileResp {
        /** 登录用户名（不可改） */
        private String username;
        /** 显示名称，可能为空（前端回退用户名） */
        private String displayName;
        /** 头像 base64 data URL，可能为空 */
        private String avatar;

        public ProfileResp(String username, String displayName, String avatar) {
            this.username = username;
            this.displayName = displayName;
            this.avatar = avatar;
        }
    }

    @Data
    public static class UpdateProfileReq {
        @NotBlank(message = "用户名称不能为空")
        @Size(max = 32, message = "用户名称最长 32 字")
        private String displayName;

        /** base64 data URL；null 表示移除头像 */
        @Size(max = 700000, message = "头像过大，请选择 500KB 以内的图片")
        private String avatar;
    }

    @Data
    public static class ChangePasswordReq {
        @NotBlank(message = "原密码不能为空")
        private String oldPassword;

        @NotBlank(message = "新密码不能为空")
        @Size(min = 6, max = 64, message = "新密码长度需在6-64之间")
        private String newPassword;
    }
}
