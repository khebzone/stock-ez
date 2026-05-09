package com.distroiq.api.module.route.service;

import com.distroiq.api.module.order.entity.Order;
import com.distroiq.api.module.order.entity.Payment;
import com.distroiq.api.module.order.repository.OrderRepository;
import com.distroiq.api.module.order.repository.PaymentRepository;
import com.distroiq.api.module.route.dto.RouteAllocationDtos;
import com.distroiq.api.module.route.entity.Route;
import com.distroiq.api.module.route.entity.RouteAllocation;
import com.distroiq.api.module.route.repository.RouteAllocationRepository;
import com.distroiq.api.module.route.repository.RouteRepository;
import com.distroiq.api.module.user.entity.User;
import com.distroiq.api.module.user.repository.UserRepository;
import com.distroiq.api.module.vehicle.entity.Vehicle;
import com.distroiq.api.module.vehicle.repository.VehicleRepository;
import com.distroiq.common.exception.BusinessException;
import com.distroiq.common.exception.ResourceNotFoundException;
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

    public RouteAllocationDtos.RouteAllocationResponse allocateSales(
            RouteAllocationDtos.AllocateSalesRequest req, UUID tenantId) {

        RouteAllocation allocation = findOrCreate(req.getRouteId(), req.getAllocationDate(), tenantId);

        if (req.getSalesPersonId() != null) {
            User sp = userRepository.findByIdAndTenantId(req.getSalesPersonId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("User", req.getSalesPersonId().toString()));
            checkSalesPersonConflict(tenantId, sp, req.getAllocationDate(), allocation.getId());
            allocation.setSalesPerson(sp);
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

        return toResponse(allocationRepository.save(allocation));
    }

    public RouteAllocationDtos.RouteAllocationResponse allocateDelivery(
            RouteAllocationDtos.AllocateDeliveryRequest req, UUID tenantId) {

        RouteAllocation allocation = findOrCreate(req.getRouteId(), req.getAllocationDate(), tenantId);

        if (req.getDeliveryPersonId() != null) {
            User dp = userRepository.findByIdAndTenantId(req.getDeliveryPersonId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("User", req.getDeliveryPersonId().toString()));
            checkDeliveryPersonConflict(tenantId, dp, req.getAllocationDate(), allocation.getId());
            allocation.setDeliveryPerson(dp);
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

        return toResponse(allocationRepository.save(allocation));
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
        }
        if (req.getSalesPersonId() != null) {
            User sp = userRepository.findByIdAndTenantId(req.getSalesPersonId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("User", req.getSalesPersonId().toString()));
            checkSalesPersonConflict(tenantId, sp, req.getAllocationDate(), allocation.getId());
            allocation.setSalesPerson(sp);
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

    @Transactional(readOnly = true)
    public RouteAllocationDtos.RouteAllocationResponse getAllocation(UUID tenantId, UUID routeId, LocalDate date) {
        RouteAllocation allocation = allocationRepository
                .findByTenantIdAndRouteIdAndAllocationDate(tenantId, routeId, date)
                .orElseThrow(() -> new ResourceNotFoundException("RouteAllocation", routeId + " on " + date));
        return toResponse(allocation);
    }

    @Transactional(readOnly = true)
    public RouteAllocationDtos.RouteAllocationResponse getMyTodayAllocation(UUID tenantId, UUID userId) {
        LocalDate today = LocalDate.now();
        List<RouteAllocation> salesAllocations = allocationRepository
                .findByTenantIdAndSalesPersonIdAndAllocationDate(tenantId, userId, today);
        if (!salesAllocations.isEmpty()) return toResponse(salesAllocations.get(0));

        List<RouteAllocation> deliveryAllocations = allocationRepository
                .findByTenantIdAndDeliveryPersonIdAndAllocationDate(tenantId, userId, today);
        if (!deliveryAllocations.isEmpty()) return toResponse(deliveryAllocations.get(0));

        return null;
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
        item.setStatus(alloc.getStatus());

        // Orders — for SALES fetch by salesPerson; for DELIVERY fetch by route
        List<Order> orders;
        if ("SALES".equals(type)) {
            orders = orderRepository.findByTenantIdAndSalesPersonIdAndOrderDate(tenantId, person.getId(), date);
        } else {
            orders = orderRepository.findByTenantIdAndStatusInAndRouteIds(tenantId,
                List.of(Order.OrderStatus.PREPARED, Order.OrderStatus.DISPATCHED, Order.OrderStatus.DELIVERED),
                List.of(alloc.getRoute().getId()));
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
        res.setNotes(a.getNotes());
        res.setSalesStartKm(a.getSalesStartKm());
        res.setSalesEndKm(a.getSalesEndKm());
        res.setDeliveryStartKm(a.getDeliveryStartKm());
        res.setDeliveryEndKm(a.getDeliveryEndKm());
        if (a.getSalesPerson() != null)    res.setSalesPerson(toUserSummary(a.getSalesPerson()));
        if (a.getDeliveryPerson() != null) res.setDeliveryPerson(toUserSummary(a.getDeliveryPerson()));
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
