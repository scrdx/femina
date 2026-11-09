package com.femina.service;

import org.apache.commons.lang3.StringUtils;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import com.femina.common.ApiException;
import com.femina.mapper.UserMapper;
import com.femina.model.SysUser;
import com.femina.model.dto.AuthDtos.ChangePasswordReq;
import com.femina.model.dto.AuthDtos.LoginReq;
import com.femina.model.dto.AuthDtos.LoginResp;
import com.femina.model.dto.AuthDtos.ProfileResp;
import com.femina.model.dto.AuthDtos.SetupReq;
import com.femina.model.dto.AuthDtos.UpdateProfileReq;
import com.femina.util.JwtUtil;

@Service
public class AuthService {

    private final UserMapper userMapper;
    private final JwtUtil jwtUtil;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public AuthService(UserMapper userMapper, JwtUtil jwtUtil) {
        this.userMapper = userMapper;
        this.jwtUtil = jwtUtil;
    }

    public boolean isInitialized() {
        return userMapper.countUsers() > 0;
    }

    /** 首次设置管理员账号，仅允许一次 */
    public void setup(SetupReq req) {
        if (isInitialized()) {
            throw ApiException.conflict("管理员账号已存在，不能重复初始化");
        }
        userMapper.insert(req.getUsername().trim(), encoder.encode(req.getPassword()));
    }

    public LoginResp login(LoginReq req) {
        SysUser user = userMapper.findAdmin();
        if (user == null || !encoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw ApiException.unauthorized("用户名或密码错误");
        }
        String token = jwtUtil.generate(user.getUsername());
        return new LoginResp(token, user.getUsername(), jwtUtil.getExpireHours());
    }

    public void changePassword(String username, ChangePasswordReq req) {
        SysUser user = requireAdmin();
        if (!encoder.matches(req.getOldPassword(), user.getPasswordHash())) {
            throw ApiException.badRequest("原密码不正确");
        }
        userMapper.updatePassword(user.getId(), encoder.encode(req.getNewPassword()));
    }

    public ProfileResp getProfile(String username) {
        SysUser user = requireAdmin();
        return new ProfileResp(user.getUsername(), user.getDisplayName(), user.getAvatar());
    }

    /** 更新显示名称与头像（头像存 base64 data URL，不落盘、不涉及用户媒体文件） */
    public void updateProfile(String username, UpdateProfileReq req) {
        SysUser user = requireAdmin();
        String avatar = StringUtils.trimToNull(req.getAvatar());
        if (avatar != null && !avatar.startsWith("data:image/")) {
            throw ApiException.badRequest("头像格式不正确，应为图片 data URL");
        }
        userMapper.updateProfile(user.getId(), req.getDisplayName().trim(), avatar);
    }

    private SysUser requireAdmin() {
        SysUser user = userMapper.findAdmin();
        if (user == null) {
            throw ApiException.notFound("管理员账号不存在");
        }
        return user;
    }
}
