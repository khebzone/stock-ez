package com.distroiq.api.module.route.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.util.List;
import java.util.UUID;

public class RouteDtos {

    @Data
    public static class CreateRouteRequest {
        @NotBlank(message = "Route name is required")
        @Size(min = 2, max = 100, message = "Route name must be between 2 and 100 characters")
        @Pattern(regexp = "[a-zA-Z\\s\\-\\.]+", message = "Route name must contain only letters, spaces or hyphens — no numbers or special characters")
        private String name;
        @Size(max = 500)
        private String description;
    }

    @Data
    public static class AddRoutePlaceRequest {
        @NotBlank(message = "Stop name is required")
        @Size(min = 2, max = 100, message = "Stop name must be between 2 and 100 characters")
        @Pattern(regexp = "[a-zA-Z\\s\\-\\.]+", message = "Stop name must contain only letters, spaces or hyphens — no numbers or special characters")
        private String name;
        @Size(max = 500)
        private String description;
    }

    @Data
    public static class UpdateRouteRequest {
        @NotBlank(message = "Route name is required")
        @Size(min = 2, max = 100, message = "Route name must be between 2 and 100 characters")
        @Pattern(regexp = "[a-zA-Z\\s\\-\\.]+", message = "Route name must contain only letters, spaces or hyphens — no numbers or special characters")
        private String name;
        @Size(max = 500)
        private String description;
    }

    @Data
    public static class UpdateRoutePlaceRequest {
        @NotBlank(message = "Stop name is required")
        @Size(min = 2, max = 100, message = "Stop name must be between 2 and 100 characters")
        @Pattern(regexp = "[a-zA-Z\\s\\-\\.]+", message = "Stop name must contain only letters, spaces or hyphens — no numbers or special characters")
        private String name;
        @Size(max = 500)
        private String description;
    }

    @Data
    public static class AssignSalesPersonRequest {
        @NotNull(message = "Sales person ID is required")
        private UUID salesPersonId;
    }

    /** Reorder places: send ordered list of place IDs */
    @Data
    public static class ReorderPlacesRequest {
        @NotNull
        private List<UUID> placeIds;
    }

    @Data
    public static class RoutePlaceResponse {
        private UUID id;
        private String name;
        private String description;
        private Integer sortOrder;
        private boolean active;
    }

    @Data
    public static class RouteResponse {
        private UUID id;
        private String name;
        private String description;
        private boolean active;
        private AssignedPersonSummary assignedSalesPerson;
        private List<RoutePlaceResponse> places;
    }

    @Data
    public static class AssignedPersonSummary {
        private UUID id;
        private String fullName;
        private String phone;
    }

    // ── Route Plan (Beat Plan) ──────────────────────────────────────────────

    @Data
    public static class CustomerPlanEntry {
        private UUID id;
        private String businessName;
        private String ownerName;
        private String phone;
        private String address;
        private Integer visitOrder;
        private Double latitude;
        private Double longitude;
    }

    @Data
    public static class PlacePlanEntry {
        private UUID id;
        private String name;
        private Integer sortOrder;
        private List<CustomerPlanEntry> customers;
    }

    @Data
    public static class RoutePlanResponse {
        private UUID routeId;
        private String routeName;
        private AssignedPersonSummary assignedSalesPerson;
        private List<PlacePlanEntry> plan;
    }
}
