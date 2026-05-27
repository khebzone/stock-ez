package com.stockez.api.module.util;

import com.stockez.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/v1/util")
@Slf4j
public class LocationResolverController {

    // Matches !3dlat!4dlng inside the data= parameter — this is the ACTUAL place pin
    private static final Pattern DATA_3D_PATTERN =
        Pattern.compile("!3d(-?\\d+\\.\\d+)!4d(-?\\d+\\.\\d+)");

    // Matches /@lat,lng — this is the viewport center (less accurate, used as fallback)
    private static final Pattern AT_PATTERN =
        Pattern.compile("/@(-?\\d+\\.\\d+),(-?\\d+\\.\\d+)");

    // Matches ?q=lat,lng or &q=lat,lng
    private static final Pattern Q_PATTERN =
        Pattern.compile("[?&]q=(-?\\d+\\.\\d+),(-?\\d+\\.\\d+)");

    // Matches ll=lat,lng
    private static final Pattern LL_PATTERN =
        Pattern.compile("[?&]ll=(-?\\d+\\.\\d+),(-?\\d+\\.\\d+)");

    @GetMapping("/resolve-location")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Resolve a Google Maps URL (short or full) to lat/lng coordinates")
    public ResponseEntity<ApiResponse<Map<String, Double>>> resolveLocation(
            @RequestParam String url) {

        try {
            String finalUrl = followRedirects(url.trim(), 8);
            log.debug("Resolved URL: {}", finalUrl);

            double[] coords = extractCoords(finalUrl);
            if (coords == null) {
                return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Could not extract coordinates from this link. Try copying the full Google Maps URL.", "COORDS_NOT_FOUND"));
            }

            return ResponseEntity.ok(ApiResponse.success(
                Map.of("latitude", coords[0], "longitude", coords[1]),
                "Location resolved"
            ));
        } catch (Exception e) {
            log.warn("Failed to resolve location URL: {}", e.getMessage());
            return ResponseEntity.badRequest()
                .body(ApiResponse.error("Could not resolve the link. Please use GPS or enter coordinates manually.", "RESOLVE_FAILED"));
        }
    }

    /** Follow HTTP redirects up to maxHops times, return final URL */
    private String followRedirects(String urlStr, int maxHops) throws Exception {
        String current = urlStr;
        for (int i = 0; i < maxHops; i++) {
            HttpURLConnection conn = (HttpURLConnection) new URL(current).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setRequestProperty("User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36");
            conn.setRequestProperty("Accept", "text/html,application/xhtml+xml,*/*");

            int status = conn.getResponseCode();
            String location = conn.getHeaderField("Location");
            conn.disconnect();

            if (status >= 300 && status < 400 && location != null) {
                if (location.startsWith("/")) {
                    URL base = new URL(current);
                    current = base.getProtocol() + "://" + base.getHost() + location;
                } else {
                    current = location;
                }
            } else {
                break;
            }
        }
        return current;
    }

    private double[] extractCoords(String url) {
        // 1. !3dlat!4dlng — actual place pin inside data= parameter (highest priority)
        Matcher m = DATA_3D_PATTERN.matcher(url);
        if (m.find()) {
            return new double[]{Double.parseDouble(m.group(1)), Double.parseDouble(m.group(2))};
        }
        // 2. ?q=lat,lng — direct coordinate query
        m = Q_PATTERN.matcher(url);
        if (m.find()) {
            return new double[]{Double.parseDouble(m.group(1)), Double.parseDouble(m.group(2))};
        }
        // 3. ll=lat,lng
        m = LL_PATTERN.matcher(url);
        if (m.find()) {
            return new double[]{Double.parseDouble(m.group(1)), Double.parseDouble(m.group(2))};
        }
        // 4. /@lat,lng — viewport center, fallback only (less precise)
        m = AT_PATTERN.matcher(url);
        if (m.find()) {
            return new double[]{Double.parseDouble(m.group(1)), Double.parseDouble(m.group(2))};
        }
        return null;
    }
}
