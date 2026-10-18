package com.stockez.api.module.tracking.service;

import com.stockez.api.module.tracking.entity.CustomerVisit;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

/** Plain values only — this crosses a transaction boundary, so no attached entities. */
@Data
@Builder
public class VisitStamp {
    private UUID tenantId;
    private UUID userId;
    private UUID customerId;
    private UUID routeAllocationId;
    private UUID orderId;
    private UUID paymentId;
    private CustomerVisit.Outcome outcome;
    private Double latitude;
    private Double longitude;
    private Double accuracyM;
    private Instant visitedAt;
    private String reason;
}
