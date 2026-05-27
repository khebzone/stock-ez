package com.stockez.api.module.customer.service;

import com.stockez.api.module.customer.dto.CustomerDtos;
import com.stockez.api.module.customer.entity.Customer;
import com.stockez.api.module.customer.repository.CustomerRepository;
import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.order.repository.OrderRepository;
import com.stockez.api.module.route.entity.Route;
import com.stockez.api.module.route.entity.RouteAllocation;
import com.stockez.api.module.route.entity.RoutePlace;
import com.stockez.api.module.route.repository.RouteAllocationRepository;
import com.stockez.api.module.route.repository.RoutePlaceRepository;
import com.stockez.api.module.route.repository.RouteRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.audit.service.AuditService;
import com.stockez.common.exception.BusinessException;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final RouteRepository routeRepository;
    private final RoutePlaceRepository routePlaceRepository;
    private final TenantRepository tenantRepository;
    private final OrderRepository orderRepository;
    private final RouteAllocationRepository allocationRepository;
    private final AuditService auditService;

    public CustomerDtos.CustomerResponse createCustomer(CustomerDtos.CreateCustomerRequest req, UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));

        // Duplicate phone check
        if (customerRepository.existsByTenantIdAndPhoneAndActiveTrue(tenantId, req.getPhone())) {
            throw new BusinessException("A customer with phone '" + req.getPhone() + "' already exists", "DUPLICATE_PHONE");
        }

        // Credit cross-field validation
        if (req.isCreditAllowed()) {
            if (req.getCreditDays() == null || req.getCreditDays() <= 0) {
                throw new BusinessException("Credit days must be greater than 0 when credit is allowed", "INVALID_CREDIT_DAYS");
            }
            if (req.getCreditLimit() == null || req.getCreditLimit().compareTo(java.math.BigDecimal.ZERO) <= 0) {
                throw new BusinessException("Credit limit must be greater than 0 when credit is allowed", "INVALID_CREDIT_LIMIT");
            }
        }

        Route route = routeRepository.findByIdAndTenantId(req.getRouteId(), tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Route", req.getRouteId().toString()));
        RoutePlace place = routePlaceRepository.findByIdAndRouteId(req.getRoutePlaceId(), req.getRouteId())
                .orElseThrow(() -> new ResourceNotFoundException("RoutePlace", req.getRoutePlaceId().toString()));

        // Auto-assign next visit_order within this place
        Integer maxOrder = customerRepository.findMaxVisitOrderByPlaceId(place.getId());
        int nextVisitOrder = (maxOrder == null ? -1 : maxOrder) + 1;

        Customer customer = Customer.builder()
                .tenant(tenant)
                .businessName(req.getBusinessName())
                .ownerName(req.getOwnerName())
                .phone(req.getPhone())
                .altPhone(req.getAltPhone())
                .email(req.getEmail())
                .address(req.getAddress())
                .gstin(req.getGstin())
                .route(route)
                .routePlace(place)
                .visitOrder(nextVisitOrder)
                .creditAllowed(req.isCreditAllowed())
                .creditDays(req.getCreditDays())
                .creditLimit(req.getCreditLimit())
                .latitude(req.getLatitude())
                .longitude(req.getLongitude())
                .ownerImageUrl(req.getOwnerImageUrl())
                .shopImageUrl(req.getShopImageUrl())
                .build();

        Customer saved = customerRepository.save(customer);
        auditService.record(tenantId, "CUSTOMER", saved.getId(), "CREATED",
                "Customer " + saved.getBusinessName() + " added to route " + route.getName());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public CustomerDtos.CustomerResponse getById(UUID id, UUID tenantId) {
        Customer c = customerRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", id.toString()));
        return toResponse(c);
    }

    @Transactional(readOnly = true)
    public Page<CustomerDtos.CustomerResponse> getByRoute(UUID tenantId, UUID routeId, Pageable pageable) {
        return customerRepository.findByTenantIdAndRouteIdAndActiveTrue(tenantId, routeId, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<CustomerDtos.CustomerResponse> getByPlace(UUID tenantId, UUID placeId, Pageable pageable) {
        return customerRepository.findByTenantIdAndRoutePlaceIdAndActiveTrue(tenantId, placeId, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<CustomerDtos.CustomerResponse> search(UUID tenantId, String q, Pageable pageable) {
        return customerRepository.search(tenantId, q, pageable).map(this::toResponse);
    }

    public CustomerDtos.CustomerResponse updateCustomer(UUID id, CustomerDtos.UpdateCustomerRequest req, UUID tenantId) {
        Customer c = customerRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", id.toString()));

        c.setBusinessName(req.getBusinessName());
        c.setOwnerName(req.getOwnerName());
        c.setAltPhone(req.getAltPhone());
        c.setEmail(req.getEmail());
        c.setAddress(req.getAddress());
        c.setGstin(req.getGstin());
        c.setCreditAllowed(req.isCreditAllowed());
        c.setCreditDays(req.getCreditDays());
        c.setCreditLimit(req.getCreditLimit());
        c.setLatitude(req.getLatitude());
        c.setLongitude(req.getLongitude());
        if (req.getOwnerImageUrl() != null) c.setOwnerImageUrl(req.getOwnerImageUrl());
        if (req.getShopImageUrl() != null) c.setShopImageUrl(req.getShopImageUrl());

        if (req.getRouteId() != null) {
            Route route = routeRepository.findByIdAndTenantId(req.getRouteId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Route", req.getRouteId().toString()));
            c.setRoute(route);
        }
        if (req.getRoutePlaceId() != null) {
            RoutePlace rp = routePlaceRepository.findById(req.getRoutePlaceId())
                    .orElseThrow(() -> new ResourceNotFoundException("RoutePlace", req.getRoutePlaceId().toString()));
            c.setRoutePlace(rp);
        }

        Customer saved = customerRepository.save(c);
        auditService.record(tenantId, "CUSTOMER", saved.getId(), "UPDATED",
                "Customer " + saved.getBusinessName() + " details updated");
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public CustomerDtos.CustomerOutstandingResponse getOutstanding(UUID customerId, UUID tenantId) {
        Customer c = customerRepository.findByIdAndTenantId(customerId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", customerId.toString()));

        List<Order> unpaidOrders = orderRepository.findUnpaidOrdersByCustomer(tenantId, customerId, Order.OrderStatus.CANCELLED);
        LocalDate today = LocalDate.now();

        BigDecimal b0  = BigDecimal.ZERO;
        BigDecimal b31 = BigDecimal.ZERO;
        BigDecimal b61 = BigDecimal.ZERO;
        BigDecimal b91 = BigDecimal.ZERO;

        for (Order o : unpaidOrders) {
            long days = today.toEpochDay() - o.getOrderDate().toEpochDay();
            BigDecimal bal = o.getBalanceAmount();
            if (days <= 30)      b0  = b0.add(bal);
            else if (days <= 60) b31 = b31.add(bal);
            else if (days <= 90) b61 = b61.add(bal);
            else                 b91 = b91.add(bal);
        }

        BigDecimal total = b0.add(b31).add(b61).add(b91);
        BigDecimal limit = c.getCreditLimit() != null ? c.getCreditLimit() : BigDecimal.ZERO;
        boolean overLimit = c.isCreditAllowed() && limit.compareTo(BigDecimal.ZERO) > 0 && total.compareTo(limit) >= 0;

        CustomerDtos.CustomerOutstandingResponse res = new CustomerDtos.CustomerOutstandingResponse();
        res.setCustomerId(c.getId());
        res.setBusinessName(c.getBusinessName());
        res.setTotalOutstanding(total);
        res.setBucket0to30(b0);
        res.setBucket31to60(b31);
        res.setBucket61to90(b61);
        res.setBucket90plus(b91);
        res.setCreditLimit(limit);
        res.setCreditAllowed(c.isCreditAllowed());
        res.setCreditDays(c.getCreditDays());
        res.setOverLimit(overLimit);
        return res;
    }

    @Transactional(readOnly = true)
    public List<CustomerDtos.CustomerResponse> getAllocatedCustomers(UUID tenantId, UUID userId) {
        List<RouteAllocation> allocations = allocationRepository
                .findByTenantIdAndSalesPersonIdAndAllocationDate(tenantId, userId, LocalDate.now());
        if (allocations.isEmpty()) return java.util.Collections.emptyList();
        UUID routeId = allocations.get(0).getRoute().getId();
        return customerRepository.findByTenantIdAndRouteIdAndActiveTrue(tenantId, routeId)
                .stream().map(this::toResponse).collect(java.util.stream.Collectors.toList());
    }

    public void deactivate(UUID id, UUID tenantId) {
        Customer c = customerRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", id.toString()));
        c.setActive(false);
        customerRepository.save(c);
        auditService.record(tenantId, "CUSTOMER", c.getId(), "DEACTIVATED",
                "Customer " + c.getBusinessName() + " deactivated");
    }

    /** Reorder customers within a place by providing ordered list of customer IDs */
    public List<CustomerDtos.CustomerResponse> reorderCustomers(UUID placeId, CustomerDtos.ReorderCustomersRequest req, UUID tenantId) {
        routePlaceRepository.findById(placeId)
                .orElseThrow(() -> new ResourceNotFoundException("RoutePlace", placeId.toString()));

        List<CustomerDtos.CustomerResponse> result = new java.util.ArrayList<>();
        for (int i = 0; i < req.getCustomerIds().size(); i++) {
            UUID custId = req.getCustomerIds().get(i);
            Customer c = customerRepository.findByIdAndTenantId(custId, tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Customer", custId.toString()));
            c.setVisitOrder(i);
            result.add(toResponse(customerRepository.save(c)));
        }
        return result;
    }

    private CustomerDtos.CustomerResponse toResponse(Customer c) {
        CustomerDtos.CustomerResponse res = new CustomerDtos.CustomerResponse();
        res.setId(c.getId());
        res.setBusinessName(c.getBusinessName());
        res.setOwnerName(c.getOwnerName());
        res.setPhone(c.getPhone());
        res.setAltPhone(c.getAltPhone());
        res.setEmail(c.getEmail());
        res.setAddress(c.getAddress());
        res.setGstin(c.getGstin());
        res.setCreditAllowed(c.isCreditAllowed());
        res.setCreditDays(c.getCreditDays());
        res.setCreditLimit(c.getCreditLimit());
        res.setVisitOrder(c.getVisitOrder());
        res.setLatitude(c.getLatitude());
        res.setLongitude(c.getLongitude());
        res.setOwnerImageUrl(c.getOwnerImageUrl());
        res.setShopImageUrl(c.getShopImageUrl());
        res.setActive(c.isActive());
        res.setCreatedAt(c.getCreatedAt());

        if (c.getRoute() != null) {
            CustomerDtos.RouteInfo ri = new CustomerDtos.RouteInfo();
            ri.setId(c.getRoute().getId());
            ri.setName(c.getRoute().getName());
            res.setRoute(ri);
        }
        if (c.getRoutePlace() != null) {
            CustomerDtos.PlaceInfo pi = new CustomerDtos.PlaceInfo();
            pi.setId(c.getRoutePlace().getId());
            pi.setName(c.getRoutePlace().getName());
            res.setRoutePlace(pi);
        }
        return res;
    }
}
