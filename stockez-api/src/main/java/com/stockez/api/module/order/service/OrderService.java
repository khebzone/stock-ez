package com.stockez.api.module.order.service;

import com.stockez.api.module.customer.entity.Customer;
import com.stockez.api.module.customer.repository.CustomerRepository;
import com.stockez.api.module.goodsreturn.entity.GoodsReturn;
import com.stockez.api.module.goodsreturn.repository.GoodsReturnRepository;
import com.stockez.api.module.order.dto.OrderDtos;
import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.order.entity.OrderItem;
import com.stockez.api.module.order.entity.Payment;
import com.stockez.api.module.order.repository.OrderRepository;
import com.stockez.api.module.order.repository.PaymentRepository;
import com.stockez.api.module.product.entity.Product;
import com.stockez.api.module.product.repository.ProductRepository;
import com.stockez.api.module.purchase.entity.StockBatch;
import com.stockez.api.module.purchase.repository.StockBatchRepository;
import com.stockez.api.module.payment.entity.PaymentMethod;
import com.stockez.api.module.payment.repository.PaymentMethodRepository;
import com.stockez.api.module.route.entity.RouteAllocation;
import com.stockez.api.module.route.repository.RouteAllocationRepository;
import com.stockez.api.module.stockshortage.entity.StockShortage;
import com.stockez.api.module.stockshortage.service.StockShortageService;
import com.stockez.api.module.tenant.entity.TenantSettings;
import com.stockez.api.module.tenant.repository.TenantSettingsRepository;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import com.stockez.api.module.audit.service.AuditService;
import com.stockez.api.module.tracking.entity.CustomerVisit;
import com.stockez.api.module.tracking.service.GeoContext;
import com.stockez.api.module.tracking.service.VisitStamp;
import com.stockez.api.module.tracking.service.VisitStampService;
import com.stockez.common.exception.BusinessException;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Year;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
    private final PaymentMethodRepository paymentMethodRepository;
    private final RouteAllocationRepository routeAllocationRepository;
    private final StockBatchRepository stockBatchRepository;
    private final TenantSettingsRepository tenantSettingsRepository;
    private final AuditService auditService;
    private final VisitStampService visitStampService;
    private final GeoContext geoContext;
    private final StockShortageService stockShortageService;
    private final GoodsReturnRepository goodsReturnRepository;
    private final com.stockez.api.module.route.service.RouteAllocationService routeAllocationService;
    private final com.stockez.api.module.goodsreturn.service.GoodsReturnService goodsReturnService;

    public Map<UUID, List<OrderDtos.PriceEntry>> getCustomerLastPrices(UUID tenantId, UUID customerId) {
        List<Object[]> rows = orderRepository.findAllBilledPricesForCustomer(tenantId, customerId, Order.OrderStatus.CANCELLED);
        Map<UUID, List<OrderDtos.PriceEntry>> result = new LinkedHashMap<>();
        for (Object[] row : rows) {
            UUID productId = (UUID) row[0];
            BigDecimal price = (BigDecimal) row[1];
            LocalDate date = (LocalDate) row[2];
            List<OrderDtos.PriceEntry> entries = result.computeIfAbsent(productId, k -> new ArrayList<>());
            if (entries.size() < 3) {
                OrderDtos.PriceEntry entry = new OrderDtos.PriceEntry();
                entry.setPrice(price);
                entry.setDate(date);
                entries.add(entry);
            }
        }
        return result;
    }

    private void assertSalesGatePassOpen(Customer customer, UUID salesPersonId, UUID tenantId) {
        if (customer.getRoute() == null) return;
        routeAllocationRepository
                .findByTenantIdAndRouteIdAndAllocationDate(tenantId, customer.getRoute().getId(), LocalDate.now())
                .filter(a -> a.isSalesCompleted()
                        && a.getSalesPerson() != null
                        && a.getSalesPerson().getId().equals(salesPersonId))
                .ifPresent(a -> { throw new BusinessException(
                        "Sales Gate Pass for route '" + customer.getRoute().getName()
                                + "' is completed for today. Billing on this route is closed.",
                        "SALES_GATE_PASS_COMPLETED"); });
    }

    /**
     * Credit limit gate, applied to every path that puts money on a customer's account.
     *
     * Two distinct failures, because the salesman needs to know which one he hit and what to do:
     * the shop is already over its limit (nothing can be billed until money is collected), or
     * this particular bill is what pushes them over (trim it, or take part payment now).
     *
     * @param creditAmount how much of this bill goes on account — the whole total for a sales
     *                     order, the total less cash collected for a counter sale. A bill paid
     *                     in full adds no exposure and is never blocked on these grounds.
     */
    private void assertWithinCreditLimit(TenantSettings settings, Customer customer,
                                         UUID tenantId, BigDecimal creditAmount) {
        if (settings == null
                || settings.getCreditLimitEnforcement() == TenantSettings.CreditLimitEnforcement.DISABLED) return;
        if (customer == null || !customer.isCreditAllowed()) return;

        BigDecimal limit = customer.getCreditLimit();
        if (limit == null || limit.compareTo(BigDecimal.ZERO) <= 0) return;

        // Nothing new goes on account — a counter sale paid in full, or an order being reduced.
        // Neither adds to what the shop owes, so neither is blocked: refusing them would stop the
        // very transactions that bring an over-limit shop back under its limit.
        BigDecimal onAccount = creditAmount != null ? creditAmount.max(BigDecimal.ZERO) : BigDecimal.ZERO;
        if (onAccount.signum() == 0) return;

        BigDecimal outstanding = orderRepository.findTotalOutstandingByCustomer(
                tenantId, customer.getId(), Order.OrderStatus.CANCELLED);

        if (outstanding.compareTo(limit) >= 0) {
            throw new BusinessException(
                "Credit limit reached for " + customer.getBusinessName()
                + ". Outstanding ₹" + money(outstanding) + " against a limit of ₹" + money(limit)
                + ". Collect payment before billing this shop again.",
                "CREDIT_LIMIT_EXCEEDED");
        }

        BigDecimal available = limit.subtract(outstanding);
        if (onAccount.compareTo(available) > 0) {
            throw new BusinessException(
                "This bill would take " + customer.getBusinessName() + " past their credit limit."
                + " Outstanding ₹" + money(outstanding) + " of a ₹" + money(limit) + " limit, so only ₹"
                + money(available) + " of credit is left — but this bill puts ₹" + money(onAccount)
                + " on account. Reduce the order, or collect ₹" + money(onAccount.subtract(available))
                + " now to bill it.",
                "CREDIT_LIMIT_WOULD_EXCEED");
        }
    }

    private static String money(BigDecimal v) {
        return (v != null ? v : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    /** ADMIN or anyone who can view the full Gate Pass board — everyone else may only attribute to their own Gate Pass. */
    private boolean hasBroadGatePassAccess() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        return auth.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("GATE_PASS_VIEW"));
    }

    public OrderDtos.OrderResponse createOrder(OrderDtos.CreateOrderRequest req, UUID salesPersonId, UUID tenantId) {
        TenantSettings settings = tenantSettingsRepository.findByTenantId(tenantId)
                .orElseGet(TenantSettings::new);

        Customer customer = customerRepository.findByIdAndTenantId(req.getCustomerId(), tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", req.getCustomerId().toString()));

        User salesPerson = userRepository.findByIdAndTenantId(salesPersonId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", salesPersonId.toString()));

        assertSalesGatePassOpen(customer, salesPersonId, tenantId);

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

            BigDecimal unitPrice = (itemReq.getUnitPrice() != null) ? itemReq.getUnitPrice() : product.getMaxSaleRate();

            String primaryBatch = fifo.isEmpty() ? null : fifo.get(0).getBatchNumber();
            java.time.LocalDate primaryExpiry = fifo.isEmpty() ? null : fifo.get(0).getExpiryDate();
            BigDecimal batchMrp = !fifo.isEmpty() && fifo.get(0).getMrp() != null
                ? fifo.get(0).getMrp() : product.getMrp();

            BigDecimal effectiveMin = !fifo.isEmpty() && fifo.get(0).getMinSaleRate() != null
                ? fifo.get(0).getMinSaleRate() : product.getMinSaleRate();
            BigDecimal effectiveMax = !fifo.isEmpty() && fifo.get(0).getMaxSaleRate() != null
                ? fifo.get(0).getMaxSaleRate() : product.getMaxSaleRate();
            checkCrossBatchConflict(product, fifo, itemReq.getQuantity());
            if (!canOverridePriceRange() && effectiveMin != null && unitPrice.compareTo(effectiveMin) < 0) {
                throw new BusinessException(
                    "Price ₹" + unitPrice + " for '" + product.getName() + "' is below the minimum allowed rate of ₹" + effectiveMin,
                    "PRICE_BELOW_MINIMUM"
                );
            }
            if (!canOverridePriceRange() && effectiveMax != null && unitPrice.compareTo(effectiveMax) > 0) {
                throw new BusinessException(
                    "Price ₹" + unitPrice + " for '" + product.getName() + "' exceeds the maximum allowed rate of ₹" + effectiveMax,
                    "PRICE_ABOVE_MAXIMUM"
                );
            }
            BigDecimal gstPercent = product.getSalesGstPercent();
            BigDecimal lineGross  = unitPrice.multiply(BigDecimal.valueOf(itemReq.getQuantity()));
            BigDecimal discAmt, discPct;
            if (itemReq.getDiscountAmount() != null && itemReq.getDiscountAmount().compareTo(BigDecimal.ZERO) > 0) {
                discAmt = itemReq.getDiscountAmount();
                discPct = lineGross.compareTo(BigDecimal.ZERO) > 0
                    ? discAmt.multiply(BigDecimal.valueOf(100)).divide(lineGross, 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            } else {
                discPct = itemReq.getDiscountPercent() != null ? itemReq.getDiscountPercent() : BigDecimal.ZERO;
                discAmt = lineGross.multiply(discPct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            }
            BigDecimal lineTotal  = lineGross.subtract(discAmt);
            BigDecimal divisor    = BigDecimal.valueOf(100).add(gstPercent);
            BigDecimal lineBase   = lineTotal.multiply(BigDecimal.valueOf(100)).divide(divisor, 2, RoundingMode.HALF_UP);
            BigDecimal gstAmt     = lineTotal.subtract(lineBase);

            OrderItem item = OrderItem.builder()
                    .product(product)
                    .quantity(itemReq.getQuantity())
                    .mrp(batchMrp)
                    .unitPrice(unitPrice)
                    .discountPercent(discPct)
                    .discountAmount(discAmt)
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

        BigDecimal overallDiscount = applyOverallDiscount(items, req.getOverallDiscountType(), req.getOverallDiscountValue());
        if (overallDiscount.compareTo(BigDecimal.ZERO) > 0) {
            subTotal = sumLineBase(items);
            totalGst = sumGst(items);
        }

        BigDecimal rawTotal = subTotal.add(totalGst);
        BigDecimal totalAmount = rawTotal.setScale(0, RoundingMode.HALF_UP);
        BigDecimal roundOff = totalAmount.subtract(rawTotal);

        // A sales order is billed entirely on account, so the whole total is new credit exposure.
        // Checked here, once the total is known, so an order that CROSSES the limit is caught too —
        // not just one placed when the shop is already over it.
        assertWithinCreditLimit(settings, customer, tenantId, totalAmount);

        Order order = Order.builder()
                .tenant(customer.getTenant())
                .orderNumber(orderNumber)
                .customer(customer)
                .salesPerson(salesPerson)
                .orderDate(LocalDate.now())
                .status(settings.isInvoiceApprovalRequired() ? Order.OrderStatus.SUBMITTED : Order.OrderStatus.APPROVED)
                .subTotal(subTotal)
                .totalGst(totalGst)
                .overallDiscountType(overallDiscount.compareTo(BigDecimal.ZERO) > 0 ? req.getOverallDiscountType() : null)
                .overallDiscountValue(overallDiscount.compareTo(BigDecimal.ZERO) > 0 ? req.getOverallDiscountValue() : null)
                .overallDiscountAmount(overallDiscount)
                .totalAmount(totalAmount)
                .roundOffAmount(roundOff)
                .balanceAmount(totalAmount)
                .notes(req.getNotes())
                .build();

        items.forEach(item -> item.setOrder(order));
        order.getItems().addAll(items);

        Order saved = orderRepository.save(order);
        auditService.record(tenantId, "ORDER", saved.getId(), "CREATED",
                "Order " + saved.getOrderNumber() + " created for " + customer.getBusinessName() +
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
                int newStock = fifo.stream().mapToInt(b -> b.getQuantityAvailable() != null ? b.getQuantityAvailable() : 0).sum();
                product.setStockQuantity(newStock);
            }
        }
        stockBatchRepository.saveAll(batchesToSave);
        productRepository.saveAll(productMap.values());

        stampVisit(tenantId, salesPersonId, customer.getId(),
                CustomerVisit.Outcome.ORDER_PLACED, saved.getId(), null, null);

        return toResponse(saved);
    }

    /**
     * Records where the biller was standing. Deliberately last and deliberately silent: tracking is
     * an observation of the sale, never a precondition for it.
     */
    private void stampVisit(UUID tenantId, UUID userId, UUID customerId,
                            CustomerVisit.Outcome outcome, UUID orderId, UUID paymentId, String reason) {
        GeoContext.Position pos = geoContext.current();
        visitStampService.stampQuietly(VisitStamp.builder()
                .tenantId(tenantId)
                .userId(userId)
                .customerId(customerId)
                .outcome(outcome)
                .orderId(orderId)
                .paymentId(paymentId)
                .latitude(pos.latitude())
                .longitude(pos.longitude())
                .accuracyM(pos.accuracyM())
                .reason(reason)
                .build());
    }

    @Transactional(readOnly = true)
    public OrderDtos.OrderResponse getOrderById(UUID id, UUID tenantId) {
        Order order = orderRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", id.toString()));
        OrderDtos.OrderResponse res = toResponse(order);
        if (res.getCustomer() != null && order.getCustomer() != null) {
            res.getCustomer().setCustomerOutstanding(
                orderRepository.findTotalOutstandingByCustomer(tenantId, order.getCustomer().getId(), Order.OrderStatus.CANCELLED));
        }
        return res;
    }

    /** All invoices for one delivery run — the DISPATCHED orders stamped to the allocation (what actually went out). */
    @Transactional(readOnly = true)
    public List<OrderDtos.OrderResponse> getDeliveryRunInvoices(UUID allocationId, UUID tenantId) {
        List<Order> orders = orderRepository.findRunInvoices(tenantId, allocationId,
                List.of(Order.OrderStatus.DISPATCHED));
        return orders.stream().map(order -> {
            OrderDtos.OrderResponse res = toResponse(order);
            if (res.getCustomer() != null && order.getCustomer() != null) {
                res.getCustomer().setCustomerOutstanding(
                    orderRepository.findTotalOutstandingByCustomer(tenantId, order.getCustomer().getId(), Order.OrderStatus.CANCELLED));
            }
            return res;
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<OrderDtos.OrderResponse> getOrdersByStatus(
            UUID tenantId, Order.OrderStatus status, LocalDate from, LocalDate to,
            UUID salesPersonId, UUID routeId, String search, Pageable pageable) {
        LocalDate fromParam = from != null ? from : LocalDate.of(1900, 1, 1);
        LocalDate toParam   = to   != null ? to   : LocalDate.of(2999, 12, 31);
        String searchParam  = (search != null && !search.isBlank()) ? "%" + search.trim().toLowerCase() + "%" : null;
        return orderRepository.findFiltered(tenantId, status, fromParam, toParam, salesPersonId, routeId, searchParam, pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getOrderSalespersons(UUID tenantId) {
        return orderRepository.findDistinctSalespersons(tenantId).stream()
                .map(row -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", row[0]);
                    m.put("name", row[1]);
                    return m;
                })
                .collect(Collectors.toList());
    }

    /**
     * deliveredByUserId is opt-in and additive — when null (the default, used by every
     * existing caller: Invoice Approver, admin Orders list, etc.) behavior is unchanged.
     * When set, scopes to orders whose route allocation stamp shows this user as the
     * delivery person — so a delivery-only field role picking a "Reference Order" for a
     * Sales Return only sees orders they themselves delivered, not the whole tenant's.
     */
    public List<OrderDtos.OrderResponse> getAllOrders(UUID tenantId, Order.OrderStatus status, UUID deliveredByUserId) {
        return orderRepository.findAllFiltered(tenantId, status)
                .stream()
                .filter(o -> deliveredByUserId == null
                        || (o.getRouteAllocation() != null
                            && o.getRouteAllocation().getDeliveryPerson() != null
                            && o.getRouteAllocation().getDeliveryPerson().getId().equals(deliveredByUserId)))
                .map(this::toResponse).collect(java.util.stream.Collectors.toList());
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

    /** Approve every listed order in a single request/transaction instead of one call per order.
     *  Each order is validated and saved independently — one order failing (e.g. already actioned
     *  by someone else) doesn't block or roll back the others in the batch. */
    public OrderDtos.BulkApproveResponse approveOrders(List<UUID> orderIds, UUID invoicePersonId, UUID tenantId) {
        User invoicePerson = userRepository.findByIdAndTenantId(invoicePersonId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", invoicePersonId.toString()));

        int approved = 0;
        List<OrderDtos.BulkApproveResponse.BulkApproveFailure> failures = new ArrayList<>();
        for (UUID id : orderIds) {
            try {
                Order order = getOrderEntity(id, tenantId);
                validateStatus(order, Order.OrderStatus.SUBMITTED);
                order.setStatus(Order.OrderStatus.APPROVED);
                order.setApprovedBy(invoicePerson);
                order.setApprovedAt(Instant.now());
                Order approvedOrder = orderRepository.save(order);
                auditService.record(tenantId, "ORDER", approvedOrder.getId(), "APPROVED",
                        "Order " + approvedOrder.getOrderNumber() + " approved by " + invoicePerson.getFullName() + " (bulk)");
                approved++;
            } catch (Exception e) {
                OrderDtos.BulkApproveResponse.BulkApproveFailure failure = new OrderDtos.BulkApproveResponse.BulkApproveFailure();
                failure.setOrderId(id);
                orderRepository.findByIdAndTenantId(id, tenantId).ifPresent(o -> failure.setOrderNumber(o.getOrderNumber()));
                failure.setReason(e.getMessage());
                failures.add(failure);
            }
        }

        OrderDtos.BulkApproveResponse response = new OrderDtos.BulkApproveResponse();
        response.setApprovedCount(approved);
        response.setFailures(failures);
        return response;
    }

    public OrderDtos.OrderResponse updateOrder(UUID id, OrderDtos.UpdateOrderRequest req, UUID tenantId) {
        Order order = getOrderEntity(id, tenantId);
        if (order.getStatus() == Order.OrderStatus.DISPATCHED
                || order.getStatus() == Order.OrderStatus.DELIVERED
                || order.getStatus() == Order.OrderStatus.CANCELLED) {
            throw new BusinessException("Order cannot be edited after dispatch", "INVALID_STATUS");
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

            BigDecimal unitPrice = (itemReq.getUnitPrice() != null) ? itemReq.getUnitPrice() : product.getMaxSaleRate();
            String primaryBatch   = fifo.isEmpty() ? null : fifo.get(0).getBatchNumber();
            LocalDate primaryExpiry = fifo.isEmpty() ? null : fifo.get(0).getExpiryDate();
            BigDecimal batchMrp   = !fifo.isEmpty() && fifo.get(0).getMrp() != null ? fifo.get(0).getMrp() : product.getMrp();

            BigDecimal effectiveMin = !fifo.isEmpty() && fifo.get(0).getMinSaleRate() != null ? fifo.get(0).getMinSaleRate() : product.getMinSaleRate();
            BigDecimal effectiveMax = !fifo.isEmpty() && fifo.get(0).getMaxSaleRate() != null ? fifo.get(0).getMaxSaleRate() : product.getMaxSaleRate();
            checkCrossBatchConflict(product, fifo, itemReq.getQuantity());
            if (!canOverridePriceRange() && effectiveMin != null && unitPrice.compareTo(effectiveMin) < 0) {
                throw new BusinessException("Price ₹" + unitPrice + " for '" + product.getName() + "' is below the minimum allowed rate of ₹" + effectiveMin, "PRICE_BELOW_MINIMUM");
            }
            if (!canOverridePriceRange() && effectiveMax != null && unitPrice.compareTo(effectiveMax) > 0) {
                throw new BusinessException("Price ₹" + unitPrice + " for '" + product.getName() + "' exceeds the maximum allowed rate of ₹" + effectiveMax, "PRICE_ABOVE_MAXIMUM");
            }

            BigDecimal gstPercent = product.getSalesGstPercent();
            BigDecimal lineGross  = unitPrice.multiply(BigDecimal.valueOf(itemReq.getQuantity()));
            BigDecimal discAmt, discPct;
            if (itemReq.getDiscountAmount() != null && itemReq.getDiscountAmount().compareTo(BigDecimal.ZERO) > 0) {
                discAmt = itemReq.getDiscountAmount();
                discPct = lineGross.compareTo(BigDecimal.ZERO) > 0
                    ? discAmt.multiply(BigDecimal.valueOf(100)).divide(lineGross, 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            } else {
                discPct = itemReq.getDiscountPercent() != null ? itemReq.getDiscountPercent() : BigDecimal.ZERO;
                discAmt = lineGross.multiply(discPct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            }
            BigDecimal lineTotal  = lineGross.subtract(discAmt);
            BigDecimal divisor    = BigDecimal.valueOf(100).add(gstPercent);
            BigDecimal lineBase   = lineTotal.multiply(BigDecimal.valueOf(100)).divide(divisor, 2, RoundingMode.HALF_UP);
            BigDecimal gstAmt     = lineTotal.subtract(lineBase);

            newItems.add(OrderItem.builder()
                .product(product).quantity(itemReq.getQuantity())
                .mrp(batchMrp).unitPrice(unitPrice).discountPercent(discPct).discountAmount(discAmt)
                .gstPercent(gstPercent).gstAmount(gstAmt).lineTotal(lineTotal)
                .batchNumber(primaryBatch).batchExpiryDate(primaryExpiry).build());
            subTotal = subTotal.add(lineBase);
            totalGst = totalGst.add(gstAmt);
        }

        BigDecimal overallDiscount = applyOverallDiscount(newItems, req.getOverallDiscountType(), req.getOverallDiscountValue());
        if (overallDiscount.compareTo(BigDecimal.ZERO) > 0) {
            subTotal = sumLineBase(newItems);
            totalGst = sumGst(newItems);
        }

        BigDecimal rawTotal = subTotal.add(totalGst);
        BigDecimal totalAmount = rawTotal.setScale(0, RoundingMode.HALF_UP);
        BigDecimal roundOff = totalAmount.subtract(rawTotal);
        BigDecimal alreadyPaid = order.getPaidAmount() != null ? order.getPaidAmount() : BigDecimal.ZERO;
        BigDecimal newBalance  = totalAmount.subtract(alreadyPaid).max(BigDecimal.ZERO);

        // Editing an order upward is new credit too. The outstanding figure already counts this
        // order's current balance, so only the increase is fresh exposure.
        BigDecimal priorBalance = order.getBalanceAmount() != null ? order.getBalanceAmount() : BigDecimal.ZERO;
        assertWithinCreditLimit(
                tenantSettingsRepository.findByTenantId(tenantId).orElseGet(TenantSettings::new),
                order.getCustomer(), tenantId, newBalance.subtract(priorBalance));

        if (req.getNotes() != null) order.setNotes(req.getNotes());
        order.setSubTotal(subTotal);
        order.setTotalGst(totalGst);
        order.setOverallDiscountType(overallDiscount.compareTo(BigDecimal.ZERO) > 0 ? req.getOverallDiscountType() : null);
        order.setOverallDiscountValue(overallDiscount.compareTo(BigDecimal.ZERO) > 0 ? req.getOverallDiscountValue() : null);
        order.setOverallDiscountAmount(overallDiscount);
        order.setTotalAmount(totalAmount);
        order.setRoundOffAmount(roundOff);
        order.setBalanceAmount(newBalance);
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
                int newStock = fifo.stream().mapToInt(b -> b.getQuantityAvailable() != null ? b.getQuantityAvailable() : 0).sum();
                product.setStockQuantity(newStock);
            }
        }
        stockBatchRepository.saveAll(batchesToSave);
        productRepository.saveAll(productMap.values());

        auditService.record(tenantId, "ORDER", saved.getId(), "UPDATED",
            "Order " + saved.getOrderNumber() + " edited in " + saved.getStatus() + " status — " + newItems.size() + " item(s), total ₹" + totalAmount.toPlainString());
        return toResponse(saved);
    }

    public OrderDtos.OrderResponse startPacking(UUID id, UUID tenantId) {
        Order order = getOrderEntity(id, tenantId);
        validateStatus(order, Order.OrderStatus.APPROVED);
        order.setStatus(Order.OrderStatus.PACKING);
        Order saved = orderRepository.save(order);
        auditService.record(tenantId, "ORDER", saved.getId(), "PACKING",
                "Order " + saved.getOrderNumber() + " moved to packing");
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

    public OrderDtos.OrderResponse markPacked(UUID id, UUID tenantId) {
        Order order = getOrderEntity(id, tenantId);
        validateStatus(order, Order.OrderStatus.PACKING);
        boolean allVerified = order.getItems().stream().allMatch(OrderItem::isVerified);
        if (!allVerified) throw new BusinessException("All items must be verified before marking packed", "ITEMS_NOT_VERIFIED");
        order.setStatus(Order.OrderStatus.PACKED);
        order.setPackedAt(Instant.now());
        Order saved = orderRepository.save(order);
        auditService.record(tenantId, "ORDER", saved.getId(), "PACKED",
                "Order " + saved.getOrderNumber() + " items verified and marked packed");
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
        TenantSettings settings = tenantSettingsRepository.findByTenantId(tenantId).orElseGet(TenantSettings::new);
        if (settings.isPicklistEnabled()) {
            validateStatus(order, Order.OrderStatus.PACKED);
        } else if (order.getStatus() != Order.OrderStatus.PACKED && order.getStatus() != Order.OrderStatus.APPROVED) {
            throw new BusinessException("Order must be in APPROVED or PACKED status to dispatch", "INVALID_STATUS");
        }
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
        if (order.getDeliveryPerson() != null) {
            stampVisit(tenantId, order.getDeliveryPerson().getId(), order.getCustomer().getId(),
                    CustomerVisit.Outcome.DELIVERED, saved.getId(), null, null);
        }
        // Auto-complete the delivery run once its last dispatched order is delivered.
        if (order.getRouteAllocation() != null) {
            routeAllocationService.autoCompleteDeliveryIfDone(order.getRouteAllocation().getId(), tenantId);
        }
        return toResponse(saved);
    }

    /** ADMIN-only: correct the price/discount on a DELIVERED order's existing lines — quantity and
     *  products stay locked. Blocked once a Sales Return exists against the order, since a return
     *  already references the original quantities/amounts and a price edit afterward would make
     *  those numbers inconsistent. */
    public OrderDtos.OrderResponse adjustDeliveredPrice(UUID id, OrderDtos.AdjustDeliveredPriceRequest req, UUID tenantId) {
        Order order = getOrderEntity(id, tenantId);
        if (order.getStatus() != Order.OrderStatus.DELIVERED) {
            throw new BusinessException("Only delivered orders can be price-adjusted this way", "INVALID_STATUS");
        }

        List<GoodsReturn> existingReturns = goodsReturnRepository
                .findByTenantIdAndReferenceOrderIdAndTypeOrderByReturnDateDescCreatedAtDesc(
                        tenantId, order.getId(), GoodsReturn.ReturnType.SALES_RETURN);
        boolean hasActiveReturn = existingReturns.stream()
                .anyMatch(r -> r.getWarehouseStatus() != GoodsReturn.WarehouseStatus.CANCELLED);
        if (hasActiveReturn) {
            throw new BusinessException(
                    "This order already has a Sales Return on file — price can no longer be adjusted", "RETURN_EXISTS");
        }

        Map<UUID, OrderDtos.AdjustPriceItem> adjustmentByItemId = req.getItems().stream()
                .collect(Collectors.toMap(OrderDtos.AdjustPriceItem::getItemId, it -> it));

        if (!adjustmentByItemId.keySet().equals(
                order.getItems().stream().map(OrderItem::getId).collect(Collectors.toSet()))) {
            throw new BusinessException("Adjustment must include every line item on the order — quantity/products cannot change", "ITEMS_MISMATCH");
        }

        BigDecimal subTotal = BigDecimal.ZERO;
        BigDecimal totalGst = BigDecimal.ZERO;

        for (OrderItem item : order.getItems()) {
            OrderDtos.AdjustPriceItem adj = adjustmentByItemId.get(item.getId());
            Product product = item.getProduct();

            BigDecimal effectiveMin = item.getBatch() != null && item.getBatch().getMinSaleRate() != null
                    ? item.getBatch().getMinSaleRate() : product.getMinSaleRate();
            BigDecimal effectiveMax = item.getBatch() != null && item.getBatch().getMaxSaleRate() != null
                    ? item.getBatch().getMaxSaleRate() : product.getMaxSaleRate();
            if (!canOverridePriceRange() && effectiveMin != null && adj.getUnitPrice().compareTo(effectiveMin) < 0) {
                throw new BusinessException("Price ₹" + adj.getUnitPrice() + " for '" + product.getName() + "' is below the minimum allowed rate of ₹" + effectiveMin, "PRICE_BELOW_MINIMUM");
            }
            if (!canOverridePriceRange() && effectiveMax != null && adj.getUnitPrice().compareTo(effectiveMax) > 0) {
                throw new BusinessException("Price ₹" + adj.getUnitPrice() + " for '" + product.getName() + "' exceeds the maximum allowed rate of ₹" + effectiveMax, "PRICE_ABOVE_MAXIMUM");
            }

            BigDecimal lineGross = adj.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity()));
            BigDecimal discAmt, discPct;
            if (adj.getDiscountAmount() != null && adj.getDiscountAmount().compareTo(BigDecimal.ZERO) > 0) {
                discAmt = adj.getDiscountAmount();
                discPct = lineGross.compareTo(BigDecimal.ZERO) > 0
                        ? discAmt.multiply(BigDecimal.valueOf(100)).divide(lineGross, 2, RoundingMode.HALF_UP)
                        : BigDecimal.ZERO;
            } else {
                discPct = adj.getDiscountPercent() != null ? adj.getDiscountPercent() : BigDecimal.ZERO;
                discAmt = lineGross.multiply(discPct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            }
            BigDecimal lineTotal = lineGross.subtract(discAmt);
            BigDecimal divisor   = BigDecimal.valueOf(100).add(item.getGstPercent());
            BigDecimal lineBase  = lineTotal.multiply(BigDecimal.valueOf(100)).divide(divisor, 2, RoundingMode.HALF_UP);
            BigDecimal gstAmt    = lineTotal.subtract(lineBase);

            item.setUnitPrice(adj.getUnitPrice());
            item.setDiscountPercent(discPct);
            item.setDiscountAmount(discAmt);
            item.setGstAmount(gstAmt);
            item.setLineTotal(lineTotal);

            subTotal = subTotal.add(lineBase);
            totalGst = totalGst.add(gstAmt);
        }

        // Apply the (possibly admin-edited) bill-level discount to the freshly re-priced lines.
        BigDecimal overallDiscount = applyOverallDiscount(order.getItems(), req.getOverallDiscountType(), req.getOverallDiscountValue());
        if (overallDiscount.compareTo(BigDecimal.ZERO) > 0) {
            subTotal = sumLineBase(order.getItems());
            totalGst = sumGst(order.getItems());
        }
        order.setOverallDiscountType(overallDiscount.compareTo(BigDecimal.ZERO) > 0 ? req.getOverallDiscountType() : null);
        order.setOverallDiscountValue(overallDiscount.compareTo(BigDecimal.ZERO) > 0 ? req.getOverallDiscountValue() : null);
        order.setOverallDiscountAmount(overallDiscount);

        BigDecimal rawTotal = subTotal.add(totalGst);
        BigDecimal totalAmount = rawTotal.setScale(0, RoundingMode.HALF_UP);
        BigDecimal roundOff = totalAmount.subtract(rawTotal);
        BigDecimal alreadyPaid = order.getPaidAmount() != null ? order.getPaidAmount() : BigDecimal.ZERO;
        BigDecimal newBalance = totalAmount.subtract(alreadyPaid).max(BigDecimal.ZERO);

        BigDecimal oldTotal = order.getTotalAmount();
        order.setSubTotal(subTotal);
        order.setTotalGst(totalGst);
        order.setTotalAmount(totalAmount);
        order.setRoundOffAmount(roundOff);
        order.setBalanceAmount(newBalance);
        Order saved = orderRepository.save(order);

        auditService.record(tenantId, "ORDER", saved.getId(), "PRICE_ADJUSTED",
                "Order " + saved.getOrderNumber() + " price adjusted after delivery — total changed from ₹"
                        + oldTotal.toPlainString() + " to ₹" + totalAmount.toPlainString());
        return toResponse(saved);
    }

    public OrderDtos.OrderResponse returnToWarehouse(UUID id, UUID tenantId) {
        Order order = getOrderEntity(id, tenantId);
        validateStatus(order, Order.OrderStatus.DISPATCHED);
        order.setStatus(Order.OrderStatus.RETURN_TO_WAREHOUSE);
        order.setReturnedAt(Instant.now());
        Order saved = orderRepository.save(order);
        auditService.record(tenantId, "ORDER", saved.getId(), "RETURN_TO_WAREHOUSE",
                "Order " + saved.getOrderNumber() + " returned to warehouse — shop closed / not available");
        return toResponse(saved);
    }

    public OrderDtos.OrderResponse confirmWarehouseReturn(UUID id, OrderDtos.ConfirmWarehouseReturnRequest req, UUID tenantId, UUID userId) {
        Order order = getOrderEntity(id, tenantId);
        validateStatus(order, Order.OrderStatus.RETURN_TO_WAREHOUSE);
        User verifiedBy = userRepository.findByIdAndTenantId(userId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        // Captured before routeAllocation is cleared below, so the shortage record still knows
        // which route/run this order was on.
        UUID routeId = null;
        String routeName = null;
        if (order.getRouteAllocation() != null && order.getRouteAllocation().getRoute() != null) {
            routeId = order.getRouteAllocation().getRoute().getId();
            routeName = order.getRouteAllocation().getRoute().getName();
        } else if (order.getCustomer() != null && order.getCustomer().getRoute() != null) {
            routeId = order.getCustomer().getRoute().getId();
            routeName = order.getCustomer().getRoute().getName();
        }
        User responsiblePerson = order.getDeliveryPerson() != null ? order.getDeliveryPerson() : order.getSalesPerson();

        Map<UUID, Integer> receivedByItemId = req.getItems().stream()
                .collect(Collectors.toMap(OrderDtos.ReturnItemReceipt::getItemId, OrderDtos.ReturnItemReceipt::getReceivedQty));

        StringBuilder shortfalls = new StringBuilder();
        for (OrderItem item : order.getItems()) {
            Integer received = receivedByItemId.get(item.getId());
            if (received == null) {
                throw new BusinessException("Missing received quantity for '" + item.getProduct().getName() + "'", "INCOMPLETE_VERIFICATION");
            }
            if (received > item.getQuantity()) {
                throw new BusinessException("Received quantity for '" + item.getProduct().getName() + "' cannot exceed the quantity out for delivery", "INVALID_RECEIVED_QTY");
            }
            item.setReturnReceivedQuantity(received);
            int shortQty = item.getQuantity() - received;
            if (shortQty > 0) {
                if (shortfalls.length() > 0) shortfalls.append(", ");
                shortfalls.append(item.getProduct().getName()).append(" (").append(shortQty).append(" short)");

                stockShortageService.record(
                        order.getTenant(), item.getProduct(), item.getBatchNumber(), shortQty, item.getUnitPrice(),
                        StockShortage.SourceType.UNDELIVERED_ORDER, order.getOrderNumber(), order.getId(),
                        routeId, routeName, responsiblePerson, verifiedBy, LocalDate.now());
            }
        }

        order.setStatus(Order.OrderStatus.PACKED);
        order.setDispatchedAt(null);
        // Unstamp — the shop was closed / unavailable, so this must wait for an explicit
        // re-Assign on a future run rather than silently reappearing for today's delivery person.
        order.setRouteAllocation(null);
        Order saved = orderRepository.save(order);

        if (shortfalls.length() > 0) {
            auditService.record(tenantId, "ORDER", saved.getId(), "RESTOCKED_SHORTAGE",
                    "Order " + saved.getOrderNumber() + " received back at warehouse with shortage — " + shortfalls + " — flagged for review");
        } else {
            auditService.record(tenantId, "ORDER", saved.getId(), "RESTOCKED",
                    "Order " + saved.getOrderNumber() + " received back at warehouse in full — ready for re-dispatch");
        }
        return toResponse(saved);
    }

    public OrderDtos.OrderResponse markShopClosed(UUID id, UUID tenantId) {
        Order order = getOrderEntity(id, tenantId);
        validateStatus(order, Order.OrderStatus.DISPATCHED);
        auditService.record(tenantId, "ORDER", order.getId(), "SHOP_CLOSED",
                "Order " + order.getOrderNumber() + " — shop closed / unavailable, delivery person will retry today");
        if (order.getDeliveryPerson() != null) {
            stampVisit(tenantId, order.getDeliveryPerson().getId(), order.getCustomer().getId(),
                    CustomerVisit.Outcome.SHOP_CLOSED, order.getId(), null, "Shop closed / unavailable");
        }
        return toResponse(order);
    }

    public OrderDtos.CounterSaleResponse counterSale(OrderDtos.CounterSaleRequest req, UUID userId, UUID tenantId) {
        TenantSettings counterSaleSettings = tenantSettingsRepository.findByTenantId(tenantId)
                .orElseGet(TenantSettings::new);

        Customer customer = customerRepository.findByIdAndTenantId(req.getCustomerId(), tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", req.getCustomerId().toString()));

        User staff = userRepository.findByIdAndTenantId(userId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        User salesPersonForOrder = staff;
        RouteAllocation linkedGatePass = null;

        if (req.getGatePassId() != null) {
            linkedGatePass = routeAllocationRepository.findByIdAndTenant_Id(req.getGatePassId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("RouteAllocation", req.getGatePassId().toString()));
            if (linkedGatePass.getSalesPerson() == null) {
                throw new BusinessException("Selected Gate Pass has no sales person assigned", "INVALID_GATE_PASS");
            }
            if (!hasBroadGatePassAccess() && !linkedGatePass.getSalesPerson().getId().equals(userId)) {
                throw new BusinessException("You can only attribute counter sales to your own Gate Pass", "GATE_PASS_NOT_OWNED");
            }
            // Explicitly linking to a Gate Pass — even a completed one — is a deliberate
            // attribution choice, so it bypasses the "route billing closed" guard below.
            salesPersonForOrder = linkedGatePass.getSalesPerson();
        } else {
            assertSalesGatePassOpen(customer, userId, tenantId);
        }

        int seq = orderRepository.findMaxOrderSequence(tenantId) + 1;
        String orderNumber = String.format("ORD-%d-%05d", Year.now().getValue(), seq);

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

            if (!product.isActive()) throw new BusinessException("Product '" + product.getName() + "' is not active", "INACTIVE_PRODUCT");
            int available = product.getStockQuantity() != null ? product.getStockQuantity() : 0;
            if (available < itemReq.getQuantity()) throw new BusinessException(
                "Insufficient stock for '" + product.getName() + "'. Available: " + available, "INSUFFICIENT_STOCK");

            BigDecimal unitPrice = itemReq.getUnitPrice() != null ? itemReq.getUnitPrice() : product.getMaxSaleRate();
            BigDecimal effectiveMin = !fifo.isEmpty() && fifo.get(0).getMinSaleRate() != null ? fifo.get(0).getMinSaleRate() : product.getMinSaleRate();
            BigDecimal effectiveMax = !fifo.isEmpty() && fifo.get(0).getMaxSaleRate() != null ? fifo.get(0).getMaxSaleRate() : product.getMaxSaleRate();
            checkCrossBatchConflict(product, fifo, itemReq.getQuantity());
            if (!canOverridePriceRange() && effectiveMin != null && unitPrice.compareTo(effectiveMin) < 0)
                throw new BusinessException("Price ₹" + unitPrice + " for '" + product.getName() + "' is below minimum ₹" + effectiveMin, "PRICE_BELOW_MINIMUM");
            if (!canOverridePriceRange() && effectiveMax != null && unitPrice.compareTo(effectiveMax) > 0)
                throw new BusinessException("Price ₹" + unitPrice + " for '" + product.getName() + "' exceeds maximum ₹" + effectiveMax, "PRICE_ABOVE_MAXIMUM");

            BigDecimal counterMrp = !fifo.isEmpty() && fifo.get(0).getMrp() != null ? fifo.get(0).getMrp() : product.getMrp();
            BigDecimal gstPercent = product.getSalesGstPercent();
            BigDecimal lineGross = unitPrice.multiply(BigDecimal.valueOf(itemReq.getQuantity()));
            BigDecimal discAmt, discPct;
            if (itemReq.getDiscountAmount() != null && itemReq.getDiscountAmount().compareTo(BigDecimal.ZERO) > 0) {
                discAmt = itemReq.getDiscountAmount();
                discPct = lineGross.compareTo(BigDecimal.ZERO) > 0
                    ? discAmt.multiply(BigDecimal.valueOf(100)).divide(lineGross, 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            } else {
                discPct = itemReq.getDiscountPercent() != null ? itemReq.getDiscountPercent() : BigDecimal.ZERO;
                discAmt = lineGross.multiply(discPct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            }
            BigDecimal lineTotal = lineGross.subtract(discAmt);
            BigDecimal divisor   = BigDecimal.valueOf(100).add(gstPercent);
            BigDecimal lineBase  = lineTotal.multiply(BigDecimal.valueOf(100)).divide(divisor, 2, RoundingMode.HALF_UP);
            BigDecimal gstAmt    = lineTotal.subtract(lineBase);

            items.add(OrderItem.builder()
                .product(product).quantity(itemReq.getQuantity())
                .mrp(counterMrp).unitPrice(unitPrice).discountPercent(discPct).discountAmount(discAmt)
                .gstPercent(gstPercent).gstAmount(gstAmt).lineTotal(lineTotal)
                .batchNumber(fifo.isEmpty() ? null : fifo.get(0).getBatchNumber())
                .batchExpiryDate(fifo.isEmpty() ? null : fifo.get(0).getExpiryDate())
                .build());
            subTotal = subTotal.add(lineBase);
            totalGst = totalGst.add(gstAmt);
        }

        BigDecimal overallDiscount = applyOverallDiscount(items, req.getOverallDiscountType(), req.getOverallDiscountValue());
        if (overallDiscount.compareTo(BigDecimal.ZERO) > 0) {
            subTotal = sumLineBase(items);
            totalGst = sumGst(items);
        }

        BigDecimal rawTotal = subTotal.add(totalGst);
        BigDecimal totalAmount = rawTotal.setScale(0, RoundingMode.HALF_UP);
        BigDecimal roundOff = totalAmount.subtract(rawTotal);
        Instant now = Instant.now();

        // Only the unpaid part of a counter sale is new credit — a bill settled in cash at the
        // counter adds nothing to what the shop owes, so it is never blocked on credit grounds.
        BigDecimal collectedNow = req.getPaymentAmount() != null ? req.getPaymentAmount() : BigDecimal.ZERO;
        assertWithinCreditLimit(counterSaleSettings, customer, tenantId, totalAmount.subtract(collectedNow));

        Order.OrderStatus finalStatus;
        try {
            finalStatus = req.getFinalStatus() != null ? Order.OrderStatus.valueOf(req.getFinalStatus()) : Order.OrderStatus.DELIVERED;
        } catch (IllegalArgumentException e) {
            throw new BusinessException("Invalid final status: " + req.getFinalStatus(), "INVALID_STATUS");
        }
        if (!List.of(Order.OrderStatus.APPROVED, Order.OrderStatus.PACKED, Order.OrderStatus.DELIVERED).contains(finalStatus)) {
            throw new BusinessException(
                    "A counter sale can only be moved to Approved, Packed, or Delivered", "INVALID_STATUS");
        }

        Order.OrderBuilder orderBuilder = Order.builder()
                .tenant(customer.getTenant())
                .orderNumber(orderNumber)
                .customer(customer)
                .salesPerson(salesPersonForOrder)
                .routeAllocation(linkedGatePass)
                .orderDate(LocalDate.now())
                .status(finalStatus)
                .subTotal(subTotal).totalGst(totalGst).totalAmount(totalAmount)
                .roundOffAmount(roundOff)
                .overallDiscountType(overallDiscount.compareTo(BigDecimal.ZERO) > 0 ? req.getOverallDiscountType() : null)
                .overallDiscountValue(overallDiscount.compareTo(BigDecimal.ZERO) > 0 ? req.getOverallDiscountValue() : null)
                .overallDiscountAmount(overallDiscount)
                .balanceAmount(totalAmount)
                .notes(req.getNotes())
                .approvedAt(now);
        if (finalStatus == Order.OrderStatus.PACKED || finalStatus == Order.OrderStatus.DELIVERED) {
            orderBuilder.packedAt(now);
        }
        if (finalStatus == Order.OrderStatus.DELIVERED) {
            orderBuilder.dispatchedAt(now);
        }
        if (finalStatus == Order.OrderStatus.DELIVERED) {
            orderBuilder.deliveredAt(now);
        }
        Order order = orderBuilder.build();

        items.forEach(item -> item.setOrder(order));
        order.getItems().addAll(items);
        Order saved = orderRepository.save(order);

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
                int newStock = fifo.stream().mapToInt(b -> b.getQuantityAvailable() != null ? b.getQuantityAvailable() : 0).sum();
                product.setStockQuantity(newStock);
            }
        }
        stockBatchRepository.saveAll(batchesToSave);
        productRepository.saveAll(productMap.values());

        auditService.record(tenantId, "ORDER", saved.getId(), "COUNTER_SALE",
                "Counter sale " + saved.getOrderNumber() + " for " + customer.getBusinessName() +
                " — " + items.size() + " item(s), total ₹" + totalAmount.toPlainString());

        OrderDtos.CounterSaleResponse result = new OrderDtos.CounterSaleResponse();
        result.setOrder(toResponse(saved));

        if (req.getPaymentAmount() != null && req.getPaymentAmount().compareTo(BigDecimal.ZERO) > 0) {
            Payment.PaymentMode resolvedMode = req.getPaymentMode();
            String resolvedMethodName = null;
            if (req.getPaymentMethodId() != null) {
                PaymentMethod method = paymentMethodRepository.findByIdAndTenantId(req.getPaymentMethodId(), tenantId)
                        .orElseThrow(() -> new ResourceNotFoundException("PaymentMethod", req.getPaymentMethodId().toString()));
                resolvedMode = Payment.PaymentMode.valueOf(method.getMode());
                resolvedMethodName = method.getName();
            }
            if (resolvedMode == null) resolvedMode = Payment.PaymentMode.CASH;

            boolean isInstrument = resolvedMode == Payment.PaymentMode.CHEQUE
                    || resolvedMode == Payment.PaymentMode.NEFT
                    || resolvedMode == Payment.PaymentMode.RTGS;
            if (isInstrument && (req.getPaymentReference() == null || req.getPaymentReference().isBlank())) {
                String label = resolvedMode == Payment.PaymentMode.CHEQUE ? "Cheque number" : "Transaction/UTR reference";
                throw new BusinessException(label + " is required for " + resolvedMode.name() + " payments", "REFERENCE_REQUIRED");
            }

            BigDecimal payAmt = req.getPaymentAmount().min(totalAmount);
            Payment payment = Payment.builder()
                    .tenant(customer.getTenant())
                    .order(saved)
                    .customer(customer)
                    .collectedBy(staff)
                    .amount(payAmt)
                    .paymentMode(resolvedMode)
                    .paymentMethodName(resolvedMethodName)
                    .referenceNumber(req.getPaymentReference())
                    .collectionDate(LocalDate.now())
                    .status(isInstrument ? Payment.PaymentStatus.PENDING : Payment.PaymentStatus.REALISED)
                    .realisedDate(isInstrument ? null : LocalDate.now())
                    .submitted(true)
                    .submittedAt(Instant.now())
                    .build();
            paymentRepository.save(payment);
            // Instruments only reduce the balance once realised in the bank.
            if (!isInstrument) {
                saved.setPaidAmount(payAmt);
                saved.setBalanceAmount(totalAmount.subtract(payAmt));
                orderRepository.save(saved);
            }

            auditService.record(tenantId, "ORDER", saved.getId(), "PAYMENT_COLLECTED",
                    "Counter sale payment ₹" + payAmt.toPlainString() + " collected via " +
                    (resolvedMethodName != null ? resolvedMethodName : resolvedMode.name()) +
                    (isInstrument ? " — awaiting bank realisation" : ""));

            OrderDtos.PaymentResponse pr = new OrderDtos.PaymentResponse();
            pr.setId(payment.getId());
            pr.setAmount(payAmt);
            pr.setPaymentMode(resolvedMode);
            pr.setPaymentMethodName(resolvedMethodName);
            pr.setReferenceNumber(req.getPaymentReference());
            pr.setCollectionDate(LocalDate.now());
            pr.setCollectedBy(toPerson(staff));
            result.setPayment(pr);
        }

        stampVisit(tenantId, userId, customer.getId(),
                CustomerVisit.Outcome.COUNTER_SALE, saved.getId(), null, null);

        return result;
    }

    // Admin manual status override. Stock is create-bound (deducted on create, restored on
    // cancel), so moving between active stages never touches inventory — this only re-points
    // the workflow label and re-aligns the stage timestamps. Cancel / return-to-warehouse keep
    // their own actions because those DO move stock.
    @Transactional
    public OrderDtos.OrderResponse changeStatus(UUID id, Order.OrderStatus target, String notes, UUID tenantId) {
        Order order = getOrderEntity(id, tenantId);

        if (target == null) throw new BusinessException("Target status is required", "STATUS_REQUIRED");
        if (target == Order.OrderStatus.CANCELLED)
            throw new BusinessException("Use the Cancel action to cancel an order — it restores stock", "USE_CANCEL_ACTION");
        if (target == Order.OrderStatus.RETURN_TO_WAREHOUSE)
            throw new BusinessException("Use the Return to Warehouse action for that — it handles stock", "USE_RETURN_ACTION");
        if (order.getStatus() == Order.OrderStatus.CANCELLED)
            throw new BusinessException("A cancelled order cannot be reactivated — create a new order instead", "ORDER_CANCELLED");
        if (order.isOpeningBalance())
            throw new BusinessException("Opening balance entries have no workflow status", "OPENING_BALANCE");
        if (order.getStatus() == target) return toResponse(order);

        Order.OrderStatus from = order.getStatus();
        int t = stageIndex(target);
        Instant now = Instant.now();
        order.setApprovedAt(t >= 2 ? (order.getApprovedAt() != null ? order.getApprovedAt() : now) : null);
        order.setPackedAt(t >= 4 ? (order.getPackedAt() != null ? order.getPackedAt() : now) : null);
        order.setDispatchedAt(t >= 5 ? (order.getDispatchedAt() != null ? order.getDispatchedAt() : now) : null);
        order.setDeliveredAt(t >= 6 ? (order.getDeliveredAt() != null ? order.getDeliveredAt() : now) : null);
        order.setStatus(target);
        Order saved = orderRepository.save(order);

        auditService.record(tenantId, "ORDER", saved.getId(), "STATUS_OVERRIDE",
                "Status manually changed from " + from + " to " + target + " (admin override)"
                        + (notes != null && !notes.isBlank() ? " — " + notes : ""));
        return toResponse(saved);
    }

    private int stageIndex(Order.OrderStatus s) {
        return switch (s) {
            case DRAFT -> 0;
            case SUBMITTED -> 1;
            case APPROVED -> 2;
            case PACKING -> 3;
            case PACKED -> 4;
            case DISPATCHED, RETURN_TO_WAREHOUSE -> 5;
            case DELIVERED -> 6;
            case CANCELLED -> -1;
        };
    }

    @Transactional
    public OrderDtos.OrderResponse cancelOrder(UUID id, String reason, UUID userId, UUID tenantId) {
        Order order = getOrderEntity(id, tenantId);

        List<Order.OrderStatus> cancellable = List.of(
            Order.OrderStatus.DRAFT, Order.OrderStatus.SUBMITTED,
            Order.OrderStatus.APPROVED, Order.OrderStatus.PACKING, Order.OrderStatus.PACKED,
            Order.OrderStatus.RETURN_TO_WAREHOUSE
        );
        if (!cancellable.contains(order.getStatus())) {
            throw new BusinessException(
                "Cannot cancel order in status: " + order.getStatus() +
                ". Orders can only be cancelled before dispatch.",
                "INVALID_STATUS");
        }

        // If the customer already paid, cancelling would zero the balance and strand that money.
        // Queue a refund for the paid amount (into the normal Pending Refunds flow) before voiding.
        BigDecimal paid = order.getPaidAmount() != null ? order.getPaidAmount() : BigDecimal.ZERO;
        if (paid.compareTo(BigDecimal.ZERO) > 0) {
            goodsReturnService.createCancellationRefund(order, paid, userId, tenantId);
        }

        // Restore stock back to the batches
        Map<UUID, Product> affectedProducts = new LinkedHashMap<>();
        for (OrderItem item : order.getItems()) {
            Product product = item.getProduct();
            if (item.getBatchNumber() != null) {
                stockBatchRepository.findByTenantAndBatchNumber(tenantId, item.getBatchNumber())
                    .ifPresent(batch -> {
                        batch.setQuantityAvailable(batch.getQuantityAvailable() + item.getQuantity());
                        if (!batch.isActive()) batch.setActive(true);
                        stockBatchRepository.save(batch);
                    });
            }
            affectedProducts.put(product.getId(), product);
        }
        for (Product product : affectedProducts.values()) {
            Integer restored = stockBatchRepository.sumAvailableByProduct(tenantId, product.getId());
            product.setStockQuantity(restored != null ? restored : 0);
            productRepository.save(product);
        }

        order.setStatus(Order.OrderStatus.CANCELLED);
        order.setBalanceAmount(BigDecimal.ZERO);
        if (reason != null && !reason.isBlank()) order.setNotes(reason);
        Order saved = orderRepository.save(order);
        auditService.record(tenantId, "ORDER", saved.getId(), "CANCELLED",
                "Order " + saved.getOrderNumber() + " cancelled" +
                (reason != null && !reason.isBlank() ? ": " + reason : "") +
                " — stock restored for " + order.getItems().size() + " item(s)");
        return toResponse(saved);
    }

    public void deleteOpeningBalanceOrder(UUID id, UUID tenantId) {
        Order order = getOrderEntity(id, tenantId);

        if (!order.isOpeningBalance()) {
            throw new BusinessException(
                "This is a regular order, not an opening balance entry. Use Cancel instead.",
                "NOT_OPENING_BALANCE");
        }
        if (order.getPaidAmount() != null && order.getPaidAmount().compareTo(BigDecimal.ZERO) > 0) {
            throw new BusinessException(
                "Cannot delete — a payment has already been collected against this entry.",
                "PAYMENT_EXISTS");
        }

        String orderNumber = order.getOrderNumber();
        String customerName = order.getCustomer() != null ? order.getCustomer().getBusinessName() : "";
        orderRepository.delete(order);
        auditService.record(tenantId, "ORDER", id, "DELETED",
                "Opening balance entry " + orderNumber + " (" + customerName + ") deleted");
    }

    @Transactional(readOnly = true)
    public List<OrderDtos.OrderResponse> getMyOrders(UUID salesPersonId, UUID tenantId) {
        return orderRepository.findByTenantIdAndSalesPersonIdAndOrderDate(tenantId, salesPersonId, LocalDate.now())
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<OrderDtos.OrderResponse> getMyDeliveries(UUID deliveryPersonId, UUID tenantId) {
        // Scoped to the specific gate-pass assignment (route_allocation_id), not just
        // "any packed order on my route" — orders are only visible once explicitly
        // stamped into a run via Assign. See RouteAllocationService.allocateDelivery.
        List<UUID> allocationIds = routeAllocationRepository
                .findByTenantIdAndDeliveryPersonIdAndAllocationDate(tenantId, deliveryPersonId, LocalDate.now())
                .stream().map(RouteAllocation::getId).distinct().collect(Collectors.toList());
        if (allocationIds.isEmpty()) return List.of();
        return orderRepository.findByTenantIdAndStatusInAndRouteAllocationIdIn(tenantId,
                List.of(Order.OrderStatus.PACKED, Order.OrderStatus.DISPATCHED, Order.OrderStatus.DELIVERED), allocationIds)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    /**
     * A delivery person can end up working more than one route in a day, same as
     * sales — show all of them, in assignment order, not just an arbitrary one.
     * Orders come from whatever was stamped into that day's run(s), not orderDate,
     * so a leftover/overdue order delivered today still shows under today.
     */
    @Transactional(readOnly = true)
    public OrderDtos.MyDeliveryHistoryResponse getMyDeliveryHistory(UUID deliveryPersonId, UUID tenantId, LocalDate date) {
        List<RouteAllocation> allocations = routeAllocationRepository
                .findByTenantIdAndDeliveryPersonIdAndAllocationDate(tenantId, deliveryPersonId, date);
        String routeName = allocations.stream()
                .sorted(Comparator.comparing(RouteAllocation::getCreatedAt))
                .map(a -> a.getRoute().getName())
                .distinct()
                .collect(Collectors.joining(", "));
        if (routeName.isEmpty()) routeName = null;

        List<UUID> allocationIds = allocations.stream().map(RouteAllocation::getId).distinct().collect(Collectors.toList());
        List<Order> orders = allocationIds.isEmpty() ? List.of() : orderRepository.findByTenantIdAndStatusInAndRouteAllocationIdIn(
                tenantId,
                List.of(Order.OrderStatus.PACKED, Order.OrderStatus.DISPATCHED, Order.OrderStatus.DELIVERED, Order.OrderStatus.RETURN_TO_WAREHOUSE),
                allocationIds);

        List<Payment> payments = paymentRepository.findByTenantIdAndCollectedByIdAndCollectionDate(tenantId, deliveryPersonId, date);
        BigDecimal cash = BigDecimal.ZERO, upi = BigDecimal.ZERO, other = BigDecimal.ZERO;
        for (Payment p : payments) {
            if (Payment.PaymentMode.CASH.equals(p.getPaymentMode()))     cash  = cash.add(p.getAmount());
            else if (Payment.PaymentMode.UPI.equals(p.getPaymentMode())) upi   = upi.add(p.getAmount());
            else                                                          other = other.add(p.getAmount());
        }

        OrderDtos.MyDeliveryHistoryResponse res = new OrderDtos.MyDeliveryHistoryResponse();
        res.setDate(date);
        res.setRouteName(routeName);
        res.setOrdersCount(orders.size());
        res.setDeliveredCount((int) orders.stream().filter(o -> o.getStatus() == Order.OrderStatus.DELIVERED).count());
        res.setCashCollected(cash);
        res.setUpiCollected(upi);
        res.setOtherCollected(other);
        res.setTotalCollected(cash.add(upi).add(other));
        res.setOrders(orders.stream().map(o -> {
            OrderDtos.MyDeliveryHistoryResponse.DeliveryOrderSummary s = new OrderDtos.MyDeliveryHistoryResponse.DeliveryOrderSummary();
            s.setOrderId(o.getId());
            s.setOrderNumber(o.getOrderNumber());
            s.setCustomerName(o.getCustomer().getBusinessName());
            s.setCustomerPhone(o.getCustomer().getPhone());
            s.setTotalAmount(o.getTotalAmount());
            s.setPaidAmount(o.getPaidAmount());
            s.setStatus(o.getStatus().name());
            s.setItemCount(o.getItems().size());
            return s;
        }).collect(Collectors.toList()));
        res.setPayments(payments.stream().map(p -> {
            OrderDtos.MyDeliveryHistoryResponse.DeliveryPaymentSummary s = new OrderDtos.MyDeliveryHistoryResponse.DeliveryPaymentSummary();
            s.setPaymentId(p.getId());
            s.setOrderNumber(p.getOrder() != null ? p.getOrder().getOrderNumber() : null);
            s.setCustomerName(p.getCustomer() != null ? p.getCustomer().getBusinessName() : null);
            s.setAmount(p.getAmount());
            s.setPaymentMode(p.getPaymentMode() != null ? p.getPaymentMode().name() : null);
            s.setPaymentMethodName(p.getPaymentMethodName());
            s.setReferenceNumber(p.getReferenceNumber());
            s.setSubmitted(p.isSubmitted());
            s.setCollectedAt(p.getCreatedAt());
            return s;
        }).collect(Collectors.toList()));
        return res;
    }

    /** Statuses that still need picking/packing action right now — the live warehouse queue.
     *  Includes SUBMITTED (not yet approved) so a route's whole outstanding backlog is visible,
     *  not just what's already been through Invoice Approver. */
    private static final List<Order.OrderStatus> PICKLIST_LIVE_STATUSES = List.of(
            Order.OrderStatus.SUBMITTED, Order.OrderStatus.APPROVED, Order.OrderStatus.PACKING, Order.OrderStatus.PACKED);

    /** Every status an order passes through once picking has actually started — used for the
     *  read-only history view, so a route's picklist for a past date stays visible even after
     *  every order on it has moved on to DISPATCHED/DELIVERED. DRAFT/SUBMITTED (never approved,
     *  so never picked) and CANCELLED (never fulfilled) are excluded. */
    private static final List<Order.OrderStatus> PICKLIST_HISTORY_STATUSES = List.of(
            Order.OrderStatus.APPROVED, Order.OrderStatus.PACKING, Order.OrderStatus.PACKED,
            Order.OrderStatus.DISPATCHED, Order.OrderStatus.DELIVERED, Order.OrderStatus.RETURN_TO_WAREHOUSE);

    /** Live queue — the whole outstanding backlog for a route, regardless of which day each
     *  order was placed on. "date" only decides which allocation (who's assigned where) is
     *  being looked at, not which orders qualify. */
    @Transactional(readOnly = true)
    public List<OrderDtos.RoutePicklistResponse> getRoutePicklist(UUID tenantId, LocalDate date, UUID warehousePersonId) {
        return buildRoutePicklist(tenantId, date, warehousePersonId, PICKLIST_LIVE_STATUSES, false);
    }

    /** Read-only — what was picked for each route on this date, regardless of where those
     *  orders stand today. Unlike {@link #getRoutePicklist}, this never goes empty just because
     *  the day's orders have since been dispatched/delivered. Strictly scoped to that date's
     *  orderDate since it's a historical record of a specific day's activity. */
    @Transactional(readOnly = true)
    public List<OrderDtos.RoutePicklistResponse> getRoutePicklistHistory(UUID tenantId, LocalDate date, UUID warehousePersonId) {
        return buildRoutePicklist(tenantId, date, warehousePersonId, PICKLIST_HISTORY_STATUSES, true);
    }

    private List<OrderDtos.RoutePicklistResponse> buildRoutePicklist(
            UUID tenantId, LocalDate date, UUID warehousePersonId, List<Order.OrderStatus> statuses, boolean dateScoped) {
        List<UUID> allowedRouteIds = null;
        if (warehousePersonId != null) {
            allowedRouteIds = routeAllocationRepository
                    .findByTenantIdAndWarehousePersonIdAndAllocationDate(tenantId, warehousePersonId, date)
                    .stream().map(a -> a.getRoute().getId()).distinct().collect(Collectors.toList());
            if (allowedRouteIds.isEmpty()) return List.of();
        }

        List<Order> orders = dateScoped
                ? orderRepository.findByTenantDateAndStatuses(tenantId, date, statuses)
                : orderRepository.findByTenantIdAndStatusesWithDetails(tenantId, statuses);

        final List<UUID> finalAllowedRouteIds = allowedRouteIds;
        Map<UUID, List<Order>> byRoute = new LinkedHashMap<>();
        for (Order o : orders) {
            if (o.getCustomer() == null || o.getCustomer().getRoute() == null) continue;
            UUID routeId = o.getCustomer().getRoute().getId();
            if (finalAllowedRouteIds != null && !finalAllowedRouteIds.contains(routeId)) continue;
            byRoute.computeIfAbsent(routeId, k -> new ArrayList<>()).add(o);
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

            long submitted = routeOrders.stream().filter(o -> o.getStatus() == Order.OrderStatus.SUBMITTED).count();
            long approved  = routeOrders.stream().filter(o -> o.getStatus() == Order.OrderStatus.APPROVED).count();
            long packing = routeOrders.stream().filter(o -> o.getStatus() == Order.OrderStatus.PACKING).count();
            long packed  = routeOrders.stream().filter(o -> o.getStatus() == Order.OrderStatus.PACKED).count();

            OrderDtos.RoutePicklistResponse res = new OrderDtos.RoutePicklistResponse();
            res.setRouteId(entry.getKey());
            res.setRouteName(route.getName());
            res.setDate(date);
            res.setTotalOrders(routeOrders.size());
            res.setSubmittedCount((int) submitted);
            res.setApprovedCount((int) approved);
            res.setPackingCount((int) packing);
            res.setPackedCount((int) packed);
            List<OrderDtos.RoutePicklistResponse.PickItem> pickList = new ArrayList<>(pickMap.values());
            pickList.sort(Comparator.comparing(OrderDtos.RoutePicklistResponse.PickItem::getProductName, String.CASE_INSENSITIVE_ORDER));
            res.setPickList(pickList);
            res.setOrders(routeOrders.stream().map(o -> {
                OrderDtos.RoutePicklistResponse.RouteOrderSummary s = new OrderDtos.RoutePicklistResponse.RouteOrderSummary();
                s.setOrderId(o.getId());
                s.setOrderNumber(o.getOrderNumber());
                s.setCustomerName(o.getCustomer().getBusinessName());
                s.setCustomerPhone(o.getCustomer().getPhone());
                s.setStatus(o.getStatus().name());
                s.setTotalAmount(o.getTotalAmount());
                s.setItemCount(o.getItems().size());
                s.setItems(o.getItems().stream().map(item -> {
                    OrderDtos.RoutePicklistResponse.OrderItemLine line = new OrderDtos.RoutePicklistResponse.OrderItemLine();
                    line.setProductName(item.getProduct().getName());
                    line.setBrand(item.getProduct().getBrand());
                    line.setUnit(item.getProduct().getUnit());
                    line.setQuantity(item.getQuantity());
                    line.setUnitPrice(item.getUnitPrice());
                    return line;
                }).collect(Collectors.toList()));
                return s;
            }).collect(Collectors.toList()));
            return res;
        }).collect(Collectors.toList());
    }

    public void routeStartPacking(UUID tenantId, UUID routeId, LocalDate date) {
        // Acts on the route's whole backlog, not just orders dated "date" — matches the
        // live picklist, which is no longer scoped to a single order date either.
        List<Order> orders = orderRepository.findByTenantRouteAndStatus(
            tenantId, routeId, Order.OrderStatus.APPROVED);
        orders.forEach(o -> o.setStatus(Order.OrderStatus.PACKING));
        orderRepository.saveAll(orders);
        orders.forEach(o -> auditService.record(tenantId, "ORDER", o.getId(), "PACKING",
            "Order " + o.getOrderNumber() + " moved to packing via route picklist"));
    }

    public void routeMarkPacked(UUID tenantId, UUID routeId, LocalDate date) {
        List<Order> orders = orderRepository.findByTenantRouteAndStatus(
            tenantId, routeId, Order.OrderStatus.PACKING);
        Instant now = Instant.now();
        orders.forEach(o -> {
            o.getItems().forEach(item -> {
                if (!item.isVerified()) {
                    item.setVerifiedQuantity(item.getQuantity());
                    item.setVerified(true);
                }
            });
            o.setStatus(Order.OrderStatus.PACKED);
            o.setPackedAt(now);
        });
        orderRepository.saveAll(orders);
        orders.forEach(o -> auditService.record(tenantId, "ORDER", o.getId(), "PACKED",
            "Order " + o.getOrderNumber() + " packed via route picklist"));
    }

    private Order getOrderEntity(UUID id, UUID tenantId) {
        return orderRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", id.toString()));
    }

    // ── Overall (bill-level) discount ────────────────────────────────────────────
    // Applies a single bill discount BEFORE GST by shrinking each line's GST-inclusive
    // total by its share of the bill, then re-extracting GST — so tax falls correctly
    // and the customer still sees one discount, never a per-item split. Returns the ₹
    // actually applied (0 when there's no discount). Mutates the items' lineTotal/gstAmount.
    private BigDecimal applyOverallDiscount(List<OrderItem> items, String type, BigDecimal value) {
        if (type == null || value == null || value.compareTo(BigDecimal.ZERO) <= 0) return BigDecimal.ZERO;
        if (!"PERCENT".equals(type) && !"AMOUNT".equals(type)) return BigDecimal.ZERO;
        BigDecimal gross = items.stream().map(OrderItem::getLineTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (gross.compareTo(BigDecimal.ZERO) <= 0) return BigDecimal.ZERO;

        BigDecimal discount = "PERCENT".equals(type)
                ? gross.multiply(value.min(BigDecimal.valueOf(100))).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                : value.min(gross); // flat ₹ capped at the bill — never negative
        if (discount.compareTo(BigDecimal.ZERO) <= 0) return BigDecimal.ZERO;

        OrderItem largest = items.get(0);
        for (OrderItem it : items) if (it.getLineTotal().compareTo(largest.getLineTotal()) > 0) largest = it;

        BigDecimal allocated = BigDecimal.ZERO;
        for (OrderItem it : items) {
            if (it == largest) continue;
            BigDecimal share = discount.multiply(it.getLineTotal()).divide(gross, 2, RoundingMode.HALF_UP);
            reduceLineByDiscount(it, share);
            allocated = allocated.add(share);
        }
        reduceLineByDiscount(largest, discount.subtract(allocated)); // remainder absorbs rounding
        return discount;
    }

    private void reduceLineByDiscount(OrderItem it, BigDecimal share) {
        if (share.compareTo(BigDecimal.ZERO) <= 0) return;
        BigDecimal newLineTotal = it.getLineTotal().subtract(share).max(BigDecimal.ZERO);
        BigDecimal divisor = BigDecimal.valueOf(100).add(it.getGstPercent());
        BigDecimal newBase = newLineTotal.multiply(BigDecimal.valueOf(100)).divide(divisor, 2, RoundingMode.HALF_UP);
        it.setLineTotal(newLineTotal);
        it.setGstAmount(newLineTotal.subtract(newBase));
    }

    private BigDecimal sumLineBase(List<OrderItem> items) {
        return items.stream().map(it -> it.getLineTotal().subtract(it.getGstAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal sumGst(List<OrderItem> items) {
        return items.stream().map(OrderItem::getGstAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private void validateStatus(Order order, Order.OrderStatus expected) {
        if (order.getStatus() != expected) {
            throw new BusinessException(
                "Expected order status " + expected + " but was " + order.getStatus(), "INVALID_STATUS");
        }
    }

    /** Only admins may price outside a batch's min/max (e.g. negotiated supermarket rates). */
    private boolean canOverridePriceRange() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        return auth.getAuthorities().stream().anyMatch(a ->
                "ROLE_ADMIN".equals(a.getAuthority()) || "ROLE_SUPER_ADMIN".equals(a.getAuthority()));
    }

    private void checkCrossBatchConflict(Product product, List<StockBatch> fifo, int qty) {
        if (fifo.size() < 2 || fifo.get(0).getQuantityAvailable() >= qty) return;
        StockBatch next = fifo.get(1);
        if (!Objects.equals(fifo.get(0).getMinSaleRate(), next.getMinSaleRate()) ||
            !Objects.equals(fifo.get(0).getMaxSaleRate(), next.getMaxSaleRate())) {
            int cap = fifo.get(0).getQuantityAvailable();
            throw new BusinessException(
                "Only " + cap + " pcs of '" + product.getName() + "' available at current batch price. " +
                "Next batch has a different rate — reduce quantity to " + cap + " or add a separate order line.",
                "CROSS_BATCH_PRICE_CONFLICT");
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
        res.setRoundOffAmount(o.getRoundOffAmount());
        res.setOverallDiscountType(o.getOverallDiscountType());
        res.setOverallDiscountValue(o.getOverallDiscountValue());
        res.setOverallDiscountAmount(o.getOverallDiscountAmount());
        res.setTotalAmount(o.getTotalAmount());
        res.setPaidAmount(o.getPaidAmount());
        res.setBalanceAmount(o.getBalanceAmount());
        res.setInvoiceUrl(o.getInvoiceUrl());
        res.setApprovedAt(o.getApprovedAt());
        res.setPackedAt(o.getPackedAt());
        res.setDispatchedAt(o.getDispatchedAt());
        res.setDeliveredAt(o.getDeliveredAt());
        res.setCreatedAt(o.getCreatedAt());

        if (o.getCustomer() != null) {
            OrderDtos.CustomerInfo ci = new OrderDtos.CustomerInfo();
            ci.setId(o.getCustomer().getId());
            ci.setBusinessName(o.getCustomer().getBusinessName());
            ci.setOwnerName(o.getCustomer().getOwnerName());
            ci.setPhone(o.getCustomer().getPhone());
            ci.setAddress(o.getCustomer().getAddress());
            ci.setLatitude(o.getCustomer().getLatitude());
            ci.setLongitude(o.getCustomer().getLongitude());
            if (o.getCustomer().getRoute() != null) ci.setRouteName(o.getCustomer().getRoute().getName());
            if (o.getCustomer().getRoutePlace() != null) ci.setRoutePlaceName(o.getCustomer().getRoutePlace().getName());
            ci.setGstin(o.getCustomer().getGstin());
            ci.setCity(o.getCustomer().getCity());
            ci.setState(o.getCustomer().getState());
            ci.setPinCode(o.getCustomer().getPinCode());
            res.setCustomer(ci);
        }

        if (o.getSalesPerson() != null) res.setSalesPerson(toPerson(o.getSalesPerson()));
        if (o.getDeliveryPerson() != null) res.setDeliveryPerson(toPerson(o.getDeliveryPerson()));
        if (o.getApprovedBy() != null) res.setApprovedBy(toPerson(o.getApprovedBy()));

        List<OrderDtos.OrderItemResponse> items = o.getItems().stream().map(item -> {
            OrderDtos.OrderItemResponse ir = new OrderDtos.OrderItemResponse();
            ir.setId(item.getId());
            ir.setQuantity(item.getQuantity());
            ir.setMrp(item.getMrp());
            ir.setUnitPrice(item.getUnitPrice());
            ir.setDiscountPercent(item.getDiscountPercent());
            ir.setDiscountAmount(item.getDiscountAmount());
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
                pi.setHsnCode(item.getProduct().getHsnCode());
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

    @Transactional(readOnly = true)
    public List<OrderDtos.WarehouseReturnHistoryRow> getWarehouseReturnHistory(UUID tenantId, LocalDate from, LocalDate to) {
        java.time.ZoneId zone = java.time.ZoneId.of("Asia/Kolkata");
        List<com.stockez.api.module.audit.entity.AuditLog> events = auditService.getWarehouseReturnEvents(
                tenantId, from.atStartOfDay(zone).toInstant(), to.plusDays(1).atStartOfDay(zone).toInstant());
        Map<UUID, Order> orders = orderRepository.findAllById(
                events.stream().map(com.stockez.api.module.audit.entity.AuditLog::getEntityId).distinct().collect(Collectors.toList()))
                .stream().filter(o -> o.getTenant().getId().equals(tenantId))
                .collect(Collectors.toMap(Order::getId, o -> o));

        return events.stream().filter(e -> orders.containsKey(e.getEntityId())).map(e -> {
            Order o = orders.get(e.getEntityId());
            OrderDtos.WarehouseReturnHistoryRow row = new OrderDtos.WarehouseReturnHistoryRow();
            row.setOrderId(o.getId());
            row.setOrderNumber(o.getOrderNumber());
            row.setCustomerName(o.getCustomer().getBusinessName());
            row.setRouteName(o.getCustomer().getRoute() != null ? o.getCustomer().getRoute().getName() : null);
            row.setDeliveryPersonName(o.getDeliveryPerson() != null ? o.getDeliveryPerson().getFullName() : null);
            row.setTotalAmount(o.getTotalAmount());
            row.setOutcome(switch (e.getAction()) {
                case "RESTOCKED" -> "Received in full";
                case "RESTOCKED_SHORTAGE" -> "Received with shortage";
                default -> "Order cancelled";
            });
            String d = e.getDescription();
            int dash = d.indexOf(" — ");
            row.setDetail(e.getAction().equals("RESTOCKED_SHORTAGE") && dash >= 0
                    ? d.substring(dash + 3).replace(" — flagged for review", "")
                    : null);
            row.setPerformedBy(e.getPerformedBy());
            row.setPerformedAt(e.getPerformedAt());
            return row;
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<OrderDtos.WarehouseReturnGroup> getWarehouseReturns(UUID tenantId) {
        // Every open return awaiting warehouse action, regardless of date — it's a task queue
        // that clears as each order is confirmed/cancelled, not a per-day historical view.
        List<Order> orders = orderRepository.findByTenantAndStatusOrderByReturnedAt(
                tenantId, Order.OrderStatus.RETURN_TO_WAREHOUSE);

        Map<UUID, List<Order>> byPerson = new LinkedHashMap<>();
        for (Order o : orders) {
            UUID key = o.getDeliveryPerson() != null ? o.getDeliveryPerson().getId() : UUID.fromString("00000000-0000-0000-0000-000000000000");
            byPerson.computeIfAbsent(key, k -> new java.util.ArrayList<>()).add(o);
        }

        List<OrderDtos.WarehouseReturnGroup> result = new java.util.ArrayList<>();
        for (Map.Entry<UUID, List<Order>> entry : byPerson.entrySet()) {
            List<Order> personOrders = entry.getValue();
            Order sample = personOrders.get(0);

            OrderDtos.WarehouseReturnGroup group = new OrderDtos.WarehouseReturnGroup();
            if (sample.getDeliveryPerson() != null) {
                group.setDeliveryPersonId(sample.getDeliveryPerson().getId());
                group.setDeliveryPersonName(sample.getDeliveryPerson().getFullName());
                group.setDeliveryPersonPhone(sample.getDeliveryPerson().getPhone());
            } else {
                group.setDeliveryPersonName("Unassigned");
            }
            group.setOrderCount(personOrders.size());

            List<OrderDtos.WarehouseReturnOrder> returnOrders = personOrders.stream().map(o -> {
                OrderDtos.WarehouseReturnOrder ro = new OrderDtos.WarehouseReturnOrder();
                ro.setId(o.getId());
                ro.setOrderNumber(o.getOrderNumber());
                ro.setCustomerName(o.getCustomer().getBusinessName());
                ro.setCustomerPhone(o.getCustomer().getPhone());
                ro.setRouteName(o.getCustomer().getRoute() != null ? o.getCustomer().getRoute().getName() : null);
                ro.setTotalAmount(o.getTotalAmount());
                ro.setOrderDate(o.getOrderDate());
                ro.setReturnedAt(o.getReturnedAt());
                ro.setItems(o.getItems().stream().map(item -> {
                    OrderDtos.WarehouseReturnItem ri = new OrderDtos.WarehouseReturnItem();
                    ri.setItemId(item.getId());
                    ri.setProductName(item.getProduct().getName());
                    ri.setBrand(item.getProduct().getBrandMaster() != null ? item.getProduct().getBrandMaster().getName() : null);
                    ri.setUnit(item.getProduct().getUnitMaster() != null ? item.getProduct().getUnitMaster().getName() : null);
                    ri.setQuantity(item.getQuantity());
                    ri.setUnitPrice(item.getUnitPrice());
                    ri.setReturnReceivedQuantity(item.getReturnReceivedQuantity());
                    return ri;
                }).collect(Collectors.toList()));
                return ro;
            }).collect(Collectors.toList());

            group.setOrders(returnOrders);
            result.add(group);
        }
        return result;
    }
}
