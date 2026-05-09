package com.distroiq.api.module.sales.service;

import com.distroiq.api.module.customer.entity.Customer;
import com.distroiq.api.module.customer.repository.CustomerRepository;
import com.distroiq.api.module.route.entity.Route;
import com.distroiq.api.module.route.entity.RouteAllocation;
import com.distroiq.api.module.route.repository.RouteAllocationRepository;
import com.distroiq.api.module.sales.dto.SalesDtos;
import com.distroiq.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SalesService {

    private final RouteAllocationRepository allocationRepository;
    private final CustomerRepository customerRepository;

    /**
     * Get today's allocation for the calling sales person.
     * Returns route info + customers in visit order.
     */
    public SalesDtos.MyAllocationResponse getMyAllocation(UUID salesPersonId, UUID tenantId) {
        List<RouteAllocation> allocations = allocationRepository
                .findByTenantIdAndSalesPersonIdAndAllocationDate(tenantId, salesPersonId, LocalDate.now());

        if (allocations.isEmpty()) {
            throw new ResourceNotFoundException("RouteAllocation",
                    "No allocation found for sales person today");
        }

        RouteAllocation allocation = allocations.get(0);
        Route route = allocation.getRoute();

        List<Customer> customers = customerRepository.findByTenantIdAndRouteIdAndActiveTrue(tenantId, route.getId())
                .stream()
                .sorted(Comparator.comparingInt(Customer::getVisitOrder))
                .collect(Collectors.toList());

        SalesDtos.MyAllocationResponse response = new SalesDtos.MyAllocationResponse();
        response.setAllocationId(allocation.getId());
        response.setRouteId(route.getId());
        response.setRouteName(route.getName());
        response.setAllocationDate(allocation.getAllocationDate());
        response.setStatus(allocation.getStatus());
        response.setCustomers(customers.stream().map(this::toCustomerSummary).collect(Collectors.toList()));

        return response;
    }

    /**
     * Get flat customer list for today's allocated route.
     */
    public List<SalesDtos.CustomerSummary> getMyCustomers(UUID salesPersonId, UUID tenantId) {
        List<RouteAllocation> allocations = allocationRepository
                .findByTenantIdAndSalesPersonIdAndAllocationDate(tenantId, salesPersonId, LocalDate.now());

        if (allocations.isEmpty()) {
            throw new ResourceNotFoundException("RouteAllocation",
                    "No allocation found for sales person today");
        }

        Route route = allocations.get(0).getRoute();

        return customerRepository.findByTenantIdAndRouteIdAndActiveTrue(tenantId, route.getId())
                .stream()
                .sorted(Comparator.comparingInt(Customer::getVisitOrder))
                .map(this::toCustomerSummary)
                .collect(Collectors.toList());
    }

    private SalesDtos.CustomerSummary toCustomerSummary(Customer c) {
        SalesDtos.CustomerSummary cs = new SalesDtos.CustomerSummary();
        cs.setId(c.getId());
        cs.setBusinessName(c.getBusinessName());
        cs.setOwnerName(c.getOwnerName());
        cs.setPhone(c.getPhone());
        cs.setAddress(c.getAddress());
        cs.setVisitOrder(c.getVisitOrder());
        cs.setCreditLimit(c.getCreditLimit());
        cs.setCreditAllowed(c.isCreditAllowed());
        cs.setLatitude(c.getLatitude());
        cs.setLongitude(c.getLongitude());
        if (c.getRoutePlace() != null) {
            cs.setPlaceName(c.getRoutePlace().getName());
            cs.setPlaceId(c.getRoutePlace().getId());
        }
        return cs;
    }
}
