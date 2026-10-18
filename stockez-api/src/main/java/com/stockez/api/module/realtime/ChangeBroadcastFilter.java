package com.stockez.api.module.realtime;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;

/**
 * Announces every successful write so other open screens refetch. It runs after the request has
 * completed, so the transaction has already committed by the time anyone is told to reload.
 */
@Component
@RequiredArgsConstructor
public class ChangeBroadcastFilter extends OncePerRequestFilter {

    private static final Set<String> WRITE_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    /** Writes that happen constantly or change nothing another screen shows. */
    private static final String[] IGNORED_PREFIXES = {
            "/api/v1/auth/", "/api/v1/events/", "/api/v1/tracking/ping",
    };

    private final RealtimeService realtimeService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        chain.doFilter(request, response);

        if (!WRITE_METHODS.contains(request.getMethod())) return;
        int status = response.getStatus();
        if (status < 200 || status >= 300) return;

        String path = request.getRequestURI();
        if (!path.startsWith("/api/v1/")) return;
        for (String prefix : IGNORED_PREFIXES) {
            if (path.startsWith(prefix)) return;
        }

        String tenant = request.getHeader("X-Tenant-Id");
        if (tenant == null || tenant.isBlank()) return;
        try {
            realtimeService.publish(UUID.fromString(tenant.trim()), request.getHeader("X-Client-Id"));
        } catch (IllegalArgumentException ignored) {
            // malformed tenant header — nothing to notify
        }
    }
}
