package com.stockez.api.module.tracking.service;

import com.stockez.api.module.customer.entity.Customer;
import com.stockez.api.module.customer.repository.CustomerRepository;
import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.order.entity.Payment;
import com.stockez.api.module.order.repository.OrderRepository;
import com.stockez.api.module.order.repository.PaymentRepository;
import com.stockez.api.module.route.entity.RouteAllocation;
import com.stockez.api.module.route.repository.RouteAllocationRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.tracking.entity.CustomerVisit;
import com.stockez.api.module.tracking.entity.StaffLocation;
import com.stockez.api.module.tracking.repository.CustomerVisitRepository;
import com.stockez.api.module.tracking.repository.StaffLocationRepository;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import com.stockez.api.module.util.GeoUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Writes the visit row in its own transaction so that a failure here — a bad coordinate, a missing
 * row, anything — cannot roll back the sale or payment that triggered it. Billing must never depend
 * on tracking succeeding.
 */
@Service
@RequiredArgsConstructor
public class VisitWriter {

    /** Beyond this the visit is flagged rather than counted as verified at the shop. */
    static final int VERIFIED_RADIUS_M = 300;

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final CustomerVisitRepository visitRepository;
    private final StaffLocationRepository locationRepository;
    private final CustomerRepository customerRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final RouteAllocationRepository routeAllocationRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(VisitStamp s) {
        Customer customer = customerRepository.findById(s.getCustomerId()).orElse(null);
        if (customer == null) return;

        Tenant tenant = tenantRepository.getReferenceById(s.getTenantId());
        User user = userRepository.getReferenceById(s.getUserId());

        boolean gpsOk = GeoUtils.isValid(s.getLatitude(), s.getLongitude());
        boolean shopPinned = GeoUtils.isValid(customer.getLatitude(), customer.getLongitude());

        Integer distance = null;
        CustomerVisit.LocationStatus status;
        if (!gpsOk) {
            status = CustomerVisit.LocationStatus.GPS_UNAVAILABLE;
        } else if (!shopPinned) {
            status = CustomerVisit.LocationStatus.NO_SHOP_PIN;
        } else {
            distance = (int) Math.round(GeoUtils.haversineMeters(
                    s.getLatitude(), s.getLongitude(),
                    customer.getLatitude(), customer.getLongitude()));
            status = distance <= VERIFIED_RADIUS_M
                    ? CustomerVisit.LocationStatus.VERIFIED
                    : CustomerVisit.LocationStatus.FAR;
        }

        Instant now = s.getVisitedAt() != null ? s.getVisitedAt() : Instant.now();

        CustomerVisit visit = CustomerVisit.builder()
                .tenant(tenant)
                .user(user)
                .customer(customer)
                .visitDate(LocalDate.ofInstant(now, IST))
                .visitedAt(now)
                .outcome(s.getOutcome())
                .latitude(gpsOk ? s.getLatitude() : null)
                .longitude(gpsOk ? s.getLongitude() : null)
                .accuracyM(gpsOk ? s.getAccuracyM() : null)
                .distanceFromShopM(distance)
                .locationStatus(status)
                .reason(trim(s.getReason()))
                .build();

        if (s.getOrderId() != null) {
            visit.setOrder(orderRepository.getReferenceById(s.getOrderId()));
        }
        if (s.getPaymentId() != null) {
            visit.setPayment(paymentRepository.getReferenceById(s.getPaymentId()));
        }
        if (s.getRouteAllocationId() != null) {
            visit.setRouteAllocation(routeAllocationRepository.getReferenceById(s.getRouteAllocationId()));
        }

        visitRepository.save(visit);

        // The same fix also serves as a trail point, so a salesman who only ever opens the app to
        // bill still leaves a usable breadcrumb for the day.
        if (gpsOk) {
            locationRepository.save(StaffLocation.builder()
                    .tenant(tenant)
                    .user(user)
                    .recordedAt(now)
                    .latitude(s.getLatitude())
                    .longitude(s.getLongitude())
                    .accuracyM(s.getAccuracyM())
                    .source(StaffLocation.Source.ACTION)
                    .build());
        }
    }

    private String trim(String v) {
        if (v == null) return null;
        String t = v.trim();
        if (t.isEmpty()) return null;
        return t.length() > 200 ? t.substring(0, 200) : t;
    }
}
