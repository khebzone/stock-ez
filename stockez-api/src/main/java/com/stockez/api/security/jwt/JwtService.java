package com.stockez.api.security.jwt;

import com.stockez.api.module.user.entity.User;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.HashMap;
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
        claims.put("type", "ACCESS");

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
