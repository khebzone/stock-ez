package com.distroiq.api.module.order.service;

import com.distroiq.api.module.customer.entity.Customer;
import com.distroiq.api.module.customer.repository.CustomerRepository;
import com.distroiq.api.module.order.dto.OrderDtos;
import com.distroiq.api.module.order.entity.Order;
import com.distroiq.api.module.order.entity.OrderItem;
import com.distroiq.api.module.order.entity.Payment;
import com.distroiq.api.module.order.repository.OrderRepository;
import com.distroiq.api.module.order.repository.PaymentRepository;
import com.distroiq.api.module.product.entity.Product;
import com.distroiq.api.module.product.repository.ProductRepository;
import com.distroiq.api.module.purchase.entity.StockBatch;
import com.distroiq.api.module.purchase.repository.StockBatchRepository;
import com.distroiq.api.module.route.entity.RouteAllocation;
import com.distroiq.api.module.route.repository.RouteAllocationRepository;
import com.distroiq.api.module.user.entity.User;
import com.distroiq.api.module.user.repository.UserRepository;
import com.distroiq.api.module.audit.service.AuditService;
import com.distroiq.common.exception.BusinessException;
import com.distroiq.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Year;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class OrderService {

    private final OrderRepository orderRepository;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;
    private final RouteAllocationRepository routeAllocationRepository;
    private final StockBatchRepository stockBatchRepository;
    private final AuditService auditService;

    public OrderDtos.OrderResponse createOrder(OrderDtos.CreateOrderRequest req, UUID salesPersonId, UUID tenantId) {
        if (req.getCustomerId() == null && (req.getWalkInName() == null || req.getWalkInName().isBlank())) {
            throw new BusinessException("Either customer or walk-in name is required", "CUSTOMER_REQUIRED");
        }

        Customer customer = null;
        if (req.getCustomerId() != null) {
            customer = customerRepository.findByIdAndTenantId(req.getCustomerId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Customer", req.getCustomerId().toString()));
        }

        User salesPerson = userRepository.findByIdAndTenantId(salesPersonId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", salesPersonId.toString()));

        // Credit limit check — walk-in customers are always cash, no credit
        if (customer != null && customer.isCreditAllowed() && customer.getCreditLimit() != null
                && customer.getCreditLimit().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal outstanding = orderRepository.findTotalOutstandingByCustomer(tenantId, customer.getId(), Order.OrderStatus.CANCELLED);
            if (outstanding.compareTo(customer.getCreditLimit()) >= 0) {
                throw new BusinessException(
                    "Credit limit exceeded for " + customer.getBusinessName() +
                    ". Outstanding: ₹" + outstanding.setScale(2, RoundingMode.HALF_UP) +
                    " / Limit: ₹" + customer.getCreditLimit().setScale(2, RoundingMode.HALF_UP) +
                    ". Please collect payment before placing a new order.",
                    "CREDIT_LIMIT_EXCEEDED"
                );
            }
        }

        // Generate order number: ORD-2025-00001
        int seq = orderRepository.findMaxOrderSequence(tenantId) + 1;
        String orderNumber = String.format("ORD-%d-%05d", Year.now().getValue(), seq);

        // Collect products and FIFO batches in a single pass — reused for both validation and deduction
        Map<UUID, Product> productMap = new LinkedHashMap<>();
        Map<UUID, List<StockBatch>> fifoBatchMap = new LinkedHashMap<>();
        for (OrderDtos.OrderItemRequest itemReq : req.getItems()) {
            if (!productMap.containsKey(itemReq.getProductId())) {
                productMap.put(itemReq.getProductId(),
                    productRepository.findByIdAndTenantId(itemReq.getProductId(), tenantId)
                        .orElseThrow(() -> new ResourceNotFoundException("Product", itemReq.getProductId().toString())));
                fifoBatchMap.put(itemReq.getProductId(),
                    stockBatchRepository.findFifoByProduct(tenantId, itemReq.getProductId()));
            }
        }

        List<OrderItem> items = new ArrayList<>();
        BigDecimal subTotal = BigDecimal.ZERO;
        BigDecimal totalGst = BigDecimal.ZERO;

        for (OrderDtos.OrderItemRequest itemReq : req.getItems()) {
            Product product = productMap.get(itemReq.getProductId());
            List<StockBatch> fifo = fifoBatchMap.get(itemReq.getProductId());

            if (!product.isActive()) {
                throw new BusinessException("Product '" + product.getName() + "' is not active", "INACTIVE_PRODUCT");
            }

            int availableStock = product.getStockQuantity() != null ? product.getStockQuantity() : 0;
            if (availableStock < itemReq.getQuantity()) {
                throw new BusinessException(
                    "Insufficient stock for '" + product.getName() + "'. Available: " + availableStock + ", Requested: " + itemReq.getQuantity(),
                    "INSUFFICIENT_STOCK"
                );
            }

            BigDecimal unitPrice = (itemReq.getUnitPrice() != null) ? itemReq.getUnitPrice() : product.getSalesRate1();

            String primaryBatch = fifo.isEmpty() ? null : fifo.get(0).getBatchNumber();
            java.time.LocalDate primaryExpiry = fifo.isEmpty() ? null : fifo.get(0).getExpiryDate();

            BigDecimal effectiveMin = !fifo.isEmpty() && fifo.get(0).getMinSaleRate() != null
                ? fifo.get(0).getMinSaleRate() : product.getMinSaleRate();
            BigDecimal effectiveMax = !fifo.isEmpty() && fifo.get(0).getMaxSaleRate() != null
                ? fifo.get(0).getMaxSaleRate() : product.getMaxSaleRate();
            if (effectiveMin != null && unitPrice.compareTo(effectiveMin) < 0) {
                throw new BusinessException(
                    "Price ₹" + unitPrice + " for '" + product.getName() + "' is below the minimum allowed rate of ₹" + effectiveMin,
                    "PRICE_BELOW_MINIMUM"
                );
            }
            if (effectiveMax != null && unitPrice.compareTo(effectiveMax) > 0) {
                throw new BusinessException(
                    "Price ₹" + unitPrice + " for '" + product.getName() + "' exceeds the maximum allowed rate of ₹" + effectiveMax,
                    "PRICE_ABOVE_MAXIMUM"
                );
            }
            BigDecimal gstPercent = product.getSalesGstPercent();
            BigDecimal lineBase = unitPrice.multiply(BigDecimal.valueOf(itemReq.getQuantity()));
            BigDecimal gstAmt = lineBase.multiply(gstPercent).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            BigDecimal lineTotal = lineBase.add(gstAmt);

            OrderItem item = OrderItem.builder()
                    .product(product)
                    .quantity(itemReq.getQuantity())
                    .unitPrice(unitPrice)
                    .gstPercent(gstPercent)
                    .gstAmount(gstAmt)
                    .lineTotal(lineTotal)
                    .batchNumber(primaryBatch)
                    .batchExpiryDate(primaryExpiry)
                    .build();

            items.add(item);
            subTotal = subTotal.add(lineBase);
            totalGst = totalGst.add(gstAmt);
        }

        BigDecimal totalAmount = subTotal.add(totalGst);

        String orderParty = customer != null ? customer.getBusinessName() : req.getWalkInName();

        Order order = Order.builder()
                .tenant(customer != null ? customer.getTenant() : salesPerson.getTenant())
                .orderNumber(orderNumber)
                .customer(customer)
                .walkInName(customer == null ? req.getWalkInName() : null)
                .walkInPhone(customer == null ? req.getWalkInPhone() : null)
                .salesPerson(salesPerson)
                .orderDate(LocalDate.now())
                .status(Order.OrderStatus.SUBMITTED)
                .subTotal(subTotal)
                .totalGst(totalGst)
                .totalAmount(totalAmount)
                .balanceAmount(totalAmount)
                .notes(req.getNotes())
                .build();

        items.forEach(item -> item.setOrder(order));
        order.getItems().addAll(items);

        Order saved = orderRepository.save(order);
        auditService.record(tenantId, "ORDER", saved.getId(), "CREATED",
                "Order " + saved.getOrderNumber() + " created for " + orderParty +
                " — " + items.size() + " item(s), total ₹" + totalAmount.toPlainString());

        // FIFO batch deduction — reuse the already-fetched products and batches
        List<StockBatch> batchesToSave = new ArrayList<>();
        for (OrderDtos.OrderItemRequest itemReq : req.getItems()) {
            Product product = productMap.get(itemReq.getProductId());
            List<StockBatch> fifo = fifoBatchMap.get(itemReq.getProductId());

            int remaining = itemReq.getQuantity();
            if (fifo.isEmpty()) {
                int current = product.getStockQuantity() != null ? product.getStockQuantity() : 0;
                product.setStockQuantity(Math.max(0, current - itemReq.getQuantity()));
            } else {
                for (StockBatch batch : fifo) {
                    if (remaining <= 0) break;
                    int deduct = Math.min(batch.getQuantityAvailable(), remaining);
                    batch.setQuantityAvailable(batch.getQuantityAvailable() - deduct);
                    if (batch.getQuantityAvailable() == 0) batch.setActive(false);
                    batchesToSave.add(batch);
                    remaining -= deduct;
                }
                Integer newStock = stockBatchRepository.sumAvailableByProduct(tenantId, product.getId());
                product.setStockQuantity(newStock != null ? newStock : 0);
            }
        }
        stockBatchRepository.saveAll(batchesToSave);
        productRepository.saveAll(productMap.values());

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public OrderDtos.OrderResponse getOrderById(UUID id, UUID tenantId) {
        Order order = orderRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", id.toString()));
        return toResponse(order);
    }

    @Transactional(readOnly = true)
    public Page<OrderDtos.OrderResponse> getOrdersByStatus(
            UUID tenantId, Order.OrderStatus status, LocalDate from, LocalDate to, Pageable pageable) {
        return orderRepository.findFiltered(tenantId, status, from, to, pageable).map(this::toResponse);
    }

    public OrderDtos.OrderResponse approveOrder(UUID id, UUID invoicePersonId, UUID tenantId) {
        Order order = getOrderEntity(id, tenantId);
        validateStatus(order, Order.OrderStatus.SUBMITTED);

        User invoicePerson = userRepository.findByIdAndTenantId(invoicePersonId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", invoicePersonId.toString()));

        order.setStatus(Order.OrderStatus.APPROVED);
        order.setApprovedBy(invoicePerson);
        order.setApprovedAt(Instant.now());
        Order approvedOrder = orderRepository.save(order);
        auditService.record(tenantId, "ORDER", approvedOrder.getId(), "APPROVED",
                "Order " + approvedOrder.getOrderNumber() + " approved by " + invoicePerson.getFullName());
        return toResponse(approvedOrder);
    }

    public OrderDtos.OrderResponse updateOrder(UUID id, OrderDtos.UpdateOrderRequest req, UUID tenantId) {
        Order order = getOrderEntity(id, tenantId);
        if (order.getStatus() != Order.OrderStatus.SUBMITTED) {
            throw new BusinessException("Order can only be edited while in SUBMITTED status", "INVALID_STATUS");
        }

        // Restore stock for existing items before replacing them
        Map<UUID, Product> restoredProducts = new LinkedHashMap<>();
        for (OrderItem oldItem : order.getItems()) {
            Product product = oldItem.getProduct();
            if (oldItem.getBatchNumber() != null) {
                stockBatchRepository.findByTenantAndBatchNumber(tenantId, oldItem.getBatchNumber())
                    .ifPresent(batch -> {
                        batch.setQuantityAvailable(batch.getQuantityAvailable() + oldItem.getQuantity());
                        if (!batch.isActive()) batch.setActive(true);
                        stockBatchRepository.save(batch);
                    });
            }
            restoredProducts.put(product.getId(), product);
        }
        for (Product product : restoredProducts.values()) {
            Integer restored = stockBatchRepository.sumAvailableByProduct(tenantId, product.getId());
            product.setStockQuantity(restored != null ? restored : 0);
            productRepository.save(product);
        }

        // Replace items
        order.getItems().clear();

        // Process new items with FIFO deduction
        Map<UUID, Product> productMap = new LinkedHashMap<>();
        Map<UUID, List<StockBatch>> fifoBatchMap = new LinkedHashMap<>();
        for (OrderDtos.OrderItemRequest itemReq : req.getItems()) {
            if (!productMap.containsKey(itemReq.getProductId())) {
                productMap.put(itemReq.getProductId(),
                    productRepository.findByIdAndTenantId(itemReq.getProductId(), tenantId)
                        .orElseThrow(() -> new ResourceNotFoundException("Product", itemReq.getProductId().toString())));
                fifoBatchMap.put(itemReq.getProductId(),
                    stockBatchRepository.findFifoByProduct(tenantId, itemReq.getProductId()));
            }
        }

        List<OrderItem> newItems = new ArrayList<>();
        BigDecimal subTotal = BigDecimal.ZERO;
        BigDecimal totalGst  = BigDecimal.ZERO;

        for (OrderDtos.OrderItemRequest itemReq : req.getItems()) {
            Product product = productMap.get(itemReq.getProductId());
            List<StockBatch> fifo = fifoBatchMap.get(itemReq.getProductId());

            if (!product.isActive()) {
                throw new BusinessException("Product '" + product.getName() + "' is not active", "INACTIVE_PRODUCT");
            }
            int availableStock = product.getStockQuantity() != null ? product.getStockQuantity() : 0;
            if (availableStock < itemReq.getQuantity()) {
                throw new BusinessException(
                    "Insufficient stock for '" + product.getName() + "'. Available: " + availableStock + ", Requested: " + itemReq.getQuantity(),
                    "INSUFFICIENT_STOCK");
            }

            BigDecimal unitPrice = (itemReq.getUnitPrice() != null) ? itemReq.getUnitPrice() : product.getSalesRate1();
            String primaryBatch   = fifo.isEmpty() ? null : fifo.get(0).getBatchNumber();
            LocalDate primaryExpiry = fifo.isEmpty() ? null : fifo.get(0).getExpiryDate();

            BigDecimal effectiveMin = !fifo.isEmpty() && fifo.get(0).getMinSaleRate() != null ? fifo.get(0).getMinSaleRate() : product.getMinSaleRate();
            BigDecimal effectiveMax = !fifo.isEmpty() && fifo.get(0).getMaxSaleRate() != null ? fifo.get(0).getMaxSaleRate() : product.getMaxSaleRate();
            if (effectiveMin != null && unitPrice.compareTo(effectiveMin) < 0) {
                throw new BusinessException("Price ₹" + unitPrice + " for '" + product.getName() + "' is below the minimum allowed rate of ₹" + effectiveMin, "PRICE_BELOW_MINIMUM");
            }
            if (effectiveMax != null && unitPrice.compareTo(effectiveMax) > 0) {
                throw new BusinessException("Price ₹" + unitPrice + " for '" + product.getName() + "' exceeds the maximum allowed rate of ₹" + effectiveMax, "PRICE_ABOVE_MAXIMUM");
            }

            BigDecimal gstPercent = product.getSalesGstPercent();
            BigDecimal lineBase   = unitPrice.multiply(BigDecimal.valueOf(itemReq.getQuantity()));
            BigDecimal gstAmt     = lineBase.multiply(gstPercent).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            BigDecimal lineTotal  = lineBase.add(gstAmt);

            newItems.add(OrderItem.builder()
                .product(product).quantity(itemReq.getQuantity())
                .unitPrice(unitPrice).gstPercent(gstPercent).gstAmount(gstAmt).lineTotal(lineTotal)
                .batchNumber(primaryBatch).batchExpiryDate(primaryExpiry).build());
            subTotal = subTotal.add(lineBase);
            totalGst = totalGst.add(gstAmt);
        }

        BigDecimal totalAmount = subTotal.add(totalGst);
        if (req.getNotes() != null) order.setNotes(req.getNotes());
        order.setSubTotal(subTotal);
        order.setTotalGst(totalGst);
        order.setTotalAmount(totalAmount);
        order.setBalanceAmount(totalAmount);
        newItems.forEach(item -> item.setOrder(order));
        order.getItems().addAll(newItems);
        Order saved = orderRepository.save(order);

        // FIFO batch deduction for new items
        List<StockBatch> batchesToSave = new ArrayList<>();
        for (OrderDtos.OrderItemRequest itemReq : req.getItems()) {
            Product product = productMap.get(itemReq.getProductId());
            List<StockBatch> fifo = fifoBatchMap.get(itemReq.getProductId());
            int remaining = itemReq.getQuantity();
            if (fifo.isEmpty()) {
                product.setStockQuantity(Math.max(0, (product.getStockQuantity() != null ? product.getStockQuantity() : 0) - itemReq.getQuantity()));
            } else {
                for (StockBatch batch : fifo) {
                    if (remaining <= 0) break;
                    int deduct = Math.min(batch.getQuantityAvailable(), remaining);
                    batch.setQuantityAvailable(batch.getQuantityAvailable() - deduct);
                    if (batch.getQuantityAvailable() == 0) batch.setActive(false);
                    batchesToSave.add(batch);
                    remaining -= deduct;
                }
                Integer newStock = stockBatchRepository.sumAvailableByProduct(tenantId, product.getId());
                product.setStockQuantity(newStock != null ? newStock : 0);
            }
        }
        stockBatchRepository.saveAll(batchesToSave);
        productRepository.saveAll(productMap.values());

        auditService.record(tenantId, "ORDER", saved.getId(), "UPDATED",
            "Order " + saved.getOrderNumber() + " items updated by invoice approver — " + newItems.size() + " item(s), total ₹" + totalAmount.toPlainString());
        return toResponse(saved);
    }

    public OrderDtos.OrderResponse startPreparing(UUID id, UUID tenantId) {
        Order order = getOrderEntity(id, tenantId);
        validateStatus(order, Order.OrderStatus.APPROVED);
        order.setStatus(Order.OrderStatus.PREPARING);
        Order saved = orderRepository.save(order);
        auditService.record(tenantId, "ORDER", saved.getId(), "PREPARING",
                "Order " + saved.getOrderNumber() + " moved to picking/preparing");
        return toResponse(saved);
    }

    public OrderDtos.OrderResponse verifyItems(UUID id, OrderDtos.VerifyItemsRequest req, UUID tenantId) {
        Order order = getOrderEntity(id, tenantId);
        req.getItems().forEach(v -> order.getItems().stream()
                .filter(item -> item.getId().equals(v.getItemId()))
                .findFirst()
                .ifPresent(item -> {
                    item.setVerifiedQuantity(v.getVerifiedQuantity());
                    item.setVerified(true);
                }));
        return toResponse(orderRepository.save(order));
    }

    public OrderDtos.OrderResponse markPrepared(UUID id, UUID tenantId) {
        Order order = getOrderEntity(id, tenantId);
        validateStatus(order, Order.OrderStatus.PREPARING);
        boolean allVerified = order.getItems().stream().allMatch(OrderItem::isVerified);
        if (!allVerified) throw new BusinessException("All items must be verified before marking prepared", "ITEMS_NOT_VERIFIED");
        order.setStatus(Order.OrderStatus.PREPARED);
        order.setPreparedAt(Instant.now());
        Order saved = orderRepository.save(order);
        auditService.record(tenantId, "ORDER", saved.getId(), "PREPARED",
                "Order " + saved.getOrderNumber() + " items verified and marked prepared");
        return toResponse(saved);
    }

    public OrderDtos.OrderResponse assignDelivery(UUID id, OrderDtos.AssignDeliveryRequest req, UUID tenantId) {
        Order order = getOrderEntity(id, tenantId);
        User deliveryPerson = userRepository.findByIdAndTenantId(req.getDeliveryPersonId(), tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", req.getDeliveryPersonId().toString()));
        order.setDeliveryPerson(deliveryPerson);
        Order saved = orderRepository.save(order);
        auditService.record(tenantId, "ORDER", saved.getId(), "ASSIGNED",
                "Order " + saved.getOrderNumber() + " assigned to delivery person: " + deliveryPerson.getFullName());
        return toResponse(saved);
    }

    public OrderDtos.OrderResponse markDispatched(UUID id, UUID tenantId) {
        Order order = getOrderEntity(id, tenantId);
        validateStatus(order, Order.OrderStatus.PREPARED);
        order.setStatus(Order.OrderStatus.DISPATCHED);
        order.setDispatchedAt(Instant.now());
        Order saved = orderRepository.save(order);
        auditService.record(tenantId, "ORDER", saved.getId(), "DISPATCHED",
                "Order " + saved.getOrderNumber() + " dispatched for delivery");
        return toResponse(saved);
    }

    public OrderDtos.OrderResponse markDelivered(UUID id, UUID tenantId) {
        Order order = getOrderEntity(id, tenantId);
        validateStatus(order, Order.OrderStatus.DISPATCHED);
        order.setStatus(Order.OrderStatus.DELIVERED);
        order.setDeliveredAt(Instant.now());
        Order saved = orderRepository.save(order);
        auditService.record(tenantId, "ORDER", saved.getId(), "DELIVERED",
                "Order " + saved.getOrderNumber() + " delivered to " + order.getCustomer().getBusinessName());
        return toResponse(saved);
    }

    public OrderDtos.OrderResponse cancelOrder(UUID id, String reason, UUID tenantId) {
        Order order = getOrderEntity(id, tenantId);
        if (order.getStatus() != Order.OrderStatus.DRAFT && order.getStatus() != Order.OrderStatus.SUBMITTED) {
            throw new BusinessException("Cannot cancel order in status: " + order.getStatus(), "INVALID_STATUS");
        }
        order.setStatus(Order.OrderStatus.CANCELLED);
        order.setNotes(reason);
        Order saved = orderRepository.save(order);
        auditService.record(tenantId, "ORDER", saved.getId(), "CANCELLED",
                "Order " + saved.getOrderNumber() + " cancelled" + (reason != null && !reason.isBlank() ? ": " + reason : ""));
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<OrderDtos.OrderResponse> getMyOrders(UUID salesPersonId, UUID tenantId) {
        return orderRepository.findByTenantIdAndSalesPersonIdAndOrderDate(tenantId, salesPersonId, LocalDate.now())
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<OrderDtos.OrderResponse> getMyDeliveries(UUID deliveryPersonId, UUID tenantId) {
        List<UUID> routeIds = routeAllocationRepository
                .findByTenantIdAndDeliveryPersonId(tenantId, deliveryPersonId)
                .stream().map(a -> a.getRoute().getId()).distinct().collect(Collectors.toList());
        if (routeIds.isEmpty()) return List.of();
        return orderRepository.findByTenantIdAndStatusInAndRouteIds(tenantId,
                List.of(Order.OrderStatus.PREPARED, Order.OrderStatus.DISPATCHED), routeIds)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<OrderDtos.RoutePicklistResponse> getRoutePicklist(UUID tenantId, LocalDate date) {
        List<Order.OrderStatus> statuses = List.of(
            Order.OrderStatus.APPROVED, Order.OrderStatus.PREPARING, Order.OrderStatus.PREPARED);
        List<Order> orders = orderRepository.findByTenantDateAndStatuses(tenantId, date, statuses);

        Map<UUID, List<Order>> byRoute = new LinkedHashMap<>();
        for (Order o : orders) {
            if (o.getCustomer() == null || o.getCustomer().getRoute() == null) continue;
            byRoute.computeIfAbsent(o.getCustomer().getRoute().getId(), k -> new ArrayList<>()).add(o);
        }

        return byRoute.entrySet().stream().map(entry -> {
            List<Order> routeOrders = entry.getValue();
            var route = routeOrders.get(0).getCustomer().getRoute();

            Map<UUID, OrderDtos.RoutePicklistResponse.PickItem> pickMap = new LinkedHashMap<>();
            for (Order order : routeOrders) {
                for (OrderItem item : order.getItems()) {
                    UUID prodId = item.getProduct().getId();
                    OrderDtos.RoutePicklistResponse.PickItem pi = pickMap.computeIfAbsent(prodId, k -> {
                        OrderDtos.RoutePicklistResponse.PickItem p = new OrderDtos.RoutePicklistResponse.PickItem();
                        p.setProductId(prodId);
                        p.setProductName(item.getProduct().getName());
                        p.setBrand(item.getProduct().getBrand());
                        p.setUnit(item.getProduct().getUnit());
                        p.setTotalQuantity(0);
                        p.setBreakdown(new ArrayList<>());
                        return p;
                    });
                    pi.setTotalQuantity(pi.getTotalQuantity() + item.getQuantity());
                    OrderDtos.RoutePicklistResponse.CustomerQty cq = new OrderDtos.RoutePicklistResponse.CustomerQty();
                    cq.setCustomerId(order.getCustomer().getId());
                    cq.setOrderId(order.getId());
                    cq.setOrderNumber(order.getOrderNumber());
                    cq.setBusinessName(order.getCustomer().getBusinessName());
                    cq.setQuantity(item.getQuantity());
                    pi.getBreakdown().add(cq);
                }
            }

            long approved  = routeOrders.stream().filter(o -> o.getStatus() == Order.OrderStatus.APPROVED).count();
            long preparing = routeOrders.stream().filter(o -> o.getStatus() == Order.OrderStatus.PREPARING).count();
            long prepared  = routeOrders.stream().filter(o -> o.getStatus() == Order.OrderStatus.PREPARED).count();

            OrderDtos.RoutePicklistResponse res = new OrderDtos.RoutePicklistResponse();
            res.setRouteId(entry.getKey());
            res.setRouteName(route.getName());
            res.setDate(date);
            res.setTotalOrders(routeOrders.size());
            res.setApprovedCount((int) approved);
            res.setPreparingCount((int) preparing);
            res.setPreparedCount((int) prepared);
            res.setPickList(new ArrayList<>(pickMap.values()));
            res.setOrders(routeOrders.stream().map(o -> {
                OrderDtos.RoutePicklistResponse.RouteOrderSummary s = new OrderDtos.RoutePicklistResponse.RouteOrderSummary();
                s.setOrderId(o.getId());
                s.setOrderNumber(o.getOrderNumber());
                s.setCustomerName(o.getCustomer().getBusinessName());
                s.setStatus(o.getStatus().name());
                s.setTotalAmount(o.getTotalAmount());
                s.setItemCount(o.getItems().size());
                return s;
            }).collect(Collectors.toList()));
            return res;
        }).collect(Collectors.toList());
    }

    public void routeStartPreparing(UUID tenantId, UUID routeId, LocalDate date) {
        List<Order> orders = orderRepository.findByTenantRouteAndDateAndStatus(
            tenantId, routeId, date, Order.OrderStatus.APPROVED);
        orders.forEach(o -> o.setStatus(Order.OrderStatus.PREPARING));
        orderRepository.saveAll(orders);
        orders.forEach(o -> auditService.record(tenantId, "ORDER", o.getId(), "PREPARING",
            "Order " + o.getOrderNumber() + " moved to preparing via route picklist"));
    }

    public void routeMarkPrepared(UUID tenantId, UUID routeId, LocalDate date) {
        List<Order> orders = orderRepository.findByTenantRouteAndDateAndStatus(
            tenantId, routeId, date, Order.OrderStatus.PREPARING);
        Instant now = Instant.now();
        orders.forEach(o -> {
            o.getItems().forEach(item -> {
                if (!item.isVerified()) {
                    item.setVerifiedQuantity(item.getQuantity());
                    item.setVerified(true);
                }
            });
            o.setStatus(Order.OrderStatus.PREPARED);
            o.setPreparedAt(now);
        });
        orderRepository.saveAll(orders);
        orders.forEach(o -> auditService.record(tenantId, "ORDER", o.getId(), "PREPARED",
            "Order " + o.getOrderNumber() + " prepared via route picklist"));
    }

    private Order getOrderEntity(UUID id, UUID tenantId) {
        return orderRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", id.toString()));
    }

    private void validateStatus(Order order, Order.OrderStatus expected) {
        if (order.getStatus() != expected) {
            throw new BusinessException(
                "Expected order status " + expected + " but was " + order.getStatus(), "INVALID_STATUS");
        }
    }

    private OrderDtos.OrderResponse toResponse(Order o) {
        OrderDtos.OrderResponse res = new OrderDtos.OrderResponse();
        res.setId(o.getId());
        res.setOrderNumber(o.getOrderNumber());
        res.setStatus(o.getStatus());
        res.setOrderDate(o.getOrderDate());
        res.setNotes(o.getNotes());
        res.setSubTotal(o.getSubTotal());
        res.setTotalGst(o.getTotalGst());
        res.setTotalAmount(o.getTotalAmount());
        res.setPaidAmount(o.getPaidAmount());
        res.setBalanceAmount(o.getBalanceAmount());
        res.setInvoiceUrl(o.getInvoiceUrl());
        res.setApprovedAt(o.getApprovedAt());
        res.setPreparedAt(o.getPreparedAt());
        res.setDispatchedAt(o.getDispatchedAt());
        res.setDeliveredAt(o.getDeliveredAt());
        res.setCreatedAt(o.getCreatedAt());
        res.setWalkInName(o.getWalkInName());
        res.setWalkInPhone(o.getWalkInPhone());

        if (o.getCustomer() != null) {
            OrderDtos.CustomerInfo ci = new OrderDtos.CustomerInfo();
            ci.setId(o.getCustomer().getId());
            ci.setBusinessName(o.getCustomer().getBusinessName());
            ci.setOwnerName(o.getCustomer().getOwnerName());
            ci.setPhone(o.getCustomer().getPhone());
            ci.setAddress(o.getCustomer().getAddress());
            ci.setLatitude(o.getCustomer().getLatitude());
            ci.setLongitude(o.getCustomer().getLongitude());
            res.setCustomer(ci);
        }

        if (o.getSalesPerson() != null) res.setSalesPerson(toPerson(o.getSalesPerson()));
        if (o.getDeliveryPerson() != null) res.setDeliveryPerson(toPerson(o.getDeliveryPerson()));
        if (o.getApprovedBy() != null) res.setApprovedBy(toPerson(o.getApprovedBy()));

        List<OrderDtos.OrderItemResponse> items = o.getItems().stream().map(item -> {
            OrderDtos.OrderItemResponse ir = new OrderDtos.OrderItemResponse();
            ir.setId(item.getId());
            ir.setQuantity(item.getQuantity());
            ir.setUnitPrice(item.getUnitPrice());
            ir.setGstPercent(item.getGstPercent());
            ir.setGstAmount(item.getGstAmount());
            ir.setLineTotal(item.getLineTotal());
            ir.setBatchNumber(item.getBatchNumber());
            ir.setBatchExpiryDate(item.getBatchExpiryDate());
            ir.setVerified(item.isVerified());
            ir.setVerifiedQuantity(item.getVerifiedQuantity());
            if (item.getProduct() != null) {
                OrderDtos.ProductInfo pi = new OrderDtos.ProductInfo();
                pi.setId(item.getProduct().getId());
                pi.setName(item.getProduct().getName());
                pi.setBrand(item.getProduct().getBrand());
                pi.setUnit(item.getProduct().getUnit());
                pi.setImageUrl(item.getProduct().getImageUrl());
                ir.setProduct(pi);
            }
            return ir;
        }).collect(Collectors.toList());
        res.setItems(items);

        return res;
    }

    private OrderDtos.PersonInfo toPerson(User u) {
        OrderDtos.PersonInfo p = new OrderDtos.PersonInfo();
        p.setId(u.getId());
        p.setFullName(u.getFullName());
        p.setPhone(u.getPhone());
        return p;
    }
}
