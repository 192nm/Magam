package com.magam.beauty;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;

@Component
public class ApiProtectionFilter extends OncePerRequestFilter {
    private final String accessKey;
    private long windowStart = System.currentTimeMillis();
    private int requests;

    public ApiProtectionFilter(@Value("${magam.access-key}") String accessKey,
                               @Value("${magam.openai.api-key}") String apiKey, Environment environment) {
        this.accessKey = accessKey.strip();
        if (Arrays.asList(environment.getActiveProfiles()).contains("prod") && !apiKey.isBlank() && this.accessKey.isBlank()) {
            throw new IllegalStateException("APP_ACCESS_KEY must be configured for paid recognition in production.");
        }
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("Referrer-Policy", "same-origin");
        response.setHeader("X-Frame-Options", "DENY");
        if (!request.getRequestURI().startsWith("/api/")) { chain.doFilter(request, response); return; }
        response.setHeader("Cache-Control", "no-store");
        if (!"POST".equals(request.getMethod())) { chain.doFilter(request, response); return; }
        if (!"1".equals(request.getHeader("X-Magam-Client"))) {
            reject(response, 403, "허용되지 않은 요청입니다."); return;
        }
        if (request.getRequestURI().equals("/api/receipts/extract")) {
            String supplied = request.getHeader("X-Access-Key");
            if (!accessKey.isBlank() && (supplied == null || !MessageDigest.isEqual(accessKey.getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8)))) {
                reject(response, 401, "설정에서 올바른 서비스 접속 키를 입력해 주세요."); return;
            }
            if (!allowRecognition()) { response.setHeader("Retry-After", "60"); reject(response, 429, "요청이 많습니다. 1분 후 다시 시도해 주세요."); return; }
        }
        chain.doFilter(request, response);
    }

    private synchronized boolean allowRecognition() {
        long now = System.currentTimeMillis();
        if (now - windowStart >= 60_000) { windowStart = now; requests = 0; }
        return ++requests <= 20;
    }

    private void reject(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"message\":\"" + message + "\"}");
    }
}
