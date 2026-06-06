package com.stockez.api.security.jwt;

import com.stockez.api.module.role.entity.Permission;
import com.stockez.api.module.user.entity.User;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Enterprise JWT Service — issues and validates access & refresh tokens.
 * Uses HMAC-SHA512 (HS512) with a configurable secret key.
 */
@Service
@Slf4j
public class JwtService {

    @Value("${stockez.security.jwt.secret}")
    private String jwtSecret;

    @Value("${stockez.security.jwt.access-token-expiry-ms}")
    private long accessTokenExpiryMs;

    @Value("${stockez.security.jwt.refresh-token-expiry-ms}")
    private long refreshTokenExpiryMs;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes());
    }

    /**
     * Generate ACCESS token (short-lived: 15 min).
     */
    public String generateAccessToken(User user) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", user.getId().toString());
        claims.put("tenantId", user.getTenant().getId().toString());
        claims.put("role", user.getRole().name());
        claims.put("tenantStatus", user.getTenant().getStatus().name());
        claims.put("plan", user.getTenant().getPlan() != null ? user.getTenant().getPlan().name() : "TRIAL");
        claims.put("type", "ACCESS");

        List<String> permissions;
        if (user.getRole() == User.UserRole.ADMIN || user.getRole() == User.UserRole.SUPER_ADMIN) {
            permissions = List.of("ALL");
        } else if (user.getCustomRole() != null) {
            permissions = user.getCustomRole().getPermissions().stream()
                    .map(Permission::name)
                    .sorted()
                    .toList();
        } else {
            permissions = List.of();
        }
        claims.put("permissions", permissions);

        return Jwts.builder()
                .claims(claims)
                .subject(user.getPhone())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + accessTokenExpiryMs))
                .signWith(getSigningKey(), Jwts.SIG.HS512)
                .compact();
    }

    /**
     * Generate REFRESH token (long-lived: 7 days).
     */
    public String generateRefreshToken(User user) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", user.getId().toString());
        claims.put("type", "REFRESH");

        return Jwts.builder()
                .claims(claims)
                .subject(user.getPhone())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + refreshTokenExpiryMs))
                .signWith(getSigningKey(), Jwts.SIG.HS512)
                .compact();
    }

    public Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String extractPhone(String token) {
        return extractAllClaims(token).getSubject();
    }

    public String extractTenantId(String token) {
        return (String) extractAllClaims(token).get("tenantId");
    }

    public String extractUserId(String token) {
        return (String) extractAllClaims(token).get("userId");
    }

    public String extractRole(String token) {
        return (String) extractAllClaims(token).get("role");
    }

    public String extractTenantStatus(String token) {
        return (String) extractAllClaims(token).get("tenantStatus");
    }

    @SuppressWarnings("unchecked")
    public List<String> extractPermissions(String token) {
        Object perms = extractAllClaims(token).get("permissions");
        if (perms instanceof List<?> list) {
            return (List<String>) list;
        }
        return List.of();
    }

    public boolean isTokenValid(String token) {
        try {
            extractAllClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Invalid JWT token: {}", e.getMessage());
            return false;
        }
    }

    public boolean isTokenExpired(String token) {
        try {
            return extractAllClaims(token).getExpiration().before(new Date());
        } catch (ExpiredJwtException e) {
            return true;
        }
    }
}
