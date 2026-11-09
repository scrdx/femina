package com.femina.controller;

import java.util.Collections;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.femina.common.R;
import com.femina.config.JwtInterceptor;
import com.femina.model.dto.AuthDtos.ChangePasswordReq;
import com.femina.model.dto.AuthDtos.LoginReq;
import com.femina.model.dto.AuthDtos.LoginResp;
import com.femina.model.dto.AuthDtos.ProfileResp;
import com.femina.model.dto.AuthDtos.SetupReq;
import com.femina.model.dto.AuthDtos.UpdateProfileReq;
import com.femina.service.AuthService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/status")
    public R<Map<String, Object>> status() {
        return R.ok(Collections.singletonMap("initialized", authService.isInitialized()));
    }

    @PostMapping("/setup")
    public R<Void> setup(@Valid @RequestBody SetupReq req) {
        authService.setup(req);
        return R.ok();
    }

    @PostMapping("/login")
    public R<LoginResp> login(@Valid @RequestBody LoginReq req) {
        return R.ok(authService.login(req));
    }

    @GetMapping("/me")
    public R<ProfileResp> me(HttpServletRequest request) {
        String username = (String) request.getAttribute(JwtInterceptor.ATTR_USERNAME);
        return R.ok(authService.getProfile(username));
    }

    @PutMapping("/profile")
    public R<Void> updateProfile(HttpServletRequest request, @Valid @RequestBody UpdateProfileReq req) {
        String username = (String) request.getAttribute(JwtInterceptor.ATTR_USERNAME);
        authService.updateProfile(username, req);
        return R.ok();
    }

    @PutMapping("/password")
    public R<Void> changePassword(HttpServletRequest request, @Valid @RequestBody ChangePasswordReq req) {
        String username = (String) request.getAttribute(JwtInterceptor.ATTR_USERNAME);
        authService.changePassword(username, req);
        return R.ok();
    }
}
