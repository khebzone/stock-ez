package com.stockez.api.module.route.service;

import com.stockez.api.module.audit.service.AuditService;
import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.order.entity.Payment;
import com.stockez.api.module.order.repository.OrderRepository;
import com.stockez.api.module.order.repository.PaymentRepository;
import com.stockez.api.module.route.dto.RouteAllocationDtos;
import com.stockez.api.module.route.entity.Route;
import com.stockez.api.module.route.entity.RouteAllocation;
import com.stockez.api.module.route.repository.RouteAllocationRepository;
import com.stockez.api.module.route.repository.RouteRepository;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import com.stockez.api.module.vehicle.entity.Vehicle;
import com.stockez.api.module.vehicle.repository.VehicleRepository;
import com.stockez.common.exception.BusinessException;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class RouteAllocationService {

    private final RouteAllocationRepository allocationRepository;
    private final RouteRepository routeRepository;
    private final UserRepository userRepository;
    private final VehicleRepository vehicleRepository;
    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final AuditService auditService;

    public RouteAllocationDtos.RouteAllocationResponse allocateSales(
            RouteAllocationDtos.AllocateSalesRequest req, UUID tenantId) {

        RouteAllocation allocation = findOrCreate(req.getRouteId(), req.getAllocationDate(), tenantId);

        if (req.getSalesPersonId() != null) {
            User sp = userRepository.findByIdAndTenantId(req.getSalesPersonId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("User", req.getSalesPersonId().toString()));
            checkSalesPersonConflict(tenantId, sp, req.getAllocationDate(), allocation.getId());
            allocation.setSalesPerson(sp);
            // A fresh assignment is an active run, not a leftover completed one from
            // before this person (or a predecessor) was assigned to this route/date.
            allocation.setSalesCompleted(false);
        } else {
            allocation.setSalesPerson(null);
        }

        if (req.getSalesVehicleId() != null) {
            Vehicle v = vehicleRepository.findByIdAndTenantId(req.getSalesVehicleId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Vehicle", req.getSalesVehicleId().toString()));
            checkSalesVehicleConflict(tenantId, v, req.getAllocationDate(), allocation.getId());
            allocation.setSalesVehicle(v);
        } else {
            allocation.setSalesVehicle(null);
        }

        if (req.getSalesStartKm() != null) allocation.setSalesStartKm(req.getSalesStartKm());
        if (req.getSalesEndKm() != null) allocation.setSalesEndKm(req.getSalesEndKm());
        if (req.getNotes() != null) allocation.setNotes(req.getNotes());

        RouteAllocation saved = allocationRepository.save(allocation);
        auditService.record(tenantId, "ROUTE_ALLOCATION", saved.getId(), "SALES_ASSIGNED",
                "Sales Gate Pass for " + saved.getRoute().getName() + " on " + saved.getAllocationDate() + " — "
                        + (saved.getSalesPerson() != null ? "assigned to " + saved.getSalesPerson().getFullName() : "sales person cleared"));
        return toResponse(saved);
    }

    public RouteAllocationDtos.RouteAllocationResponse allocateDelivery(
            RouteAllocationDtos.AllocateDeliveryRequest req, UUID tenantId) {

        RouteAllocation allocation = findOrCreate(req.getRouteId(), req.getAllocationDate(), tenantId);

        if (req.getDeliveryPersonId() != null) {
            User dp = userRepository.findByIdAndTenantId(req.getDeliveryPersonId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("User", req.getDeliveryPersonId().toString()));
            checkDeliveryPersonConflict(tenantId, dp, req.getAllocationDate(), allocation.getId());
            allocation.setDeliveryPerson(dp);
            // A fresh assignment is an active run, not a leftover completed one from
            // before this person (or a predecessor) was assigned to this route/date.
            allocation.setDeliveryCompleted(false);
        } else {
            allocation.setDeliveryPerson(null);
        }

        if (req.getDeliveryVehicleId() != null) {
            Vehicle v = vehicleRepository.findByIdAndTenantId(req.getDeliveryVehicleId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Vehicle", req.getDeliveryVehicleId().toString()));
            checkDeliveryVehicleConflict(tenantId, v, req.getAllocationDate(), allocation.getId());
            allocation.setDeliveryVehicle(v);
        } else {
            allocation.setDeliveryVehicle(null);
        }

        if (req.getDeliveryStartKm() != null) allocation.setDeliveryStartKm(req.getDeliveryStartKm());
        if (req.getDeliveryEndKm() != null) allocation.setDeliveryEndKm(req.getDeliveryEndKm());
        if (req.getNotes() != null) allocation.setNotes(req.getNotes());

        RouteAllocation saved = allocationRepository.save(allocation);
        auditService.record(tenantId, "ROUTE_ALLOCATION", saved.getId(), "DELIVERY_ASSIGNED",
                "Delivery Gate Pass for " + saved.getRoute().getName() + " on " + saved.getAllocationDate() + " — "
                        + (saved.getDeliveryPerson() != null ? "assigned to " + saved.getDeliveryPerson().getFullName() : "delivery person cleared"));

        // Stamp today's snapshot: PACKED orders not yet stamped into any run, and any
        // DISPATCHED order on this route not already stamped to THIS allocation (covers
        // orders that were never assigned, and leftover/overdue ones carried over from a
        // prior day's allocation) get pulled into this assignment. A PACKED order that
        // arrives after this moment stays unstamped and invisible to the delivery person
        // until an admin explicitly re-Assigns (later today to top up this run, or on a
        // future day's gate pass).
        if (req.getDeliveryPersonId() != null) {
            List<Order> toStamp = orderRepository.findByTenantIdAndStatusInAndRouteIdAndNotStampedToAllocation(
                    tenantId, List.of(Order.OrderStatus.PACKED, Order.OrderStatus.DISPATCHED),
                    req.getRouteId(), saved.getId());
            if (!toStamp.isEmpty()) {
                toStamp.forEach(o -> o.setRouteAllocation(saved));
                orderRepository.saveAll(toStamp);
            }
        }

        return toResponse(saved);
    }

    public RouteAllocationDtos.RouteAllocationResponse markSalesComplete(UUID id, UUID tenantId) {
        RouteAllocation allocation = getAllocationForTenant(id, tenantId);
        if (allocation.isSalesCompleted())
            throw new BusinessException("Sales trip is already completed", "ALREADY_COMPLETED");
        allocation.setSalesCompleted(true);
        RouteAllocation saved = allocationRepository.save(allocation);
        auditService.record(tenantId, "ROUTE_ALLOCATION", saved.getId(), "SALES_COMPLETED_MANUAL",
                "Sales Gate Pass for " + saved.getRoute().getName() + " on " + saved.getAllocationDate() + " marked complete manually");
        return toResponse(saved);
    }

    public RouteAllocationDtos.RouteAllocationResponse markDeliveryComplete(UUID id, UUID tenantId, boolean force) {
        RouteAllocation allocation = getAllocationForTenant(id, tenantId);
        if (allocation.isDeliveryCompleted())
            throw new BusinessException("Delivery run is already completed", "ALREADY_COMPLETED");
        long pending = orderRepository.countRunOrdersByStatus(tenantId, id, Order.OrderStatus.DISPATCHED);
        if (pending > 0 && !force)
            throw new BusinessException(pending + " order(s) on this run are still undelivered", "PENDING_DELIVERIES");
        snapshotAndComplete(allocation, false, tenantId);
        return toResponse(allocation);
    }

    /**
     * End-of-day sweep: any gate pass from a past date still marked active gets auto-completed.
     * Sales/warehouse have no natural "all done" signal, so this closes yesterday's leftovers
     * (that nobody clicked Complete on); delivery runs are snapshotted with any pending count.
     */
    @org.springframework.scheduling.annotation.Scheduled(cron = "0 30 1 * * *")
    @org.springframework.transaction.annotation.Transactional
    public void autoCompleteStaleGatePasses() {
        List<RouteAllocation> stale = allocationRepository.findStaleActive(java.time.LocalDate.now());
        for (RouteAllocation a : stale) {
            UUID tenantId = a.getTenant().getId();
            if (a.getSalesPerson() != null && !a.isSalesCompleted()) {
                a.setSalesCompleted(true);
                auditService.record(tenantId, "ROUTE_ALLOCATION", a.getId(), "SALES_COMPLETED_AUTO",
                        "Sales Gate Pass for " + a.getRoute().getName() + " on " + a.getAllocationDate() + " auto-completed at end of day");
            }
            if (a.getWarehousePerson() != null && !a.isWarehouseCompleted()) {
                a.setWarehouseCompleted(true);
                auditService.record(tenantId, "ROUTE_ALLOCATION", a.getId(), "WAREHOUSE_COMPLETED_AUTO",
                        "Warehouse Gate Pass for " + a.getRoute().getName() + " on " + a.getAllocationDate() + " auto-completed at end of day");
            }
            if (a.getDeliveryPerson() != null && !a.isDeliveryCompleted()) {
                snapshotAndComplete(a, true, tenantId); // saves + audits
            } else {
                allocationRepository.save(a);
            }
        }
    }

    /** Auto-complete a delivery run once its last dispatched order is delivered. */
    public void autoCompleteDeliveryIfDone(UUID allocationId, UUID tenantId) {
        RouteAllocation alloc = allocationRepository.findById(allocationId).orElse(null);
        if (alloc == null || !alloc.getTenant().getId().equals(tenantId)) return;
        if (alloc.isDeliveryCompleted() || alloc.getDeliveryPerson() == null) return;
        if (orderRepository.countRunOrdersByStatus(tenantId, allocationId, Order.OrderStatus.DISPATCHED) > 0) return;
        if (orderRepository.countRunOrdersByStatus(tenantId, allocationId, Order.OrderStatus.DELIVERED) == 0) return;
        snapshotAndComplete(alloc, true, tenantId);
    }

    private void snapshotAndComplete(RouteAllocation alloc, boolean auto, UUID tenantId) {
        UUID allocId = alloc.getId();
        long total     = orderRepository.countRunOrders(tenantId, allocId, Order.OrderStatus.CANCELLED);
        long delivered = orderRepository.countRunOrdersByStatus(tenantId, allocId, Order.OrderStatus.DELIVERED);
        long pending   = orderRepository.countRunOrdersByStatus(tenantId, allocId, Order.OrderStatus.DISPATCHED);
        alloc.setDeliveryCompleted(true);
        alloc.setDeliveryCompletedAt(java.time.Instant.now());
        alloc.setDeliveryDeliveredCount((int) delivered);
        alloc.setDeliveryPendingCount((int) pending);
        alloc.setDeliveryTotalCount((int) total);
        allocationRepository.save(alloc);
        auditService.record(tenantId, "ROUTE_ALLOCATION", allocId,
                auto ? "DELIVERY_COMPLETED_AUTO" : "DELIVERY_COMPLETED_MANUAL",
                "Delivery Gate Pass for " + alloc.getRoute().getName() + " on " + alloc.getAllocationDate()
                        + (auto ? " auto-completed" : " marked complete") + " — " + delivered + " of " + total + " delivered"
                        + (pending > 0 ? ", " + pending + " still undelivered" : ""));
    }

    public RouteAllocationDtos.RouteAllocationResponse markWarehouseComplete(UUID id, UUID tenantId) {
        RouteAllocation allocation = getAllocationForTenant(id, tenantId);
        if (allocation.isWarehouseCompleted())
            throw new BusinessException("Warehouse task is already completed", "ALREADY_COMPLETED");
        allocation.setWarehouseCompleted(true);
        RouteAllocation saved = allocationRepository.save(allocation);
        auditService.record(tenantId, "ROUTE_ALLOCATION", saved.getId(), "WAREHOUSE_COMPLETED_MANUAL",
                "Warehouse Gate Pass for " + saved.getRoute().getName() + " on " + saved.getAllocationDate() + " marked complete manually");
        return toResponse(saved);
    }

    private RouteAllocation getAllocationForTenant(UUID id, UUID tenantId) {
        RouteAllocation allocation = allocationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("RouteAllocation", id.toString()));
        if (!allocation.getTenant().getId().equals(tenantId))
            throw new ResourceNotFoundException("RouteAllocation", id.toString());
        return allocation;
    }

    public int dispatchPackedOrders(UUID allocationId, UUID tenantId) {
        RouteAllocation allocation = allocationRepository.findById(allocationId)
                .orElseThrow(() -> new ResourceNotFoundException("RouteAllocation", allocationId.toString()));
        if (allocation.getDeliveryPerson() == null)
            throw new BusinessException("No delivery person assigned to this route", "NO_DELIVERY_PERSON");
        // Only orders stamped into THIS run — not every packed order on the route, which
        // could include orders packed later that were never Assigned to this delivery person.
        List<Order> packed = orderRepository.findByTenantIdAndStatusAndRouteAllocationId(
                tenantId, Order.OrderStatus.PACKED, allocationId);
        java.time.Instant now = java.time.Instant.now();
        packed.forEach(o -> {
            o.setStatus(Order.OrderStatus.DISPATCHED);
            o.setDispatchedAt(now);
        });
        if (!packed.isEmpty()) {
            orderRepository.saveAll(packed);
            String driver = allocation.getDeliveryPerson().getFullName();
            String routeName = allocation.getRoute().getName();
            packed.forEach(o -> auditService.record(tenantId, "ORDER", o.getId(), "DISPATCHED",
                    "Order " + o.getOrderNumber() + " dispatched with the delivery run on " + routeName + " \u2014 " + driver));
        }
        return packed.size();
    }

    public RouteAllocationDtos.RouteAllocationResponse allocateWarehouse(
            RouteAllocationDtos.AllocateWarehouseRequest req, UUID tenantId) {

        RouteAllocation allocation = findOrCreate(req.getRouteId(), req.getAllocationDate(), tenantId);

        if (req.getWarehousePersonId() != null) {
            User wp = userRepository.findByIdAndTenantId(req.getWarehousePersonId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("User", req.getWarehousePersonId().toString()));
            if (allocationRepository.isWarehousePersonAllocatedOnDate(tenantId, wp.getId(), req.getAllocationDate(), allocation.getId())) {
                throw new BusinessException(
                    wp.getFullName() + " is already assigned to a warehouse route on " + req.getAllocationDate() + ".",
                    "WAREHOUSE_PERSON_ALREADY_ALLOCATED"
                );
            }
            allocation.setWarehousePerson(wp);
            // A fresh assignment is an active run, not a leftover completed one from
            // before this person (or a predecessor) was assigned to this route/date.
            allocation.setWarehouseCompleted(false);
        } else {
            allocation.setWarehousePerson(null);
        }

        RouteAllocation saved = allocationRepository.save(allocation);
        auditService.record(tenantId, "ROUTE_ALLOCATION", saved.getId(), "WAREHOUSE_ASSIGNED",
                "Warehouse Gate Pass for " + saved.getRoute().getName() + " on " + saved.getAllocationDate() + " — "
                        + (saved.getWarehousePerson() != null ? "assigned to " + saved.getWarehousePerson().getFullName() : "warehouse person cleared"));
        return toResponse(saved);
    }

    public RouteAllocationDtos.RouteAllocationResponse allocateRoute(
            RouteAllocationDtos.AllocateRouteRequest req, UUID tenantId) {

        RouteAllocation allocation = findOrCreate(req.getRouteId(), req.getAllocationDate(), tenantId);

        if (req.getSalesPersonId() != null) {
            allocation.setSalesPerson(userRepository.findByIdAndTenantId(req.getSalesPersonId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("User", req.getSalesPersonId().toString())));
        }
        if (req.getDeliveryPersonId() != null) {
            User dp = userRepository.findByIdAndTenantId(req.getDeliveryPersonId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("User", req.getDeliveryPersonId().toString()));
            checkDeliveryPersonConflict(tenantId, dp, req.getAllocationDate(), allocation.getId());
            allocation.setDeliveryPerson(dp);
            allocation.setDeliveryCompleted(false);
        }
        if (req.getSalesPersonId() != null) {
            User sp = userRepository.findByIdAndTenantId(req.getSalesPersonId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("User", req.getSalesPersonId().toString()));
            checkSalesPersonConflict(tenantId, sp, req.getAllocationDate(), allocation.getId());
            allocation.setSalesPerson(sp);
            allocation.setSalesCompleted(false);
        }
        if (req.getSalesVehicleId() != null && req.getDeliveryVehicleId() != null
                && req.getSalesVehicleId().equals(req.getDeliveryVehicleId())) {
            throw new BusinessException(
                "Sales vehicle and delivery vehicle cannot be the same vehicle.",
                "SAME_VEHICLE_CONFLICT"
            );
        }
        if (req.getSalesVehicleId() != null) {
            Vehicle sv = vehicleRepository.findByIdAndTenantId(req.getSalesVehicleId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Vehicle", req.getSalesVehicleId().toString()));
            checkSalesVehicleConflict(tenantId, sv, req.getAllocationDate(), allocation.getId());
            allocation.setSalesVehicle(sv);
        }
        if (req.getDeliveryVehicleId() != null) {
            Vehicle dv = vehicleRepository.findByIdAndTenantId(req.getDeliveryVehicleId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Vehicle", req.getDeliveryVehicleId().toString()));
            checkDeliveryVehicleConflict(tenantId, dv, req.getAllocationDate(), allocation.getId());
            allocation.setDeliveryVehicle(dv);
        }
        if (req.getSalesStartKm() != null)    allocation.setSalesStartKm(req.getSalesStartKm());
        if (req.getSalesEndKm() != null)      allocation.setSalesEndKm(req.getSalesEndKm());
        if (req.getDeliveryStartKm() != null) allocation.setDeliveryStartKm(req.getDeliveryStartKm());
        if (req.getDeliveryEndKm() != null)   allocation.setDeliveryEndKm(req.getDeliveryEndKm());
        if (req.getNotes() != null)           allocation.setNotes(req.getNotes());

        return toResponse(allocationRepository.save(allocation));
    }

    @Transactional(readOnly = true)
    public RouteAllocationDtos.DailyAllocationSummary getAllocationsForDate(UUID tenantId, LocalDate date) {
        List<RouteAllocation> allocations = allocationRepository
                .findByTenantIdAndAllocationDateOrderByRoute_Name(tenantId, date);
        RouteAllocationDtos.DailyAllocationSummary summary = new RouteAllocationDtos.DailyAllocationSummary();
        summary.setDate(date);
        summary.setAllocations(allocations.stream().map(this::toResponse).collect(Collectors.toList()));
        return summary;
    }

    /** How many days back a Gate Pass remains selectable for Counter Sale attribution. */
    private static final int GATE_PASS_LOOKBACK_DAYS = 7;

    /**
     * Today's and recent (last {@value #GATE_PASS_LOOKBACK_DAYS} days) sales Gate Passes,
     * offered as Counter Sale attribution options — so a bill for something a customer asked
     * about on an earlier route run can still be linked, not just today's. seeAll=false scopes
     * the list to the caller's own Gate Pass(es) so a plain salesman can't attribute a sale
     * onto someone else's numbers.
     */
    @Transactional(readOnly = true)
    public List<RouteAllocationDtos.GatePassOption> getGatePassOptions(UUID tenantId, UUID callerId, boolean seeAll) {
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(GATE_PASS_LOOKBACK_DAYS - 1);
        List<RouteAllocation> allocations = seeAll
                ? allocationRepository.findByTenantIdAndAllocationDateBetweenOrderByAllocationDateDescRoute_Name(tenantId, from, today)
                : allocationRepository.findByTenantIdAndSalesPersonIdAndAllocationDateBetweenOrderByAllocationDateDesc(tenantId, callerId, from, today);

        return allocations.stream()
                .filter(a -> a.getSalesPerson() != null)
                .map(a -> {
                    RouteAllocationDtos.GatePassOption o = new RouteAllocationDtos.GatePassOption();
                    o.setAllocationId(a.getId());
                    o.setAllocationDate(a.getAllocationDate());
                    o.setRouteId(a.getRoute().getId());
                    o.setRouteName(a.getRoute().getName());
                    o.setSalesPersonId(a.getSalesPerson().getId());
                    o.setSalesPersonName(a.getSalesPerson().getFullName());
                    o.setSalesCompleted(a.isSalesCompleted());
                    return o;
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public RouteAllocationDtos.RouteAllocationResponse getAllocation(UUID tenantId, UUID routeId, LocalDate date) {
        RouteAllocation allocation = allocationRepository
                .findByTenantIdAndRouteIdAndAllocationDate(tenantId, routeId, date)
                .orElseThrow(() -> new ResourceNotFoundException("RouteAllocation", routeId + " on " + date));
        return toResponse(allocation);
    }

    @Transactional(readOnly = true)
    public RouteAllocationDtos.MyTodayAllocationResponse getMyTodayAllocation(UUID tenantId, UUID userId) {
        LocalDate today = LocalDate.now();

        List<RouteAllocation> salesAllocations     = allocationRepository.findByTenantIdAndSalesPersonIdAndAllocationDate(tenantId, userId, today)
                .stream().filter(a -> !a.isSalesCompleted()).collect(Collectors.toList());
        List<RouteAllocation> deliveryAllocations  = allocationRepository.findByTenantIdAndDeliveryPersonIdAndAllocationDate(tenantId, userId, today)
                .stream().filter(a -> !a.isDeliveryCompleted()).collect(Collectors.toList());
        List<RouteAllocation> warehouseAllocations = allocationRepository.findByTenantIdAndWarehousePersonIdAndAllocationDate(tenantId, userId, today)
                .stream().filter(a -> !a.isWarehouseCompleted()).collect(Collectors.toList());

        boolean isSales     = !salesAllocations.isEmpty();
        boolean isDelivery  = !deliveryAllocations.isEmpty();
        boolean isWarehouse = !warehouseAllocations.isEmpty();

        RouteAllocationDtos.RouteAllocationResponse detail = null;
        if (isSales)          detail = toResponse(salesAllocations.get(0));
        else if (isDelivery)  detail = toResponse(deliveryAllocations.get(0));
        else if (isWarehouse) detail = toResponse(warehouseAllocations.get(0));

        RouteAllocationDtos.MyTodayAllocationResponse res = new RouteAllocationDtos.MyTodayAllocationResponse();
        res.setAllocated(isSales || isDelivery || isWarehouse);
        res.setSales(isSales);
        res.setDelivery(isDelivery);
        res.setWarehouse(isWarehouse);
        res.setAllocation(detail);
        return res;
    }

    @Transactional(readOnly = true)
    public RouteAllocationDtos.RouteDeliverySummary getDeliveryRouteSummary(UUID tenantId, LocalDate date) {
        List<Route> routes = routeRepository.findByTenantIdAndActiveTrue(tenantId);

        List<Order> pendingOrders = orderRepository.findByTenantIdAndStatusIn(tenantId,
                List.of(Order.OrderStatus.PACKING, Order.OrderStatus.PACKED, Order.OrderStatus.DISPATCHED));

        java.util.Map<UUID, List<Order>> byRoute = pendingOrders.stream()
                .collect(java.util.stream.Collectors.groupingBy(o -> o.getCustomer().getRoute().getId()));

        java.util.Map<UUID, RouteAllocation> allocationByRoute = allocationRepository
                .findByTenantIdAndAllocationDateOrderByRoute_Name(tenantId, date)
                .stream().collect(java.util.stream.Collectors.toMap(
                        a -> a.getRoute().getId(), a -> a, (a, b) -> a));

        // Historical, stamp-based assignment: every order still stamped to one of this
        // date's allocations (any status except cancelled). The stamp survives delivery,
        // so this stays accurate when reviewing a past date — unlike the live counts above.
        List<UUID> allocationIds = allocationByRoute.values().stream()
                .map(RouteAllocation::getId).collect(Collectors.toList());
        java.util.Map<UUID, List<Order>> stampedByAlloc = allocationIds.isEmpty()
                ? java.util.Map.of()
                : orderRepository.findByTenantIdAndRouteAllocationIdInAndStatusNot(
                        tenantId, allocationIds, Order.OrderStatus.CANCELLED)
                    .stream().collect(java.util.stream.Collectors.groupingBy(o -> o.getRouteAllocation().getId()));

        List<RouteAllocationDtos.RouteDeliveryRow> rows = routes.stream().map(route -> {
            List<Order> orders = byRoute.getOrDefault(route.getId(), List.of());
            RouteAllocation alloc = allocationByRoute.get(route.getId());

            long preparing  = orders.stream().filter(o -> Order.OrderStatus.PACKING.equals(o.getStatus())).count();
            long packed     = orders.stream().filter(o -> Order.OrderStatus.PACKED.equals(o.getStatus())).count();
            long dispatched = orders.stream().filter(o -> Order.OrderStatus.DISPATCHED.equals(o.getStatus())).count();
            BigDecimal value = orders.stream()
                    .filter(o -> Order.OrderStatus.PACKED.equals(o.getStatus()))
                    .map(Order::getTotalAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            // "Assigned" = actually stamped into today's run AND a delivery person is on
            // that run (see allocateDelivery) — this is what the delivery person assigned
            // to this route can actually see in their app right now. A route-allocation
            // stamp can also come from an unrelated Sales/Counter-Sale Gate Pass link
            // (same shared row, different purpose); without a delivery person that stamp
            // doesn't mean anything for delivery, so it must not count as "assigned" here.
            boolean hasDeliveryPerson = alloc != null && alloc.getDeliveryPerson() != null;
            long assignedPacked = 0;
            long assignedDispatched = 0;
            if (hasDeliveryPerson) {
                assignedPacked = orders.stream()
                        .filter(o -> Order.OrderStatus.PACKED.equals(o.getStatus()))
                        .filter(o -> o.getRouteAllocation() != null && o.getRouteAllocation().getId().equals(alloc.getId()))
                        .count();
                assignedDispatched = orders.stream()
                        .filter(o -> Order.OrderStatus.DISPATCHED.equals(o.getStatus()))
                        .filter(o -> o.getRouteAllocation() != null && o.getRouteAllocation().getId().equals(alloc.getId()))
                        .count();
            }

            // Total orders assigned to this route's run (any status) + their value — historical.
            List<Order> stamped = hasDeliveryPerson
                    ? stampedByAlloc.getOrDefault(alloc.getId(), List.of()) : List.of();
            int assignedCount = stamped.size();
            BigDecimal assignedValue = stamped.stream()
                    .map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

            // Packed but not part of an active delivery run — live backlog waiting to be
            // assigned. Includes orders never stamped at all, plus orders stamped to this
            // route's allocation for an unrelated reason while it still has no delivery person.
            List<Order> unassignedPacked = orders.stream()
                    .filter(o -> Order.OrderStatus.PACKED.equals(o.getStatus()))
                    .filter(o -> !hasDeliveryPerson || o.getRouteAllocation() == null)
                    .collect(Collectors.toList());
            BigDecimal unassignedPackedValue = unassignedPacked.stream()
                    .map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

            RouteAllocationDtos.RouteDeliveryRow row = new RouteAllocationDtos.RouteDeliveryRow();
            row.setRouteId(route.getId());
            row.setRouteName(route.getName());
            row.setPreparingCount((int) preparing);
            row.setPackedCount((int) packed);
            row.setDispatchedCount((int) dispatched);
            row.setAssignedPackedCount((int) assignedPacked);
            row.setAssignedDispatchedCount((int) assignedDispatched);
            row.setPackedValue(value);
            row.setAssignedCount(assignedCount);
            row.setAssignedValue(assignedValue);
            row.setUnassignedPackedCount(unassignedPacked.size());
            row.setUnassignedPackedValue(unassignedPackedValue);

            if (alloc != null) {
                row.setAllocationId(alloc.getId());
                row.setDeliveryStartKm(alloc.getDeliveryStartKm());
                row.setDeliveryEndKm(alloc.getDeliveryEndKm());
                row.setDeliveryCompleted(alloc.isDeliveryCompleted());
                row.setDeliveryCompletedAt(alloc.getDeliveryCompletedAt());
                row.setDeliveryDeliveredCount(alloc.getDeliveryDeliveredCount());
                row.setDeliveryPendingCount(alloc.getDeliveryPendingCount());
                row.setDeliveryTotalCount(alloc.getDeliveryTotalCount());
                if (alloc.getDeliveryPerson() != null) row.setDeliveryPerson(toUserSummary(alloc.getDeliveryPerson()));
                if (alloc.getDeliveryVehicle() != null) row.setDeliveryVehicle(toVehicleSummary(alloc.getDeliveryVehicle()));
            }
            return row;
        }).sorted(java.util.Comparator
                .comparingInt(RouteAllocationDtos.RouteDeliveryRow::getAssignedCount).reversed()
                .thenComparing(RouteAllocationDtos.RouteDeliveryRow::getRouteName))
          .collect(Collectors.toList());

        RouteAllocationDtos.RouteDeliverySummary summary = new RouteAllocationDtos.RouteDeliverySummary();
        summary.setDate(date);
        summary.setRoutes(rows);
        return summary;
    }

    @Transactional(readOnly = true)
    public RouteAllocationDtos.RouteWarehouseSummary getWarehouseSummary(UUID tenantId, LocalDate date) {
        List<Route> routes = routeRepository.findByTenantIdAndActiveTrue(tenantId);

        // Whole outstanding backlog per route — not scoped to this date's orderDate, since an
        // order submitted/approved days ago and still unpacked must keep showing until it's
        // packed. "date" below only decides which day's allocation (who's assigned) is shown.
        List<Order> orders = orderRepository.findByTenantIdAndStatusIn(tenantId,
                List.of(Order.OrderStatus.SUBMITTED, Order.OrderStatus.APPROVED,
                        Order.OrderStatus.PACKING, Order.OrderStatus.PACKED));

        java.util.Map<UUID, List<Order>> byRoute = orders.stream()
                .filter(o -> o.getCustomer() != null && o.getCustomer().getRoute() != null)
                .collect(java.util.stream.Collectors.groupingBy(o -> o.getCustomer().getRoute().getId()));

        java.util.Map<UUID, RouteAllocation> allocationByRoute = allocationRepository
                .findByTenantIdAndAllocationDateOrderByRoute_Name(tenantId, date)
                .stream().collect(java.util.stream.Collectors.toMap(
                        a -> a.getRoute().getId(), a -> a, (a, b) -> a));

        List<RouteAllocationDtos.RouteWarehouseRow> rows = routes.stream().map(route -> {
            List<Order> routeOrders = byRoute.getOrDefault(route.getId(), List.of());
            long submitted = routeOrders.stream().filter(o -> Order.OrderStatus.SUBMITTED.equals(o.getStatus())).count();
            long approved  = routeOrders.stream().filter(o -> Order.OrderStatus.APPROVED.equals(o.getStatus())).count();
            long packing = routeOrders.stream().filter(o -> Order.OrderStatus.PACKING.equals(o.getStatus())).count();
            long packed  = routeOrders.stream().filter(o -> Order.OrderStatus.PACKED.equals(o.getStatus())).count();

            RouteAllocationDtos.RouteWarehouseRow row = new RouteAllocationDtos.RouteWarehouseRow();
            row.setRouteId(route.getId());
            row.setRouteName(route.getName());
            row.setSubmittedCount((int) submitted);
            row.setApprovedCount((int) approved);
            row.setPackingCount((int) packing);
            row.setPackedCount((int) packed);
            row.setPendingCount((int) (submitted + approved + packing + packed));

            RouteAllocation alloc = allocationByRoute.get(route.getId());
            if (alloc != null) {
                row.setAllocationId(alloc.getId());
                if (alloc.getWarehousePerson() != null) row.setWarehousePerson(toUserSummary(alloc.getWarehousePerson()));
                row.setWarehouseCompleted(alloc.isWarehouseCompleted());
            }
            return row;
        }).sorted(java.util.Comparator
                .comparingInt(RouteAllocationDtos.RouteWarehouseRow::getPendingCount).reversed()
                .thenComparing(RouteAllocationDtos.RouteWarehouseRow::getRouteName))
          .collect(Collectors.toList());

        RouteAllocationDtos.RouteWarehouseSummary summary = new RouteAllocationDtos.RouteWarehouseSummary();
        summary.setDate(date);
        summary.setRoutes(rows);
        return summary;
    }

    @Transactional(readOnly = true)
    public RouteAllocationDtos.FieldActivityResponse getFieldActivity(UUID tenantId, LocalDate date) {
        List<RouteAllocation> allocations = allocationRepository
                .findByTenantIdAndAllocationDateOrderByRoute_Name(tenantId, date);

        List<RouteAllocationDtos.FieldActivityResponse.ActivityItem> items = new ArrayList<>();

        for (RouteAllocation alloc : allocations) {
            if (alloc.getSalesPerson() != null) {
                items.add(buildActivityItem(alloc, "SALES", alloc.getSalesPerson(),
                        alloc.getSalesVehicle(), alloc.getSalesStartKm(), alloc.getSalesEndKm(),
                        tenantId, date));
            }
            if (alloc.getDeliveryPerson() != null) {
                items.add(buildActivityItem(alloc, "DELIVERY", alloc.getDeliveryPerson(),
                        alloc.getDeliveryVehicle(), alloc.getDeliveryStartKm(), alloc.getDeliveryEndKm(),
                        tenantId, date));
            }
        }

        RouteAllocationDtos.FieldActivityResponse res = new RouteAllocationDtos.FieldActivityResponse();
        res.setDate(date);
        res.setActivities(items);
        return res;
    }

    private RouteAllocationDtos.FieldActivityResponse.ActivityItem buildActivityItem(
            RouteAllocation alloc, String type, User person, Vehicle vehicle,
            Integer startKm, Integer endKm, UUID tenantId, LocalDate date) {

        RouteAllocationDtos.FieldActivityResponse.ActivityItem item =
                new RouteAllocationDtos.FieldActivityResponse.ActivityItem();

        item.setAllocationId(alloc.getId());
        item.setRouteName(alloc.getRoute().getName());
        item.setType(type);
        item.setPerson(toUserSummary(person));
        if (vehicle != null) item.setVehicle(toVehicleSummary(vehicle));
        item.setStartKm(startKm);
        item.setEndKm(endKm);
        if (startKm != null && endKm != null) item.setKmDriven(endKm - startKm);
        boolean completed = "SALES".equals(type) ? alloc.isSalesCompleted() : alloc.isDeliveryCompleted();
        item.setStatus(completed ? "COMPLETED" : "ACTIVE");

        // Orders — for SALES fetch by salesPerson; for DELIVERY fetch by route
        List<Order> orders;
        if ("SALES".equals(type)) {
            orders = orderRepository.findByTenantIdAndSalesPersonIdAndOrderDate(tenantId, person.getId(), date);
        } else {
            // In-transit + returned today + delivered today
            List<Order> inTransit = orderRepository.findByTenantIdAndStatusInAndRouteIds(tenantId,
                List.of(Order.OrderStatus.DISPATCHED, Order.OrderStatus.RETURN_TO_WAREHOUSE),
                List.of(alloc.getRoute().getId()));
            List<Order> deliveredToday = orderRepository.findDeliveredByRouteIdsAndDate(tenantId,
                List.of(alloc.getRoute().getId()), date);
            orders = new ArrayList<>();
            orders.addAll(inTransit);
            orders.addAll(deliveredToday);
        }

        item.setOrdersCount(orders.size());
        item.setOrdersValue(orders.stream().map(Order::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add));

        // Order detail list
        item.setOrders(orders.stream().map(o -> {
            RouteAllocationDtos.FieldActivityResponse.OrderSummary s =
                    new RouteAllocationDtos.FieldActivityResponse.OrderSummary();
            s.setOrderId(o.getId());
            s.setOrderNumber(o.getOrderNumber());
            s.setCustomerName(o.getCustomer().getBusinessName());
            s.setCustomerPhone(o.getCustomer().getPhone());
            s.setItemCount(o.getItems().size());
            s.setTotalAmount(o.getTotalAmount());
            s.setPaidAmount(o.getPaidAmount());
            s.setBalanceAmount(o.getBalanceAmount());
            s.setStatus(o.getStatus().name());
            return s;
        }).collect(java.util.stream.Collectors.toList()));

        // Payment stats
        List<Payment> payments = paymentRepository
                .findByTenantIdAndCollectedByIdAndCollectionDate(tenantId, person.getId(), date);
        BigDecimal cash = BigDecimal.ZERO, upi = BigDecimal.ZERO, other = BigDecimal.ZERO;
        for (Payment p : payments) {
            Payment.PaymentMode mode = p.getPaymentMode();
            if (Payment.PaymentMode.CASH.equals(mode))      cash  = cash.add(p.getAmount());
            else if (Payment.PaymentMode.UPI.equals(mode))  upi   = upi.add(p.getAmount());
            else                                             other = other.add(p.getAmount());
        }
        item.setCashCollected(cash);
        item.setUpiCollected(upi);
        item.setOtherCollected(other);
        item.setTotalCollected(cash.add(upi).add(other));

        if ("DELIVERY".equals(type)) {
            long delivered = orders.stream()
                    .filter(o -> Order.OrderStatus.DELIVERED.equals(o.getStatus()))
                    .count();
            item.setDeliveriesCompleted((int) delivered);
        }

        return item;
    }

    private RouteAllocation findOrCreate(UUID routeId, LocalDate date, UUID tenantId) {
        Route route = routeRepository.findByIdAndTenantId(routeId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Route", routeId.toString()));

        return allocationRepository
                .findByTenantIdAndRouteIdAndAllocationDate(tenantId, routeId, date)
                .orElseGet(() -> RouteAllocation.builder()
                        .tenant(route.getTenant())
                        .route(route)
                        .allocationDate(date)
                        .build());
    }

    private RouteAllocationDtos.RouteAllocationResponse toResponse(RouteAllocation a) {
        RouteAllocationDtos.RouteAllocationResponse res = new RouteAllocationDtos.RouteAllocationResponse();
        res.setId(a.getId());
        res.setRouteId(a.getRoute().getId());
        res.setRouteName(a.getRoute().getName());
        res.setAllocationDate(a.getAllocationDate());
        res.setStatus(a.getStatus());
        res.setSalesCompleted(a.isSalesCompleted());
        res.setDeliveryCompleted(a.isDeliveryCompleted());
        res.setWarehouseCompleted(a.isWarehouseCompleted());
        res.setNotes(a.getNotes());
        res.setSalesStartKm(a.getSalesStartKm());
        res.setSalesEndKm(a.getSalesEndKm());
        res.setDeliveryStartKm(a.getDeliveryStartKm());
        res.setDeliveryEndKm(a.getDeliveryEndKm());
        if (a.getSalesPerson() != null)    res.setSalesPerson(toUserSummary(a.getSalesPerson()));
        if (a.getDeliveryPerson() != null) res.setDeliveryPerson(toUserSummary(a.getDeliveryPerson()));
        if (a.getWarehousePerson() != null) res.setWarehousePerson(toUserSummary(a.getWarehousePerson()));
        if (a.getSalesVehicle() != null)   res.setSalesVehicle(toVehicleSummary(a.getSalesVehicle()));
        if (a.getDeliveryVehicle() != null) res.setDeliveryVehicle(toVehicleSummary(a.getDeliveryVehicle()));
        return res;
    }

    private RouteAllocationDtos.UserSummary toUserSummary(User u) {
        RouteAllocationDtos.UserSummary s = new RouteAllocationDtos.UserSummary();
        s.setId(u.getId());
        s.setFullName(u.getFullName());
        s.setPhone(u.getPhone());
        s.setRole(u.getRole().name());
        return s;
    }

    private RouteAllocationDtos.VehicleSummary toVehicleSummary(Vehicle v) {
        RouteAllocationDtos.VehicleSummary s = new RouteAllocationDtos.VehicleSummary();
        s.setId(v.getId());
        s.setVehicleNumber(v.getVehicleNumber());
        s.setVehicleType(v.getVehicleType());
        s.setModel(v.getModel());
        return s;
    }

    private void checkSalesVehicleConflict(UUID tenantId, Vehicle vehicle, LocalDate date, UUID excludeId) {
        if (vehicle == null) return;
        if (allocationRepository.isVehicleUsedAsSales(tenantId, vehicle.getId(), date, excludeId)) {
            throw new BusinessException(
                "Vehicle " + vehicle.getVehicleNumber() + " is already allocated for Sales on " + date + ".",
                "VEHICLE_ALREADY_ALLOCATED"
            );
        }
        if (allocationRepository.isVehicleUsedAsDelivery(tenantId, vehicle.getId(), date, excludeId)) {
            throw new BusinessException(
                "Vehicle " + vehicle.getVehicleNumber() + " is already allocated for Delivery on " + date + ".",
                "VEHICLE_ALREADY_ALLOCATED"
            );
        }
    }

    private void checkDeliveryVehicleConflict(UUID tenantId, Vehicle vehicle, LocalDate date, UUID excludeId) {
        if (vehicle == null) return;
        if (allocationRepository.isVehicleUsedAsDelivery(tenantId, vehicle.getId(), date, excludeId)) {
            throw new BusinessException(
                "Vehicle " + vehicle.getVehicleNumber() + " is already allocated for Delivery on " + date + ".",
                "VEHICLE_ALREADY_ALLOCATED"
            );
        }
        if (allocationRepository.isVehicleUsedAsSales(tenantId, vehicle.getId(), date, excludeId)) {
            throw new BusinessException(
                "Vehicle " + vehicle.getVehicleNumber() + " is already allocated for Sales on " + date + ".",
                "VEHICLE_ALREADY_ALLOCATED"
            );
        }
    }

    private void checkSalesPersonConflict(UUID tenantId, User person, LocalDate date, UUID excludeId) {
        if (person == null) return;
        if (allocationRepository.isSalesPersonAllocatedOnDate(tenantId, person.getId(), date, excludeId)) {
            throw new BusinessException(
                person.getFullName() + " is already assigned to a route on " + date + ".",
                "SALES_PERSON_ALREADY_ALLOCATED"
            );
        }
    }

    private void checkDeliveryPersonConflict(UUID tenantId, User person, LocalDate date, UUID excludeId) {
        if (person == null) return;
        if (allocationRepository.isDeliveryPersonAllocatedOnDate(tenantId, person.getId(), date, excludeId)) {
            throw new BusinessException(
                person.getFullName() + " is already assigned to a delivery route on " + date + ".",
                "DELIVERY_PERSON_ALREADY_ALLOCATED"
            );
        }
    }
}
