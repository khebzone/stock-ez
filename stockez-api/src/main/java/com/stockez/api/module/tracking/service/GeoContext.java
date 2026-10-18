package com.stockez.api.module.tracking.service;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Reads the caller's device position off the request headers.
 *
 * Headers rather than request bodies because every billing path would otherwise need a new field in
 * its DTO, its controller and its frontend payload. The field app sets these once where it already
 * sets X-Tenant-Id, so orders, counter sales, payments and deliveries all carry a position without
 * any of those endpoints knowing about tracking.
 */
@Component
public class GeoContext {

    public static final String LAT_HEADER = "X-Geo-Lat";
    public static final String LNG_HEADER = "X-Geo-Lng";
    public static final String ACC_HEADER = "X-Geo-Acc";

    public record Position(Double latitude, Double longitude, Double accuracyM) {}

    private static final Position EMPTY = new Position(null, null, null);

    public Position current() {
        HttpServletRequest request = request();
        if (request == null) return EMPTY;
        Double lat = parse(request.getHeader(LAT_HEADER));
        Double lng = parse(request.getHeader(LNG_HEADER));
        if (lat == null || lng == null) return EMPTY;
        return new Position(lat, lng, parse(request.getHeader(ACC_HEADER)));
    }

    private HttpServletRequest request() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        return attributes instanceof ServletRequestAttributes servlet ? servlet.getRequest() : null;
    }

    private Double parse(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            double v = Double.parseDouble(raw.trim());
            return Double.isFinite(v) ? v : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
