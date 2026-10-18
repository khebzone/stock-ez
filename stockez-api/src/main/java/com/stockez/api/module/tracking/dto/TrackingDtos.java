package com.stockez.api.module.tracking.dto;

import com.stockez.api.module.tracking.entity.CustomerVisit;
import com.stockez.api.module.tracking.entity.StaffLocation;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class TrackingDtos {

    @Data
    public static class PingRequest {
        @NotNull @DecimalMin("-90")  @DecimalMax("90")  private Double latitude;
        @NotNull @DecimalMin("-180") @DecimalMax("180") private Double longitude;
        private Double accuracyM;
    }

    /**
     * Tells the client whether to keep pinging. Returning this instead of an error keeps a disabled
     * tenant from generating a stream of 4xx responses from every field phone.
     */
    @Data
    public static class PingResponse {
        private boolean accepted;
        private String reason;
        private int nextPingSeconds;
    }

    @Data
    public static class NoOrderVisitRequest {
        @NotNull private UUID customerId;
        private UUID routeAllocationId;
        private Double latitude;
        private Double longitude;
        private Double accuracyM;
        private String reason;
    }

    @Data
    public static class VisitResponse {
        private UUID id;
        private UUID customerId;
        private String customerName;
        private UUID userId;
        private String userName;
        private Instant visitedAt;
        private CustomerVisit.Outcome outcome;
        private Integer distanceFromShopM;
        private CustomerVisit.LocationStatus locationStatus;
        private Double latitude;
        private Double longitude;
        private String reason;
        private String orderNumber;
        private BigDecimal orderAmount;
    }

    @Data
    public static class TrailPoint {
        private Double latitude;
        private Double longitude;
        private Double accuracyM;
        private Instant recordedAt;
        private StaffLocation.Source source;
    }

    @Data
    public static class LiveStaffResponse {
        private UUID userId;
        private String fullName;
        private String dutyRole;
        private String routeName;
        private boolean checkedIn;
        private Double lastLatitude;
        private Double lastLongitude;
        private Instant lastSeenAt;
        private Long minutesSinceLastSeen;
        /** True when the last ping is older than the staleness window — phone locked, not necessarily idle. */
        private boolean stale;
        private int shopsVisited;
        private int shopsOnRoute;
        private int ordersPlaced;
        private int verifiedAtShop;
        private int flaggedFarFromShop;
    }

    @Data
    public static class LiveBoardResponse {
        private boolean trackingEnabled;
        private int stalenessMinutes;
        private List<LiveStaffResponse> staff;
    }

    @Data
    public static class StaffDayResponse {
        private UUID userId;
        private String fullName;
        private String routeName;
        private int shopsOnRoute;
        private int shopsVisited;
        private int verifiedAtShop;
        private int flaggedFarFromShop;
        private int noLocation;
        private List<TrailPoint> trail;
        private List<VisitResponse> visits;
    }

    @Data
    public static class TrackingSettingsRequest {
        private boolean locationTrackingEnabled;
        private Integer locationPingIntervalSeconds;
        private boolean trackOnlyWhenCheckedIn;
        private Integer locationRetentionDays;
    }

    @Data
    public static class TrackingSettingsResponse {
        private boolean locationTrackingEnabled;
        private int locationPingIntervalSeconds;
        private boolean trackOnlyWhenCheckedIn;
        private int locationRetentionDays;
    }
}
