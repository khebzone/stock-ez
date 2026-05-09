package com.distroiq.api.module.route.service;

import com.distroiq.api.module.customer.entity.Customer;
import com.distroiq.api.module.customer.repository.CustomerRepository;
import com.distroiq.api.module.route.dto.RouteDtos;
import com.distroiq.api.module.route.entity.Route;
import com.distroiq.api.module.route.entity.RoutePlace;
import com.distroiq.api.module.route.repository.RoutePlaceRepository;
import com.distroiq.api.module.route.repository.RouteRepository;
import com.distroiq.api.module.tenant.entity.Tenant;
import com.distroiq.api.module.tenant.repository.TenantRepository;
import com.distroiq.api.module.user.entity.User;
import com.distroiq.api.module.user.repository.UserRepository;
import com.distroiq.common.exception.BusinessException;
import com.distroiq.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class RouteService {

    private final RouteRepository routeRepository;
    private final RoutePlaceRepository routePlaceRepository;
    private final CustomerRepository customerRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;

    public RouteDtos.RouteResponse createRoute(RouteDtos.CreateRouteRequest req, UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));

        Route route = Route.builder()
                .tenant(tenant)
                .name(req.getName())
                .description(req.getDescription())
                .build();

        return toResponse(routeRepository.save(route));
    }

    public RouteDtos.RouteResponse updateRoute(UUID routeId, RouteDtos.UpdateRouteRequest req, UUID tenantId) {
        Route route = routeRepository.findByIdAndTenantId(routeId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Route", routeId.toString()));
        route.setName(req.getName());
        if (req.getDescription() != null) route.setDescription(req.getDescription());
        return toResponse(routeRepository.save(route));
    }

    public RouteDtos.RoutePlaceResponse updatePlace(UUID routeId, UUID placeId, RouteDtos.UpdateRoutePlaceRequest req, UUID tenantId) {
        routeRepository.findByIdAndTenantId(routeId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Route", routeId.toString()));
        RoutePlace place = routePlaceRepository.findByIdAndRouteId(placeId, routeId)
                .orElseThrow(() -> new ResourceNotFoundException("RoutePlace", placeId.toString()));
        place.setName(req.getName());
        if (req.getDescription() != null) place.setDescription(req.getDescription());
        return toPlaceResponse(routePlaceRepository.save(place));
    }

    public RouteDtos.RoutePlaceResponse addPlace(UUID routeId, RouteDtos.AddRoutePlaceRequest req, UUID tenantId) {
        Route route = routeRepository.findByIdAndTenantId(routeId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Route", routeId.toString()));

        // Auto-assign next sort_order
        Integer maxOrder = routePlaceRepository.findMaxSortOrderByRouteId(routeId);
        int nextOrder = (maxOrder == null ? -1 : maxOrder) + 1;

        RoutePlace place = RoutePlace.builder()
                .route(route)
                .name(req.getName())
                .description(req.getDescription())
                .sortOrder(nextOrder)
                .build();

        RoutePlace saved = routePlaceRepository.save(place);
        return toPlaceResponse(saved);
    }

    /** Reorder places by providing their IDs in the desired sequence */
    public List<RouteDtos.RoutePlaceResponse> reorderPlaces(UUID routeId, RouteDtos.ReorderPlacesRequest req, UUID tenantId) {
        routeRepository.findByIdAndTenantId(routeId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Route", routeId.toString()));

        List<RouteDtos.RoutePlaceResponse> result = new ArrayList<>();
        for (int i = 0; i < req.getPlaceIds().size(); i++) {
            UUID placeId = req.getPlaceIds().get(i);
            RoutePlace place = routePlaceRepository.findByIdAndRouteId(placeId, routeId)
                    .orElseThrow(() -> new ResourceNotFoundException("RoutePlace", placeId.toString()));
            place.setSortOrder(i);
            result.add(toPlaceResponse(routePlaceRepository.save(place)));
        }
        return result;
    }

    public RouteDtos.RouteResponse assignSalesPerson(UUID routeId, RouteDtos.AssignSalesPersonRequest req, UUID tenantId) {
        Route route = routeRepository.findByIdAndTenantId(routeId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Route", routeId.toString()));

        User salesPerson = userRepository.findByIdAndTenantId(req.getSalesPersonId(), tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", req.getSalesPersonId().toString()));

        if (salesPerson.getRole() != User.UserRole.SALES) {
            throw new BusinessException("User is not a SALES person", "INVALID_ROLE");
        }

        route.setAssignedSalesPerson(salesPerson);
        return toResponse(routeRepository.save(route));
    }

    public void deleteRoute(UUID routeId, UUID tenantId) {
        Route route = routeRepository.findByIdAndTenantId(routeId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Route", routeId.toString()));

        long activeCustomers = customerRepository.countByRouteIdAndActiveTrue(routeId);
        if (activeCustomers > 0) {
            throw new BusinessException(
                "Cannot delete route — it has " + activeCustomers + " active customer(s). Move or deactivate customers first.",
                "ROUTE_HAS_CUSTOMERS"
            );
        }

        // Soft-delete: deactivate route and its places
        route.setActive(false);
        routeRepository.save(route);
        routePlaceRepository.findByRouteIdAndActiveTrueOrderBySortOrderAsc(routeId)
                .forEach(p -> { p.setActive(false); routePlaceRepository.save(p); });
    }

    @Transactional(readOnly = true)
    public List<RouteDtos.RouteResponse> getRoutes(UUID tenantId) {
        return routeRepository.findByTenantIdAndActiveTrue(tenantId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public RouteDtos.RouteResponse getRouteById(UUID id, UUID tenantId) {
        Route route = routeRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Route", id.toString()));
        return toResponse(route);
    }

    @Transactional(readOnly = true)
    public RouteDtos.RouteResponse getSalesPersonRoute(UUID salesPersonId, UUID tenantId) {
        Route route = routeRepository.findByTenantIdAndAssignedSalesPersonId(tenantId, salesPersonId)
                .orElseThrow(() -> new BusinessException("No route assigned to this sales person", "NO_ROUTE_ASSIGNED"));
        return toResponse(route);
    }

    /** Beat Plan: full route with places ordered by sort_order, each with customers ordered by visit_order */
    @Transactional(readOnly = true)
    public RouteDtos.RoutePlanResponse getRoutePlan(UUID routeId, UUID tenantId) {
        Route route = routeRepository.findByIdAndTenantId(routeId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Route", routeId.toString()));

        List<RoutePlace> places = routePlaceRepository.findByRouteIdAndActiveTrueOrderBySortOrderAsc(routeId);

        List<RouteDtos.PlacePlanEntry> planEntries = places.stream().map(place -> {
            List<Customer> customers = customerRepository
                    .findByTenantIdAndRoutePlaceIdAndActiveTrueOrderByVisitOrderAsc(tenantId, place.getId());

            List<RouteDtos.CustomerPlanEntry> custEntries = customers.stream().map(c -> {
                RouteDtos.CustomerPlanEntry ce = new RouteDtos.CustomerPlanEntry();
                ce.setId(c.getId());
                ce.setBusinessName(c.getBusinessName());
                ce.setOwnerName(c.getOwnerName());
                ce.setPhone(c.getPhone());
                ce.setAddress(c.getAddress());
                ce.setVisitOrder(c.getVisitOrder());
                ce.setLatitude(c.getLatitude());
                ce.setLongitude(c.getLongitude());
                return ce;
            }).collect(Collectors.toList());

            RouteDtos.PlacePlanEntry pe = new RouteDtos.PlacePlanEntry();
            pe.setId(place.getId());
            pe.setName(place.getName());
            pe.setSortOrder(place.getSortOrder());
            pe.setCustomers(custEntries);
            return pe;
        }).collect(Collectors.toList());

        RouteDtos.RoutePlanResponse plan = new RouteDtos.RoutePlanResponse();
        plan.setRouteId(route.getId());
        plan.setRouteName(route.getName());
        plan.setPlan(planEntries);

        if (route.getAssignedSalesPerson() != null) {
            RouteDtos.AssignedPersonSummary sp = new RouteDtos.AssignedPersonSummary();
            sp.setId(route.getAssignedSalesPerson().getId());
            sp.setFullName(route.getAssignedSalesPerson().getFullName());
            sp.setPhone(route.getAssignedSalesPerson().getPhone());
            plan.setAssignedSalesPerson(sp);
        }

        return plan;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private RouteDtos.RoutePlaceResponse toPlaceResponse(RoutePlace p) {
        RouteDtos.RoutePlaceResponse pr = new RouteDtos.RoutePlaceResponse();
        pr.setId(p.getId());
        pr.setName(p.getName());
        pr.setDescription(p.getDescription());
        pr.setSortOrder(p.getSortOrder());
        pr.setActive(p.isActive());
        return pr;
    }

    private RouteDtos.RouteResponse toResponse(Route r) {
        RouteDtos.RouteResponse res = new RouteDtos.RouteResponse();
        res.setId(r.getId());
        res.setName(r.getName());
        res.setDescription(r.getDescription());
        res.setActive(r.isActive());

        if (r.getAssignedSalesPerson() != null) {
            RouteDtos.AssignedPersonSummary sp = new RouteDtos.AssignedPersonSummary();
            sp.setId(r.getAssignedSalesPerson().getId());
            sp.setFullName(r.getAssignedSalesPerson().getFullName());
            sp.setPhone(r.getAssignedSalesPerson().getPhone());
            res.setAssignedSalesPerson(sp);
        }

        if (r.getPlaces() != null) {
            res.setPlaces(r.getPlaces().stream()
                    .filter(RoutePlace::isActive)
                    .sorted(java.util.Comparator.comparing(RoutePlace::getSortOrder))
                    .map(this::toPlaceResponse)
                    .collect(Collectors.toList()));
        }

        return res;
    }
}
