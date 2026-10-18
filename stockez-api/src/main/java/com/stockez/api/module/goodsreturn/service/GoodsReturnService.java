package com.stockez.api.module.goodsreturn.service;

import com.stockez.api.module.goodsreturn.dto.GoodsReturnDtos;
import com.stockez.api.module.goodsreturn.entity.GoodsReturn;
import com.stockez.api.module.goodsreturn.entity.GoodsReturnItem;
import com.stockez.api.module.goodsreturn.repository.GoodsReturnRepository;
import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.order.entity.OrderItem;
import com.stockez.api.module.order.entity.Payment;
import com.stockez.api.module.order.repository.OrderRepository;
import com.stockez.api.module.order.repository.PaymentRepository;
import com.stockez.api.module.customer.entity.Customer;
import com.stockez.api.module.customer.repository.CustomerRepository;
import com.stockez.api.module.product.entity.Product;
import com.stockez.api.module.product.repository.ProductRepository;
import com.stockez.api.module.purchase.entity.PurchaseEntry;
import com.stockez.api.module.purchase.entity.StockBatch;
import com.stockez.api.module.purchase.repository.PurchaseEntryRepository;
import com.stockez.api.module.purchase.repository.StockBatchRepository;
import com.stockez.api.module.stockshortage.entity.StockShortage;
import com.stockez.api.module.stockshortage.service.StockShortageService;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import com.stockez.api.module.audit.service.AuditService;
import com.stockez.common.exception.BusinessException;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.Year;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GoodsReturnService {

    private final GoodsReturnRepository goodsReturnRepository;
    private final StockBatchRepository stockBatchRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final CustomerRepository customerRepository;
    private final PaymentRepository paymentRepository;
    private final PurchaseEntryRepository purchaseEntryRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;
    private final StockShortageService stockShortageService;

    /**
     * A return can never be bigger than what is physically there to return:
     *   sales return     - sold on the order, minus what earlier returns already took back
     *   purchase return  - in stock (in the named batch, when one is named) and on the referenced bill
     *   damage           - in stock (in the named batch, when one is named)
     * The screens pre-cap these, but the server is the last line of defence.
     */
    private boolean canFileDamage() {
        org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        return auth.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_SUPER_ADMIN")
                        || a.getAuthority().equals("RETURNS_DAMAGE"));
    }

    private void validateReturnQuantities(GoodsReturn.ReturnType type, GoodsReturnDtos.CreateGoodsReturnRequest req,
                                          Order referenceOrder, PurchaseEntry referencePurchaseEntry, UUID tenantId) {
        java.util.Map<UUID, Integer> askedByProduct = new java.util.LinkedHashMap<>();
        for (GoodsReturnDtos.GoodsReturnItemRequest it : req.getItems()) {
            askedByProduct.merge(it.getProductId(), it.getQuantity(), Integer::sum);
        }

        if (type == GoodsReturn.ReturnType.SALES_RETURN && referenceOrder != null) {
            java.util.Map<UUID, Integer> sold = new java.util.HashMap<>();
            for (OrderItem oi : referenceOrder.getItems()) {
                sold.merge(oi.getProduct().getId(), oi.getQuantity(), Integer::sum);
            }
            java.util.Map<String, Integer> returned = getReturnedQtyByOrder(referenceOrder.getId(), tenantId);
            for (var e : askedByProduct.entrySet()) {
                String name = productName(e.getKey(), tenantId);
                Integer soldQty = sold.get(e.getKey());
                if (soldQty == null) {
                    throw new BusinessException("'" + name + "' is not on order " + referenceOrder.getOrderNumber(),
                            "PRODUCT_NOT_ON_ORDER");
                }
                int already = returned.getOrDefault(e.getKey().toString(), 0);
                if (e.getValue() > soldQty - already) {
                    throw new BusinessException(String.format(
                            "Only %d unit(s) of '%s' can still be returned on this order (sold %d, already returned %d)",
                            Math.max(soldQty - already, 0), name, soldQty, already), "RETURN_QTY_EXCEEDS_SOLD");
                }
            }
        }

        if (type == GoodsReturn.ReturnType.PURCHASE_RETURN || type == GoodsReturn.ReturnType.DAMAGE) {
            java.util.Map<String, Integer> askedByBatch = new java.util.LinkedHashMap<>();
            java.util.Map<String, UUID> batchProduct = new java.util.HashMap<>();
            for (GoodsReturnDtos.GoodsReturnItemRequest it : req.getItems()) {
                if (it.getBatchNumber() != null && !it.getBatchNumber().isBlank()) {
                    String bn = it.getBatchNumber().trim();
                    askedByBatch.merge(bn, it.getQuantity(), Integer::sum);
                    batchProduct.put(bn, it.getProductId());
                }
            }
            for (var e : askedByBatch.entrySet()) {
                String bn = e.getKey();
                UUID productId = batchProduct.get(bn);
                StockBatch batch = stockBatchRepository.findByTenantAndBatchNumber(tenantId, bn)
                        .orElseThrow(() -> new BusinessException("Batch " + bn + " was not found", "BATCH_NOT_FOUND"));
                if (!batch.getProduct().getId().equals(productId)) {
                    throw new BusinessException("Batch " + bn + " does not belong to '"
                            + productName(productId, tenantId) + "'", "BATCH_PRODUCT_MISMATCH");
                }
                if (e.getValue() > batch.getQuantityAvailable()) {
                    throw new BusinessException(String.format(
                            "Batch %s of '%s' has only %d unit(s) in stock - cannot return %d",
                            bn, productName(productId, tenantId), batch.getQuantityAvailable(), e.getValue()),
                            "RETURN_QTY_EXCEEDS_STOCK");
                }
            }
            for (var e : askedByProduct.entrySet()) {
                Integer inStock = stockBatchRepository.sumAvailableByProduct(tenantId, e.getKey());
                int available = inStock != null ? inStock : 0;
                if (e.getValue() > available) {
                    throw new BusinessException(String.format(
                            "Only %d unit(s) of '%s' in stock - cannot return %d",
                            available, productName(e.getKey(), tenantId), e.getValue()), "RETURN_QTY_EXCEEDS_STOCK");
                }
            }
        }

        // Against a bill: no more than was bought on it, net of earlier returns. Opening-balance
        // bills carry no item lines, so there is nothing to compare against.
        if (type == GoodsReturn.ReturnType.PURCHASE_RETURN && referencePurchaseEntry != null
                && !referencePurchaseEntry.getItems().isEmpty()) {
            java.util.Map<UUID, Integer> bought = new java.util.HashMap<>();
            for (var pi : referencePurchaseEntry.getItems()) {
                bought.merge(pi.getProduct().getId(), pi.getQuantity(), Integer::sum);
            }
            java.util.Map<UUID, Integer> returned = new java.util.HashMap<>();
            for (Object[] row : goodsReturnRepository.sumReturnedQtyByPurchaseEntry(tenantId, referencePurchaseEntry.getId())) {
                returned.put((UUID) row[0], ((Number) row[1]).intValue());
            }
            for (var e : askedByProduct.entrySet()) {
                String name = productName(e.getKey(), tenantId);
                Integer boughtQty = bought.get(e.getKey());
                if (boughtQty == null) {
                    throw new BusinessException("'" + name + "' is not on purchase " + referencePurchaseEntry.getEntryNumber(),
                            "PRODUCT_NOT_ON_PURCHASE");
                }
                int already = returned.getOrDefault(e.getKey(), 0);
                if (e.getValue() > boughtQty - already) {
                    throw new BusinessException(String.format(
                            "Only %d unit(s) of '%s' can still be returned on this purchase (bought %d, already returned %d)",
                            Math.max(boughtQty - already, 0), name, boughtQty, already), "RETURN_QTY_EXCEEDS_PURCHASED");
                }
            }
        }
    }

    /** Mirror a return/refund event onto the sales order it belongs to, so the order's own audit history tells the whole story. */
    private void recordOnOrder(GoodsReturn gr, String action, String description) {
        if (gr.getReferenceOrder() == null) return;
        auditService.record(gr.getTenant().getId(), "ORDER", gr.getReferenceOrder().getId(), action, description);
    }

    private String productName(UUID productId, UUID tenantId) {
        return productRepository.findByIdAndTenantId(productId, tenantId)
                .map(Product::getName).orElse("product");
    }

    @Transactional
    public GoodsReturnDtos.GoodsReturnResponse createReturn(
            GoodsReturnDtos.CreateGoodsReturnRequest req, UUID userId, UUID tenantId) {

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));
        User createdBy = userRepository.findByIdAndTenantId(userId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        GoodsReturn.ReturnType returnType;
        try {
            returnType = GoodsReturn.ReturnType.valueOf(req.getType());
        } catch (IllegalArgumentException e) {
            throw new BusinessException(
                    "Invalid return type: " + req.getType() + ". Must be SALES_RETURN, PURCHASE_RETURN, or DAMAGE",
                    "INVALID_RETURN_TYPE");
        }

        if (returnType == GoodsReturn.ReturnType.DAMAGE && !canFileDamage()) {
            throw new BusinessException("You do not have permission to file damage / loss entries", "DAMAGE_NOT_ALLOWED");
        }

        // Each return type carries its own self-describing number series:
        //   SRN-YYYY-NNNNN  sales return    (customer → us, credit note)
        //   PRN-YYYY-NNNNN  purchase return (us → supplier, debit note)
        //   DMG-YYYY-NNNNN  damage / loss   (internal write-off)
        // Legacy RTN-… numbers created before this split are left untouched.
        String prefix = switch (returnType) {
            case SALES_RETURN -> "SRN";
            case PURCHASE_RETURN -> "PRN";
            case DAMAGE -> "DMG";
            case OLD_STOCK_RETURN -> "OSR";
        };
        int year = Year.now().getValue();
        int seq = goodsReturnRepository.findMaxReturnSequence(tenantId, prefix, year) + 1;
        String returnNumber = String.format("%s-%d-%05d", prefix, year, seq);

        if (returnType == GoodsReturn.ReturnType.SALES_RETURN && req.getOrderId() == null) {
            throw new BusinessException(
                    "Order reference is required for Sales Return", "ORDER_REQUIRED");
        }

        Order referenceOrder = null;
        if (returnType == GoodsReturn.ReturnType.SALES_RETURN && req.getOrderId() != null) {
            referenceOrder = orderRepository.findByIdAndTenantId(req.getOrderId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Order", req.getOrderId().toString()));
        }

        // Old-stock return — legacy goods with no order in the system. Office/admin only,
        // and it settles against a chosen customer's opening balance instead of an order.
        Customer legacyCustomer = null;
        if (returnType == GoodsReturn.ReturnType.OLD_STOCK_RETURN) {
            boolean fieldStaff = createdBy.getRole() == User.UserRole.SALES
                    || createdBy.getRole() == User.UserRole.DELIVERY
                    || (createdBy.getCustomRole() != null && createdBy.getCustomRole().isFieldStaff());
            if (fieldStaff) {
                throw new BusinessException(
                        "Old-stock returns can only be filed by office/admin staff", "NOT_ALLOWED");
            }
            if (req.getCustomerId() == null) {
                throw new BusinessException(
                        "Customer is required for an old-stock return", "CUSTOMER_REQUIRED");
            }
            legacyCustomer = customerRepository.findByIdAndTenantId(req.getCustomerId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Customer", req.getCustomerId().toString()));
        }

        PurchaseEntry referencePurchaseEntry = null;
        String resolvedSupplierName = req.getSupplierName();
        if (returnType == GoodsReturn.ReturnType.PURCHASE_RETURN && req.getPurchaseEntryId() != null) {
            referencePurchaseEntry = purchaseEntryRepository.findByIdAndTenantId(req.getPurchaseEntryId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("PurchaseEntry", req.getPurchaseEntryId().toString()));
            if (resolvedSupplierName == null || resolvedSupplierName.isBlank()) {
                resolvedSupplierName = referencePurchaseEntry.getSupplierName();
            }
        }

        // Damage attribution — where the loss came from and who is responsible.
        User responsiblePerson = null;
        String damageSource = null;
        if (returnType == GoodsReturn.ReturnType.DAMAGE) {
            damageSource = (req.getDamageSource() != null && !req.getDamageSource().isBlank())
                    ? req.getDamageSource().toUpperCase() : "WAREHOUSE";
            if (req.getResponsiblePersonId() != null) {
                responsiblePerson = userRepository.findByIdAndTenantId(req.getResponsiblePersonId(), tenantId)
                        .orElseThrow(() -> new ResourceNotFoundException("User", req.getResponsiblePersonId().toString()));
            }
            if ("SUPPLIER".equals(damageSource) && (resolvedSupplierName == null || resolvedSupplierName.isBlank())) {
                throw new BusinessException(
                        "Supplier name is required for supplier-caused damage", "SUPPLIER_REQUIRED");
            }
        }

        GoodsReturn goodsReturn = GoodsReturn.builder()
                .tenant(tenant)
                .returnNumber(returnNumber)
                .type(returnType)
                .referenceOrder(referenceOrder)
                .referencePurchaseEntry(referencePurchaseEntry)
                .customer(legacyCustomer)
                .supplierName(resolvedSupplierName)
                .damageSource(damageSource)
                .responsiblePerson(responsiblePerson)
                .returnDate(req.getReturnDate())
                .reason(req.getReason())
                .createdBy(createdBy)
                .warehouseStatus(returnType == GoodsReturn.ReturnType.SALES_RETURN
                        ? GoodsReturn.WarehouseStatus.PENDING_VERIFICATION
                        : GoodsReturn.WarehouseStatus.VERIFIED)
                .build();

        validateReturnQuantities(returnType, req, referenceOrder, referencePurchaseEntry, tenantId);

        BigDecimal totalAmount = BigDecimal.ZERO;

        for (GoodsReturnDtos.GoodsReturnItemRequest itemReq : req.getItems()) {
            Product product = productRepository.findByIdAndTenantId(itemReq.getProductId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Product", itemReq.getProductId().toString()));

            BigDecimal amount = itemReq.getUnitRate().multiply(BigDecimal.valueOf(itemReq.getQuantity()));
            totalAmount = totalAmount.add(amount);

            BigDecimal gstPct = product.getSalesGstPercent() != null ? product.getSalesGstPercent() : BigDecimal.ZERO;
            BigDecimal gstAmt = gstPct.compareTo(BigDecimal.ZERO) > 0
                    ? amount.multiply(gstPct).divide(BigDecimal.valueOf(100).add(gstPct), 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            BigDecimal taxable = amount.subtract(gstAmt);

            GoodsReturnItem item = GoodsReturnItem.builder()
                    .goodsReturn(goodsReturn)
                    .product(product)
                    .batchNumber(itemReq.getBatchNumber())
                    .quantity(itemReq.getQuantity())
                    .unitRate(itemReq.getUnitRate())
                    .amount(amount)
                    .gstPercent(gstPct)
                    .taxableAmount(taxable)
                    .gstAmount(gstAmt)
                    .reason(itemReq.getReason())
                    .itemCondition(itemReq.getCondition())
                    .mrp(itemReq.getMrp())
                    .minSaleRate(itemReq.getMinSaleRate())
                    .maxSaleRate(itemReq.getMaxSaleRate())
                    .purchaseRate(itemReq.getPurchaseRate())
                    .expiryDate(itemReq.getExpiryDate())
                    .build();

            goodsReturn.getItems().add(item);
        }

        goodsReturn.setTotalAmount(totalAmount);
        GoodsReturn saved = goodsReturnRepository.save(goodsReturn);

        // Fresh-batch numbering for sellable old-stock lines (BCH-YYYYMMDD-NNN), seeded once.
        final String batchDateTag = req.getReturnDate().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd"));
        final java.util.concurrent.atomic.AtomicInteger batchSeq = new java.util.concurrent.atomic.AtomicInteger(
                returnType == GoodsReturn.ReturnType.OLD_STOCK_RETURN
                        ? stockBatchRepository.countByTenantAndDate(tenantId, req.getReturnDate()) + 1 : 1);

        // ── Stock adjustments (SALES_RETURN deferred until warehouse verifies) ──
        for (GoodsReturnItem item : saved.getItems()) {
            Product product = item.getProduct();
            UUID productId = product.getId();

            switch (returnType) {

                case SALES_RETURN -> {
                    // Stock restored only when warehouse physically verifies receipt — see verifyWarehouseReceipt()
                }

                case OLD_STOCK_RETURN -> {
                    if ("EXPIRED".equalsIgnoreCase(item.getItemCondition())) {
                        // Expired legacy goods — written off. They were never in our stock,
                        // so there is nothing to add or deduct; the value is a recorded loss.
                    } else {
                        // Sellable legacy goods — restock into a FRESH batch. Origin/expiry are
                        // unknown to StockEz, so we create a new batch with the expiry read off the
                        // physical pack and its own min/max sale range (defaulted from the product).
                        BigDecimal mrp  = item.getMrp() != null ? item.getMrp() : product.getMrp();
                        BigDecimal cost = item.getPurchaseRate() != null ? item.getPurchaseRate() : product.getPurchaseRate();
                        BigDecimal minR = item.getMinSaleRate() != null ? item.getMinSaleRate() : product.getMinSaleRate();
                        BigDecimal maxR = item.getMaxSaleRate() != null ? item.getMaxSaleRate() : product.getMaxSaleRate();
                        if (mrp == null || cost == null) {
                            throw new BusinessException(
                                    "MRP and cost are required to restock '" + product.getName() + "'",
                                    "BATCH_PRICING_REQUIRED");
                        }
                        BigDecimal pGst = product.getPurchaseGstPercent() != null
                                ? product.getPurchaseGstPercent() : BigDecimal.ZERO;
                        String batchNumber = String.format("BCH-%s-%03d", batchDateTag, batchSeq.getAndIncrement());
                        StockBatch batch = StockBatch.builder()
                                .tenant(saved.getTenant())
                                .product(product)
                                .batchNumber(batchNumber)
                                .mrp(mrp)
                                .purchaseRate(cost)
                                .purchaseGstPercent(pGst)
                                .minSaleRate(minR)
                                .maxSaleRate(maxR)
                                .expiryDate(item.getExpiryDate())
                                .quantityReceived(item.getQuantity())
                                .quantityAvailable(item.getQuantity())
                                .receivedDate(req.getReturnDate())
                                .active(true)
                                .build();
                        stockBatchRepository.save(batch);
                    }
                }

                case PURCHASE_RETURN, DAMAGE -> {
                    String namedBatch = item.getBatchNumber() != null ? item.getBatchNumber().trim() : "";
                    if (!namedBatch.isEmpty()) {
                        // The batch the user picked is the stock that physically goes; availability was checked up front.
                        StockBatch batch = stockBatchRepository.findByTenantAndBatchNumber(tenantId, namedBatch)
                                .orElseThrow(() -> new BusinessException(
                                        "Batch " + namedBatch + " was not found", "BATCH_NOT_FOUND"));
                        batch.setQuantityAvailable(batch.getQuantityAvailable() - item.getQuantity());
                        if (batch.getQuantityAvailable() == 0) {
                            batch.setActive(false);
                        }
                        stockBatchRepository.save(batch);
                        Integer batchStock = stockBatchRepository.sumAvailableByProduct(tenantId, productId);
                        product.setStockQuantity(batchStock != null ? batchStock : 0);
                        productRepository.save(product);
                        continue;
                    }
                    // No batch named: FIFO deduction, oldest batch first
                    List<StockBatch> fifoBatches = stockBatchRepository.findFifoByProduct(tenantId, productId);
                    int remaining = item.getQuantity();

                    for (StockBatch batch : fifoBatches) {
                        if (remaining <= 0) break;
                        int deduct = Math.min(batch.getQuantityAvailable(), remaining);
                        batch.setQuantityAvailable(batch.getQuantityAvailable() - deduct);
                        if (batch.getQuantityAvailable() == 0) {
                            batch.setActive(false);
                        }
                        stockBatchRepository.save(batch);
                        remaining -= deduct;
                    }

                    if (remaining > 0) {
                        throw new BusinessException(
                                "Insufficient stock for product: " + product.getName() +
                                ". Available stock is less than return quantity.",
                                "INSUFFICIENT_STOCK");
                    }
                }
            }

            // Sync product.stockQuantity from batches
            Integer newStock = stockBatchRepository.sumAvailableByProduct(tenantId, productId);
            product.setStockQuantity(newStock != null ? newStock : 0);
            productRepository.save(product);
        }

        // Sales returns settle financially only when the warehouse confirms receipt
        // (see verifyWarehouseReceipt) — the bill reduction and any cash refund are based
        // on the quantity actually received, so nothing touches the order or records a
        // refund at filing time.

        // A purchase return is money the supplier owes us back — tracked as a pending
        // claim under Finance → Refunds & Claims until it is marked received.
        if (returnType == GoodsReturn.ReturnType.PURCHASE_RETURN) {
            saved.setRefundStatus(GoodsReturn.RefundStatus.PENDING);
            saved.setRefundAmount(saved.getTotalAmount());
            goodsReturnRepository.save(saved);
        }

        // Supplier-caused damage is money the supplier owes us back — a recoverable claim,
        // not a plain internal loss. Warehouse / transit / customer damage stays a loss (NONE).
        if (returnType == GoodsReturn.ReturnType.DAMAGE && "SUPPLIER".equals(saved.getDamageSource())) {
            saved.setRefundStatus(GoodsReturn.RefundStatus.PENDING);
            saved.setRefundAmount(saved.getTotalAmount());
            goodsReturnRepository.save(saved);
        }

        // Old-stock return — the returned value is a credit to the customer. Apply it to their
        // migrated opening balance (oldest first); any excess becomes a pending cash refund.
        if (returnType == GoodsReturn.ReturnType.OLD_STOCK_RETURN) {
            BigDecimal remainder = applyCreditToOpeningBalance(tenantId, legacyCustomer.getId(), saved.getTotalAmount());
            BigDecimal creditApplied = saved.getTotalAmount().subtract(remainder);
            if (remainder.compareTo(BigDecimal.ZERO) > 0) {
                saved.setRefundStatus(GoodsReturn.RefundStatus.PENDING);
                saved.setRefundAmount(remainder);
            }
            goodsReturnRepository.save(saved);
            auditService.record(tenantId, "GOODS_RETURN", saved.getId(), "OLD_STOCK_CREDIT",
                    "Old-stock return " + saved.getReturnNumber() + " for " + legacyCustomer.getBusinessName()
                    + " — ₹" + creditApplied.toPlainString() + " credited to opening balance"
                    + (remainder.compareTo(BigDecimal.ZERO) > 0
                        ? ", ₹" + remainder.toPlainString() + " queued as cash refund" : ""));
        }

        auditService.record(tenantId, "GOODS_RETURN", saved.getId(), "CREATED",
                "Return " + saved.getReturnNumber() + " (" + returnType.name() + ") — " +
                req.getItems().size() + " item(s), ₹" + saved.getTotalAmount().toPlainString());
        recordOnOrder(saved, "RETURN_FILED", "Return " + saved.getReturnNumber() + " filed against this order \u2014 "
                + req.getItems().size() + " item(s), ₹" + saved.getTotalAmount().toPlainString());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public Page<GoodsReturnDtos.GoodsReturnResponse> listReturns(UUID tenantId, Pageable pageable) {
        return goodsReturnRepository.findByTenantIdOrderByReturnDateDescCreatedAtDesc(tenantId, pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public GoodsReturnDtos.GoodsReturnResponse getReturn(UUID id, UUID tenantId) {
        GoodsReturn goodsReturn = goodsReturnRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("GoodsReturn", id.toString()));
        return toResponse(goodsReturn);
    }

    @Transactional(readOnly = true)
    public List<GoodsReturnDtos.GoodsReturnResponse> getMyReturns(UUID tenantId, UUID userId, java.time.LocalDate date) {
        return goodsReturnRepository.findByTenantIdAndCreatedByIdAndReturnDateOrderByCreatedAtDesc(tenantId, userId, date)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GoodsReturnDtos.GoodsReturnResponse> getPendingRefunds(UUID tenantId) {
        return goodsReturnRepository
                .findByTenantIdAndRefundStatusOrderByReturnDateDesc(tenantId, GoodsReturn.RefundStatus.PENDING)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    /** Customer refunds already paid out on sales / old-stock returns — a tracking view. */
    @Transactional(readOnly = true)
    public List<GoodsReturnDtos.GoodsReturnResponse> getCustomerRefunds(UUID tenantId) {
        return goodsReturnRepository
                .findByTenantIdAndRefundStatusAndTypeInOrderByReturnDateDesc(
                        tenantId, GoodsReturn.RefundStatus.PROCESSED,
                        List.of(GoodsReturn.ReturnType.SALES_RETURN, GoodsReturn.ReturnType.OLD_STOCK_RETURN))
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    /** Money owed to us by suppliers — purchase returns and supplier-caused damage, pending or received. */
    @Transactional(readOnly = true)
    public List<GoodsReturnDtos.GoodsReturnResponse> getSupplierClaims(UUID tenantId) {
        return goodsReturnRepository
                .findSupplierClaims(tenantId,
                        List.of(GoodsReturn.RefundStatus.PENDING, GoodsReturn.RefundStatus.PROCESSED),
                        GoodsReturn.ReturnType.PURCHASE_RETURN, GoodsReturn.ReturnType.DAMAGE)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GoodsReturnDtos.GoodsReturnResponse> getPendingVerification(UUID tenantId) {
        return goodsReturnRepository
                .findByTenantIdAndWarehouseStatusOrderByReturnDateDescCreatedAtDesc(
                        tenantId, GoodsReturn.WarehouseStatus.PENDING_VERIFICATION)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GoodsReturnDtos.GoodsReturnResponse> getWarehouseHistory(UUID tenantId, java.time.LocalDate from, java.time.LocalDate to) {
        return goodsReturnRepository.findSalesReturnHistory(tenantId, from, to)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    /** Void a return that's still awaiting warehouse verification — safe because nothing has
     *  touched stock, the customer's balance, or any payment yet at this stage (that only
     *  happens in verifyWarehouseReceipt). Once verified, this is no longer available; a
     *  verified return needs a manual stock/balance correction instead of a blind undo. */
    @Transactional
    public GoodsReturnDtos.GoodsReturnResponse cancelReturn(
            UUID id, GoodsReturnDtos.CancelReturnRequest req, UUID userId, UUID tenantId) {
        GoodsReturn gr = goodsReturnRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("GoodsReturn", id.toString()));

        if (gr.getWarehouseStatus() != GoodsReturn.WarehouseStatus.PENDING_VERIFICATION) {
            throw new BusinessException(
                    "Only a return still awaiting verification can be cancelled — this one is already "
                            + gr.getWarehouseStatus().name().toLowerCase().replace('_', ' ') + ".",
                    "RETURN_NOT_CANCELLABLE");
        }

        User cancelledBy = userRepository.findByIdAndTenantId(userId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        gr.setWarehouseStatus(GoodsReturn.WarehouseStatus.CANCELLED);
        gr.setCancelledBy(cancelledBy);
        gr.setCancelledAt(Instant.now());
        gr.setCancellationReason(req.getReason());
        GoodsReturn saved = goodsReturnRepository.save(gr);

        auditService.record(tenantId, "GOODS_RETURN", saved.getId(), "CANCELLED",
                "Return " + saved.getReturnNumber() + " cancelled by " + cancelledBy.getFullName()
                        + " — " + req.getReason());
        recordOnOrder(saved, "RETURN_CANCELLED", "Return " + saved.getReturnNumber() + " cancelled by "
                + cancelledBy.getFullName() + " — " + req.getReason());
        return toResponse(saved);
    }

    @Transactional
    public GoodsReturnDtos.GoodsReturnResponse verifyWarehouseReceipt(
            UUID id, GoodsReturnDtos.VerifyReceiptRequest req, UUID userId, UUID tenantId) {
        GoodsReturn gr = goodsReturnRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("GoodsReturn", id.toString()));

        if (gr.getType() != GoodsReturn.ReturnType.SALES_RETURN) {
            throw new BusinessException("Only sales returns require warehouse verification", "INVALID_RETURN_TYPE");
        }
        if (gr.getWarehouseStatus() == GoodsReturn.WarehouseStatus.VERIFIED) {
            throw new BusinessException("This return has already been verified", "ALREADY_VERIFIED");
        }

        User verifiedBy = userRepository.findByIdAndTenantId(userId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        java.util.Map<UUID, Integer> receivedByItem = req.getItems().stream()
                .collect(Collectors.toMap(
                        GoodsReturnDtos.VerifyReceiptItem::getItemId,
                        GoodsReturnDtos.VerifyReceiptItem::getReceivedQty));
        java.util.Map<UUID, Integer> damagedByItem = new java.util.HashMap<>();
        req.getItems().forEach(i -> damagedByItem.put(i.getItemId(), i.getDamagedQty() != null ? i.getDamagedQty() : 0));

        Order referenceOrder = gr.getReferenceOrder();
        UUID routeId = resolveRouteId(referenceOrder);
        String routeName = resolveRouteName(referenceOrder);
        User responsiblePerson = referenceOrder != null
                ? (referenceOrder.getDeliveryPerson() != null ? referenceOrder.getDeliveryPerson() : referenceOrder.getSalesPerson())
                : null;

        int totalFiled = 0;
        int totalReceived = 0;
        int totalDamaged = 0;

        for (GoodsReturnItem item : gr.getItems()) {
            Integer received = receivedByItem.get(item.getId());
            if (received == null) {
                throw new BusinessException(
                        "Received quantity missing for product: " + item.getProduct().getName(),
                        "RECEIVED_QTY_MISSING");
            }
            if (received > item.getQuantity()) {
                throw new BusinessException(
                        "Received quantity cannot exceed the filed quantity for product: "
                                + item.getProduct().getName(),
                        "RECEIVED_QTY_TOO_HIGH");
            }

            int damaged = damagedByItem.getOrDefault(item.getId(), 0);
            if (damaged > received) {
                throw new BusinessException(
                        "Damaged quantity cannot exceed the received quantity for product: "
                                + item.getProduct().getName(),
                        "DAMAGED_QTY_TOO_HIGH");
            }

            item.setReceivedQty(received);
            item.setDamagedQty(damaged);
            totalFiled += item.getQuantity();
            totalReceived += received;
            totalDamaged += damaged;

            Product product = item.getProduct();
            UUID productId = product.getId();

            int itemShortQty = item.getQuantity() - received;
            if (itemShortQty > 0) {
                stockShortageService.record(
                        gr.getTenant(), product, item.getBatchNumber(), itemShortQty, item.getUnitRate(),
                        StockShortage.SourceType.SALES_RETURN, gr.getReturnNumber(), gr.getId(),
                        routeId, routeName, responsiblePerson, verifiedBy, gr.getReturnDate());
            }

            // Damaged units came back but cannot be sold: refunded to the customer, written off here.
            if (damaged > 0) {
                stockShortageService.record(
                        gr.getTenant(), product, item.getBatchNumber(), damaged, item.getUnitRate(),
                        StockShortage.SourceType.SALES_RETURN_DAMAGED, gr.getReturnNumber(), gr.getId(),
                        routeId, routeName, null, verifiedBy, gr.getReturnDate());
            }

            int sellable = received - damaged;
            if (sellable > 0) {
                StockBatch targetBatch;
                if (item.getBatchNumber() != null && !item.getBatchNumber().isBlank()) {
                    targetBatch = stockBatchRepository
                            .findByTenantAndBatchNumber(tenantId, item.getBatchNumber())
                            .orElseGet(() -> stockBatchRepository
                                    .findByTenantAndProduct(tenantId, productId)
                                    .stream().findFirst()
                                    .orElseThrow(() -> new BusinessException(
                                            "No stock batch found for product: " + product.getName(), "BATCH_NOT_FOUND")));
                } else {
                    targetBatch = stockBatchRepository
                            .findByTenantAndProduct(tenantId, productId)
                            .stream().findFirst()
                            .orElseThrow(() -> new BusinessException(
                                    "No stock batch found for product: " + product.getName(), "BATCH_NOT_FOUND"));
                }
                targetBatch.setQuantityAvailable(targetBatch.getQuantityAvailable() + sellable);
                targetBatch.setActive(true);
                stockBatchRepository.save(targetBatch);

                Integer newStock = stockBatchRepository.sumAvailableByProduct(tenantId, productId);
                product.setStockQuantity(newStock != null ? newStock : 0);
                productRepository.save(product);
            }
        }

        // ── Financial settlement — based on the quantity actually received ──
        // The customer's bill is reduced by the value of goods confirmed back (damaged included: the
        // customer is credited either way). If they had already paid more than the reduced bill, the
        // excess becomes a PENDING refund that finance pays out from Refunds & Claims with the real
        // payment mode and date; no cash is recorded as leaving until then. Otherwise their
        // outstanding simply drops.
        BigDecimal receivedValue = BigDecimal.ZERO;
        for (GoodsReturnItem item : gr.getItems()) {
            Integer rec = item.getReceivedQty();
            if (rec != null && rec > 0) {
                receivedValue = receivedValue.add(item.getUnitRate().multiply(BigDecimal.valueOf(rec)));
            }
        }

        if (referenceOrder != null && receivedValue.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal newTotal = referenceOrder.getTotalAmount().subtract(receivedValue);
            if (newTotal.compareTo(BigDecimal.ZERO) < 0) newTotal = BigDecimal.ZERO;

            BigDecimal paidSoFar = referenceOrder.getPaidAmount();
            BigDecimal refundAmt = paidSoFar.subtract(newTotal); // positive = customer overpaid vs new total

            if (refundAmt.compareTo(BigDecimal.ZERO) > 0) {
                referenceOrder.setPaidAmount(newTotal);
                referenceOrder.setBalanceAmount(BigDecimal.ZERO);

                gr.setRefundStatus(GoodsReturn.RefundStatus.PENDING);
                gr.setRefundAmount(refundAmt);
            } else {
                referenceOrder.setBalanceAmount(newTotal.subtract(paidSoFar));
            }
            referenceOrder.setTotalAmount(newTotal);
            orderRepository.save(referenceOrder);
        }

        gr.setWarehouseStatus(GoodsReturn.WarehouseStatus.VERIFIED);
        gr.setVerifiedBy(verifiedBy);
        gr.setVerifiedAt(Instant.now());
        GoodsReturn saved = goodsReturnRepository.save(gr);

        int shortage = totalFiled - totalReceived;
        String detail = "Return " + saved.getReturnNumber() + " verified by " + verifiedBy.getFullName()
                + " — received " + totalReceived + " of " + totalFiled + " filed unit(s), "
                + (totalReceived - totalDamaged) + " restocked";
        if (totalDamaged > 0) {
            detail += ", " + totalDamaged + " damaged (written off, not restocked)";
        }
        if (shortage > 0) {
            detail += ". SHORTAGE: " + shortage + " unit(s) filed but not received.";
        }
        auditService.record(tenantId, "GOODS_RETURN", saved.getId(),
                shortage > 0 ? "WAREHOUSE_VERIFIED_SHORTAGE" : "WAREHOUSE_VERIFIED", detail);
        recordOnOrder(saved, "RETURN_VERIFIED", detail);

        if (saved.getRefundStatus() == GoodsReturn.RefundStatus.PENDING
                && saved.getRefundAmount() != null && saved.getRefundAmount().compareTo(BigDecimal.ZERO) > 0) {
            String customerName = referenceOrder.getCustomer() != null
                    ? referenceOrder.getCustomer().getBusinessName() : "customer";
            auditService.record(tenantId, "GOODS_RETURN", saved.getId(), "REFUND_INITIATED",
                    "₹" + saved.getRefundAmount().toPlainString() + " refund due to " + customerName
                            + " — awaiting payout by finance (Refunds & Claims)");
            recordOnOrder(saved, "REFUND_INITIATED", "₹" + saved.getRefundAmount().toPlainString()
                    + " refund due to the customer for return " + saved.getReturnNumber()
                    + " — awaiting payout by finance");
        }
        return toResponse(saved);
    }

    /** Apply an old-stock return credit against a customer's migrated opening balance, oldest
     *  first, by shrinking the opening-balance order total (balance = total − paid stays consistent
     *  and never goes negative). Returns the un-applied remainder, which the caller turns into a
     *  pending cash refund. */
    private BigDecimal applyCreditToOpeningBalance(UUID tenantId, UUID customerId, BigDecimal credit) {
        if (credit == null || credit.compareTo(BigDecimal.ZERO) <= 0) return BigDecimal.ZERO;
        BigDecimal remaining = credit;
        for (Order o : orderRepository.findOpeningBalanceOutstandingByCustomer(
                tenantId, customerId, Order.OrderStatus.CANCELLED)) {
            if (remaining.compareTo(BigDecimal.ZERO) <= 0) break;
            BigDecimal bal = o.getBalanceAmount();
            if (bal == null || bal.compareTo(BigDecimal.ZERO) <= 0) continue;
            BigDecimal applied = remaining.min(bal);
            o.setTotalAmount(o.getTotalAmount().subtract(applied));
            o.setBalanceAmount(o.getTotalAmount().subtract(o.getPaidAmount()));
            orderRepository.save(o);
            remaining = remaining.subtract(applied);
        }
        return remaining;
    }

    /** The route an order was actually worked under — falls back to the customer's home route. */
    private UUID resolveRouteId(Order order) {
        if (order == null) return null;
        if (order.getRouteAllocation() != null && order.getRouteAllocation().getRoute() != null) {
            return order.getRouteAllocation().getRoute().getId();
        }
        if (order.getCustomer() != null && order.getCustomer().getRoute() != null) {
            return order.getCustomer().getRoute().getId();
        }
        return null;
    }

    private String resolveRouteName(Order order) {
        if (order == null) return null;
        if (order.getRouteAllocation() != null && order.getRouteAllocation().getRoute() != null) {
            return order.getRouteAllocation().getRoute().getName();
        }
        if (order.getCustomer() != null && order.getCustomer().getRoute() != null) {
            return order.getCustomer().getRoute().getName();
        }
        return null;
    }

    /** All sales returns filed against an order — for showing returns on the order detail. */
    @Transactional(readOnly = true)
    public List<GoodsReturnDtos.GoodsReturnResponse> getReturnsByOrder(UUID orderId, UUID tenantId) {
        return goodsReturnRepository
                .findByTenantIdAndReferenceOrderIdAndTypeOrderByReturnDateDescCreatedAtDesc(
                        tenantId, orderId, GoodsReturn.ReturnType.SALES_RETURN)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public java.util.Map<String, Integer> getReturnedQtyByOrder(UUID orderId, UUID tenantId) {
        List<Object[]> rows = goodsReturnRepository.sumReturnedQtyByOrder(tenantId, orderId, GoodsReturn.ReturnType.SALES_RETURN);
        java.util.Map<String, Integer> result = new java.util.HashMap<>();
        for (Object[] row : rows) {
            result.put(row[0].toString(), ((Number) row[1]).intValue());
        }
        return result;
    }

    /**
     * Settle a pending return.
     *
     * Customer side (SALES_RETURN / OLD_STOCK_RETURN) — cash goes out, recorded as a negative payment.
     *
     * Supplier side (PURCHASE_RETURN / supplier-caused DAMAGE) — the caller must say HOW the supplier
     * settled it, because each route lands somewhere different:
     *   ADJUST_AGAINST_BILL  knocked off what we owe them   → our payable stays reduced
     *   CASH_REFUND          they paid the money back       → payable returns to full, cash in
     *   GOODS_REPLACED       they sent goods of equal value → payable returns to full, stock restored here
     * The payable itself is derived, not stored — see GoodsReturnRepository.sumOpenSupplierCredit*.
     */
    @Transactional
    public GoodsReturnDtos.GoodsReturnResponse processRefund(
            UUID returnId, GoodsReturnDtos.ProcessRefundRequest req, UUID userId, UUID tenantId) {

        GoodsReturn goodsReturn = goodsReturnRepository.findByIdAndTenantId(returnId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("GoodsReturn", returnId.toString()));

        if (goodsReturn.getRefundStatus() != GoodsReturn.RefundStatus.PENDING) {
            throw new BusinessException("This return does not have a pending refund", "INVALID_REFUND_STATUS");
        }

        User processedBy = userRepository.findByIdAndTenantId(userId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        boolean supplierOwed = isSupplierClaim(goodsReturn);
        Instant now = Instant.now();

        GoodsReturn.SettlementMode settlement = null;
        if (supplierOwed) {
            if (req.getSettlementMode() == null || req.getSettlementMode().isBlank()) {
                throw new BusinessException(
                        "Tell us how the supplier settled this — cash refund, adjusted against a bill, or goods replaced",
                        "SETTLEMENT_MODE_REQUIRED");
            }
            try {
                settlement = GoodsReturn.SettlementMode.valueOf(req.getSettlementMode());
            } catch (IllegalArgumentException e) {
                throw new BusinessException(
                        "Invalid settlement mode: " + req.getSettlementMode()
                        + ". Must be CASH_REFUND, ADJUST_AGAINST_BILL, or GOODS_REPLACED",
                        "INVALID_SETTLEMENT_MODE");
            }
        }

        // A payment mode only means something when money actually moved.
        boolean moneyMoved = !supplierOwed || settlement == GoodsReturn.SettlementMode.CASH_REFUND;
        Payment.PaymentMode mode = null;
        if (moneyMoved) {
            if (req.getPaymentMode() == null || req.getPaymentMode().isBlank()) {
                throw new BusinessException("Payment mode is required", "PAYMENT_MODE_REQUIRED");
            }
            try {
                mode = Payment.PaymentMode.valueOf(req.getPaymentMode());
            } catch (IllegalArgumentException e) {
                throw new BusinessException("Invalid payment mode: " + req.getPaymentMode(), "INVALID_PAYMENT_MODE");
            }
        }

        if (goodsReturn.getType() == GoodsReturn.ReturnType.SALES_RETURN
                || goodsReturn.getType() == GoodsReturn.ReturnType.OLD_STOCK_RETURN) {
            // Negative payment = cash going out of the business to the customer.
            // Old-stock returns have no order, so the customer comes off the return itself.
            Customer refundCustomer = goodsReturn.getReferenceOrder() != null
                    ? goodsReturn.getReferenceOrder().getCustomer() : goodsReturn.getCustomer();
            Payment refundPayment = Payment.builder()
                    .tenant(goodsReturn.getTenant())
                    .order(goodsReturn.getReferenceOrder())
                    .customer(refundCustomer)
                    .collectedBy(processedBy)
                    .amount(goodsReturn.getRefundAmount().negate())
                    .paymentMode(mode)
                    .collectionDate(req.getRefundDate())
                    .cleared(true)
                    .clearedAt(now)
                    .submitted(true)
                    .submittedAt(now)
                    .notes("Refund for " + goodsReturn.getReturnNumber() +
                           (req.getNotes() != null && !req.getNotes().isBlank() ? " — " + req.getNotes() : ""))
                    .build();
            paymentRepository.save(refundPayment);
        }

        // Replacement goods arriving is a real stock movement — put them back now.
        if (settlement == GoodsReturn.SettlementMode.GOODS_REPLACED) {
            restockReplacement(goodsReturn, req.getReplacementExpiryDate(), req.getRefundDate(), tenantId);
        }

        goodsReturn.setRefundStatus(GoodsReturn.RefundStatus.PROCESSED);
        goodsReturn.setRefundDate(req.getRefundDate());
        goodsReturn.setRefundMode(moneyMoved ? req.getPaymentMode() : null);
        goodsReturn.setSettlementMode(settlement);
        if (req.getSupplierRefNumber() != null && !req.getSupplierRefNumber().isBlank()) {
            goodsReturn.setSupplierRefNumber(req.getSupplierRefNumber().trim());
        }
        goodsReturn.setRefundProcessedBy(processedBy);
        goodsReturn.setRefundProcessedAt(now);
        goodsReturn.setRefundNotes(req.getNotes());
        GoodsReturn updated = goodsReturnRepository.save(goodsReturn);

        String how = supplierOwed ? settlementLabel(settlement) : "via " + req.getPaymentMode();
        auditService.record(tenantId, "GOODS_RETURN", returnId,
                supplierOwed ? "SUPPLIER_CLAIM_SETTLED" : "REFUND_PROCESSED",
                "₹" + goodsReturn.getRefundAmount().toPlainString() + " " + how
                + " by " + processedBy.getFullName());
        if (!supplierOwed) {
            recordOnOrder(updated, "REFUNDED", "₹" + goodsReturn.getRefundAmount().toPlainString() + " refunded " + how
                    + " for return " + updated.getReturnNumber() + " by " + processedBy.getFullName());
        }

        return toResponse(updated);
    }

    /**
     * Supplier sent goods instead of money. The returned lines come back into stock as a FRESH batch:
     * the originals were FIFO-deducted at filing time and their batches may be closed, and replacement
     * packs carry their own expiry anyway.
     */
    private void restockReplacement(GoodsReturn gr, java.time.LocalDate expiryDate,
                                    java.time.LocalDate receivedDate, UUID tenantId) {
        if (gr.isReplacementRestocked()) {
            throw new BusinessException(
                    "Replacement stock for " + gr.getReturnNumber() + " has already been received",
                    "ALREADY_RESTOCKED");
        }

        String batchDateTag = receivedDate.format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd"));
        int seq = stockBatchRepository.countByTenantAndDate(tenantId, receivedDate) + 1;

        for (GoodsReturnItem item : gr.getItems()) {
            Product product = item.getProduct();

            BigDecimal mrp  = item.getMrp() != null ? item.getMrp() : product.getMrp();
            BigDecimal cost = item.getPurchaseRate() != null ? item.getPurchaseRate() : product.getPurchaseRate();
            if (mrp == null || cost == null) {
                throw new BusinessException(
                        "MRP and purchase rate are required to restock '" + product.getName() + "'",
                        "BATCH_PRICING_REQUIRED");
            }
            BigDecimal pGst = product.getPurchaseGstPercent() != null
                    ? product.getPurchaseGstPercent() : BigDecimal.ZERO;

            StockBatch batch = StockBatch.builder()
                    .tenant(gr.getTenant())
                    .product(product)
                    .batchNumber(String.format("BCH-%s-%03d", batchDateTag, seq++))
                    .mrp(mrp)
                    .purchaseRate(cost)
                    .purchaseGstPercent(pGst)
                    .minSaleRate(item.getMinSaleRate() != null ? item.getMinSaleRate() : product.getMinSaleRate())
                    .maxSaleRate(item.getMaxSaleRate() != null ? item.getMaxSaleRate() : product.getMaxSaleRate())
                    .expiryDate(expiryDate != null ? expiryDate : item.getExpiryDate())
                    .quantityReceived(item.getQuantity())
                    .quantityAvailable(item.getQuantity())
                    .receivedDate(receivedDate)
                    .active(true)
                    .build();
            stockBatchRepository.save(batch);

            Integer newStock = stockBatchRepository.sumAvailableByProduct(tenantId, product.getId());
            product.setStockQuantity(newStock != null ? newStock : 0);
            productRepository.save(product);
        }

        gr.setReplacementRestocked(true);
    }

    private boolean isSupplierClaim(GoodsReturn gr) {
        return gr.getType() == GoodsReturn.ReturnType.PURCHASE_RETURN
                || (gr.getType() == GoodsReturn.ReturnType.DAMAGE && "SUPPLIER".equals(gr.getDamageSource()));
    }

    /**
     * True while this credit is still knocked off what we owe the supplier.
     * Must stay in step with GoodsReturnRepository.OPEN_CREDIT_PREDICATE, which is what actually
     * moves the payable — this method only labels the row for the UI.
     */
    private boolean reducesPayable(GoodsReturn gr) {
        if (!isSupplierClaim(gr)) return false;
        if (gr.getWarehouseStatus() == GoodsReturn.WarehouseStatus.CANCELLED) return false;
        if (gr.getSettlementMode() == GoodsReturn.SettlementMode.ADJUST_AGAINST_BILL) return true;
        return gr.getType() == GoodsReturn.ReturnType.PURCHASE_RETURN && gr.getSettlementMode() == null;
    }

    private String settlementLabel(GoodsReturn.SettlementMode mode) {
        if (mode == null) return "settled";
        return switch (mode) {
            case CASH_REFUND -> "refunded in cash/bank";
            case ADJUST_AGAINST_BILL -> "adjusted against supplier bill";
            case GOODS_REPLACED -> "settled with replacement goods";
        };
    }

    /**
     * Queue a PENDING refund for an order that was cancelled after the customer had already paid.
     * No stock movement here — cancellation already restored stock; this only records the money
     * owed back, so it surfaces in the normal Pending Refunds queue for finance to pay out.
     */
    @Transactional
    public void createCancellationRefund(Order order, BigDecimal amount, UUID userId, UUID tenantId) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) return;
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));
        User createdBy = userRepository.findByIdAndTenantId(userId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        int year = Year.now().getValue();
        int seq = goodsReturnRepository.findMaxReturnSequence(tenantId, "SRN", year) + 1;
        String returnNumber = String.format("SRN-%d-%05d", year, seq);

        GoodsReturn gr = GoodsReturn.builder()
                .tenant(tenant)
                .returnNumber(returnNumber)
                .type(GoodsReturn.ReturnType.SALES_RETURN)
                .referenceOrder(order)
                .returnDate(java.time.LocalDate.now())
                .reason("Refund for cancelled order " + order.getOrderNumber())
                .totalAmount(amount)
                .refundStatus(GoodsReturn.RefundStatus.PENDING)
                .refundAmount(amount)
                .warehouseStatus(GoodsReturn.WarehouseStatus.VERIFIED)
                .createdBy(createdBy)
                .build();
        GoodsReturn saved = goodsReturnRepository.save(gr);
        auditService.record(tenantId, "GOODS_RETURN", saved.getId(), "REFUND_INITIATED",
                "Refund of ₹" + amount.toPlainString() + " queued for cancelled order " + order.getOrderNumber());
        recordOnOrder(saved, "REFUND_INITIATED", "Refund of ₹" + amount.toPlainString()
                + " queued for this cancelled order (" + saved.getReturnNumber() + ")");
    }

    /**
     * Build the printable debit note for a supplier return. Resolved inside a transaction so the
     * PDF writer and the print view never touch a lazy proxy.
     *
     * GST is split into equal CGST/SGST halves, matching how purchases are recorded — an interstate
     * IGST split would need the supplier's state on file, which we do not capture yet.
     */
    @Transactional(readOnly = true)
    public GoodsReturnDtos.DebitNoteResponse getDebitNote(UUID id, UUID tenantId) {
        GoodsReturn gr = goodsReturnRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("GoodsReturn", id.toString()));
        return buildDebitNote(gr);
    }

    private GoodsReturnDtos.DebitNoteResponse buildDebitNote(GoodsReturn gr) {
        if (!isSupplierClaim(gr)) {
            throw new BusinessException(
                    "A debit note applies only to supplier returns and supplier-caused damage",
                    "NOT_A_SUPPLIER_RETURN");
        }

        GoodsReturnDtos.DebitNoteResponse res = new GoodsReturnDtos.DebitNoteResponse();
        res.setId(gr.getId());
        res.setReturnNumber(gr.getReturnNumber());
        res.setReturnDate(gr.getReturnDate());
        res.setType(gr.getType().name());
        res.setReason(gr.getReason());
        res.setSupplierName(gr.getSupplierName());
        res.setSupplierRefNumber(gr.getSupplierRefNumber());
        res.setSettlementMode(gr.getSettlementMode() != null ? gr.getSettlementMode().name() : null);
        res.setRefundStatus(gr.getRefundStatus().name());
        res.setRefundDate(gr.getRefundDate());
        res.setTotalAmount(gr.getTotalAmount());
        res.setCreatedByName(gr.getCreatedBy() != null ? gr.getCreatedBy().getFullName() : null);

        if (gr.getReferencePurchaseEntry() != null) {
            PurchaseEntry pe = gr.getReferencePurchaseEntry();
            res.setAgainstEntryNumber(pe.getEntryNumber());
            res.setAgainstInvoiceNumber(pe.getInvoiceNumber());
            res.setAgainstInvoiceDate(pe.getPurchaseDate());
        }

        Tenant t = gr.getTenant();
        GoodsReturnDtos.CompanyInfo company = new GoodsReturnDtos.CompanyInfo();
        company.setName(t.getName());
        company.setOwnerName(t.getOwnerName());
        company.setPhone(t.getPhone());
        company.setEmail(t.getEmail());
        company.setAddress(t.getAddress());
        company.setCity(t.getCity());
        company.setState(t.getState());
        company.setStateCode(t.getStateCode());
        company.setPinCode(t.getPinCode());
        company.setGstin(t.getGstin());
        company.setFssaiNumber(t.getFssaiNumber());
        company.setLogoUrl(t.getLogoUrl());
        res.setCompany(company);

        BigDecimal totalTaxable = BigDecimal.ZERO;
        BigDecimal totalGst = BigDecimal.ZERO;
        java.util.Map<BigDecimal, GoodsReturnDtos.GstSlab> slabs = new java.util.TreeMap<>();
        List<GoodsReturnDtos.DebitNoteLine> lines = new java.util.ArrayList<>();

        for (GoodsReturnItem it : gr.getItems()) {
            GoodsReturnDtos.DebitNoteLine line = new GoodsReturnDtos.DebitNoteLine();
            line.setProductName(it.getProduct().getName());
            line.setHsnCode(it.getProduct().getHsnCode());
            line.setUnitName(it.getProduct().getUnit());
            line.setBatchNumber(it.getBatchNumber());
            line.setQuantity(it.getQuantity());
            line.setUnitRate(it.getUnitRate());
            line.setTaxableAmount(it.getTaxableAmount());
            line.setGstPercent(it.getGstPercent());
            line.setGstAmount(it.getGstAmount());
            line.setAmount(it.getAmount());
            line.setReason(it.getReason());
            lines.add(line);

            totalTaxable = totalTaxable.add(nz(it.getTaxableAmount()));
            totalGst = totalGst.add(nz(it.getGstAmount()));

            BigDecimal pct = nz(it.getGstPercent());
            GoodsReturnDtos.GstSlab slab = slabs.computeIfAbsent(pct, p -> {
                GoodsReturnDtos.GstSlab s = new GoodsReturnDtos.GstSlab();
                s.setGstPercent(p);
                s.setTaxableAmount(BigDecimal.ZERO);
                s.setCgst(BigDecimal.ZERO);
                s.setSgst(BigDecimal.ZERO);
                s.setTotal(BigDecimal.ZERO);
                return s;
            });
            BigDecimal half = nz(it.getGstAmount()).divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
            slab.setTaxableAmount(slab.getTaxableAmount().add(nz(it.getTaxableAmount())));
            slab.setCgst(slab.getCgst().add(half));
            slab.setSgst(slab.getSgst().add(half));
            slab.setTotal(slab.getTotal().add(nz(it.getGstAmount())));
        }

        res.setLines(lines);
        res.setGstSummary(new java.util.ArrayList<>(slabs.values()));
        res.setTotalTaxable(totalTaxable);
        res.setTotalGst(totalGst);
        return res;
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    // ── Mapping helpers ──────────────────────────────────────────────────────────

    private GoodsReturnDtos.GoodsReturnResponse toResponse(GoodsReturn gr) {
        GoodsReturnDtos.GoodsReturnResponse res = new GoodsReturnDtos.GoodsReturnResponse();
        res.setId(gr.getId());
        res.setReturnNumber(gr.getReturnNumber());
        res.setType(gr.getType().name());
        res.setSupplierName(gr.getSupplierName());

        if (gr.getCustomer() != null) {
            res.setCustomerId(gr.getCustomer().getId());
            res.setCustomerName(gr.getCustomer().getBusinessName());
        } else if (gr.getReferenceOrder() != null && gr.getReferenceOrder().getCustomer() != null) {
            res.setCustomerName(gr.getReferenceOrder().getCustomer().getBusinessName());
        }

        if (gr.getType() == GoodsReturn.ReturnType.OLD_STOCK_RETURN) {
            BigDecimal restock = BigDecimal.ZERO, writeoff = BigDecimal.ZERO;
            for (GoodsReturnItem it : gr.getItems()) {
                if ("EXPIRED".equalsIgnoreCase(it.getItemCondition())) writeoff = writeoff.add(it.getAmount());
                else restock = restock.add(it.getAmount());
            }
            res.setRestockAmount(restock);
            res.setWriteOffAmount(writeoff);
        }

        res.setDamageSource(gr.getDamageSource());
        if (gr.getResponsiblePerson() != null) {
            res.setResponsiblePersonName(gr.getResponsiblePerson().getFullName());
        }
        res.setReturnDate(gr.getReturnDate());
        res.setReason(gr.getReason());
        res.setTotalAmount(gr.getTotalAmount());
        res.setRefundStatus(gr.getRefundStatus().name());
        res.setRefundAmount(gr.getRefundAmount());
        res.setRefundDate(gr.getRefundDate());
        res.setRefundMode(gr.getRefundMode());
        res.setRefundNotes(gr.getRefundNotes());
        res.setSettlementMode(gr.getSettlementMode() != null ? gr.getSettlementMode().name() : null);
        res.setSupplierRefNumber(gr.getSupplierRefNumber());
        res.setReplacementRestocked(gr.isReplacementRestocked());
        res.setReducesPayable(reducesPayable(gr));
        res.setWarehouseStatus(gr.getWarehouseStatus().name());
        res.setVerifiedAt(gr.getVerifiedAt());
        if (gr.getVerifiedBy() != null) {
            GoodsReturnDtos.PersonInfo vb = new GoodsReturnDtos.PersonInfo();
            vb.setId(gr.getVerifiedBy().getId());
            vb.setFullName(gr.getVerifiedBy().getFullName());
            res.setVerifiedBy(vb);
        }
        res.setCancelledAt(gr.getCancelledAt());
        res.setCancellationReason(gr.getCancellationReason());
        if (gr.getCancelledBy() != null) {
            GoodsReturnDtos.PersonInfo cb = new GoodsReturnDtos.PersonInfo();
            cb.setId(gr.getCancelledBy().getId());
            cb.setFullName(gr.getCancelledBy().getFullName());
            res.setCancelledBy(cb);
        }
        res.setCreatedAt(gr.getCreatedAt());

        if (gr.getReferenceOrder() != null) {
            res.setReferenceOrderNumber(gr.getReferenceOrder().getOrderNumber());
            res.setReferenceOrderId(gr.getReferenceOrder().getId());
            if (gr.getReferenceOrder().getCustomer() != null) {
                res.setReferenceOrderCustomerName(gr.getReferenceOrder().getCustomer().getBusinessName());
            }
            if (gr.getReferenceOrder().getRouteAllocation() != null
                    && gr.getReferenceOrder().getRouteAllocation().getRoute() != null) {
                res.setReferenceOrderRouteName(gr.getReferenceOrder().getRouteAllocation().getRoute().getName());
            }
        }

        if (gr.getReferencePurchaseEntry() != null) {
            res.setReferencePurchaseEntryId(gr.getReferencePurchaseEntry().getId());
            res.setReferencePurchaseEntryNumber(gr.getReferencePurchaseEntry().getEntryNumber());
            res.setReferencePurchaseSupplierName(gr.getReferencePurchaseEntry().getSupplierName());
        }

        if (gr.getRefundProcessedBy() != null) {
            GoodsReturnDtos.PersonInfo rp = new GoodsReturnDtos.PersonInfo();
            rp.setId(gr.getRefundProcessedBy().getId());
            rp.setFullName(gr.getRefundProcessedBy().getFullName());
            res.setRefundProcessedBy(rp);
        }

        if (gr.getCreatedBy() != null) {
            GoodsReturnDtos.PersonInfo pi = new GoodsReturnDtos.PersonInfo();
            pi.setId(gr.getCreatedBy().getId());
            pi.setFullName(gr.getCreatedBy().getFullName());
            res.setCreatedBy(pi);
        }

        res.setItems(gr.getItems().stream().map(item -> {
            GoodsReturnDtos.GoodsReturnItemResponse ir = new GoodsReturnDtos.GoodsReturnItemResponse();
            ir.setId(item.getId());
            ir.setProductId(item.getProduct().getId());
            ir.setProductName(item.getProduct().getName());
            ir.setProductBrand(item.getProduct().getBrand());
            ir.setBatchNumber(item.getBatchNumber());
            ir.setQuantity(item.getQuantity());
            ir.setReceivedQty(item.getReceivedQty());
            ir.setDamagedQty(item.getDamagedQty());
            ir.setUnitRate(item.getUnitRate());
            ir.setAmount(item.getAmount());
            ir.setGstPercent(item.getGstPercent());
            ir.setTaxableAmount(item.getTaxableAmount());
            ir.setGstAmount(item.getGstAmount());
            ir.setReason(item.getReason());
            ir.setCondition(item.getItemCondition());
            ir.setExpiryDate(item.getExpiryDate());
            ir.setMrp(item.getMrp());
            ir.setMinSaleRate(item.getMinSaleRate());
            ir.setMaxSaleRate(item.getMaxSaleRate());
            return ir;
        }).collect(Collectors.toList()));

        return res;
    }
}
