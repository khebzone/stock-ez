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

        final String phone = jwtService.extractPhone(token);

        if (phone != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserDetails userDetails = userDetailsService.loadUserByUsername(phone);

            List<SimpleGrantedAuthority> authorities = buildAuthorities(token);

            UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(userDetails, null, authorities);
            authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

            SecurityContextHolder.getContext().setAuthentication(authToken);
            log.debug("Authenticated user: {} role: {}", phone, jwtService.extractRole(token));
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
}
