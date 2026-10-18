package com.stockez.api.security.filter;

import com.stockez.api.security.jwt.JwtService;
import com.stockez.api.security.service.StockEzUserDetailsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final StockEzUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        final String token = authHeader.substring(7);

        if (!jwtService.isTokenValid(token) || jwtService.isTokenExpired(token)) {
            filterChain.doFilter(request, response);
            return;
        }

        final String tokenTenantId = jwtService.extractTenantId(token);
        final String headerTenantId = request.getHeader("X-Tenant-Id");
        if (tokenTenantId != null
                && headerTenantId != null && !headerTenantId.isBlank()
                && !"SUPER_ADMIN".equals(jwtService.extractRole(token))
                && !tokenTenantId.equalsIgnoreCase(headerTenantId.trim())) {
            log.warn("Tenant mismatch: token tenant {} but header tenant {} on {} {}",
                    tokenTenantId, headerTenantId, request.getMethod(), request.getRequestURI());
            sendError(response, HttpServletResponse.SC_FORBIDDEN,
                    "TENANT_MISMATCH", "You do not have access to this company's data.");
            return;
        }

        final String phone = jwtService.extractPhone(token);
        final String userId = jwtService.extractUserId(token);

        if (userId != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserDetails userDetails = userDetailsService.loadByUserId(UUID.fromString(userId));
            List<SimpleGrantedAuthority> authorities = buildAuthorities(token);
            UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(userDetails, null, authorities);
            authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authToken);
            log.debug("Authenticated user: {} role: {}", phone, jwtService.extractRole(token));
        }

        String tenantStatus = jwtService.extractTenantStatus(token);
        if ("SUSPENDED".equals(tenantStatus)) {
            sendError(response, HttpServletResponse.SC_FORBIDDEN,
                    "TENANT_SUSPENDED", "Your account has been suspended. Please contact support.");
            return;
        }
        if ("READ_ONLY".equals(tenantStatus)) {
            String method = request.getMethod();
            if (!"GET".equals(method) && !"OPTIONS".equals(method)) {
                sendError(response, HttpServletResponse.SC_FORBIDDEN,
                        "TENANT_READ_ONLY", "Your subscription has expired. Please renew to continue.");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private List<SimpleGrantedAuthority> buildAuthorities(String token) {
        String role = jwtService.extractRole(token);

        if ("ADMIN".equals(role) || "SUPER_ADMIN".equals(role)) {
            return List.of(new SimpleGrantedAuthority("ROLE_" + role));
        }

        List<String> permissions = jwtService.extractPermissions(token);
        if (permissions.contains("ALL")) {
            return List.of(new SimpleGrantedAuthority("ROLE_ADMIN"));
        }

        return permissions.stream()
                .map(SimpleGrantedAuthority::new)
                .map(a -> (SimpleGrantedAuthority) a)
                .toList();
    }

    private void sendError(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write(String.format("{\"code\":\"%s\",\"message\":\"%s\"}", code, message));
    }
}
