package com.stockez.api.module.tracking.service;

import com.stockez.api.module.attendance.repository.AttendanceRepository;
import com.stockez.api.module.customer.repository.CustomerRepository;
import com.stockez.api.module.route.entity.RouteAllocation;
import com.stockez.api.module.route.repository.RouteAllocationRepository;
import com.stockez.api.module.tenant.entity.TenantSettings;
import com.stockez.api.module.tenant.repository.TenantSettingsRepository;
import com.stockez.api.module.tracking.dto.TrackingDtos;
import com.stockez.api.module.tracking.entity.CustomerVisit;
import com.stockez.api.module.tracking.entity.StaffLocation;
import com.stockez.api.module.tracking.repository.CustomerVisitRepository;
import com.stockez.api.module.tracking.repository.StaffLocationRepository;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import com.stockez.api.module.util.GeoUtils;
import com.stockez.common.exception.BusinessException;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class TrackingService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final int MIN_STALENESS_MINUTES = 5;

    private final StaffLocationRepository locationRepository;
    private final CustomerVisitRepository visitRepository;
    private final TenantSettingsRepository settingsRepository;
    private final AttendanceRepository attendanceRepository;
    private final RouteAllocationRepository routeAllocationRepository;
    private final CustomerRepository customerRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final VisitWriter visitWriter;

    // -- Field side -----------------------------------------------------------

    public TrackingDtos.PingResponse recordPing(TrackingDtos.PingRequest req, UUID tenantId, UUID userId) {
        TenantSettings settings = settings(tenantId);
        TrackingDtos.PingResponse res = new TrackingDtos.PingResponse();
        res.setNextPingSeconds(settings.getLocationPingIntervalSeconds());

        if (!settings.isLocationTrackingEnabled()) {
            res.setAccepted(false);
            res.setReason("TRACKING_DISABLED");
            return res;
        }
        if (!GeoUtils.isValid(req.getLatitude(), req.getLongitude())) {
            res.setAccepted(false);
            res.setReason("INVALID_COORDINATES");
            return res;
        }
        if (settings.isTrackOnlyWhenCheckedIn() && !isOnDuty(tenantId, userId)) {
            res.setAccepted(false);
            res.setReason("NOT_CHECKED_IN");
            return res;
        }

        locationRepository.save(StaffLocation.builder()
                .tenant(tenantRepository.getReferenceById(tenantId))
                .user(userRepository.getReferenceById(userId))
                .recordedAt(Instant.now())
                .latitude(req.getLatitude())
                .longitude(req.getLongitude())
                .accuracyM(req.getAccuracyM())
                .source(StaffLocation.Source.FOREGROUND)
                .build());

        res.setAccepted(true);
        return res;
    }

    public void recordNoOrderVisit(TrackingDtos.NoOrderVisitRequest req, UUID tenantId, UUID userId) {
        if (!settings(tenantId).isLocationTrackingEnabled()) {
            throw new BusinessException("Visit tracking is turned off for this company",
                    "TRACKING_DISABLED");
        }
        visitWriter.write(VisitStamp.builder()
                .tenantId(tenantId)
                .userId(userId)
                .customerId(req.getCustomerId())
                .routeAllocationId(req.getRouteAllocationId())
                .outcome(CustomerVisit.Outcome.NO_ORDER)
                .latitude(req.getLatitude())
                .longitude(req.getLongitude())
                .accuracyM(req.getAccuracyM())
                .reason(req.getReason())
                .build());
    }

    @Transactional(readOnly = true)
    public List<UUID> visitedCustomerIdsToday(UUID tenantId, UUID userId) {
        return visitRepository.findVisitedCustomerIds(tenantId, userId, LocalDate.now(IST));
    }

    // -- Admin side -----------------------------------------------------------

    @Transactional(readOnly = true)
    public TrackingDtos.LiveBoardResponse getLiveBoard(UUID tenantId, LocalDate date) {
        TenantSettings settings = settings(tenantId);
        LocalDate day = date != null ? date : LocalDate.now(IST);
        int staleness = stalenessMinutes(settings);

        TrackingDtos.LiveBoardResponse board = new TrackingDtos.LiveBoardResponse();
        board.setTrackingEnabled(settings.isLocationTrackingEnabled());
        board.setStalenessMinutes(staleness);

        Map<UUID, TrackingDtos.LiveStaffResponse> byUser = new LinkedHashMap<>();
        for (RouteAllocation a : routeAllocationRepository
                .findByTenantIdAndAllocationDateOrderByRoute_Name(tenantId, day)) {
            long shops = a.getRoute() != null
                    ? customerRepository.countByRouteIdAndActiveTrue(a.getRoute().getId()) : 0;
            addDutyRow(byUser, a.getSalesPerson(), "Sales", a, shops);
            addDutyRow(byUser, a.getDeliveryPerson(), "Delivery", a, shops);
        }

        for (CustomerVisit v : visitRepository.findForDay(tenantId, day)) {
            TrackingDtos.LiveStaffResponse row = byUser.get(v.getUser().getId());
            if (row == null) {
                row = newRow(v.getUser(), "Field", null, 0);
                byUser.put(v.getUser().getId(), row);
            }
            row.setShopsVisited(row.getShopsVisited() + 1);
            if (v.getOutcome() == CustomerVisit.Outcome.ORDER_PLACED
                    || v.getOutcome() == CustomerVisit.Outcome.COUNTER_SALE) {
                row.setOrdersPlaced(row.getOrdersPlaced() + 1);
            }
            if (v.getLocationStatus() == CustomerVisit.LocationStatus.VERIFIED) {
                row.setVerifiedAtShop(row.getVerifiedAtShop() + 1);
            } else if (v.getLocationStatus() == CustomerVisit.LocationStatus.FAR) {
                row.setFlaggedFarFromShop(row.getFlaggedFarFromShop() + 1);
            }
        }

        Instant since = day.atStartOfDay(IST).toInstant();
        Instant now = Instant.now();
        for (Object[] r : locationRepository.findLatestPerUser(tenantId, since)) {
            UUID uid = (UUID) r[0];
            TrackingDtos.LiveStaffResponse row = byUser.get(uid);
            if (row == null) continue;
            row.setLastLatitude((Double) r[1]);
            row.setLastLongitude((Double) r[2]);
            Instant at = toInstant(r[4]);
            if (at == null) continue;
            row.setLastSeenAt(at);
            long mins = ChronoUnit.MINUTES.between(at, now);
            row.setMinutesSinceLastSeen(mins);
            row.setStale(mins > staleness);
        }

        for (TrackingDtos.LiveStaffResponse row : byUser.values()) {
            if (row.getLastSeenAt() == null) row.setStale(true);
            row.setCheckedIn(isOnDuty(tenantId, row.getUserId()));
        }

        board.setStaff(new ArrayList<>(byUser.values()));
        return board;
    }

    @Transactional(readOnly = true)
    public TrackingDtos.StaffDayResponse getStaffDay(UUID tenantId, UUID userId, LocalDate date) {
        LocalDate day = date != null ? date : LocalDate.now(IST);
        Instant from = day.atStartOfDay(IST).toInstant();
        Instant to = day.plusDays(1).atStartOfDay(IST).toInstant();

        TrackingDtos.StaffDayResponse res = new TrackingDtos.StaffDayResponse();
        res.setUserId(userId);

        RouteAllocation allocation = routeAllocationRepository
                .findByTenantIdAndSalesPersonIdAndAllocationDate(tenantId, userId, day)
                .stream().findFirst()
                .orElseGet(() -> routeAllocationRepository
                        .findByTenantIdAndDeliveryPersonIdAndAllocationDate(tenantId, userId, day)
                        .stream().findFirst().orElse(null));
        if (allocation != null && allocation.getRoute() != null) {
            res.setRouteName(allocation.getRoute().getName());
            res.setShopsOnRoute((int) customerRepository
                    .countByRouteIdAndActiveTrue(allocation.getRoute().getId()));
        }

        List<TrackingDtos.TrailPoint> trail = new ArrayList<>();
        for (StaffLocation p : locationRepository.findTrail(tenantId, userId, from, to)) {
            TrackingDtos.TrailPoint tp = new TrackingDtos.TrailPoint();
            tp.setLatitude(p.getLatitude());
            tp.setLongitude(p.getLongitude());
            tp.setAccuracyM(p.getAccuracyM());
            tp.setRecordedAt(p.getRecordedAt());
            tp.setSource(p.getSource());
            trail.add(tp);
        }
        res.setTrail(trail);

        List<TrackingDtos.VisitResponse> visits = new ArrayList<>();
        for (CustomerVisit v : visitRepository.findForDayAndUser(tenantId, day, userId)) {
            visits.add(toVisitResponse(v));
            if (res.getFullName() == null) res.setFullName(v.getUser().getFullName());
            switch (v.getLocationStatus()) {
                case VERIFIED -> res.setVerifiedAtShop(res.getVerifiedAtShop() + 1);
                case FAR -> res.setFlaggedFarFromShop(res.getFlaggedFarFromShop() + 1);
                default -> res.setNoLocation(res.getNoLocation() + 1);
            }
        }
        res.setVisits(visits);
        res.setShopsVisited(visits.size());
        if (res.getFullName() == null) {
            userRepository.findById(userId).ifPresent(u -> res.setFullName(u.getFullName()));
        }
        return res;
    }

    @Transactional(readOnly = true)
    public List<TrackingDtos.VisitResponse> getCustomerVisitHistory(UUID tenantId, UUID customerId) {
        return visitRepository.findRecentForCustomer(tenantId, customerId)
                .stream().map(this::toVisitResponse).toList();
    }

    // -- Settings -------------------------------------------------------------

    @Transactional(readOnly = true)
    public TrackingDtos.TrackingSettingsResponse getSettings(UUID tenantId) {
        return toSettingsResponse(settings(tenantId));
    }

    public TrackingDtos.TrackingSettingsResponse saveSettings(
            TrackingDtos.TrackingSettingsRequest req, UUID tenantId) {
        TenantSettings s = settings(tenantId);
        s.setLocationTrackingEnabled(req.isLocationTrackingEnabled());
        s.setTrackOnlyWhenCheckedIn(req.isTrackOnlyWhenCheckedIn());
        if (req.getLocationPingIntervalSeconds() != null) {
            s.setLocationPingIntervalSeconds(clamp(req.getLocationPingIntervalSeconds(), 30, 900));
        }
        if (req.getLocationRetentionDays() != null) {
            s.setLocationRetentionDays(clamp(req.getLocationRetentionDays(), 7, 730));
        }
        return toSettingsResponse(settingsRepository.save(s));
    }

    // -- Helpers --------------------------------------------------------------

    private TenantSettings settings(UUID tenantId) {
        return settingsRepository.findByTenantId(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("TenantSettings", tenantId.toString()));
    }

    /**
     * How long a marker may go quiet before it is shown as stale. Three missed pings, because one
     * missed ping is normal on a moving phone and would otherwise look like the staff stopped work.
     */
    private int stalenessMinutes(TenantSettings s) {
        return Math.max(MIN_STALENESS_MINUTES, (s.getLocationPingIntervalSeconds() * 3) / 60);
    }

    /**
     * A native query hands back whatever the JDBC driver chose for timestamptz, which has varied
     * across pgjdbc versions. A hard cast here would take the whole live board down on an upgrade,
     * so each shape the driver can return is handled.
     */
    private Instant toInstant(Object value) {
        if (value instanceof Timestamp ts) return ts.toInstant();
        if (value instanceof Instant instant) return instant;
        if (value instanceof OffsetDateTime odt) return odt.toInstant();
        if (value instanceof LocalDateTime ldt) return ldt.atZone(IST).toInstant();
        return null;
    }

    private boolean isOnDuty(UUID tenantId, UUID userId) {
        return attendanceRepository
                .findByTenantIdAndUserIdAndAttendanceDate(tenantId, userId, LocalDate.now(IST))
                .map(a -> a.getCheckInTime() != null && a.getCheckOutTime() == null)
                .orElse(false);
    }

    private void addDutyRow(Map<UUID, TrackingDtos.LiveStaffResponse> byUser,
                            User user, String dutyRole, RouteAllocation a, long shops) {
        if (user == null) return;
        TrackingDtos.LiveStaffResponse existing = byUser.get(user.getId());
        if (existing != null) {
            if (!existing.getDutyRole().contains(dutyRole)) {
                existing.setDutyRole(existing.getDutyRole() + " + " + dutyRole);
            }
            return;
        }
        byUser.put(user.getId(), newRow(user, dutyRole,
                a.getRoute() != null ? a.getRoute().getName() : null, shops));
    }

    private TrackingDtos.LiveStaffResponse newRow(User user, String dutyRole, String routeName, long shops) {
        TrackingDtos.LiveStaffResponse row = new TrackingDtos.LiveStaffResponse();
        row.setUserId(user.getId());
        row.setFullName(user.getFullName());
        row.setDutyRole(dutyRole);
        row.setRouteName(routeName);
        row.setShopsOnRoute((int) shops);
        return row;
    }

    private TrackingDtos.VisitResponse toVisitResponse(CustomerVisit v) {
        TrackingDtos.VisitResponse r = new TrackingDtos.VisitResponse();
        r.setId(v.getId());
        r.setCustomerId(v.getCustomer().getId());
        r.setCustomerName(v.getCustomer().getBusinessName());
        r.setUserId(v.getUser().getId());
        r.setUserName(v.getUser().getFullName());
        r.setVisitedAt(v.getVisitedAt());
        r.setOutcome(v.getOutcome());
        r.setDistanceFromShopM(v.getDistanceFromShopM());
        r.setLocationStatus(v.getLocationStatus());
        r.setLatitude(v.getLatitude());
        r.setLongitude(v.getLongitude());
        r.setReason(v.getReason());
        if (v.getOrder() != null) {
            r.setOrderNumber(v.getOrder().getOrderNumber());
            r.setOrderAmount(v.getOrder().getTotalAmount());
        }
        return r;
    }

    private TrackingDtos.TrackingSettingsResponse toSettingsResponse(TenantSettings s) {
        TrackingDtos.TrackingSettingsResponse r = new TrackingDtos.TrackingSettingsResponse();
        r.setLocationTrackingEnabled(s.isLocationTrackingEnabled());
        r.setLocationPingIntervalSeconds(s.getLocationPingIntervalSeconds());
        r.setTrackOnlyWhenCheckedIn(s.isTrackOnlyWhenCheckedIn());
        r.setLocationRetentionDays(s.getLocationRetentionDays());
        return r;
    }

    private int clamp(int v, int min, int max) {
        return Math.max(min, Math.min(max, v));
    }
}
