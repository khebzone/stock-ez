package com.stockez.api.module.route.controller;

import com.stockez.api.module.route.dto.RouteDtos;
import com.stockez.api.module.route.service.RouteExcelService;
import com.stockez.api.module.route.service.RouteService;
import com.stockez.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/routes")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Routes", description = "Sales and delivery route management")
public class RouteController {

    private final RouteService routeService;
    private final RouteExcelService routeExcelService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Create a new route [ADMIN]")
    public ResponseEntity<ApiResponse<RouteDtos.RouteResponse>> create(
            @Valid @RequestBody RouteDtos.CreateRouteRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(routeService.createRoute(request, tenantId), "Route created"));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','SALES','DELIVERY')")
    @Operation(summary = "List all routes")
    public ResponseEntity<ApiResponse<List<RouteDtos.RouteResponse>>> list(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(routeService.getRoutes(tenantId)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SALES','DELIVERY')")
    @Operation(summary = "Get route by ID")
    public ResponseEntity<ApiResponse<RouteDtos.RouteResponse>> getById(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(routeService.getRouteById(id, tenantId)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Rename a route [ADMIN]")
    public ResponseEntity<ApiResponse<RouteDtos.RouteResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody RouteDtos.UpdateRouteRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(routeService.updateRoute(id, request, tenantId), "Route updated"));
    }

    @PutMapping("/{id}/places/{placeId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Rename a stop on a route [ADMIN]")
    public ResponseEntity<ApiResponse<RouteDtos.RoutePlaceResponse>> updatePlace(
            @PathVariable UUID id,
            @PathVariable UUID placeId,
            @Valid @RequestBody RouteDtos.UpdateRoutePlaceRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(routeService.updatePlace(id, placeId, request, tenantId), "Stop updated"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Delete (deactivate) a route [ADMIN]")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        routeService.deleteRoute(id, tenantId);
        return ResponseEntity.ok(ApiResponse.success(null, "Route deleted"));
    }

    @PostMapping("/{id}/places")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Add a place to route [ADMIN]")
    public ResponseEntity<ApiResponse<RouteDtos.RoutePlaceResponse>> addPlace(
            @PathVariable UUID id,
            @Valid @RequestBody RouteDtos.AddRoutePlaceRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(routeService.addPlace(id, request, tenantId), "Place added"));
    }

    @PutMapping("/{id}/places/reorder")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Reorder places within a route [ADMIN]")
    public ResponseEntity<ApiResponse<List<RouteDtos.RoutePlaceResponse>>> reorderPlaces(
            @PathVariable UUID id,
            @Valid @RequestBody RouteDtos.ReorderPlacesRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(routeService.reorderPlaces(id, request, tenantId), "Places reordered"));
    }

    @PostMapping("/{id}/assign")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Assign sales person to route [ADMIN]")
    public ResponseEntity<ApiResponse<RouteDtos.RouteResponse>> assign(
            @PathVariable UUID id,
            @Valid @RequestBody RouteDtos.AssignSalesPersonRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(routeService.assignSalesPerson(id, request, tenantId), "Sales person assigned"));
    }

    @GetMapping("/{id}/plan")
    @PreAuthorize("hasAnyRole('ADMIN','SALES','DELIVERY')")
    @Operation(summary = "Get beat plan for route — places and customers in visit order")
    public ResponseEntity<ApiResponse<RouteDtos.RoutePlanResponse>> getPlan(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(routeService.getRoutePlan(id, tenantId)));
    }

    @GetMapping("/{id}/export")
    @PreAuthorize("hasAnyRole('ADMIN','SALES','DELIVERY')")
    @Operation(summary = "Export route customers to Excel, ordered by stop")
    public ResponseEntity<byte[]> exportRoute(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) throws IOException {
        byte[] data = routeExcelService.exportRoute(id, tenantId);
        String filename = "route-customers-" + LocalDate.now() + ".xlsx";
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename).build().toString())
                .body(data);
    }

    @GetMapping("/export/all")
    @PreAuthorize("hasAnyRole('ADMIN','SALES','DELIVERY')")
    @Operation(summary = "Export all routes customers to Excel — one sheet per route")
    public ResponseEntity<byte[]> exportAllRoutes(
            @RequestHeader("X-Tenant-Id") UUID tenantId) throws IOException {
        byte[] data = routeExcelService.exportAllRoutes(tenantId);
        String filename = "all-routes-customers-" + LocalDate.now() + ".xlsx";
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename).build().toString())
                .body(data);
    }

    @GetMapping("/my-route")
    @PreAuthorize("hasRole('SALES')")
    @Operation(summary = "Get assigned route for current sales person [SALES]")
    public ResponseEntity<ApiResponse<RouteDtos.RouteResponse>> myRoute(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(routeService.getSalesPersonRoute(userId, tenantId)));
    }
}
